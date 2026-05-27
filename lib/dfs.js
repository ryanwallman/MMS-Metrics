const Papa = require("papaparse");
const {
  PITCHER_STATS_BY_TEAM_KEY,
  PITCHER_LEAGUE_AVG,
} = require("../data/pitcherStats2026");

const { getGamelogs2026CsvUrl } = require("./sheetUrls");
const { fetchCsvText } = require("./fetchCsvText");

const DFS_LINEUP_SIZE = 8;
const DFS_SALARY_CAP = 50000;
/** Shown salary for the bottom tier (see DFS_BOTTOM_TIER_PCT). */
const DFS_SALARY_MIN = 5000;
/** Lowest salary for players above the bottom tier (smooth ladder starts here). */
const DFS_SALARY_NON_BOTTOM_MIN = 5100;
const DFS_SALARY_MAX = 12000;
const DFS_SALARY_STEP = 100;
/** Discrete salary tiers from composite score (fewer unique prices). */
const DFS_SALARY_TIERS = 14;
/** Bottom share of the slate pool pinned to DFS_SALARY_MIN (no single “cheapest” player). */
const DFS_BOTTOM_TIER_PCT = 0.2;
/** Internal spread for raw salaries before the bottom-tier floor is applied. */
const DFS_SALARY_INTERNAL_MIN = 3000;

const OFFENSE_SALARY_WEIGHT = 0.8;
const OPP_RUNS_SALARY_WEIGHT = 0.12;
const PITCHER_SALARY_WEIGHT = 0.08;
/** Offense rating blend for DFS salaries when career + 2026 samples both exist. */
const DFS_OFFENSE_RATING_WEIGHT_HISTORICAL = 0.85;
const DFS_OFFENSE_RATING_WEIGHT_2026 = 0.15;

/** DraftKings-style softball scoring (applied when gamelog rows exist). */
const DFS_SCORING = Object.freeze({
  single: 3,
  double: 5,
  triple: 8,
  hr: 10,
  rbi: 2,
  run: 2,
  walk: 2,
});

function safeText(value) {
  return (value || "").toString().trim();
}

function normalizePlayerName(name) {
  let s = safeText(name).toLowerCase().replace(/[.'’]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function roundSalary(n) {
  const stepped = Math.round(n / DFS_SALARY_STEP) * DFS_SALARY_STEP;
  return clamp(stepped, 0, DFS_SALARY_MAX);
}

/**
 * Pin the lowest share of the slate (by raw salary) to DFS_SALARY_MIN, then assign everyone
 * else a smooth ladder from DFS_SALARY_NON_BOTTOM_MIN up to DFS_SALARY_MAX by offense rating.
 */
function applyDfsSalaryPricing(pool, bottomPct = DFS_BOTTOM_TIER_PCT) {
  if (!pool.length) return pool;

  for (const p of pool) {
    p.rawSalary = p.salary;
  }

  const byRaw = pool.slice().sort((a, b) => a.rawSalary - b.rawSalary);
  const bottomCount = Math.max(1, Math.ceil(pool.length * bottomPct));
  const cutoffRaw = byRaw[bottomCount - 1].rawSalary;
  const bottomNorms = new Set();
  for (const p of pool) {
    if (p.rawSalary <= cutoffRaw) {
      bottomNorms.add(p.norm);
      p.salary = DFS_SALARY_MIN;
    }
  }

  const rest = pool
    .filter((p) => !bottomNorms.has(p.norm))
    .sort((a, b) => {
      if (b.offenseRating !== a.offenseRating) return b.offenseRating - a.offenseRating;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

  const minR = DFS_SALARY_NON_BOTTOM_MIN;
  const maxR = DFS_SALARY_MAX;
  const n = rest.length;
  for (let i = 0; i < n; i += 1) {
    const t = n === 1 ? 0 : i / (n - 1);
    const raw = maxR - t * (maxR - minR);
    rest[i].salary = roundSalary(raw);
  }

  for (const p of pool) {
    p.salary = Math.max(roundSalary(p.salary), DFS_SALARY_MIN);
    delete p.rawSalary;
  }
  return pool;
}

/** @deprecated Use applyDfsSalaryPricing */
function applyBottomTierSalaryFloor(pool, pct = DFS_BOTTOM_TIER_PCT) {
  return applyDfsSalaryPricing(pool, pct);
}

/** Every player is at least DFS_SALARY_MIN; no sub-$5k prices. */
function enforceGlobalSalaryFloor(pool) {
  for (const p of pool) {
    p.salary = Math.max(roundSalary(p.salary), DFS_SALARY_MIN);
  }
  return pool;
}

function sortDfsPlayerPool(pool) {
  pool.sort((a, b) => {
    if (b.salary !== a.salary) return b.salary - a.salary;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
  return pool;
}

function captainLastName(captain) {
  const parts = safeText(captain).split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1].toUpperCase() : "";
}

function weekdayFromIso(iso) {
  const [y, m, d] = safeText(iso).split("-").map(Number);
  if (!y || !m || !d) return -1;
  /** Match server.js schedule parsing (local calendar date at midday avoids DST boundary shifts). */
  return new Date(y, m - 1, d, 12, 0, 0).getDay();
}

/**
 * ISO dates used to join the gamelog Google Sheet export for a DFS slate — anchored to the weekly schedule’s
 * Sunday (or Wednesday D-token), then merged with row `_iso` from games so CSV dates align with sheet dates.
 */
function dfsScoringIsoDatesForToken(viewToken, schedulePayload) {
  const v = safeText(viewToken).toUpperCase();
  const out = new Set();

  if (/^W\d+$/.test(v)) {
    const wn = Number(v.slice(1));
    const sunIso = schedulePayload.sundayIsosSorted?.[wn - 1];
    if (sunIso) out.add(safeText(sunIso));
    const chunk = schedulePayload.gamesByIso?.get(sunIso) || [];
    for (const g of chunk) {
      if (g._iso) out.add(safeText(g._iso));
    }
  } else if (/^D\d{8}$/.test(v)) {
    const digits = v.replace(/^D/, "");
    const iso = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    out.add(iso);
    const chunk = schedulePayload.gamesByIso?.get(iso) || [];
    for (const g of chunk) {
      if (g._iso) out.add(safeText(g._iso));
    }
  }

  if (out.size === 0) {
    const games = resolveGamesForViewToken(v, schedulePayload);
    for (const g of games) {
      if (g._iso) out.add(safeText(g._iso));
    }
  }

  return [...out].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

/**
 * Map numeric team id → stats sheet code (AG, JB, …) by majority vote from 2026 stats rows.
 */
function buildTeamCodeById(teams, stats2026ByPlayer) {
  const votes = new Map();
  for (const t of teams) {
    const id = safeText(t.teamId);
    const tally = new Map();
    for (const name of t.players || []) {
      const row = stats2026ByPlayer.get(normalizePlayerName(name));
      const code = row ? safeText(row.Team) : "";
      if (!code) continue;
      tally.set(code, (tally.get(code) || 0) + 1);
    }
    let best = "";
    let bestN = 0;
    for (const [code, n] of tally.entries()) {
      if (n > bestN) {
        best = code;
        bestN = n;
      }
    }
    if (best) votes.set(id, safeText(best).toUpperCase());
  }
  return votes;
}

function buildCodeToTeamId(teamCodeById) {
  const map = new Map();
  for (const [id, code] of teamCodeById.entries()) {
    if (code) map.set(code, id);
  }
  return map;
}

function pitcherForTeamId(teamId, teams) {
  const t = teams.find((x) => safeText(x.teamId) === safeText(teamId));
  if (!t) return null;
  const key = captainLastName(t.captain);
  return PITCHER_STATS_BY_TEAM_KEY[key] || null;
}

/** Human venue string from a schedule game row (server sets `location`; `field` is optional fallback). */
function scheduleVenueFromGame(game) {
  const g = game || {};
  const loc = safeText(g.location);
  if (loc && loc !== "-") return loc;
  return safeText(g.field) || "";
}

function normalizeOffenseRating(rating) {
  return clamp((toNumber(rating) + 2.5) / 5.5, 0, 1);
}

function normalizeRunsAgainst(rag, leagueAvg) {
  if (rag == null || !Number.isFinite(rag)) return 0.5;
  return clamp((rag - (leagueAvg - 3)) / 8, 0, 1);
}

/** Higher BAA / runs per game faced = easier matchup for hitters. */
function normalizePitcherEase(pitcher) {
  if (!pitcher) return 0.5;
  const baaEase = clamp((toNumber(pitcher.baa) - PITCHER_LEAGUE_AVG.baa) / 0.12, 0, 1);
  const runsEase = clamp(
    (toNumber(pitcher.runsPerG) - PITCHER_LEAGUE_AVG.runsPerG) / 6,
    0,
    1
  );
  return 0.55 * baaEase + 0.45 * runsEase;
}

function computeSalaryComposite({
  offenseRating,
  opponentRunsAgainst,
  opponentPitcher,
  leagueAvgRag,
}) {
  const off = normalizeOffenseRating(offenseRating);
  const opp = normalizeRunsAgainst(opponentRunsAgainst, leagueAvgRag);
  const pit = normalizePitcherEase(opponentPitcher);
  return (
    OFFENSE_SALARY_WEIGHT * off + OPP_RUNS_SALARY_WEIGHT * opp + PITCHER_SALARY_WEIGHT * pit
  );
}

/** Snap composite to a small set of tiers so salaries are not overly granular. */
function quantizeSalaryComposite(composite) {
  const c = clamp(composite, 0, 1);
  const tiers = Math.max(2, DFS_SALARY_TIERS);
  const tier = Math.round(c * (tiers - 1));
  return tier / (tiers - 1);
}

function salaryFromComposite(composite) {
  const q = quantizeSalaryComposite(composite);
  const raw = DFS_SALARY_INTERNAL_MIN + q * (DFS_SALARY_MAX - DFS_SALARY_INTERNAL_MIN);
  return roundSalary(raw);
}

function computePlayerSalary({ offenseRating, opponentRunsAgainst, opponentPitcher, leagueAvgRag }) {
  const composite = computeSalaryComposite({
    offenseRating,
    opponentRunsAgainst,
    opponentPitcher,
    leagueAvgRag,
  });
  return salaryFromComposite(composite);
}

/**
 * Players with very similar offensive ratings get the same salary (median within each band).
 */
function applyOffenseRatingSalaryBands(pool, bandWidth = DFS_OFFENSE_RATING_BAND) {
  if (!pool.length || bandWidth <= 0) return pool;
  const groups = new Map();
  for (const p of pool) {
    const band = Math.round(toNumber(p.offenseRating) / bandWidth) * bandWidth;
    const key = String(Math.round(band * 100) / 100);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  for (const group of groups.values()) {
    const salaries = group.map((p) => p.salary).sort((a, b) => a - b);
    const mid = salaries[Math.floor(salaries.length / 2)];
    const unified = roundSalary(mid);
    for (const p of group) p.salary = unified;
  }
  return pool;
}

/**
 * Closest upcoming DFS slate from schedule payload (reuses site schedule view logic).
 */
function resolveUpcomingDfsSlate(referenceIso, schedulePayload, pickDefaultViewFn) {
  const viewToken = pickDefaultViewFn(referenceIso, schedulePayload);
  if (!viewToken) {
    return {
      viewToken: "",
      slateType: null,
      games: [],
      teamIds: new Set(),
      isoDates: [],
      label: "No upcoming slate on the schedule.",
      isPast: false,
    };
  }

  const games = resolveGamesForViewToken(viewToken, schedulePayload);
  const teamIds = new Set();
  const isoDates = new Set();
  for (const g of games) {
    if (g.awayTeamId) teamIds.add(safeText(g.awayTeamId));
    if (g.homeTeamId) teamIds.add(safeText(g.homeTeamId));
    if (g._iso) isoDates.add(safeText(g._iso));
  }
  for (const iso of dfsScoringIsoDatesForToken(viewToken, schedulePayload)) {
    isoDates.add(iso);
  }

  const isWeek = /^W\d+$/i.test(viewToken);
  const slateType = isWeek ? "sunday" : "wednesday";
  const wn = isWeek ? Number(viewToken.slice(1)) : null;
  const sunIso = isWeek ? schedulePayload.sundayIsosSorted[wn - 1] : null;
  const firstIso = isWeek ? sunIso : [...isoDates][0];
  const ref = safeText(referenceIso);
  const isPast = firstIso && ref && firstIso < ref;

  let label = schedulePayload.dateLabelByIso?.get?.(firstIso) || firstIso || viewToken;
  if (isWeek) {
    label = `Week ${wn} — ${label} (full slate, ${teamIds.size} teams)`;
  } else {
    label = `${label} — Wednesday (${teamIds.size} teams, ${games.length} games)`;
  }

  return {
    viewToken,
    slateType,
    games,
    teamIds,
    isoDates: [...isoDates].sort((a, b) => a.localeCompare(b)),
    label,
    isPast,
    weekNumber: wn,
  };
}

function slateFirstIso(viewToken, schedulePayload) {
  const v = safeText(viewToken).toUpperCase();
  if (/^W\d+$/.test(v)) {
    const wn = Number(v.slice(1));
    return schedulePayload.sundayIsosSorted?.[wn - 1] || null;
  }
  if (/^D\d{8}$/.test(v)) {
    const digits = v.replace(/^D/, "");
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return null;
}

/** YYYY-MM-DD in America/New_York for instant `ms`. */
function nyCalendarIsoDate(ms) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (t) => parts.find((p) => p.type === t)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Numeric sort key YYYYMMDD for Eastern calendar date at `ms`. */
function nyCalendarDayNumber(ms) {
  const iso = nyCalendarIsoDate(ms);
  const [y, m, d] = iso.split("-").map(Number);
  return y * 10000 + m * 100 + d;
}

/**
 * First UTC ms where the Eastern calendar reads `isoDate` (YYYY-MM-DD).
 * Used so lineup lock = start of game day minus 1 ms (= end of prior Eastern day).
 */
function startOfNyCalendarDayUtcMs(isoDate) {
  const [y, mo, da] = safeText(isoDate).split("-").map(Number);
  if (!y || !mo || !da) return NaN;
  const target = y * 10000 + mo * 100 + da;
  let lo = Date.UTC(y, mo - 1, da - 1, 12, 0, 0, 0);
  let hi = Date.UTC(y, mo - 1, da + 1, 12, 0, 0, 0);
  while (nyCalendarDayNumber(lo) >= target) lo -= 3600000;
  while (nyCalendarDayNumber(hi) < target) hi += 3600000;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (nyCalendarDayNumber(mid) >= target) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Lineup edits allowed through end of Eastern day before game day (= instant before game-day midnight ET). */
function lineupLockDeadlineMsFromFirstGameIso(firstIso) {
  const iso = safeText(firstIso);
  if (!iso) return null;
  const gameDayStartMs = startOfNyCalendarDayUtcMs(iso);
  if (!Number.isFinite(gameDayStartMs)) return null;
  return gameDayStartMs - 1;
}

/** UTC instant when Eastern wall clock reads `isoDate` at `hour24`:`minute` (local). */
function instantAtNyLocalTime(isoDate, hour24, minute = 0) {
  const iso = safeText(isoDate);
  if (!iso) return NaN;
  const [y, mo, da] = iso.split("-").map(Number);
  if (!y || !mo || !da) return NaN;
  const targetDay = y * 10000 + mo * 100 + da;
  const targetMins = hour24 * 60 + minute;

  function nyDayAndMinutes(ms) {
    const dayNum = nyCalendarDayNumber(ms);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(new Date(ms));
    const h = Number(parts.find((p) => p.type === "hour")?.value || 0);
    const m = Number(parts.find((p) => p.type === "minute")?.value || 0);
    return { dayNum, mins: h * 60 + m };
  }

  let lo = Date.UTC(y, mo - 1, da - 1, 12, 0, 0, 0);
  let hi = Date.UTC(y, mo - 1, da + 1, 12, 0, 0, 0);
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const { dayNum, mins } = nyDayAndMinutes(mid);
    if (dayNum < targetDay || (dayNum === targetDay && mins < targetMins)) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** Sunday week slates: lock 11:59 PM ET the night before games. Wednesday: lock 8:00 PM ET on game day. */
function lineupLockDeadlineMsForSlate(viewToken, firstIso) {
  const v = safeText(viewToken).toUpperCase();
  const iso = safeText(firstIso);
  if (!iso) return null;
  if (/^D\d{8}$/.test(v)) {
    const atEightPm = instantAtNyLocalTime(iso, 20, 0);
    return Number.isFinite(atEightPm) ? atEightPm - 1 : null;
  }
  return lineupLockDeadlineMsFromFirstGameIso(iso);
}

function formatLineupLockDeadlineEst(lockMs, viewToken) {
  if (lockMs == null || !Number.isFinite(lockMs)) return "";
  const v = safeText(viewToken).toUpperCase();
  const displayMs =
    /^D\d{8}$/.test(v) ? lockMs + 1 : lockMs;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(displayMs));
}

/**
 * Lineup lock instant for the countdown (open slate first, then soonest future deadline).
 * @param {object} [slate] — built slate for the current page (optional)
 */
function resolveNextLineupLockDeadline(slateOptions, slate, nowMs = Date.now()) {
  if (typeof slate === "number" && Number.isFinite(slate)) {
    nowMs = slate;
    slate = null;
  }

  const options = slateOptions || [];
  const editable = options.find((o) => o.canEdit);

  let deadlineMs = null;
  if (editable?.lineupLockDeadlineMs != null && Number.isFinite(editable.lineupLockDeadlineMs)) {
    deadlineMs = editable.lineupLockDeadlineMs;
  } else if (
    slate?.canEdit &&
    slate.lineupLockDeadlineMs != null &&
    Number.isFinite(slate.lineupLockDeadlineMs)
  ) {
    deadlineMs = slate.lineupLockDeadlineMs;
  } else {
    deadlineMs =
      options
        .map((o) => o.lineupLockDeadlineMs)
        .filter((ms) => ms != null && Number.isFinite(ms) && ms > nowMs)
        .sort((a, b) => a - b)[0] ?? null;
  }

  if (deadlineMs == null || !Number.isFinite(deadlineMs)) {
    return { deadlineMs: null, deadlineLabel: "" };
  }

  return {
    deadlineMs,
    deadlineLabel: formatLineupLockDeadlineEst(
      deadlineMs,
      editable?.value || slate?.viewToken || ""
    ),
  };
}

/**
 * Chronological DFS slates. Users see past slates + at most one future slate (currently editable).
 * Sunday slates lock 11:59 PM ET the night before games; Wednesday slates lock 8:00 PM ET on game day.
 */
function buildDfsSlateOptions(schedulePayload, refIso, nowMs = Date.now()) {
  const raw = (schedulePayload.scheduleOptions || []).filter((o) =>
    /^(W\d+|D\d{8})$/i.test(o.value)
  );

  const enriched = raw.map((o) => {
    const value = safeText(o.value).toUpperCase();
    const firstIso = slateFirstIso(value, schedulePayload);
    const lineupLockDeadlineMs = lineupLockDeadlineMsForSlate(value, firstIso);
    const deadlinePassed =
      lineupLockDeadlineMs != null ? nowMs > lineupLockDeadlineMs : true;

    return {
      value,
      label: o.label,
      firstIso,
      lineupLockDeadlineMs,
      lineupDeadlinePassed: deadlinePassed,
      /** Calendar “today” vs game day — informational only */
      gameDayPassedByCalendar:
        !!(firstIso && safeText(refIso) && firstIso < safeText(refIso)),
      slateKind: /^W\d+$/.test(value) ? "week" : "wednesday",
    };
  });

  let activeEditableIndex = -1;
  for (let i = 0; i < enriched.length; i += 1) {
    const d = enriched[i].lineupLockDeadlineMs;
    if (d != null && nowMs <= d) {
      activeEditableIndex = i;
      break;
    }
  }

  return enriched.map((o, i) => {
    const canEdit = activeEditableIndex >= 0 && i === activeEditableIndex;
    const isVisibleInPicker = activeEditableIndex < 0 ? true : i <= activeEditableIndex;

    return {
      ...o,
      activeEditableIndex,
      canEdit,
      isPast: o.lineupDeadlinePassed,
      isActive: canEdit,
      isFuture: false,
      isViewOnly: !canEdit,
      isLocked: false,
      isVisibleInPicker,
      lineupLockDeadlineLabel: formatLineupLockDeadlineEst(o.lineupLockDeadlineMs, o.value),
    };
  });
}

function filterVisibleDfsSlateOptions(options) {
  return (options || []).filter((o) => o.isVisibleInPicker);
}

function resolveActiveDfsSlateToken(schedulePayload, refIso, nowMs = Date.now()) {
  return (
    buildDfsSlateOptions(schedulePayload, refIso, nowMs).find((o) => o.canEdit)?.value || null
  );
}

function buildSlateFromToken(viewToken, schedulePayload, refIso, slateOptions, nowMs = Date.now()) {
  const v = safeText(viewToken).toUpperCase();
  if (!v) return null;

  const opt = (slateOptions || []).find((o) => o.value === v);
  const games = resolveGamesForViewToken(v, schedulePayload);
  const teamIds = new Set();
  const isoDates = new Set();
  for (const g of games) {
    if (g.awayTeamId) teamIds.add(safeText(g.awayTeamId));
    if (g.homeTeamId) teamIds.add(safeText(g.homeTeamId));
    if (g._iso) isoDates.add(safeText(g._iso));
  }
  for (const iso of dfsScoringIsoDatesForToken(v, schedulePayload)) {
    isoDates.add(iso);
  }

  const isWeek = /^W\d+$/.test(v);
  const wn = isWeek ? Number(v.slice(1)) : null;
  const firstIso = slateFirstIso(v, schedulePayload) || [...isoDates][0] || null;
  const ref = safeText(refIso);
  const lineupLockDeadlineMs = lineupLockDeadlineMsForSlate(v, firstIso);
  const lineupDeadlinePassedFallback =
    lineupLockDeadlineMs != null ? nowMs > lineupLockDeadlineMs : true;
  const gameDayPassedByCalendar = !!(firstIso && ref && firstIso < ref);

  let label = schedulePayload.dateLabelByIso?.get?.(firstIso) || firstIso || v;
  if (isWeek) {
    label = `Week ${wn} — ${label} (full slate, ${teamIds.size} teams)`;
  } else if (/^D\d{8}$/.test(v)) {
    label = `${label} — Wednesday (${teamIds.size} teams, ${games.length} games)`;
  }

  const canEdit = opt?.canEdit ?? false;

  return {
    viewToken: v,
    slateType: isWeek ? "sunday" : "wednesday",
    games,
    teamIds,
    isoDates: [...isoDates].sort((a, b) => a.localeCompare(b)),
    label: opt?.label || label,
    firstIso,
    lineupLockDeadlineMs: opt?.lineupLockDeadlineMs ?? lineupLockDeadlineMs,
    lineupLockDeadlineLabel:
      opt?.lineupLockDeadlineLabel ?? formatLineupLockDeadlineEst(lineupLockDeadlineMs, v),
    lineupDeadlinePassed: opt?.lineupDeadlinePassed ?? lineupDeadlinePassedFallback,
    /** Legacy field: locked after lineup deadline (not necessarily gamelog-complete). */
    isPast: opt?.isPast ?? lineupDeadlinePassedFallback,
    gameDayPassedByCalendar,
    weekNumber: wn,
    canEdit,
    isViewOnly: opt?.isViewOnly ?? !canEdit,
    isFuture: opt?.isFuture ?? false,
    isLocked: opt?.isLocked ?? false,
    isActive: opt?.isActive ?? false,
  };
}

function resolveGamesForViewToken(viewToken, payload) {
  const v = safeText(viewToken);
  if (/^W\d+$/i.test(v)) {
    const wn = Number(v.slice(1));
    const sunIso = payload.sundayIsosSorted[wn - 1];
    const chunk = payload.gamesByIso.get(sunIso) || [];
    return chunk.map(({ _iso, ...rest }) => ({ ...rest, _iso }));
  }
  if (/^D\d{8}$/i.test(v)) {
    const digits = v.toUpperCase().replace(/^D/, "");
    const iso = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    if (weekdayFromIso(iso) !== 3) return [];
    const chunk = payload.gamesByIso.get(iso) || [];
    return chunk.map(({ _iso, ...rest }) => ({ ...rest, _iso }));
  }
  return [];
}

function buildDfsPlayerPool({
  teams,
  slate,
  offenseRatingByNorm,
  scheduleRunRates,
  stats2026ByPlayer,
  teamCodeById,
}) {
  const teamIds = slate.teamIds;
  if (!teamIds.size) return [];

  const ragValues = [];
  for (const [, rr] of scheduleRunRates || []) {
    if (rr?.runsAgainstPerGame != null && Number.isFinite(rr.runsAgainstPerGame)) {
      ragValues.push(rr.runsAgainstPerGame);
    }
  }
  const leagueAvgRag =
    ragValues.length > 0 ? ragValues.reduce((a, b) => a + b, 0) / ragValues.length : 12;

  const venueByTeam = new Map();
  for (const g of slate.games) {
    const label = scheduleVenueFromGame(g);
    if (!label) continue;
    for (const tid of [safeText(g.awayTeamId), safeText(g.homeTeamId)]) {
      if (!tid) continue;
      if (!venueByTeam.has(tid)) venueByTeam.set(tid, new Set());
      venueByTeam.get(tid).add(label);
    }
  }

  const matchupByTeam = new Map();
  for (const g of slate.games) {
    const awayId = safeText(g.awayTeamId);
    const homeId = safeText(g.homeTeamId);
    matchupByTeam.set(awayId, { opponentId: homeId, side: "away", game: g });
    matchupByTeam.set(homeId, { opponentId: awayId, side: "home", game: g });
  }

  const pool = [];

  for (const t of teams) {
    const tid = safeText(t.teamId);
    if (!teamIds.has(tid)) continue;

    const match = matchupByTeam.get(tid);
    const oppId = match?.opponentId || "";
    const oppRates = scheduleRunRates?.get?.(oppId);
    const oppPitcher = pitcherForTeamId(oppId, teams);
    const oppTeam = teams.find((x) => safeText(x.teamId) === oppId);
    const teamCode = teamCodeById.get(tid) || "";

    const venueSet = venueByTeam.get(tid);
    const venueJoined =
      venueSet && venueSet.size ? [...venueSet].join(" · ") : scheduleVenueFromGame(match?.game);

    for (const playerName of t.players || []) {
      const norm = normalizePlayerName(playerName);
      const rating = offenseRatingByNorm.get(norm) ?? 0;
      const row26 = stats2026ByPlayer.get(norm);
      const salary = computePlayerSalary({
        offenseRating: rating,
        opponentRunsAgainst: oppRates?.runsAgainstPerGame ?? null,
        opponentPitcher: oppPitcher,
        leagueAvgRag,
      });

      pool.push({
        norm,
        name: playerName,
        teamId: tid,
        teamName: t.teamName,
        teamCode,
        offenseRating: Math.round(rating * 100) / 100,
        salary, // raw; bottom tier adjusted below
        opponentId: oppId,
        opponentName: oppTeam?.teamName || `Team ${oppId}`,
        opponentRunsAgainst: oppRates?.runsAgainstPerGame ?? null,
        opposingPitcher: oppPitcher?.primaryPitcher || "—",
        pitcherBaa: oppPitcher?.baa ?? null,
        pitcherRunsG: oppPitcher?.runsPerG ?? null,
        pa2026: row26 ? toNumber(row26.PA) : 0,
        gameField: venueJoined || "—",
        gameLabel: match?.game
          ? `${match.game.away} @ ${match.game.home}`
          : "",
      });
    }
  }

  applyDfsSalaryPricing(pool);
  sortDfsPlayerPool(pool);
  return pool;
}

/**
 * Gamelog export is US-style month/day/year only, e.g. 4/26/2026 (fixed export shape).
 * Allows optional spaces around slashes, quoted cells, BOM, and NBSP/thin-space characters.
 */
function parseGamelogDateCell(cell) {
  let s = safeText(cell).replace(/^\ufeff/g, "");
  if (!s) return null;
  s = s.replace(/[\u00a0\u202f]/g, " ").trim().replace(/^["']+|["']+$/g, "");
  const m = /(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/.exec(s);
  if (!m) return null;
  const month = String(m[1]).padStart(2, "0");
  const day = String(m[2]).padStart(2, "0");
  return `${m[3]}-${month}-${day}`;
}

async function load2026GamelogsByPlayer() {
  try {
    let text = await fetchCsvText(getGamelogs2026CsvUrl());
    const parsed = Papa.parse(text, { skipEmptyLines: true });
    const rows = parsed.data || [];
    if (rows.length < 3) return { byNorm: new Map(), bySlateKey: new Map(), gameIsos: new Set() };

    const headerRow = rows.find(
      (r) => safeText(r[0]).replace(/^\ufeff/, "") === "Team" && safeText(r[1]) === "Date"
    );
    if (!headerRow) return { byNorm: new Map(), bySlateKey: new Map(), gameIsos: new Set() };

    const headerIdx = rows.indexOf(headerRow);
    const h = headerRow.map((x) => safeText(x));
    const col = (name) => h.indexOf(name);

    const byNorm = new Map();
    const bySlateKey = new Map();
    const gameIsos = new Set();

    for (let i = headerIdx + 1; i < rows.length; i += 1) {
      const row = rows[i];
      const teamCode = safeText(row[col("Team")]).toUpperCase();
      const iso = parseGamelogDateCell(row[col("Date")]);
      const player = safeText(row[col("Player")]);
      if (!teamCode || !iso || !player) continue;

      gameIsos.add(iso);

      const norm = normalizePlayerName(player);
      const entry = {
        teamCode,
        iso,
        opponentCode: safeText(row[col("Opponent ID")]),
        gameId: safeText(row[col("Game ID")]),
        pa: toNumber(row[col("PA")]),
        ab: toNumber(row[col("AB")]),
        hits: toNumber(row[col("Hits")]),
        runs: toNumber(row[col("Runs")]),
        rbi: toNumber(row[col("RBI")]),
        bb: toNumber(row[col("BB")]),
        singles: toNumber(row[col("1B")]),
        doubles: toNumber(row[col("2B")]),
        triples: toNumber(row[col("3B")]),
        hr: toNumber(row[col("HR")]),
        tb: toNumber(row[col("TB")]),
      };
      entry.points = fantasyPointsFromLog(entry);

      if (!byNorm.has(norm)) byNorm.set(norm, []);
      byNorm.get(norm).push(entry);

      const slateKey = `${iso}|${teamCode}`;
      if (!bySlateKey.has(slateKey)) bySlateKey.set(slateKey, []);
      bySlateKey.get(slateKey).push({ norm, ...entry });
    }

    return { byNorm, bySlateKey, gameIsos };
  } catch {
    return { byNorm: new Map(), bySlateKey: new Map(), gameIsos: new Set() };
  }
}

/** True when the gamelog sheet has at least one row dated on any of this slate’s ISO game dates. */
function slateHasGamelogDates(slate, gamelogs) {
  const dates = gamelogs?.gameIsos;
  if (!(dates instanceof Set) || dates.size === 0) return false;
  const slateDates = slate?.isoDates;
  if (!Array.isArray(slateDates) || !slateDates.length) return false;
  return slateDates.some((iso) => dates.has(iso));
}

function fantasyPointsFromLog(log) {
  const s = DFS_SCORING;
  return (
    log.singles * s.single +
    log.doubles * s.double +
    log.triples * s.triple +
    log.hr * s.hr +
    log.rbi * s.rbi +
    log.runs * s.run +
    log.bb * s.walk
  );
}

function scoreLineupForSlate(lineupNorms, poolByNorm, slate, teamCodeById, gamelogs) {
  const isoSet = new Set(slate.isoDates || []);
  let total = 0;
  const breakdown = [];

  for (const norm of lineupNorms) {
    const p = poolByNorm.get(norm);
    const logs = gamelogs.byNorm.get(norm) || [];
    const code = safeText(p?.teamCode).toUpperCase();
    const relevant = logs.filter(
      (l) => isoSet.has(l.iso) && safeText(l.teamCode).toUpperCase() === code
    );
    const pts = relevant.reduce((sum, l) => sum + l.points, 0);
    total += pts;
    breakdown.push({
      norm,
      name: p?.name || norm,
      points: Math.round(pts * 10) / 10,
      games: relevant.length,
    });
  }

  return { total: Math.round(total * 10) / 10, breakdown };
}

/**
 * Prior numbered week slate (W1, W2, …) for “last week” preview.
 * Wednesday-only slates (D########) are ignored — never used as current or previous week.
 */
function resolvePreviousDfsSlate(currentViewToken, schedulePayload) {
  const v = safeText(currentViewToken).toUpperCase();
  if (!/^W\d+$/.test(v)) return null;

  const weekOptions = (schedulePayload.scheduleOptions || []).filter((o) =>
    /^W\d+$/i.test(o.value)
  );
  const ix = weekOptions.findIndex((o) => o.value.toUpperCase() === v);
  if (ix <= 0) return null;

  const prev = weekOptions[ix - 1];
  const games = resolveGamesForViewToken(prev.value, schedulePayload);
  const isoDates = dfsScoringIsoDatesForToken(prev.value, schedulePayload);

  const wn = Number(prev.value.slice(1));
  return {
    viewToken: prev.value,
    label: prev.label || `Week ${wn}`,
    weekNumber: wn,
    isoDates,
    games,
  };
}

/** Fantasy points per player for a slate’s game dates (from the gamelog Google Sheet export). */
function buildSlatePointsByNorm(playerPool, slate, gamelogs) {
  if (!slate?.isoDates?.length) {
    return { byNorm: {}, hasStats: false };
  }
  const isoSet = new Set(slate.isoDates);
  const byNorm = {};
  let hasStats = false;

  for (const p of playerPool) {
    const code = safeText(p.teamCode).toUpperCase();
    const logs = (gamelogs.byNorm.get(p.norm) || []).filter(
      (l) => isoSet.has(l.iso) && safeText(l.teamCode).toUpperCase() === code
    );
    const pts = logs.reduce((sum, l) => sum + l.points, 0);
    if (logs.length) hasStats = true;
    byNorm[p.norm] = {
      name: p.name,
      points: Math.round(pts * 10) / 10,
      games: logs.length,
    };
  }

  return { byNorm, hasStats };
}

/** Fantasy points per player on the previous numbered week (Sunday slate dates only). */
function buildLastWeekPointsByNorm(playerPool, prevSlate, gamelogs) {
  return buildSlatePointsByNorm(playerPool, prevSlate, gamelogs);
}

function scoreLineupFromPointsMap(lineupNorms, poolByNorm, pointsByNorm) {
  let total = 0;
  const breakdown = [];

  for (const norm of lineupNorms) {
    const p = poolByNorm.get(norm);
    const row = pointsByNorm[norm] || { points: 0, games: 0, name: "" };
    total += row.points;
    breakdown.push({
      norm,
      name: p?.name || row.name || norm,
      points: row.points,
      games: row.games,
    });
  }

  return { total: Math.round(total * 10) / 10, breakdown };
}

function referenceIsoForScheduleYear(calendarYear) {
  const now = new Date();
  const y = calendarYear || now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Numbered Sunday week slates (W1, W2, …) for leaderboard week picker. */
function listWeekSlateOptions(schedulePayload, refIso) {
  return (schedulePayload.scheduleOptions || [])
    .filter((o) => /^W\d+$/i.test(o.value))
    .map((o) => {
      const value = safeText(o.value).toUpperCase();
      const weekNumber = Number(value.slice(1));
      const sunIso = schedulePayload.sundayIsosSorted[weekNumber - 1];
      const isPast = !!(sunIso && refIso && sunIso < refIso);
      return {
        value,
        label: o.label || `Week ${weekNumber}`,
        weekNumber,
        sunIso: sunIso || null,
        isPast,
      };
    });
}

/** Default leaderboard week: latest Sunday slate whose date is before today. */
function defaultLeaderboardWeek(weekOptions) {
  const past = (weekOptions || []).filter((w) => w.isPast);
  if (past.length) return past[past.length - 1].value;
  const all = weekOptions || [];
  return all.length ? all[all.length - 1].value : "";
}

function buildWeekSlateFromToken(viewToken, schedulePayload, refIso) {
  const v = safeText(viewToken).toUpperCase();
  if (!/^W\d+$/.test(v)) return null;

  const games = resolveGamesForViewToken(v, schedulePayload);
  const teamIds = new Set();
  const isoDates = new Set();
  for (const g of games) {
    if (g.awayTeamId) teamIds.add(safeText(g.awayTeamId));
    if (g.homeTeamId) teamIds.add(safeText(g.homeTeamId));
    if (g._iso) isoDates.add(safeText(g._iso));
  }
  for (const iso of dfsScoringIsoDatesForToken(v, schedulePayload)) {
    isoDates.add(iso);
  }

  const weekNumber = Number(v.slice(1));
  const firstIso = schedulePayload.sundayIsosSorted[weekNumber - 1];
  const opt = (schedulePayload.scheduleOptions || []).find(
    (o) => safeText(o.value).toUpperCase() === v
  );

  return {
    viewToken: v,
    slateType: "sunday",
    games,
    teamIds,
    isoDates: [...isoDates].sort((a, b) => a.localeCompare(b)),
    label: opt?.label || `Week ${weekNumber}`,
    isPast: !!(firstIso && refIso && firstIso < refIso),
    weekNumber,
  };
}

/** Same slate object as the DFS lineup builder (pool + scoring stay in sync). */
function buildLeaderboardSlateFromToken(
  viewToken,
  schedulePayload,
  refIso,
  nowMs = Date.now()
) {
  const v = safeText(viewToken).toUpperCase();
  if (!/^(W\d+|D\d{8})$/i.test(v)) return null;
  const slateOptions = buildDfsSlateOptions(schedulePayload, refIso, nowMs);
  return buildSlateFromToken(v, schedulePayload, refIso, slateOptions, nowMs);
}

/** Sunday weeks and Wednesday slates (chronological) for the leaderboard picker and season total. */
function listLeaderboardSlateOptions(schedulePayload, refIso, nowMs = Date.now()) {
  return (schedulePayload.scheduleOptions || [])
    .filter((o) => /^(W\d+|D\d{8})$/i.test(o.value))
    .map((o) => {
      const value = safeText(o.value).toUpperCase();
      const isWeek = /^W\d+$/.test(value);
      const weekNumber = isWeek ? Number(value.slice(1)) : null;
      const sunIso = isWeek
        ? schedulePayload.sundayIsosSorted?.[weekNumber - 1] || null
        : null;
      const slate = buildLeaderboardSlateFromToken(value, schedulePayload, refIso, nowMs);
      return {
        value,
        label: o.label || slate?.label || value,
        weekNumber,
        sunIso,
        firstIso: slateFirstIso(value, schedulePayload),
        isPast: !!(slate && slate.isPast),
        slateKind: isWeek ? "week" : "wednesday",
      };
    });
}

module.exports = {
  DFS_LINEUP_SIZE,
  DFS_SALARY_CAP,
  DFS_SCORING,
  OFFENSE_SALARY_WEIGHT,
  OPP_RUNS_SALARY_WEIGHT,
  PITCHER_SALARY_WEIGHT,
  DFS_OFFENSE_RATING_WEIGHT_HISTORICAL,
  DFS_OFFENSE_RATING_WEIGHT_2026,
  buildTeamCodeById,
  buildCodeToTeamId,
  resolveUpcomingDfsSlate,
  resolvePreviousDfsSlate,
  resolveGamesForViewToken,
  buildDfsPlayerPool,
  load2026GamelogsByPlayer,
  buildSlatePointsByNorm,
  buildLastWeekPointsByNorm,
  scoreLineupForSlate,
  scoreLineupFromPointsMap,
  referenceIsoForScheduleYear,
  listWeekSlateOptions,
  listLeaderboardSlateOptions,
  defaultLeaderboardWeek,
  buildWeekSlateFromToken,
  buildLeaderboardSlateFromToken,
  slateFirstIso,
  buildDfsSlateOptions,
  filterVisibleDfsSlateOptions,
  resolveActiveDfsSlateToken,
  resolveNextLineupLockDeadline,
  buildSlateFromToken,
  computePlayerSalary,
  computeSalaryComposite,
  applyDfsSalaryPricing,
  applyOffenseRatingSalaryBands,
  DFS_SALARY_MIN,
  DFS_SALARY_NON_BOTTOM_MIN,
  DFS_BOTTOM_TIER_PCT,
  captainLastName,
  slateHasGamelogDates,
  normalizePlayerName,
};
