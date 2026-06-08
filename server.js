require("dotenv").config();

const express = require("express");
const Papa = require("papaparse");
const fs = require("fs/promises");
const path = require("path");
const { getFirebaseClientConfig } = require("./lib/firebaseClientConfig");
const { matchupSlugToKey } = require("./lib/matchupSlug");
const {
  normalizeMatchupPredictorMode,
  matchupPredictorModeLabel,
  matchupPredictorBasePath,
  matchupPredictorViewPath,
} = require("./lib/matchupPredictorMode");
const { buildWeeklyLeaderboardResponse } = require("./lib/dfsLeaderboardResponse");
const {
  getCachedDfsLeaderboardScoringContext,
  loadWeeklySchedule,
  setNodeCareerReader,
} = require("./lib/dfsLeaderboardScoringContext");
const fsPromises = require("fs/promises");

setNodeCareerReader((filePath) => fsPromises.readFile(filePath, "utf8"));
const { fetchCsvText } = require("./lib/fetchCsvText");
const { publicErrorMessage } = require("./lib/publicErrorMessage");
const { load2026StatsByPlayer } = require("./lib/stats2026Loader");
const { buildLeagueLeaders } = require("./lib/leagueLeaders");
const { createMemoryCache } = require("./lib/memoryCache");
const { getAdminFirestore, isFirebaseAdminConfigured } = require("./lib/firebaseAdmin");
const {
  buildWeeklyLeaderboardFromLineups,
  buildLineupDetailView,
  fetchLineupsForSlate,
  fetchLineupByUserAndSlate,
  slateSummaryForClient,
} = require("./lib/dfsLeaderboard");
const {
  loadTeamRosters,
  pickRosterEntry,
  buildNameToTeamIdMap,
  buildRosterByTeamId,
} = require("./lib/teamRosters");
const {
  loadPowerRankingsCaptainMap,
  loadCaptainTeamCodeById,
  lookupPowerRankingsCaptain,
} = require("./lib/powerRankingsCaptains");
const { buildPowerRankingsPageData } = require("./lib/powerRankingsPageData");
const { careerIncludes2025Set } = require("./data/careerIncludes2025Names");
const {
  parseMissingNorms,
  serializeMissingNorms,
  enrichRosterForMatchupView,
  applyMissingPlayersToProfile,
  applyCriticalRosterWinCap,
  applyCriticalRosterRunProjection,
} = require("./lib/matchupMissingPlayers");
const {
  leagueRunScoringBaseline,
  buildTeamScheduleRunRates,
  buildDefenseZByNorm,
  buildTeamMatchupProfiles,
  buildMatchupLeagueNorms,
  predictMatchupGame,
  predictSeasonGameWinProbs,
  enrichMatchupPredictionLines,
  americanMoneylinePair,
  roundMatchupN,
} = require("./lib/matchupPredict");
const {
  findParsedGameForMatchup,
  isParsedGameFinished,
  gradeMatchupModelBets,
} = require("./lib/matchupGameResult");
const { buildMatchupClientPayload } = require("./lib/matchupClientPayload");
const {
  buildMatchupOptionsForGames,
  findGameByMatchupKey,
} = require("./lib/matchupScheduleChrome");
const { applyGamelogMissingForFinishedGame } = require("./lib/matchupGamelogMissing");
const {
  filterScheduleGamesBeforeIso,
  buildStats2026ByPlayerFromGamelogsBefore,
} = require("./lib/matchupHistoricalSnapshot");
const { buildMatchupLeagueContext } = require("./lib/matchupLeagueContext");
const {
  getMatchupPredictorAudit,
  getMatchupCalibrationForProjections,
  matchupPredictorHeadlineRecord,
} = require("./lib/matchupPredictorAudit");
const {
  getCachedPlayerReplacements,
  applyReplacementsToPlayerNames,
  remapLineupNorms,
  filterReplacementsForDate,
} = require("./lib/playerReplacements");
const { normalizedNameToPosition } = require("./data/playerPositions2026");
const {
  DFS_LINEUP_SIZE,
  DFS_SALARY_CAP,
  DFS_SCORING,
  DFS_OFFENSE_RATING_WEIGHT_HISTORICAL,
  DFS_OFFENSE_RATING_WEIGHT_2026,
  buildTeamCodeById,
  resolvePreviousDfsSlate,
  buildDfsSlateOptions,
  filterVisibleDfsSlateOptions,
  buildSlateFromToken,
  resolveGamesForViewToken,
  buildDfsPlayerPool,
  load2026GamelogsByPlayer,
  buildSlatePointsByNorm,
  buildLastWeekPointsByNorm,
  scoreLineupForSlate,
  scoreLineupFromPointsMap,
  referenceIsoForScheduleYear,
  listLeaderboardSlateOptions,
  defaultLeaderboardWeek,
  buildLeaderboardSlateFromToken,
  slateHasGamelogDates,
  resolveActiveDfsSlateToken,
  pickMatchupPredictorDefaultView,
  filterScheduleOptionsForMatchupPredictorMode,
  pickMatchupPredictorDefaultViewForMode,
  filterScheduleOptionsToDfsVisibility,
  resolveNextLineupLockDeadline,
} = require("./lib/dfs");

const app = express();
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.locals.assetVersion =
  process.env.RENDER_GIT_COMMIT?.slice(0, 12) ||
  process.env.ASSET_VERSION ||
  "2";

app.use(express.json({ limit: "512kb" }));

/** Lightweight probe for Render — do not use `/` (loads full league CSVs). */
app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});

const INDEX_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS4gZ_lSTJs9QfCC-FCDFLCSX8q88t6txvtDgKFinSQJqX0seyYhK5wHr0WwwjRaA1mxZdETC0CGNMz/pub?gid=1191877237&single=true&output=csv";
const SCHEDULE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS4gZ_lSTJs9QfCC-FCDFLCSX8q88t6txvtDgKFinSQJqX0seyYhK5wHr0WwwjRaA1mxZdETC0CGNMz/pub?gid=0&single=true&output=csv";
const ROSTER_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFhhdnzm2I_PVTkR4FDL-pbBhf_K53gMj6Pk5u8vtfYTXN9569QbdTRG9pZBuIFpQuWIpT9tJMbLY1/pub?gid=1722495492&single=true&output=csv";
const HIST_2025_STATS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj9_UhD3MyWbDfD3zlwO7mcOOjpcmSc2OrPYXa6UEeii422rpHFBBn2AXkf5KP_OKtJrcobvlT_J7d/pub?output=csv";
const {
  getStats2026CsvUrl,
  CSV_CAREER: CAREER_CSV_PATH,
  XLSX_DEFENSIVE_TEMPLATE,
} = require("./lib/dataPaths");
const { setCareerCsvFilePath } = require("./lib/sheetUrls");
const {
  normalizeSiteBasePath,
  sitePath: buildSitePath,
  mapNavHrefs,
} = require("./lib/sitePaths");

setCareerCsvFilePath(CAREER_CSV_PATH);

const SITE_BASE_PATH = normalizeSiteBasePath(process.env.SITE_BASE_PATH || "");
const STATIC_EXPORT = process.env.STATIC_EXPORT === "1";

function sitePath(path) {
  return buildSitePath(path, SITE_BASE_PATH);
}

/** EJS includes (site-head, site-header) read from app.locals — not per-render locals alone. */
app.locals.sitePath = sitePath;
app.locals.siteBasePath = SITE_BASE_PATH;
/** Visible stat columns on `/stats/team/:id` (must match 2026 stats sheet / CSV headers; excludes Team, IDs, Player, IsRookie). */
const TEAM_PAGE_2026_STAT_COLUMNS = Object.freeze([
  "PA",
  "AB",
  "Hits",
  "Runs",
  "RBI",
  "BB",
  "1B",
  "2B",
  "3B",
  "HR",
  "MG",
  "TB",
  "AVG",
  "OBP",
  "SLG",
  "OPS",
]);

app.set("view engine", "ejs");
app.set("views", `${__dirname}/views`);
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: process.env.NODE_ENV === "production" ? "1d" : 0,
    etag: true,
  })
);

/** Main site navigation (shared header on all primary pages). */
const SITE_NAV = Object.freeze([
  { id: "home", label: "League Leaders", href: "/" },
  { id: "matchup", label: "Matchup Predictor", href: "/matchup-predictor/future" },
  { id: "dfs", label: "DFS Lineup", href: "/dfs" },
  { id: "power", label: "Power Rankings", href: "/rankings/power" },
]);

const SITE_DISCLAIMER =
  "This site uses current and career stats for calculations. The algorithm isn’t perfect and will often be wrong, so please don’t use it to seriously compare players or teams.";

function formatDataUpdatedLabel(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })} ET`;
  } catch {
    return iso;
  }
}

function renderPage(res, view, locals = {}) {
  const generatedAt =
    locals.generatedAt !== undefined
      ? locals.generatedAt
      : STATIC_EXPORT
        ? null
        : new Date().toISOString();
  res.render(view, {
    siteNav: mapNavHrefs(SITE_NAV, SITE_BASE_PATH),
    siteDisclaimer: SITE_DISCLAIMER,
    sitePath,
    siteBasePath: SITE_BASE_PATH,
    staticSite: STATIC_EXPORT,
    generatedAt,
    dataUpdatedLabel: generatedAt ? formatDataUpdatedLabel(generatedAt) : "",
    ...locals,
  });
}

function safeText(value) {
  return (value || "").toString().trim();
}

/** Lowercase + collapse spaces — must match client normalization in schedule.ejs. */
function normalizeScheduleTeamLabel(value) {
  return safeText(value).toLowerCase().replace(/\s+/g, " ").trim();
}

/** Base64-encoded JSON avoids HTML/script parsing breakage (e.g. `&` in names) inline in pages. */
function buildScheduleRosterPayloadB64(rosterByTeamId, teams) {
  const nameToTeamId = {};
  for (const t of teams) {
    const key = normalizeScheduleTeamLabel(t.teamName);
    if (key && !nameToTeamId[key]) nameToTeamId[key] = t.teamId;
  }
  const body = JSON.stringify({ byTeamId: rosterByTeamId, nameToTeamId });
  return Buffer.from(body, "utf8").toString("base64");
}

async function fetchCsvRows(url) {
  const csvText = await fetchCsvText(url);
  return Papa.parse(csvText).data;
}

function normalizePlayerName(name) {
  let s = safeText(name).toLowerCase().replace(/[.'’]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function buildPositionByNormMap(playerNames) {
  const map = new Map();
  for (const name of playerNames || []) {
    const norm = normalizePlayerName(name);
    const pos = normalizedNameToPosition[norm];
    if (pos) map.set(norm, pos);
  }
  return map;
}

/** For fuzzy matching, keep suffix so Jr/Sr/II/III/IV remain distinct people. */
function getFuzzyNameParts(normalized) {
  const suffixes = new Set(["jr", "sr", "ii", "iii", "iv"]);
  const parts = normalized.split(" ").filter(Boolean);
  const tail = parts[parts.length - 1] || "";
  const suffix = suffixes.has(tail) ? tail : "";
  const firstInitial = parts[0] ? parts[0][0] : "";
  const lastName = suffix
    ? (parts.length > 2 ? parts[parts.length - 2] : "")
    : (parts.length > 1 ? parts[parts.length - 1] : "");
  return { firstInitial, lastName, suffix };
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatRate(value) {
  return value.toFixed(3);
}

function computeRates(pa, ab, h, r, rbi, bb, tb) {
  const avg = ab > 0 ? h / ab : 0;
  const obp = ab + bb > 0 ? (h + bb) / (ab + bb) : 0;
  const slg = ab > 0 ? tb / ab : 0;
  const ops = obp + slg;
  const runsPerPA = pa > 0 ? r / pa : 0;
  const rbiPerPA = pa > 0 ? rbi / pa : 0;
  const hitsPerPA = pa > 0 ? h / pa : 0;
  return { avg, obp, slg, ops, runsPerPA, rbiPerPA, hitsPerPA };
}

function computeProgression(career, s2025, s2026) {
  const c = computeRates(career.pa, career.ab, career.h, career.r, career.rbi, career.bb, career.tb);
  const y = computeRates(s2025.pa, s2025.ab, s2025.h, s2025.r, s2025.rbi, s2025.bb, s2025.tb);
  const n = computeRates(s2026.pa, s2026.ab, s2026.h, s2026.r, s2026.rbi, s2026.bb, s2026.tb);

  // Weighted trend: career -> 2025 and 2025 -> 2026.
  const d = {
    avg: 0.5 * (y.avg - c.avg) + 1.0 * (n.avg - y.avg),
    obp: 0.5 * (y.obp - c.obp) + 1.0 * (n.obp - y.obp),
    slg: 0.5 * (y.slg - c.slg) + 1.0 * (n.slg - y.slg),
    ops: 0.5 * (y.ops - c.ops) + 1.0 * (n.ops - y.ops),
    runsPerPA: 0.5 * (y.runsPerPA - c.runsPerPA) + 1.0 * (n.runsPerPA - y.runsPerPA),
    rbiPerPA: 0.5 * (y.rbiPerPA - c.rbiPerPA) + 1.0 * (n.rbiPerPA - y.rbiPerPA),
    hitsPerPA: 0.5 * (y.hitsPerPA - c.hitsPerPA) + 1.0 * (n.hitsPerPA - y.hitsPerPA),
  };

  // Composite score emphasizing OPS/OBP/SLG/AVG.
  const score =
    d.ops * 0.40 +
    d.obp * 0.18 +
    d.slg * 0.18 +
    d.avg * 0.12 +
    d.runsPerPA * 0.06 +
    d.rbiPerPA * 0.04 +
    d.hitsPerPA * 0.02;

  // More discrete levels for a clearer heat scale.
  const levels = [
    { min: -Infinity, max: -0.06, color: "#ff0000", label: "strong regression" }, // bright red
    { min: -0.06, max: -0.03, color: "#ff4d4d", label: "regression" },
    { min: -0.03, max: -0.015, color: "#ff9999", label: "mild regression" },
    { min: -0.015, max: 0.015, color: "#b0b7c3", label: "neutral" },
    { min: 0.015, max: 0.03, color: "#99ff99", label: "mild progression" },
    { min: 0.03, max: 0.06, color: "#4dff4d", label: "progression" },
    { min: 0.06, max: Infinity, color: "#00ff00", label: "strong progression" }, // bright green
  ];

  const band = levels.find((l) => score >= l.min && score < l.max) || levels[3];
  const bgColor = band.color;

  const deltas = [
    { key: "OPS", value: d.ops },
    { key: "OBP", value: d.obp },
    { key: "SLG", value: d.slg },
    { key: "AVG", value: d.avg },
    { key: "R/PA", value: d.runsPerPA },
    { key: "RBI/PA", value: d.rbiPerPA },
    { key: "H/PA", value: d.hitsPerPA },
  ].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const top = deltas[0];
  let insight = "Trend is stable across recent seasons.";
  if (score >= 0.015) {
    insight = `Upward trend led by ${top.key} improvement (${top.value >= 0 ? "+" : ""}${top.value.toFixed(3)}).`;
  } else if (score <= -0.015) {
    insight = `Downward trend mostly from ${top.key} decline (${top.value >= 0 ? "+" : ""}${top.value.toFixed(3)}).`;
  }

  return {
    label: band.label,
    score,
    bgColor,
    insight,
  };
}

function computeProgressionTwoSeasons(s2025, s2026) {
  const y = computeRates(s2025.pa, s2025.ab, s2025.h, s2025.r, s2025.rbi, s2025.bb, s2025.tb);
  const n = computeRates(s2026.pa, s2026.ab, s2026.h, s2026.r, s2026.rbi, s2026.bb, s2026.tb);

  const d = {
    avg: n.avg - y.avg,
    obp: n.obp - y.obp,
    slg: n.slg - y.slg,
    ops: n.ops - y.ops,
    runsPerPA: n.runsPerPA - y.runsPerPA,
    rbiPerPA: n.rbiPerPA - y.rbiPerPA,
    hitsPerPA: n.hitsPerPA - y.hitsPerPA,
  };

  const score =
    d.ops * 0.40 +
    d.obp * 0.18 +
    d.slg * 0.18 +
    d.avg * 0.12 +
    d.runsPerPA * 0.06 +
    d.rbiPerPA * 0.04 +
    d.hitsPerPA * 0.02;

  const levels = [
    { min: -Infinity, max: -0.06, color: "#ff0000", label: "strong regression" },
    { min: -0.06, max: -0.03, color: "#ff4d4d", label: "regression" },
    { min: -0.03, max: -0.015, color: "#ff9999", label: "mild regression" },
    { min: -0.015, max: 0.015, color: "#b0b7c3", label: "neutral" },
    { min: 0.015, max: 0.03, color: "#99ff99", label: "mild progression" },
    { min: 0.03, max: 0.06, color: "#4dff4d", label: "progression" },
    { min: 0.06, max: Infinity, color: "#00ff00", label: "strong progression" },
  ];

  const band = levels.find((l) => score >= l.min && score < l.max) || levels[3];
  const deltas = [
    { key: "OPS", value: d.ops },
    { key: "OBP", value: d.obp },
    { key: "SLG", value: d.slg },
    { key: "AVG", value: d.avg },
    { key: "R/PA", value: d.runsPerPA },
    { key: "RBI/PA", value: d.rbiPerPA },
    { key: "H/PA", value: d.hitsPerPA },
  ].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const top = deltas[0];
  let insight = "2025 to 2026 trend is stable.";
  if (score >= 0.015) {
    insight = `2025 to 2026 is improving, led by ${top.key} (${top.value >= 0 ? "+" : ""}${top.value.toFixed(3)}).`;
  } else if (score <= -0.015) {
    insight = `2025 to 2026 is regressing, mainly from ${top.key} (${top.value >= 0 ? "+" : ""}${top.value.toFixed(3)}).`;
  }

  return { label: band.label, score, bgColor: band.color, insight };
}

function buildRookieInsight(s2026) {
  const rates = computeRates(s2026.pa, s2026.ab, s2026.h, s2026.r, s2026.rbi, s2026.bb, s2026.tb);
  const pa = toNumber(s2026.pa);
  const bbRate = pa > 0 ? s2026.bb / pa : 0;
  const powerGap = rates.slg - rates.avg;
  const runProdRate = pa > 0 ? (s2026.r + s2026.rbi) / pa : 0;

  const strengths = [];
  const concerns = [];

  if (rates.obp >= 0.47 && bbRate >= 0.16) {
    strengths.push("elite plate discipline; gets on base heavily through walks");
  } else if (rates.obp >= 0.43 && bbRate >= 0.12) {
    strengths.push("strong on-base profile driven by patient at-bats");
  } else if (rates.obp >= 0.4) {
    strengths.push("solid on-base ability");
  } else if (bbRate < 0.07) {
    concerns.push("aggressive approach with fewer free passes");
  }

  if (rates.slg >= 0.7 || powerGap >= 0.17) {
    strengths.push("impact power shows up in extra-base production");
  } else if (rates.slg < 0.5) {
    concerns.push("limited slugging impact so far");
  }

  if (runProdRate >= 0.38) {
    strengths.push("consistently creates run production");
  } else if (runProdRate < 0.24) {
    concerns.push("run production has been light");
  }

  let profile = "balanced early profile";
  if (strengths.length >= 2 && concerns.length === 0) {
    profile = "well-rounded impact bat";
  } else if (strengths.some((s) => s.includes("plate discipline")) && concerns.some((c) => c.includes("slugging"))) {
    profile = "on-base first profile";
  } else if (strengths.some((s) => s.includes("power")) && concerns.some((c) => c.includes("passes"))) {
    profile = "power-first profile";
  } else if (strengths.length === 0 && concerns.length >= 2) {
    profile = "developmental profile";
  }

  const strengthText = strengths.length ? `Strength: ${strengths[0]}.` : "";
  const concernText = concerns.length ? ` Watch: ${concerns[0]}.` : "";
  return `Rookie outlook: ${profile}; OPS ${rates.ops.toFixed(3)} in ${pa} PA.${strengthText}${concernText}`;
}

/** Rookies: stats and progression use only the 2026 stats sheet row (exact normalized name). Never merge career / 2025 or fuzzy-match another player. */
function buildRookieOnlyMergedRow(playerName, season2026) {
  const sPA = toNumber(season2026?.PA);
  const sAB = toNumber(season2026?.AB);
  const sH = toNumber(season2026?.Hits);
  const sR = toNumber(season2026?.Runs);
  const sRBI = toNumber(season2026?.RBI);
  const sBB = toNumber(season2026?.BB);
  const sTB = toNumber(season2026?.TB);

  const avg = sAB > 0 ? sH / sAB : 0;
  const obp = sAB + sBB > 0 ? (sH + sBB) / (sAB + sBB) : 0;
  const slg = sAB > 0 ? sTB / sAB : 0;
  const ops = obp + slg;

  return {
    playerName,
    found: true,
    stats: null,
    season2026,
    rookie: true,
    likelySecondYear: false,
    progression: {
      label: "rookie",
      score: 0,
      bgColor: "#ffff00",
      insight: buildRookieInsight({ pa: sPA, ab: sAB, h: sH, r: sR, rbi: sRBI, bb: sBB, tb: sTB }),
    },
    merged: {
      seasons: sPA > 0 ? 1 : 0,
      pa: sPA,
      ab: sAB,
      h: sH,
      r: sR,
      rbi: sRBI,
      bb: sBB,
      tb: sTB,
      avg: formatRate(avg),
      obp: formatRate(obp),
      slg: formatRate(slg),
      ops: formatRate(ops),
    },
  };
}

function parseWeekIndex(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Season year embedded in MMS schedule CSV date strings (`Sun, 26-Apr`, etc.). */
const SCHEDULE_CALENDAR_YEAR = Number(process.env.SCHEDULE_CALENDAR_YEAR) || 2026;

function parseScheduleSheetDate(displayDate) {
  const s = safeText(displayDate);
  if (!s) return null;
  const match = /^([A-Za-z]{3}),\s*(\d{1,2})-([A-Za-z]{3})$/.exec(s);
  if (!match) return null;
  const monthAbbrToNum = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };
  const day = Number(match[2]);
  const monthNum = monthAbbrToNum[match[3].slice(0, 3).toLowerCase()];
  if (!monthNum || !Number.isFinite(day) || day < 1 || day > 31) return null;
  const dt = new Date(SCHEDULE_CALENDAR_YEAR, monthNum - 1, day);
  if (
    dt.getFullYear() !== SCHEDULE_CALENDAR_YEAR ||
    dt.getMonth() !== monthNum - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }
  const iso = `${String(SCHEDULE_CALENDAR_YEAR)}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { iso, label: s };
}

/** Calendar weekday for `YYYY-MM-DD` (local tz, midday avoids DST borders). Sun=0, Wed=3. */
function weekdayFromIso(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).getDay();
}

/** Local calendar date as `YYYY-MM-DD` (server timezone). */
function localCalendarIso(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Default `/schedule` view from "today": Wed → that Wed if on sheet; Thu–Sat → next Sunday;
 * Mon–Tue → next Wednesday on the sheet if any, else next Sunday; Sun → that Sunday's week.
 * If nothing is on/after today, use the last scheduled slate.
 */
function pickSmartDefaultScheduleView(referenceIso, payload) {
  const { uniqueIsosSorted, sundayIsosSorted } = payload;
  if (!uniqueIsosSorted?.length || !Array.isArray(sundayIsosSorted)) return "";

  const allowedViews = new Set(payload.allScheduleViews || []);

  const anchors = [];
  for (const iso of uniqueIsosSorted) {
    const wd = weekdayFromIso(iso);
    if (wd !== 0 && wd !== 3) continue;
    let value = "";
    if (wd === 3) {
      value = `D${scheduleIsoToCompactDigits(iso)}`;
    } else {
      const ix = sundayIsosSorted.indexOf(iso);
      if (ix >= 0) value = `W${ix + 1}`;
    }
    if (!value || !allowedViews.has(value)) continue;
    anchors.push({ iso, value });
  }
  if (!anchors.length) return "";

  const ref = safeText(referenceIso);
  let futureOrToday = ref ? anchors.filter((a) => a.iso.localeCompare(ref) >= 0) : [...anchors];

  const lastValue = anchors[anchors.length - 1].value;
  if (!futureOrToday.length) return lastValue;

  const wdRef = weekdayFromIso(ref || futureOrToday[0].iso);
  const exact = anchors.find((a) => a.iso === ref);

  if (exact && (wdRef === 3 || wdRef === 0)) {
    return exact.value;
  }

  if (wdRef === 4 || wdRef === 5 || wdRef === 6) {
    const nextSun = futureOrToday.find((a) => weekdayFromIso(a.iso) === 0);
    return nextSun ? nextSun.value : futureOrToday[0].value;
  }

  if (wdRef === 1 || wdRef === 2) {
    const nextWed = futureOrToday.find((a) => weekdayFromIso(a.iso) === 3);
    if (nextWed) return nextWed.value;
    const nextSun = futureOrToday.find((a) => weekdayFromIso(a.iso) === 0);
    return nextSun ? nextSun.value : futureOrToday[0].value;
  }

  return futureOrToday[0].value;
}

function scheduleIsoToCompactDigits(isoDate) {
  return safeText(isoDate).replace(/\D+/g, "");
}

function compactDayDigitsToIso(digits8) {
  const d = safeText(digits8);
  if (!/^\d{8}$/.test(d)) return null;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

/** Minutes from midnight for sorting; unparseable / PPD / TBD sorts last. */
function scheduleStartTimeSortKey(timeStr) {
  const compact = safeText(timeStr).toLowerCase().replace(/\./g, "").replace(/\s+/g, "").trim();
  if (
    !compact ||
    compact === "-" ||
    compact === "ppd" ||
    compact === "tbd" ||
    compact === "postponed"
  ) {
    return 1e9;
  }

  const m12 = compact.match(/^(\d{1,2}):(\d{2})(am|pm)$/);
  if (m12) {
    let h = Number(m12[1]);
    const min = Number(m12[2]);
    if (m12[3] === "pm" && h < 12) h += 12;
    if (m12[3] === "am" && h === 12) h = 0;
    return h * 60 + min;
  }

  const m24 = compact.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = Number(m24[1]);
    const min = Number(m24[2]);
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return h * 60 + min;
  }

  return 1e9 - 1;
}

function sortScheduleGameRows(rows) {
  return rows.slice().sort((a, b) => {
    const ka = scheduleStartTimeSortKey(a.time);
    const kb = scheduleStartTimeSortKey(b.time);
    if (ka !== kb) return ka - kb;
    return safeText(a.home).localeCompare(safeText(b.home));
  });
}

/** Score cell NaN unless a real number (not blank / #N/A / PPD). */
function optionalScheduleScore(cell) {
  const t = safeText(cell);
  if (!t || /^#?n\/?a$/i.test(t) || /^ppd$/i.test(t)) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function formatFinishedScheduleResult(awayScore, homeScore, resultCell, winnerCell) {
  if (!Number.isFinite(awayScore) || !Number.isFinite(homeScore)) return "";
  const rs = safeText(resultCell).trim();
  if (!/^#?n\/?a$/i.test(rs) && !/^-$/.test(rs) && rs) return rs;

  const w = safeText(winnerCell);
  if (!/^#?n\/?a$/i.test(w) && w !== "-") return `${awayScore}–${homeScore} (${w})`;
  return `${awayScore}–${homeScore}`;
}

/** Sunday / Week N: games on that calendar Sunday only (Wednesdays are chosen separately in the dropdown). */
function gamesForSundayWeekNumber(weekNum, sundayAsc, gamesByIso) {
  const i = weekNum - 1;
  if (i < 0 || i >= sundayAsc.length) return [];
  const sunIso = sundayAsc[i];
  const chunk = gamesByIso.get(sunIso);
  if (!chunk) return [];
  return sortScheduleGameRows(chunk).map(({ _iso, ...rest }) => ({ ...rest, isoDate: _iso || rest.isoDate }));
}

function isValidScheduleTeamNumber(value) {
  const raw = safeText(value).replace(/\s+/g, "");
  if (/^n\/?a$/i.test(raw) || /^#+$/.test(raw)) return false;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 18;
}

function normalizeScheduleTeamId(id) {
  const n = Number(safeText(id).replace(/\s+/g, ""));
  return Number.isInteger(n) ? String(n) : safeText(id);
}

function scheduleHeaderRowNormalized(headers) {
  return (headers || []).map((x) =>
    safeText(x)
      .replace(/^\ufeff/g, "")
      .toLowerCase()
  );
}

/** First column index whose normalized header matches one of `candidates` (exact). */
function scheduleColumnFirstOf(normalizedHeaders, candidates) {
  const h = normalizedHeaders;
  for (const c of candidates) {
    const i = h.indexOf(c);
    if (i >= 0) return i;
  }
  return -1;
}

function buildScheduleVenueLabel(parts) {
  const out = [];
  for (const p of parts) {
    const t = safeText(p);
    if (!t || t === "-") continue;
    if (out.length && out[out.length - 1] === t) continue;
    out.push(t);
  }
  return out.join(" · ");
}

/** Diamond / short-field locations only (e.g. MIDDLE, SWIM, UH Left) — not turf or class. */
function buildScheduleDiamondLocationLabel(fieldMain, fieldShort) {
  return buildScheduleVenueLabel([fieldMain, fieldShort]);
}

function scheduleCsvColumnIndex(headers) {
  const h = scheduleHeaderRowNormalized(headers);
  return {
    date: h.indexOf("date"),
    awayId: h.indexOf("away #"),
    awayTeam: h.indexOf("away team"),
    homeId: h.indexOf("home #"),
    homeTeam: h.indexOf("home team"),
    field: scheduleColumnFirstOf(h, ["field", "diamond"]),
    shortField: scheduleColumnFirstOf(h, ["short field"]),
    time: h.indexOf("time"),
    gameId: h.indexOf("gameid"),
    awayScore: h.indexOf("away score"),
    homeScore: h.indexOf("home score"),
    winner: h.indexOf("winner"),
    result: h.indexOf("result"),
  };
}

/** All schedule rows with scores (for standings / SOS), not filtered to Wed/Sun display slates. */
function buildParsedScheduleGames(scheduleRows, teams) {
  const headers = (scheduleRows[0] || []).map((h) => safeText(h));
  const rows = scheduleRows.slice(1);
  const idx = scheduleCsvColumnIndex(headers);

  if (idx.date === -1 || idx.awayId === -1 || idx.homeId === -1) {
    throw new Error("Schedule CSV missing required columns.");
  }

  const teamNameById = new Map(
    teams.map((t) => [safeText(t.teamId), safeText(t.teamName) || `Team ${t.teamId}`])
  );
  const parsedGames = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const awayId = safeText(row[idx.awayId]);
    const homeId = safeText(row[idx.homeId]);
    if (!isValidScheduleTeamNumber(awayId) || !isValidScheduleTeamNumber(homeId)) continue;

    const dateDisplay = safeText(row[idx.date]);
    const parsedDate = parseScheduleSheetDate(dateDisplay);
    if (!parsedDate) continue;

    const gameId = idx.gameId >= 0 ? safeText(row[idx.gameId]) : "";
    const field = idx.field >= 0 ? safeText(row[idx.field]) : "";
    const fieldShort = idx.shortField >= 0 ? safeText(row[idx.shortField]) : "";
    const venueLabel = buildScheduleDiamondLocationLabel(field, fieldShort);
    const time = idx.time >= 0 ? safeText(row[idx.time]) : "";
    const awayName = safeText(row[idx.awayTeam]) || teamNameById.get(awayId) || `Team ${awayId}`;
    const homeName = safeText(row[idx.homeTeam]) || teamNameById.get(homeId) || `Team ${homeId}`;

    const rawAwayScore = idx.awayScore >= 0 ? row[idx.awayScore] : "";
    const rawHomeScore = idx.homeScore >= 0 ? row[idx.homeScore] : "";
    parsedGames.push({
      awayId,
      homeId,
      awayName,
      homeName,
      dateDisplay,
      isoDate: parsedDate.iso,
      field,
      venueLabel,
      time,
      gameId,
      rowIndex: i,
      awayScore: optionalScheduleScore(rawAwayScore),
      homeScore: optionalScheduleScore(rawHomeScore),
      winnerCsv: idx.winner >= 0 ? safeText(row[idx.winner]) : "",
      resultCsv: idx.result >= 0 ? safeText(row[idx.result]) : "",
    });
  }

  return parsedGames;
}

function finishedScheduleGameDedupeKey(g) {
  const awayId = normalizeScheduleTeamId(g.awayId);
  const homeId = normalizeScheduleTeamId(g.homeId);
  const gid = safeText(g.gameId);
  if (gid) return `gid|${gid}`;
  return `m|${g.isoDate || ""}|${[awayId, homeId].sort().join("|")}`;
}

function resolveScheduleGamesForView(encodedView, payload) {
  const allowed = new Set(payload.allScheduleViews || []);

  if (!payload.scheduleOptions || !payload.scheduleOptions.length) {
    return {
      selectedView: "",
      games: [],
      summaryLine: "Schedule not available.",
    };
  }

  const firstSunToken = payload.scheduleOptions.find((o) => /^W\d+$/i.test(o.value))?.value || "";
  const firstAny = payload.scheduleOptions[0].value;
  const fallback = firstSunToken || firstAny;

  const v = safeText(encodedView);
  let candidate = "";
  if (/^W\d+$/i.test(v)) candidate = `W${Number(v.slice(1))}`;
  else if (/^D\d{8}$/i.test(v)) candidate = v.toUpperCase();

  const selected = allowed.has(candidate) ? candidate : fallback;

  let games = [];
  let summaryLine = "";

  if (/^W\d+$/i.test(selected)) {
    const wn = Number(selected.slice(1));
    games = gamesForSundayWeekNumber(wn, payload.sundayIsosSorted, payload.gamesByIso);
    const sunIso = payload.sundayIsosSorted[wn - 1];
    const sunLabel = sunIso ? payload.dateLabelByIso.get(sunIso) || sunIso : "";
    summaryLine = sunLabel ? `Week ${wn} (${sunLabel} games only)` : `Week ${wn}`;
  } else if (/^D\d{8}$/i.test(selected)) {
    const digits = safeText(selected).toUpperCase().replace(/^D/, "");
    const iso = compactDayDigitsToIso(digits);
    if (iso && weekdayFromIso(iso) === 3) {
      const rows = payload.gamesByIso.get(iso) || [];
      games = sortScheduleGameRows(rows).map(({ _iso, ...rest }) => ({ ...rest, isoDate: _iso || rest.isoDate }));
      summaryLine = payload.dateLabelByIso.get(iso) || iso;
    } else {
      games = [];
      summaryLine = "Invalid Wednesday selection.";
    }
  }

  return { selectedView: selected, games, summaryLine };
}

function resolveSundayWeekViewParam(encodedWeek, payload) {
  const weekOptions = (payload.scheduleOptions || []).filter((o) => /^W\d+$/i.test(o.value));
  if (!weekOptions.length) return { selectedWeek: "", weekOptions: [] };

  const allowed = new Set(weekOptions.map((o) => o.value));
  const firstSun = weekOptions[0].value;
  const fallback =
    pickSmartDefaultScheduleView(localCalendarIso(), payload) ||
    firstSun;
  const fallbackWeek = /^W\d+$/i.test(fallback) ? fallback : firstSun;

  let candidate = "";
  const v = safeText(encodedWeek);
  if (/^W\d+$/i.test(v)) candidate = `W${Number(v.slice(1))}`;
  else if (v !== "" && /^\d+$/.test(v)) candidate = `W${Number(v)}`;

  const selectedWeek = allowed.has(candidate) ? candidate : fallbackWeek;
  return { selectedWeek, weekOptions };
}

function displaySeason2026StatCell(season2026, headerKey) {
  if (!season2026 || !Object.prototype.hasOwnProperty.call(season2026, headerKey)) return "—";
  const s = safeText(season2026[headerKey]);
  return s === "" ? "—" : s;
}

/** Team page: show 2026 CSV stats only; strip lifetime `merged` so career/2025+ cumulative lines stay off the client (progression still computed server-side). */
function sanitizeTeamRosterRowsForTeamStatPage(players) {
  return players.map((p) => {
    const { merged: _lifetimeMerged, ...rest } = p;
    const stats2026Cells = {};
    for (const col of TEAM_PAGE_2026_STAT_COLUMNS) {
      stats2026Cells[col] = displaySeason2026StatCell(p.season2026, col);
    }
    return { ...rest, stats2026Cells };
  });
}

function sanitizeTeamSnapshotForTeamStatPage(team) {
  return { ...team, players: sanitizeTeamRosterRowsForTeamStatPage(team.players) };
}

async function load2025HistoricalByPlayer() {
  const rows = await fetchCsvRows(HIST_2025_STATS_URL);
  const headers = (rows[0] || []).map((h) => safeText(h));
  const dataRows = rows.slice(1);
  const nameIndex = headers.findIndex((h) => h.toLowerCase() === "player");
  if (nameIndex === -1) {
    throw new Error("2025 historical CSV missing Player column.");
  }

  const byPlayer = new Map();
  for (const row of dataRows) {
    const playerName = safeText(row[nameIndex]);
    if (!playerName) continue;

    const singles = toNumber(row[6]);
    const doubles = toNumber(row[7]);
    const triples = toNumber(row[8]);
    const homers = toNumber(row[9]);
    const bb = toNumber(row[10]);
    const ab = toNumber(row[2]);

    const stats = {
      player: playerName,
      team: safeText(row[1]),
      pa: ab + bb, // proxy since PA is not explicitly present
      ab,
      h: toNumber(row[3]),
      r: toNumber(row[4]),
      rbi: toNumber(row[5]),
      bb,
      tb: singles + doubles * 2 + triples * 3 + homers * 4,
    };

    byPlayer.set(normalizePlayerName(playerName), stats);
  }

  return byPlayer;
}

async function loadCareerByPlayer() {
  const csvText = await fs.readFile(CAREER_CSV_PATH, "utf8");
  const rows = Papa.parse(csvText).data;
  const headers = (rows[0] || []).map((h) => safeText(h).toLowerCase());
  const dataRows = rows.slice(1);

  const idx = {
    name: headers.indexOf("player_name"),
    seasons: headers.indexOf("seasons"),
    pa: headers.indexOf("pa"),
    ab: headers.indexOf("ab"),
    h: headers.indexOf("h"),
    r: headers.indexOf("r"),
    rbi: headers.indexOf("rbi"),
    bb: headers.indexOf("bb"),
    tb: headers.indexOf("tb"),
  };

  if (idx.name === -1) {
    throw new Error("data/csv/career.csv missing player_name column.");
  }

  const byPlayer = new Map();
  for (const row of dataRows) {
    const name = safeText(row[idx.name]);
    if (!name) continue;
    byPlayer.set(normalizePlayerName(name), {
      seasons: toNumber(row[idx.seasons]),
      pa: toNumber(row[idx.pa]),
      ab: toNumber(row[idx.ab]),
      h: toNumber(row[idx.h]),
      r: toNumber(row[idx.r]),
      rbi: toNumber(row[idx.rbi]),
      bb: toNumber(row[idx.bb]),
      tb: toNumber(row[idx.tb]),
    });
  }
  return byPlayer;
}

/**
 * Offensive rating: raw rates from each era (no PA shrink toward league μ). OPS = AVG + SLG only (walks excluded).
 * Z-scores compare each raw rate to league PA-weighted μ/σ from career + 2025 + 2026 rows (reference only — player
 * rates are never blended with μ). When both eras exist: rating = 70% historical composite + 30% 2026 composite.
 * No history ⇒ rating = 2026 composite only.
 */
/** Blend for final rating when career/2025 and 2026 both exist (sums to 1). */
const OFFENSE_RATING_WEIGHT_HISTORICAL = 0.7;
const OFFENSE_RATING_WEIGHT_2026 = 0.3;
/** Team overall +/- when schedule exists: player roster rating + record + SOS (sum = 1). */
const TEAM_OVERALL_WEIGHT_PLAYER = 0.5;
const TEAM_OVERALL_WEIGHT_RECORD = 0.4;
const TEAM_OVERALL_WEIGHT_SOS = 0.1;
const REGULAR_SEASON_GAMES = 22;
/** Weights on standardized metrics within each era composite (sum = 1). */
const OFFENSE_METRIC_WEIGHTS = Object.freeze({
  ops: 0.52,
  iso: 0.16,
  tbPerPa: 0.26,
  runProd: 0.06,
});
const OFFENSE_METRIC_KEYS = Object.keys(OFFENSE_METRIC_WEIGHTS);

function computeOffenseRateBundle(pa, ab, bb, h, tb, r, rbi) {
  const paN = toNumber(pa);
  if (paN <= 0) return null;
  const abN = toNumber(ab);
  const bbN = toNumber(bb);
  const hN = toNumber(h);
  const tbN = toNumber(tb);
  const rN = toNumber(r);
  const rbiN = toNumber(rbi);

  if (abN + bbN <= 0) return null;

  const slg = abN > 0 ? tbN / abN : 0;
  const avg = abN > 0 ? hN / abN : 0;
  const iso = slg - avg;
  /** Walk-excluded OPS: batting average + slugging only. */
  const ops = avg + slg;
  const tbPerPa = tbN / paN;
  const runProd = (rN + rbiN) / paN;

  if (![ops, iso, tbPerPa, runProd].every((x) => Number.isFinite(x))) return null;

  return { ops, iso, tbPerPa, runProd };
}

function collectLeagueOffenseBundles(careerByPlayer, hist2025ByPlayer, stats2026ByPlayer) {
  const out = [];

  for (const [, c] of careerByPlayer.entries()) {
    const pa = toNumber(c.pa);
    const b = computeOffenseRateBundle(pa, c.ab, c.bb, c.h, c.tb, c.r, c.rbi);
    if (b) out.push({ pa, bundle: b });
  }

  for (const [, h] of hist2025ByPlayer.entries()) {
    const pa = toNumber(h.pa);
    const b = computeOffenseRateBundle(pa, h.ab, h.bb, h.h, h.tb, h.r, h.rbi);
    if (b) out.push({ pa, bundle: b });
  }

  for (const [, row] of stats2026ByPlayer.entries()) {
    const pa = toNumber(row.PA);
    const b = computeOffenseRateBundle(pa, row.AB, row.BB, row.Hits, row.TB, row.Runs, row.RBI);
    if (b) out.push({ pa, bundle: b });
  }

  return out;
}

function weightedMomentsPerMetric(observations) {
  const totPa = observations.reduce((s, o) => s + o.pa, 0);
  const moments = {};
  if (totPa <= 0) {
    for (const k of OFFENSE_METRIC_KEYS) {
      moments[k] = { mu: 0, sigma: 1 };
    }
    return { moments, totPa };
  }

  for (const key of OFFENSE_METRIC_KEYS) {
    const mu =
      observations.reduce((s, o) => s + o.pa * o.bundle[key], 0) / totPa;
    const variance =
      observations.reduce((s, o) => s + o.pa * (o.bundle[key] - mu) ** 2, 0) / totPa;
    const sigma = Math.sqrt(Math.max(variance, 1e-10));
    moments[key] = { mu, sigma };
  }

  return { moments, totPa };
}

function zScoresFromBundle(bundle, moments) {
  const z = {};
  for (const key of OFFENSE_METRIC_KEYS) {
    const { mu, sigma } = moments[key];
    z[key] = (bundle[key] - mu) / sigma;
  }
  return z;
}

function compositeZFromZScores(zObj) {
  let s = 0;
  for (const key of OFFENSE_METRIC_KEYS) {
    s += OFFENSE_METRIC_WEIGHTS[key] * zObj[key];
  }
  return s;
}

/** Career PA + bundle, else 2025 PA + bundle (same precedence as before). */
function historicalPaAndBundleForPlayer(normalizedKey, careerByPlayer, hist2025ByPlayer) {
  const c = careerByPlayer.get(normalizedKey);
  if (c && toNumber(c.pa) > 0) {
    const pa = toNumber(c.pa);
    const bundle = computeOffenseRateBundle(pa, c.ab, c.bb, c.h, c.tb, c.r, c.rbi);
    if (bundle) return { pa, bundle };
  }
  const h25 = hist2025ByPlayer.get(normalizedKey);
  if (h25 && toNumber(h25.pa) > 0) {
    const pa = toNumber(h25.pa);
    const bundle = computeOffenseRateBundle(pa, h25.ab, h25.bb, h25.h, h25.tb, h25.r, h25.rbi);
    if (bundle) return { pa, bundle };
  }
  return null;
}

function bundle2026FromRow(row2026) {
  const pa = toNumber(row2026.PA);
  if (pa <= 0) return null;
  return computeOffenseRateBundle(pa, row2026.AB, row2026.BB, row2026.Hits, row2026.TB, row2026.Runs, row2026.RBI);
}

function neutralCompositeZ() {
  return 0;
}

/** Rating blend when both career and 2026 exist; else the single available composite. */
function blendedOffenseRating(composite26, compositeHist, has26, hasHist, blendWeights) {
  const wHist = blendWeights?.historical ?? OFFENSE_RATING_WEIGHT_HISTORICAL;
  const w26 = blendWeights?.y2026 ?? OFFENSE_RATING_WEIGHT_2026;
  if (has26 && hasHist) {
    return wHist * compositeHist + w26 * composite26;
  }
  if (has26) return composite26;
  if (hasHist) return compositeHist;
  return neutralCompositeZ();
}

const DFS_SALARY_RATING_BLEND = Object.freeze({
  historical: DFS_OFFENSE_RATING_WEIGHT_HISTORICAL,
  y2026: DFS_OFFENSE_RATING_WEIGHT_2026,
});

function buildOffensivePlayerRows(
  teams,
  careerByPlayer,
  hist2025ByPlayer,
  stats2026ByPlayer,
  moments,
  blendWeights
) {
  const rows = [];

  for (const team of teams) {
    for (const playerName of team.players) {
      const norm = normalizePlayerName(playerName);
      const row2026 = stats2026ByPlayer.get(norm);
      const pa26 = row2026 ? toNumber(row2026.PA) : 0;

      const raw26 = row2026 && pa26 > 0 ? bundle2026FromRow(row2026) : null;
      const z26 = raw26 ? zScoresFromBundle(raw26, moments) : null;
      const composite26 = z26 ? compositeZFromZScores(z26) : neutralCompositeZ();
      const has26 = z26 != null;

      const histSample = historicalPaAndBundleForPlayer(norm, careerByPlayer, hist2025ByPlayer);
      const rawHist = histSample?.bundle ?? null;
      const zHist = rawHist ? zScoresFromBundle(rawHist, moments) : null;
      const compositeHist = zHist ? compositeZFromZScores(zHist) : null;
      const hasHist = zHist != null;

      const ratingRaw = blendedOffenseRating(
        composite26,
        compositeHist ?? 0,
        has26,
        hasHist,
        blendWeights
      );
      const ratingRounded = Number.isFinite(ratingRaw) ? Math.round(ratingRaw * 100) / 100 : 0;

      const opsDisplay26 =
        raw26 && Number.isFinite(raw26.ops) ? Math.round(raw26.ops * 1000) / 1000 : null;

      rows.push({
        playerName,
        norm,
        teamId: team.teamId,
        teamName: team.teamName,
        pa2026: pa26,
        composite2026: Number.isFinite(composite26) ? Math.round(composite26 * 1000) / 1000 : 0,
        compositeHist:
          compositeHist != null && Number.isFinite(compositeHist)
            ? Math.round(compositeHist * 1000) / 1000
            : null,
        ops2026Adj: opsDisplay26,
        tbPerPa2026:
          raw26 && Number.isFinite(raw26.tbPerPa) ? Math.round(raw26.tbPerPa * 1000) / 1000 : null,
        rating: ratingRounded,
      });
    }
  }

  rows.sort((a, b) => b.rating - a.rating);
  rows.forEach((r, i) => {
    r.leagueRank = i + 1;
  });
  return rows;
}

function buildTeamStandingsFromScheduleGames(parsedGames, teams) {
  const rec = new Map();
  for (const t of teams) {
    const id = normalizeScheduleTeamId(t.teamId);
    rec.set(id, { wins: 0, losses: 0, opponentIdsPerGame: [] });
  }

  const seen = new Set();
  for (const g of parsedGames) {
    const awayId = normalizeScheduleTeamId(g.awayId);
    const homeId = normalizeScheduleTeamId(g.homeId);
    if (!rec.has(awayId) || !rec.has(homeId)) continue;
    if (!Number.isFinite(g.awayScore) || !Number.isFinite(g.homeScore)) continue;
    if (g.awayScore === g.homeScore) continue;

    const dedupeKey = finishedScheduleGameDedupeKey(g);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    if (g.awayScore > g.homeScore) {
      rec.get(awayId).wins += 1;
      rec.get(homeId).losses += 1;
    } else {
      rec.get(homeId).wins += 1;
      rec.get(awayId).losses += 1;
    }
    rec.get(awayId).opponentIdsPerGame.push(homeId);
    rec.get(homeId).opponentIdsPerGame.push(awayId);
  }

  const standings = new Map();
  for (const [id, r] of rec.entries()) {
    const gamesPlayed = r.wins + r.losses;
    const winPct = gamesPlayed > 0 ? r.wins / gamesPlayed : null;
    standings.set(id, {
      wins: r.wins,
      losses: r.losses,
      gamesPlayed,
      winPct,
      sosOppWinPct: null,
    });
  }

  for (const [id, r] of rec.entries()) {
    let sosSum = 0;
    let sosN = 0;
    for (const oppId of r.opponentIdsPerGame) {
      const opp = standings.get(oppId);
      if (!opp || opp.gamesPlayed <= 0) continue;
      sosSum += opp.winPct;
      sosN += 1;
    }
    const row = standings.get(id);
    if (row) row.sosOppWinPct = sosN > 0 ? sosSum / sosN : null;
  }

  return standings;
}

function zScoresFromStandingsMetric(standingsMap, pickValue) {
  const z = new Map();
  const samples = [];
  for (const [id, row] of standingsMap.entries()) {
    const v = pickValue(row);
    if (v != null && Number.isFinite(v)) samples.push({ id, v });
  }
  for (const id of standingsMap.keys()) z.set(id, 0);
  if (!samples.length) return z;

  const mu = samples.reduce((s, x) => s + x.v, 0) / samples.length;
  const variance =
    samples.reduce((s, x) => s + (x.v - mu) ** 2, 0) / samples.length;
  const sigma = Math.sqrt(Math.max(variance, 1e-10));
  for (const { id, v } of samples) z.set(id, (v - mu) / sigma);
  return z;
}

function buildTeamOffenseSections(teamsInOrder, rankedRows, standingsMap) {
  const byTeam = new Map();
  for (const t of teamsInOrder) {
    byTeam.set(t.teamId, {
      teamId: t.teamId,
      teamName: t.teamName,
      jerseyColor: t.jerseyColor,
      numberColor: t.numberColor,
      players: [],
    });
  }
  for (const r of rankedRows) {
    const b = byTeam.get(r.teamId);
    if (b) b.players.push(r);
  }

  const recordZ = standingsMap
    ? zScoresFromStandingsMetric(standingsMap, (s) => s.winPct)
    : new Map();
  const sosZ = standingsMap
    ? zScoresFromStandingsMetric(standingsMap, (s) => s.sosOppWinPct)
    : new Map();

  const sections = teamsInOrder
    .map((t) => {
      const b = byTeam.get(t.teamId);
      if (!b) return null;
      b.players.sort((a, c) => c.rating - a.rating);
      const paSum = b.players.reduce((s, p) => s + p.pa2026, 0);
      let teamPlayerRating = 0;
      if (paSum > 0) {
        teamPlayerRating = b.players.reduce((s, p) => s + p.rating * p.pa2026, 0) / paSum;
      } else if (b.players.length) {
        teamPlayerRating = b.players.reduce((s, p) => s + p.rating, 0) / b.players.length;
      }
      teamPlayerRating = Number.isFinite(teamPlayerRating)
        ? Math.round(teamPlayerRating * 100) / 100
        : 0;

      const sid = normalizeScheduleTeamId(t.teamId);
      const st = standingsMap?.get(sid) || {
        wins: 0,
        losses: 0,
        gamesPlayed: 0,
        winPct: null,
        sosOppWinPct: null,
      };

      const rz = recordZ.get(sid) ?? 0;
      const sz = sosZ.get(sid) ?? 0;
      let teamOffenseRating = teamPlayerRating;
      if (st.gamesPlayed > 0 && standingsMap) {
        teamOffenseRating =
          TEAM_OVERALL_WEIGHT_PLAYER * teamPlayerRating +
          TEAM_OVERALL_WEIGHT_RECORD * rz +
          TEAM_OVERALL_WEIGHT_SOS * sz;
      }
      teamOffenseRating = Number.isFinite(teamOffenseRating)
        ? Math.round(teamOffenseRating * 100) / 100
        : 0;

      return {
        ...b,
        teamPlayerRating,
        teamOffenseRating,
        teamWins: st.wins,
        teamLosses: st.losses,
        teamWinPct: st.winPct,
        teamSosOppWinPct: st.sosOppWinPct,
        teamRecordZ: st.gamesPlayed > 0 ? Math.round(rz * 1000) / 1000 : null,
        teamSosZ: st.sosOppWinPct != null ? Math.round(sz * 1000) / 1000 : null,
      };
    })
    .filter(Boolean);

  sections.sort((a, b) => {
    const d = b.teamOffenseRating - a.teamOffenseRating;
    if (d !== 0) return d;
    return (a.teamId || 0) - (b.teamId || 0);
  });

  return sections;
}

function isPlayedScheduleGame(g) {
  return (
    Number.isFinite(g.awayScore) &&
    Number.isFinite(g.homeScore) &&
    g.awayScore !== g.homeScore
  );
}

function buildRemainingScheduleGames(parsedGames) {
  const seen = new Set();
  const remaining = [];
  for (const g of parsedGames) {
    if (isPlayedScheduleGame(g)) continue;
    const awayId = normalizeScheduleTeamId(g.awayId);
    const homeId = normalizeScheduleTeamId(g.homeId);
    const gid = safeText(g.gameId);
    const key = gid ? `gid|${gid}` : `u|${g.isoDate || ""}|${[awayId, homeId].sort().join("|")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    remaining.push({ ...g, awayId, homeId });
  }
  remaining.sort((a, b) => {
    const d = (a.isoDate || "").localeCompare(b.isoDate || "");
    if (d !== 0) return d;
    return (a.rowIndex || 0) - (b.rowIndex || 0);
  });
  return remaining;
}

function heatMapRgb(t) {
  const clamped = Math.max(0, Math.min(1, t));
  const red = { r: 248, g: 113, b: 113 };
  const mid = { r: 254, g: 243, b: 199 };
  const green = { r: 74, g: 222, b: 128 };
  let r;
  let g;
  let b;
  if (clamped < 0.5) {
    const u = clamped / 0.5;
    r = red.r + (mid.r - red.r) * u;
    g = red.g + (mid.g - red.g) * u;
    b = red.b + (mid.b - red.b) * u;
  } else {
    const u = (clamped - 0.5) / 0.5;
    r = mid.r + (green.r - mid.r) * u;
    g = mid.g + (green.g - mid.g) * u;
    b = mid.b + (green.b - mid.b) * u;
  }
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/** Green = high value; red = low. Set invert for metrics where high is bad (e.g. SOS). */
function heatMapBackground(value, min, max, invert = false) {
  if (value == null || !Number.isFinite(value) || min == null || !Number.isFinite(min) || max == null || !Number.isFinite(max)) {
    return "";
  }
  if (max === min) return "background-color: #f3f4f6";
  let t = (value - min) / (max - min);
  if (invert) t = 1 - t;
  return `background-color: ${heatMapRgb(t)}`;
}

function applyPowerRankingsHeatMaps(rows) {
  const winVals = rows.map((r) => r.winPct).filter((v) => Number.isFinite(v));
  const sosVals = rows.map((r) => r.sosOppWinPct).filter((v) => Number.isFinite(v));
  const winMin = winVals.length ? Math.min(...winVals) : 0;
  const winMax = winVals.length ? Math.max(...winVals) : 1;
  const sosMin = sosVals.length ? Math.min(...sosVals) : 0;
  const sosMax = sosVals.length ? Math.max(...sosVals) : 1;
  return rows.map((r) => ({
    ...r,
    winPctHeatStyle: heatMapBackground(r.winPct, winMin, winMax, false),
    sosHeatStyle: heatMapBackground(r.sosOppWinPct, sosMin, sosMax, true),
  }));
}

function buildPowerRankingsCurrentRows(teamSections, captainMap) {
  const rows = teamSections.map((t, i) => ({
    rank: i + 1,
    teamId: t.teamId,
    teamName: t.teamName,
    captain: lookupPowerRankingsCaptain(captainMap, t.teamId, t.teamName),
    powerRating: t.teamOffenseRating,
    rosterRating: t.teamPlayerRating,
    wins: t.teamWins,
    losses: t.teamLosses,
    gamesPlayed: t.teamWins + t.teamLosses,
    winPct: t.teamWinPct,
    sosOppWinPct: t.teamSosOppWinPct,
  }));
  return applyPowerRankingsHeatMaps(rows);
}

/**
 * Project final W-L using current record + expected wins on remaining schedule
 * (matchup predictor win % per game).
 */
function attachCaptainsToProjectionRows(rows, captainMap) {
  for (const row of rows) {
    row.captain = lookupPowerRankingsCaptain(captainMap, row.teamId, row.teamName);
  }
  return rows;
}

function projectSeasonStandings(teams, standingsMap, teamProfiles, leagueNorms, runBase, parsedGames) {
  const remaining = buildRemainingScheduleGames(parsedGames);
  const rowsById = new Map();

  for (const t of teams) {
    const sid = normalizeScheduleTeamId(t.teamId);
    const st = standingsMap.get(sid) || {
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
    };
    rowsById.set(sid, {
      teamId: sid,
      teamName: t.teamName,
      currentWins: st.wins,
      currentLosses: st.losses,
      gamesPlayed: st.gamesPlayed,
      expFutureWins: 0,
      expFutureLosses: 0,
      scheduledRemaining: 0,
    });
  }

  let remainingGamesSimulated = 0;
  for (const g of remaining) {
    const awayProfile = teamProfiles.get(g.awayId);
    const homeProfile = teamProfiles.get(g.homeId);
    if (!awayProfile || !homeProfile) continue;

    const { away: pAway, home: pHome } = predictSeasonGameWinProbs(
      awayProfile,
      homeProfile,
      leagueNorms,
      runBase
    );

    const awayRow = rowsById.get(g.awayId);
    const homeRow = rowsById.get(g.homeId);
    if (awayRow) {
      awayRow.expFutureWins += pAway;
      awayRow.expFutureLosses += pHome;
      awayRow.scheduledRemaining += 1;
    }
    if (homeRow) {
      homeRow.expFutureWins += pHome;
      homeRow.expFutureLosses += pAway;
      homeRow.scheduledRemaining += 1;
    }
    remainingGamesSimulated += 1;
  }

  const rows = [];
  for (const row of rowsById.values()) {
    const projWins = row.currentWins + row.expFutureWins;
    const projLosses = row.currentLosses + row.expFutureLosses;
    const projGames = projWins + projLosses;
    const roundedWins = Math.round(projWins);
    const roundedLosses = Math.round(projLosses);
    const expRestWins = roundedWins - row.currentWins;
    const expRestLosses = roundedLosses - row.currentLosses;
    rows.push({
      ...row,
      projectedWins: roundMatchupN(projWins, 1),
      projectedLosses: roundMatchupN(projLosses, 1),
      projectedRecord: `${roundedWins}-${roundedLosses}`,
      projectedWinPct:
        projGames > 0 ? roundMatchupN((projWins / projGames) * 100, 1) : null,
      expRestRecord: `${expRestWins}-${expRestLosses}`,
      gamesToReachSeason: Math.max(0, REGULAR_SEASON_GAMES - row.gamesPlayed),
    });
  }

  rows.sort((a, b) => {
    const d = b.projectedWins - a.projectedWins;
    if (d !== 0) return d;
    const wp = (b.projectedWinPct ?? 0) - (a.projectedWinPct ?? 0);
    if (wp !== 0) return wp;
    return String(a.teamId).localeCompare(String(b.teamId), undefined, { numeric: true });
  });
  rows.forEach((r, i) => {
    r.projectedRank = i + 1;
  });

  return {
    rows,
    remainingGamesSimulated,
    remainingGamesTotal: remaining.length,
  };
}

function attachPowerRatingsToProjections(projectionRows, teamSections) {
  const powerById = new Map();
  const currentRankById = new Map();
  for (const t of teamSections) {
    const sid = normalizeScheduleTeamId(t.teamId);
    powerById.set(sid, t.teamOffenseRating);
  }
  teamSections.forEach((t, i) => {
    currentRankById.set(normalizeScheduleTeamId(t.teamId), i + 1);
  });
  for (const r of projectionRows) {
    r.powerRating = powerById.get(r.teamId) ?? null;
    r.currentPowerRank = currentRankById.get(r.teamId) ?? null;
  }
  return projectionRows;
}


async function loadDefensiveRatingsNormalizedMap() {
  const map = new Map();
  try {
    const manual = require("./data/defensiveRatings2026");
    for (const [k, v] of Object.entries(manual.normalizedNameToDefense || {})) {
      map.set(normalizePlayerName(k), toNumber(v));
    }
  } catch {
    /* optional file */
  }

  const xlsxPath = XLSX_DEFENSIVE_TEMPLATE;
  try {
    await fs.access(xlsxPath);
    const XLSX = require("xlsx");
    const buf = await fs.readFile(xlsxPath);
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
    for (const row of jsonRows) {
      const player =
        row.Player ||
        row.player ||
        row.NAME ||
        row.PlayerName ||
        row["Player Name"] ||
        "";
      const defRaw =
        row["Defensive Rating"] ??
        row["Defensive"] ??
        row.defensive ??
        row.DEF ??
        row.Defense ??
        row.Rating ??
        "";
      const name = safeText(player);
      if (!name) continue;
      const n = Number(safeText(String(defRaw)).replace(/,/g, ""));
      if (!Number.isFinite(n)) continue;
      map.set(normalizePlayerName(name), n);
    }
  } catch {
    /* no workbook or unreadable */
  }

  return map;
}

function levenshtein(a, b) {
  const s = safeText(a).toLowerCase();
  const t = safeText(b).toLowerCase();
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function normalizedDistance(a, b) {
  const maxLen = Math.max(safeText(a).length, safeText(b).length, 1);
  return levenshtein(a, b) / maxLen;
}

app.get("/", async (req, res) => {
  try {
    await renderLeagueLeadersPage(res);
  } catch (error) {
    res.status(500).send(publicErrorMessage(error, "Failed to load league leaders. Please try again."));
  }
});

app.get("/stats", (req, res) => {
  res.redirect(301, "/");
});

/** Offensive rankings hidden for now. */
app.get("/offensive-rankings", (req, res) => {
  res.redirect(302, "/");
});

app.get("/rankings/offense", (req, res) => {
  res.redirect(302, "/");
});

app.get("/power-rankings", (req, res) => {
  res.redirect(302, "/rankings/power");
});

app.get("/rankings/power", async (req, res) => {
  try {
    if (STATIC_EXPORT) {
      return renderPage(res, "power-rankings", {
        navActive: "power",
        pageTitle: "Power Rankings",
        clientSidePowerRankings: true,
        regularSeasonGames: REGULAR_SEASON_GAMES,
        currentRankings: [],
        projectionRows: [],
        remainingGamesSimulated: 0,
        remainingGamesTotal: 0,
        teamOverallWeights: {
          player: TEAM_OVERALL_WEIGHT_PLAYER,
          record: TEAM_OVERALL_WEIGHT_RECORD,
          sos: TEAM_OVERALL_WEIGHT_SOS,
        },
      });
    }

    renderPage(res, "power-rankings", {
      navActive: "power",
      pageTitle: "Power Rankings",
      clientSidePowerRankings: true,
      regularSeasonGames: REGULAR_SEASON_GAMES,
      currentRankings: [],
      projectionRows: [],
      remainingGamesSimulated: 0,
      remainingGamesTotal: 0,
      teamOverallWeights: {
        player: TEAM_OVERALL_WEIGHT_PLAYER,
        record: TEAM_OVERALL_WEIGHT_RECORD,
        sos: TEAM_OVERALL_WEIGHT_SOS,
      },
    });
  } catch (error) {
    res.status(500).send(publicErrorMessage(error, "Failed to build power rankings. Please try again."));
  }
});

/** Defense rankings hidden for now. */
app.get("/rankings/defense", (req, res) => {
  res.redirect(302, "/");
});

app.get("/defense-rankings", (req, res) => {
  res.redirect(302, "/");
});


app.get("/dfs", async (req, res) => {
  try {
    const [
      teams,
      careerByPlayer,
      hist2025ByPlayer,
      stats2026ByPlayer,
      schedulePayload,
      gamelogs,
      replacements,
    ] = await Promise.all([
      loadTeamRosters(),
      loadCareerByPlayer(),
      load2025HistoricalByPlayer(),
      load2026StatsByPlayer(),
      loadWeeklySchedule(),
      load2026GamelogsByPlayer(),
      getCachedPlayerReplacements(),
    ]);

    const scheduleRows = await fetchCsvRows(SCHEDULE_URL);
    const parsedScheduleGames = buildParsedScheduleGames(scheduleRows, teams);
    const scheduleRunRates = buildTeamScheduleRunRates(parsedScheduleGames, teams);

    const bundles = collectLeagueOffenseBundles(careerByPlayer, hist2025ByPlayer, stats2026ByPlayer);
    const { moments } = weightedMomentsPerMetric(bundles);
    const leagueRows = buildOffensivePlayerRows(
      teams,
      careerByPlayer,
      hist2025ByPlayer,
      stats2026ByPlayer,
      moments,
      DFS_SALARY_RATING_BLEND
    );
    const offenseRatingByNorm = new Map(leagueRows.map((r) => [r.norm, r.rating]));
    const teamCodeById = buildTeamCodeById(teams, stats2026ByPlayer);

    const refIso = referenceIsoForScheduleYear(SCHEDULE_CALENDAR_YEAR);
    const nowMs = Date.now();
    const fullSlateOptions = buildDfsSlateOptions(schedulePayload, refIso, nowMs);
    const slateOptions = filterVisibleDfsSlateOptions(fullSlateOptions);
    const activeSlateToken = fullSlateOptions.find((o) => o.canEdit)?.value ?? null;
    const allSlatesLocked = !activeSlateToken;

    const slateParam = safeText(req.query.slate).toUpperCase();
    const viewOnlySlate = safeText(req.query.view) === "1";
    if (
      !viewOnlySlate &&
      slateParam &&
      activeSlateToken &&
      slateParam !== activeSlateToken
    ) {
      const requested = fullSlateOptions.find((o) => o.value === slateParam);
      if (requested && !requested.canEdit) {
        return res.redirect(
          302,
          sitePath(`/dfs?slate=${encodeURIComponent(activeSlateToken)}`)
        );
      }
    }

    let selectedToken = activeSlateToken;
    if (slateParam && slateOptions.some((o) => o.value === slateParam)) {
      selectedToken = slateParam;
    } else if (!selectedToken && slateOptions.length) {
      selectedToken = slateOptions[slateOptions.length - 1].value;
    } else if (!selectedToken) {
      selectedToken = fullSlateOptions[0]?.value || "";
    }

    let slate = buildSlateFromToken(selectedToken, schedulePayload, refIso, fullSlateOptions, nowMs);
    if (!slate) {
      slate = {
        viewToken: "",
        slateType: null,
        games: [],
        teamIds: new Set(),
        isoDates: [],
        label: "No slate available",
        isPast: false,
        canEdit: false,
        isViewOnly: false,
        isFuture: false,
        isLocked: true,
        isActive: false,
        weekNumber: null,
      };
    }
    const canEdit = slate.canEdit ?? false;

    const playerPool = buildDfsPlayerPool({
      teams,
      slate,
      offenseRatingByNorm,
      scheduleRunRates,
      stats2026ByPlayer,
      teamCodeById,
      replacementByOriginalNorm: replacements.byOriginalNorm,
    });

    const poolByNorm = new Map(playerPool.map((p) => [p.norm, p]));
    const lineupNorms = remapLineupNorms(
      safeText(req.query.lineup).split(",").filter(Boolean),
      replacements.byOriginalNorm
    )
      .filter((n) => poolByNorm.has(n))
      .slice(0, DFS_LINEUP_SIZE);

    const salaryUsed = lineupNorms.reduce((sum, n) => sum + (poolByNorm.get(n)?.salary || 0), 0);

    const showSlateStats = Boolean(slate && !slate.canEdit);
    let slateStats = { byNorm: {}, hasStats: false };
    if (showSlateStats && playerPool.length) {
      slateStats = buildSlatePointsByNorm(playerPool, slate, gamelogs);
    }
    const playerPoolWithStats = playerPool.map((p) => {
      const row = slateStats.byNorm[p.norm] || { points: 0, games: 0 };
      return {
        ...p,
        slatePoints: row.points,
        slateGames: row.games,
        doubleHeader: Boolean(p.doubleHeader || row.games >= 2),
      };
    });

    const scored =
      showSlateStats && lineupNorms.length
        ? scoreLineupFromPointsMap(lineupNorms, poolByNorm, slateStats.byNorm)
        : null;

    const prevSlate =
      slate.viewToken && /^W\d+$/i.test(slate.viewToken)
        ? resolvePreviousDfsSlate(slate.viewToken, schedulePayload)
        : null;
    let lastWeekPreview = null;
    if (prevSlate) {
      const { byNorm, hasStats } = buildLastWeekPointsByNorm(playerPool, prevSlate, gamelogs);
      lastWeekPreview = {
        slateLabel: prevSlate.label,
        viewToken: prevSlate.viewToken,
        byNorm,
        hasStats,
        scored:
          lineupNorms.length > 0
            ? scoreLineupFromPointsMap(lineupNorms, poolByNorm, byNorm)
            : null,
      };
    }

    const firebaseClientConfig = getFirebaseClientConfig();
    const lockDeadline = canEdit
      ? resolveNextLineupLockDeadline(fullSlateOptions, slate, nowMs)
      : { deadlineMs: null, deadlineLabel: "" };

    renderPage(res, "dfs-lineup", {
      navActive: "dfs",
      refIso,
      slate,
      slateOptions,
      activeSlateToken,
      allSlatesLocked,
      canEdit,
      dfsLockDeadlineMs: lockDeadline.deadlineMs,
      dfsLockDeadlineLabel: lockDeadline.deadlineLabel,
      selectedSlate: slate?.viewToken || "",
      clientSidePool: STATIC_EXPORT,
      playerPool: STATIC_EXPORT ? [] : playerPoolWithStats,
      showSlateStats,
      slateStats,
      lineupNorms,
      lineupSize: DFS_LINEUP_SIZE,
      salaryCap: DFS_SALARY_CAP,
      salaryUsed,
      salaryRemaining: DFS_SALARY_CAP - salaryUsed,
      scoringRules: DFS_SCORING,
      scored,
      hasGamelogData: gamelogs.byNorm.size > 0,
      lastWeekPreview,
      firebaseClientConfig,
      firebaseEnabled: !!firebaseClientConfig,
      slateHasBoxScores: slateHasGamelogDates(slate, gamelogs),
    });
  } catch (error) {
    console.error(error);
    res.status(500).send(publicErrorMessage(error, "DFS page failed to load. Please try again."));
  }
});

const weeklyScheduleCache = createMemoryCache(
  Number(process.env.SCHEDULE_CACHE_TTL_MS) || 10 * 60 * 1000,
  "weekly-schedule"
);

function getCachedWeeklySchedule() {
  return weeklyScheduleCache.get("payload", loadWeeklySchedule);
}

/** Server-rendered standings (no browser Firestore fetch). */
async function loadWeeklyStandingsForSlate(selectedWeek) {
  const db = getAdminFirestore();
  if (!db) return null;
  const slateId = safeText(selectedWeek).toUpperCase();
  if (!slateId) return null;
  const lineups = await fetchLineupsForSlate(db, slateId);
  return buildWeeklyLeaderboardResponse(slateId, lineups);
}

/** Firestore lineups for slate + score (weekly only). */
app.get("/api/dfs/leaderboard/data", async (req, res) => {
  try {
    const selectedWeek = safeText(req.query.week || req.query.selectedWeek).toUpperCase();

    const db = getAdminFirestore();
    if (!db) {
      return res.status(503).json({
        needClientLineups: true,
        error:
          "Leaderboard server read is not configured. For local dev, set FIREBASE_SERVICE_ACCOUNT_JSON. On GitHub Pages, the browser loads lineups directly from Firestore.",
      });
    }

    if (!selectedWeek) {
      return res.status(400).json({ error: "Missing week (slate id), e.g. W1 or D20260514." });
    }

    const lineups = await fetchLineupsForSlate(db, selectedWeek);
    const body = await buildWeeklyLeaderboardResponse(selectedWeek, lineups);
    res.setHeader("Cache-Control", "private, max-age=60");
    res.json(body);
  } catch (error) {
    console.error("[MMS] GET /api/dfs/leaderboard/data:", error);
    res.status(500).json({ error: publicErrorMessage(error, "Leaderboard load failed.") });
  }
});

/** Score lineups sent from the browser (fallback when Admin SDK is not on Render). */
app.post("/api/dfs/leaderboard/score", async (req, res) => {
  try {
    const selectedWeek = safeText(req.body?.selectedWeek || req.body?.week).toUpperCase();
    const lineups = Array.isArray(req.body?.lineups) ? req.body.lineups : [];

    if (!selectedWeek) {
      return res.status(400).json({ error: "Missing selectedWeek (slate id)." });
    }

    const body = await buildWeeklyLeaderboardResponse(selectedWeek, lineups);
    res.json(body);
  } catch (error) {
    console.error("[MMS] POST /api/dfs/leaderboard/score:", error);
    res.status(500).json({ error: publicErrorMessage(error, "Leaderboard scoring failed.") });
  }
});

app.get(["/dfs/leaderboard/lineup", "/dfs/leaderboard/lineup/"], async (req, res) => {
  try {
    const week = safeText(req.query.week || req.query.slate).toUpperCase();
    const userId = safeText(req.query.user || req.query.userId);
    const firebaseClientConfig = getFirebaseClientConfig();
    const useClientLineup = STATIC_EXPORT || !isFirebaseAdminConfigured();

    if (useClientLineup) {
      return renderPage(res, "dfs-leaderboard-lineup-client", {
        navActive: "dfs",
        selectedWeek: week,
        firebaseClientConfig,
        firebaseEnabled: !!firebaseClientConfig,
      });
    }

    if (!week || !userId) {
      return res.status(400).send("Missing week (slate) or user id.");
    }

    const db = getAdminFirestore();
    if (!db) {
      return res
        .status(503)
        .send("Lineup view requires FIREBASE_SERVICE_ACCOUNT_JSON on the server.");
    }

    const schedulePayload = await getCachedWeeklySchedule();
    const refIso = referenceIsoForScheduleYear(SCHEDULE_CALENDAR_YEAR);
    const nowMs = Date.now();
    const { scoringDeps } = await getCachedDfsLeaderboardScoringContext();

    const lineup = await fetchLineupByUserAndSlate(db, week, userId);
    const detail = await buildLineupDetailView(
      lineup,
      week,
      scoringDeps,
      schedulePayload,
      refIso,
      nowMs
    );

    if (detail.error && detail.locked === false) {
      return res.status(403).send(detail.error);
    }
    if (detail.error) {
      return res.status(404).send(detail.error);
    }

    renderPage(res, "dfs-leaderboard-lineup", {
      navActive: "dfs",
      selectedWeek: week,
      detail,
      scoringRules: DFS_SCORING,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send(publicErrorMessage(error, "Lineup view failed to load. Please try again."));
  }
});

app.get("/dfs/leaderboard", async (req, res) => {
  try {
    const weekParam = safeText(req.query.week).toUpperCase();

    const schedulePayload = await getCachedWeeklySchedule();
    const refIso = referenceIsoForScheduleYear(SCHEDULE_CALENDAR_YEAR);
    const nowMs = Date.now();
    const weekOptions = listLeaderboardSlateOptions(schedulePayload, refIso, nowMs);
    const selectedWeek =
      weekParam && weekOptions.some((w) => w.value === weekParam)
        ? weekParam
        : defaultLeaderboardWeek(weekOptions, schedulePayload, refIso, nowMs);

    if (safeText(req.query.tab).toLowerCase() === "cumulative") {
      return res.redirect(
        302,
        sitePath(`/dfs/leaderboard?week=${encodeURIComponent(selectedWeek)}`)
      );
    }

    const slate = buildLeaderboardSlateFromToken(selectedWeek, schedulePayload, refIso, nowMs);
    const firebaseClientConfig = getFirebaseClientConfig();
    const adminConfigured = STATIC_EXPORT ? false : isFirebaseAdminConfigured();

    let weeklyStandings = null;
    let weeklyStandingsError = null;
    if (adminConfigured) {
      try {
        weeklyStandings = await loadWeeklyStandingsForSlate(selectedWeek);
      } catch (err) {
        console.error("[MMS] Leaderboard page standings:", err);
        weeklyStandingsError = publicErrorMessage(err, "Could not load standings.");
      }
    }

    const hasGamelogData =
      weeklyStandings?.hasGamelogData !== undefined ? weeklyStandings.hasGamelogData : true;
    const slateHasBoxScoresForWeek = weeklyStandings?.slateHasBoxScoresForWeek ?? false;

    const slateLocked = slate ? slate.canEdit !== true : false;

    const useClientScoring = STATIC_EXPORT || !adminConfigured;

    renderPage(res, "dfs-leaderboard", {
      navActive: "dfs",
      weekOptions,
      selectedWeek,
      slate,
      slateLocked,
      hasGamelogData,
      slateHasBoxScoresForWeek,
      weeklyStandings,
      weeklyStandingsError,
      serverRenderedStandings: STATIC_EXPORT
        ? false
        : !!(weeklyStandings && !weeklyStandingsError),
      leaderboardServerRead: adminConfigured,
      firebaseClientConfig,
      firebaseEnabled: !!firebaseClientConfig,
      useClientScoring,
      scoringRules: DFS_SCORING,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send(publicErrorMessage(error, "DFS leaderboard failed to load. Please try again."));
  }
});

async function loadMatchupPredictorSeasonRecord() {
  const [
    teams,
    careerByPlayer,
    hist2025ByPlayer,
    stats2026ByPlayer,
    scheduleRows,
    defenseMap,
    replacements,
    gamelogs,
    captainTeamCodeById,
  ] = await Promise.all([
    loadTeamRosters(),
    loadCareerByPlayer(),
    load2025HistoricalByPlayer(),
    load2026StatsByPlayer(),
    fetchCsvRows(SCHEDULE_URL),
    loadDefensiveRatingsNormalizedMap(),
    getCachedPlayerReplacements(),
    load2026GamelogsByPlayer(),
    loadCaptainTeamCodeById(),
  ]);
  const { byOriginalNorm } = replacements;
  const teamCodeById = new Map([
    ...buildTeamCodeById(teams, stats2026ByPlayer),
    ...captainTeamCodeById,
  ]);
  const nameToTeamId = buildNameToTeamIdMap(teams);
  const rosterByTeamId = buildRosterByTeamId(teams);
  const parsedScheduleGames = buildParsedScheduleGames(scheduleRows, teams);
  const payload = await loadWeeklySchedule();
  const audit = await getMatchupPredictorAudit({
    parsedScheduleGames,
    teams,
    rosterByTeamId,
    nameToTeamId,
    careerByPlayer,
    hist2025ByPlayer,
    stats2026ByPlayer,
    defenseMap,
    gamelogs,
    teamCodeById,
    replacementByOriginalNorm: byOriginalNorm,
    sundayIsosSorted: payload.sundayIsosSorted,
  }).catch((err) => {
    console.error("[MMS] Matchup predictor audit:", err.message || err);
    return null;
  });
  if (!audit || audit.decided <= 0) return null;
  return matchupPredictorHeadlineRecord(audit);
}

app.get("/matchup-predictor/season-record.json", async (_req, res) => {
  try {
    const record = await loadMatchupPredictorSeasonRecord();
    if (!record) {
      return res.status(404).json({ error: "Season record unavailable" });
    }
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.json(record);
  } catch (error) {
    return res.status(500).json({ error: publicErrorMessage(error, "Failed to load season record.") });
  }
});

async function loadMatchupPredictorDefaultViewMeta(mode = "future") {
  const payload = await loadWeeklySchedule();
  const refIso = referenceIsoForScheduleYear(SCHEDULE_CALENDAR_YEAR);
  const nowMs = Date.now();
  const view = pickMatchupPredictorDefaultViewForMode(payload, refIso, nowMs, mode);
  if (!view) return null;
  return {
    mode: normalizeMatchupPredictorMode(mode),
    view: safeText(view).toUpperCase(),
    refIso,
    computedAt: new Date().toISOString(),
  };
}

async function sendMatchupPredictorDefaultViewJson(req, res) {
  try {
    const mode = normalizeMatchupPredictorMode(req.params?.mode);
    const meta = await loadMatchupPredictorDefaultViewMeta(mode);
    if (!meta?.view) {
      return res.status(404).json({ error: "Default view unavailable" });
    }
    res.setHeader("Cache-Control", "public, max-age=120");
    return res.json(meta);
  } catch (error) {
    return res.status(500).json({ error: publicErrorMessage(error, "Failed to load default view.") });
  }
}

app.get("/matchup-predictor/default-view.json", (req, res) => sendMatchupPredictorDefaultViewJson(req, res));
app.get("/matchup-predictor/future/default-view.json", (req, res) => {
  req.params.mode = "future";
  return sendMatchupPredictorDefaultViewJson(req, res);
});
app.get("/matchup-predictor/past/default-view.json", (req, res) => {
  req.params.mode = "past";
  return sendMatchupPredictorDefaultViewJson(req, res);
});

function parseMatchupPredictorModeFromRequest(req) {
  if (req.params?.mode) return normalizeMatchupPredictorMode(req.params.mode);
  const p = safeText(req.path || "");
  if (/\/matchup-predictor\/past(?:\/|$)/i.test(p)) return "past";
  return "future";
}

async function renderMatchupPredictorPage(req, res) {
  const matchupMode = parseMatchupPredictorModeFromRequest(req);
  try {
    const [
      payload,
      teams,
      careerByPlayer,
      hist2025ByPlayer,
      stats2026ByPlayer,
      scheduleRows,
      defenseMap,
      replacements,
      gamelogs,
      captainTeamCodeById,
    ] = await Promise.all([
      loadWeeklySchedule(),
      loadTeamRosters(),
      loadCareerByPlayer(),
      load2025HistoricalByPlayer(),
      load2026StatsByPlayer(),
      fetchCsvRows(SCHEDULE_URL),
      loadDefensiveRatingsNormalizedMap(),
      getCachedPlayerReplacements(),
      load2026GamelogsByPlayer(),
      loadCaptainTeamCodeById(),
    ]);
    const { byOriginalNorm } = replacements;
    const teamCodeById = new Map([
      ...buildTeamCodeById(teams, stats2026ByPlayer),
      ...captainTeamCodeById,
    ]);

    const viewFromPath = safeText(req.params?.view);
    let viewParam = viewFromPath || safeText(req.query.view);
    if (!viewParam && req.query.week !== undefined && req.query.week !== null && safeText(req.query.week) !== "") {
      const wk = safeText(req.query.week);
      viewParam = /^W\d+$/i.test(wk) ? `W${Number(wk.slice(1))}` : `W${parseWeekIndex(wk, 1)}`;
    }
    if (!viewParam) {
      const wedDigits = safeText(req.query.wed).replace(/^D/i, "").toUpperCase();
      if (/^\d{8}$/.test(wedDigits)) viewParam = `D${wedDigits}`;
    }
    const refIso = referenceIsoForScheduleYear(SCHEDULE_CALENDAR_YEAR);
    const nowMs = Date.now();

    if (!viewParam) {
      viewParam =
        pickMatchupPredictorDefaultViewForMode(payload, refIso, nowMs, matchupMode) ||
        pickSmartDefaultScheduleView(localCalendarIso(), payload) ||
        payload.scheduleOptions.find((o) => /^W\d+$/i.test(o.value))?.value ||
        payload.scheduleOptions[0]?.value ||
        "";
    }

    const hasExplicitView =
      !!viewFromPath ||
      !!safeText(req.query.view) ||
      (req.query.week !== undefined && req.query.week !== null && safeText(req.query.week) !== "") ||
      /^\d{8}$/.test(safeText(req.query.wed).replace(/^D/i, ""));

    if (!hasExplicitView && viewParam && !req.params?.matchup) {
      return res.redirect(
        302,
        matchupPredictorViewPath(matchupMode, viewParam, "", SITE_BASE_PATH)
      );
    }

    const scheduleOptions = filterScheduleOptionsForMatchupPredictorMode(
      payload.scheduleOptions || [],
      payload,
      refIso,
      nowMs,
      matchupMode
    );
    const allowedViews = new Set(
      scheduleOptions.map((o) => safeText(o.value).toUpperCase()).filter(Boolean)
    );
    if (viewParam && allowedViews.size && !allowedViews.has(safeText(viewParam).toUpperCase())) {
      viewParam = pickMatchupPredictorDefaultViewForMode(payload, refIso, nowMs, matchupMode) || "";
      if (viewParam && !req.params?.matchup) {
        return res.redirect(
          302,
          matchupPredictorViewPath(matchupMode, viewParam, "", SITE_BASE_PATH)
        );
      }
    }
    const { selectedView, games, summaryLine } = resolveScheduleGamesForView(viewParam, payload);

    const matchupOptions = buildMatchupOptionsForGames(games);
    const validMatchupKeys = new Set(matchupOptions.map((o) => o.value));
    let selectedMatchup =
      matchupSlugToKey(req.params?.matchup) || matchupSlugToKey(req.query.matchup);
    if (!validMatchupKeys.has(selectedMatchup)) selectedMatchup = "";

    const nameToTeamId = buildNameToTeamIdMap(teams);
    const rosterByTeamId = buildRosterByTeamId(teams);

    const parsedScheduleGames = buildParsedScheduleGames(scheduleRows, teams);
    const auditInput = {
      parsedScheduleGames,
      teams,
      rosterByTeamId,
      nameToTeamId,
      careerByPlayer,
      hist2025ByPlayer,
      stats2026ByPlayer,
      defenseMap,
      gamelogs,
      teamCodeById,
      replacementByOriginalNorm: byOriginalNorm,
      sundayIsosSorted: payload.sundayIsosSorted,
    };
    const predictorAuditPromise = getMatchupPredictorAudit(auditInput).catch((err) => {
      console.error("[MMS] Matchup predictor audit:", err.message || err);
      return null;
    });
    const calibrationPromise = getMatchupCalibrationForProjections(auditInput).catch((err) => {
      console.error("[MMS] Matchup predictor calibration:", err.message || err);
      return null;
    });
    let {
      runBase,
      offenseRatingByNorm,
      defenseZByNorm,
      teamProfiles,
      leagueNorms,
    } = buildMatchupLeagueContext({
      teams,
      careerByPlayer,
      hist2025ByPlayer,
      stats2026ByPlayer,
      parsedScheduleGames,
      defenseMap,
      rosterByTeamId,
    });
    let activeStats2026 = stats2026ByPlayer;

    const awayMissingSet = parseMissingNorms(req.query.awayMissing, normalizePlayerName);
    const homeMissingSet = parseMissingNorms(req.query.homeMissing, normalizePlayerName);

    let selectedGame = null;
    let awayRoster = null;
    let homeRoster = null;
    let prediction = null;
    let gameResult = null;
    let lineupRuleAlerts = [];
    let matchupClient = null;
    let matchupCalibration = null;

    const viewIso =
      /^D\d{8}$/i.test(selectedView)
        ? compactDayDigitsToIso(safeText(selectedView).replace(/^D/i, ""))
        : /^W\d+$/i.test(selectedView)
          ? payload.sundayIsosSorted?.[Number(selectedView.slice(1)) - 1] || null
          : null;

    if (selectedMatchup) {
      selectedGame = findGameByMatchupKey(games, selectedMatchup);
      if (selectedGame) {
        const matchupReplacements = filterReplacementsForDate(
          byOriginalNorm,
          selectedGame.isoDate
        );

        awayRoster = pickRosterEntry(
          rosterByTeamId,
          nameToTeamId,
          selectedGame.awayTeamId,
          selectedGame.away
        );
        homeRoster = pickRosterEntry(
          rosterByTeamId,
          nameToTeamId,
          selectedGame.homeTeamId,
          selectedGame.home
        );

        const awayEffectivePlayers = applyReplacementsToPlayerNames(
          awayRoster?.players,
          matchupReplacements
        );
        const homeEffectivePlayers = applyReplacementsToPlayerNames(
          homeRoster?.players,
          matchupReplacements
        );

        const parsedGameForMissing = findParsedGameForMatchup(
          parsedScheduleGames,
          selectedGame,
          viewIso
        );
        if (isParsedGameFinished(parsedGameForMissing)) {
          awayMissingSet.clear();
          homeMissingSet.clear();
          applyGamelogMissingForFinishedGame({
            awayMissingSet,
            homeMissingSet,
            selectedGame,
            viewIso,
            parsedScheduleGames,
            gamelogs,
            teamCodeById,
            awayEffectivePlayers,
            homeEffectivePlayers,
            normalizeName: normalizePlayerName,
          });

          const gameIso = safeText(selectedGame.isoDate || viewIso);
          if (gameIso && gamelogs?.byNorm?.size) {
            const histStats = buildStats2026ByPlayerFromGamelogsBefore(gamelogs, gameIso);
            const histGames = filterScheduleGamesBeforeIso(parsedScheduleGames, gameIso);
            const histCtx = buildMatchupLeagueContext({
              teams,
              careerByPlayer,
              hist2025ByPlayer,
              stats2026ByPlayer: histStats.size ? histStats : stats2026ByPlayer,
              parsedScheduleGames: histGames,
              defenseMap,
              rosterByTeamId,
            });
            runBase = histCtx.runBase;
            offenseRatingByNorm = histCtx.offenseRatingByNorm;
            defenseZByNorm = histCtx.defenseZByNorm;
            teamProfiles = histCtx.teamProfiles;
            leagueNorms = histCtx.leagueNorms;
            activeStats2026 = histStats.size ? histStats : stats2026ByPlayer;
          }
        }

        const awayPositionByNorm = buildPositionByNormMap(awayEffectivePlayers);
        const homePositionByNorm = buildPositionByNormMap(homeEffectivePlayers);

        awayRoster = enrichRosterForMatchupView(
          awayRoster,
          offenseRatingByNorm,
          awayMissingSet,
          normalizePlayerName,
          activeStats2026,
          awayPositionByNorm,
          matchupReplacements
        );
        homeRoster = enrichRosterForMatchupView(
          homeRoster,
          offenseRatingByNorm,
          homeMissingSet,
          normalizePlayerName,
          activeStats2026,
          homePositionByNorm,
          matchupReplacements
        );

        const awayId = normalizeScheduleTeamId(selectedGame.awayTeamId);
        const homeId = normalizeScheduleTeamId(selectedGame.homeTeamId);
        let awayProfile = teamProfiles.get(awayId);
        let homeProfile = teamProfiles.get(homeId);
        let awayBaseProfile = null;
        let homeBaseProfile = null;

        if (awayProfile && awayRoster?.players?.length) {
          awayBaseProfile = { ...awayProfile };
          awayProfile = applyMissingPlayersToProfile(
            awayProfile,
            awayEffectivePlayers,
            awayMissingSet,
            offenseRatingByNorm,
            activeStats2026,
            defenseZByNorm,
            normalizePlayerName,
            awayPositionByNorm
          );
          teamProfiles.set(awayId, awayProfile);
        }
        if (homeProfile && homeRoster?.players?.length) {
          homeBaseProfile = { ...homeProfile };
          homeProfile = applyMissingPlayersToProfile(
            homeProfile,
            homeEffectivePlayers,
            homeMissingSet,
            offenseRatingByNorm,
            activeStats2026,
            defenseZByNorm,
            normalizePlayerName,
            homePositionByNorm
          );
          teamProfiles.set(homeId, homeProfile);
        }

        lineupRuleAlerts = [
          ...(awayRoster?.lineupAlerts || []).map((a) => ({
            ...a,
            teamSide: "away",
            teamName: awayRoster.teamName || selectedGame.away,
          })),
          ...(homeRoster?.lineupAlerts || []).map((a) => ({
            ...a,
            teamSide: "home",
            teamName: homeRoster.teamName || selectedGame.home,
          })),
        ];

        if (awayProfile && homeProfile) {
          const parsedGame = findParsedGameForMatchup(
            parsedScheduleGames,
            selectedGame,
            viewIso
          );
          const isFinishedGame = isParsedGameFinished(parsedGame);

          // Fixed league norms (full-roster baseline) — do not rebuild from adjusted profiles or
          // missing-player penalties get normalized away in z-scores.
          prediction = predictMatchupGame(awayProfile, homeProfile, leagueNorms, runBase);
          if (!isFinishedGame) {
            matchupCalibration = await calibrationPromise;
          }
          prediction.missingImpact = {
            away: {
              teamMultiplier: awayProfile.teamMultiplier ?? 1,
              defenseMultiplier: awayProfile.defenseMultiplier ?? 1,
              runsAgainstMultiplier: awayProfile.runsAgainstMultiplier ?? 1,
              offenseRating: awayProfile.offenseRating,
              presentCount: awayProfile.presentCount,
              missingCount: awayProfile.missingCount,
              shortHandedSlots: awayProfile.shortHandedSlots ?? 0,
            },
            home: {
              teamMultiplier: homeProfile.teamMultiplier ?? 1,
              defenseMultiplier: homeProfile.defenseMultiplier ?? 1,
              runsAgainstMultiplier: homeProfile.runsAgainstMultiplier ?? 1,
              offenseRating: homeProfile.offenseRating,
              presentCount: homeProfile.presentCount,
              missingCount: homeProfile.missingCount,
              shortHandedSlots: homeProfile.shortHandedSlots ?? 0,
            },
          };
          enrichMatchupPredictionLines(prediction);
          prediction.awayLabel = awayRoster.teamName || selectedGame.away;
          prediction.homeLabel = homeRoster.teamName || selectedGame.home;

          if (isFinishedGame) {
            gameResult = gradeMatchupModelBets(
              parsedGame,
              prediction,
              prediction.awayLabel,
              prediction.homeLabel
            );
          }

          if (awayBaseProfile && homeBaseProfile) {
            const matchupPositionByNorm = new Map([
              ...awayPositionByNorm.entries(),
              ...homePositionByNorm.entries(),
            ]);
            matchupClient = buildMatchupClientPayload({
              awayBaseProfile,
              homeBaseProfile,
              leagueNorms,
              runBase,
              awayPlayers: awayEffectivePlayers,
              homePlayers: homeEffectivePlayers,
              awayPlayersOriginal: awayRoster.players,
              homePlayersOriginal: homeRoster.players,
              replacementByOriginalNorm: matchupReplacements,
              gameIsoDate: selectedGame.isoDate || viewIso || null,
              gameId: selectedGame.gameId || parsedGameForMissing?.gameId || null,
              isFinishedGame: Boolean(gameResult),
              gameResult,
              awayLabel: prediction.awayLabel,
              homeLabel: prediction.homeLabel,
              offenseRatingByNorm,
              stats2026ByPlayer: activeStats2026,
              defenseZByNorm,
              positionByNorm: matchupPositionByNorm,
              calibrationWeights: matchupCalibration?.weights || null,
            });
          }
        }
      }
    }

    const awayMissingSerialized = serializeMissingNorms(awayMissingSet);
    const homeMissingSerialized = serializeMissingNorms(homeMissingSet);
    const predictorAudit = await predictorAuditPromise;
    if (!matchupCalibration) {
      matchupCalibration = await calibrationPromise;
    }
    const predictorRecord = matchupPredictorHeadlineRecord(predictorAudit);

    renderPage(res, "matchup-predictor", {
      navActive: "matchup",
      matchupMode,
      matchupModeLabel: matchupPredictorModeLabel(matchupMode),
      matchupBasePath: matchupPredictorBasePath(matchupMode, SITE_BASE_PATH),
      pageTitle: "Matchup Predictor",
      scheduleOptions,
      selectedView,
      scheduleSummary: summaryLine,
      matchupOptions,
      selectedMatchup,
      selectedGame,
      awayRoster,
      homeRoster,
      prediction: gameResult ? null : prediction,
      gameResult,
      awayMissingSerialized,
      homeMissingSerialized,
      lineupRuleAlerts,
      matchupClient,
      matchupPageReady: hasExplicitView,
      predictorRecord,
      predictorAudit,
    });
  } catch (error) {
    res.status(500).send(publicErrorMessage(error, "Failed to load matchup predictor. Please try again."));
  }
}

app.get("/matchup-predictor", (req, res) => {
  res.redirect(302, sitePath("/matchup-predictor/future"));
});

app.get("/matchup-predictor/future", renderMatchupPredictorPage);
app.get("/matchup-predictor/past", renderMatchupPredictorPage);
app.get("/matchup-predictor/future/view/:view", renderMatchupPredictorPage);
app.get("/matchup-predictor/past/view/:view", renderMatchupPredictorPage);
app.get("/matchup-predictor/future/view/:view/matchup/:matchup", renderMatchupPredictorPage);
app.get("/matchup-predictor/past/view/:view/matchup/:matchup", renderMatchupPredictorPage);

app.get("/matchup-predictor/view/:view", (req, res) => {
  const view = encodeURIComponent(req.params.view);
  res.redirect(302, sitePath(`/matchup-predictor/future/view/${view}`));
});
app.get("/matchup-predictor/view/:view/matchup/:matchup", (req, res) => {
  const view = encodeURIComponent(req.params.view);
  const matchup = encodeURIComponent(req.params.matchup);
  res.redirect(302, sitePath(`/matchup-predictor/future/view/${view}/matchup/${matchup}`));
});

/** Schedule page hidden for now. */
app.get("/schedule", (req, res) => {
  res.redirect(302, sitePath("/"));
});

/** Pretty paths for static GitHub Pages exports (redirect to query form on Node). */
app.get("/dfs/slate/:slate", (req, res) => {
  const token = safeText(req.params.slate).toUpperCase();
  res.redirect(302, sitePath(`/dfs?slate=${encodeURIComponent(token)}`));
});

app.get("/dfs/leaderboard/week/:week", (req, res) => {
  const week = safeText(req.params.week).toUpperCase();
  res.redirect(302, sitePath(`/dfs/leaderboard?week=${encodeURIComponent(week)}`));
});

async function renderLeagueLeadersPage(res) {
  if (STATIC_EXPORT) {
    return renderPage(res, "historical", {
      leaders: [],
      topRookies: [],
      clientSideLeaders: true,
      navActive: "home",
      pageTitle: "League Leaders",
      generatedAt: null,
    });
  }

  const stats2026ByPlayer = await load2026StatsByPlayer();
  const players2026 = Array.from(stats2026ByPlayer.values());
  const { leaders, topRookies } = buildLeagueLeaders(players2026);

  renderPage(res, "historical", {
    leaders,
    topRookies,
    navActive: "home",
    pageTitle: "League Leaders",
  });
}

/** Team stat pages hidden for now. */
app.get("/stats/team/:teamId", (req, res) => {
  res.redirect(302, "/");
});

app.get("/historical", (req, res) => {
  res.redirect(301, "/");
});


app.get("/confirm-names", async (req, res) => {
  try {
    const [teams, careerByPlayer] = await Promise.all([loadTeamRosters(), loadCareerByPlayer()]);
    const rosterNames = teams.flatMap((team) =>
      team.players.map((playerName) => ({ teamId: team.teamId, teamName: team.teamName, playerName }))
    );
    const careerNames = Array.from(careerByPlayer.keys());

    const rows = rosterNames.map((entry) => {
      let bestName = "";
      let bestScore = Number.POSITIVE_INFINITY;
      for (const candidate of careerNames) {
        const score = normalizedDistance(entry.playerName, candidate);
        if (score < bestScore) {
          bestScore = score;
          bestName = candidate;
        }
      }

      // strict threshold: if too dissimilar, treat as no usable similarity
      const hasSimilar = bestScore <= 0.42;
      let matchType = "none";
      if (hasSimilar) {
        matchType = bestScore === 0 ? "exact" : "similar";
      }
      return {
        ...entry,
        closestCareerName: hasSimilar ? bestName : "",
        distance: hasSimilar ? bestScore : null,
        matchType,
      };
    });

    renderPage(res, "confirm-names", {
      rows,
      pageTitle: "Roster name confirmation",
    });
  } catch (error) {
    res.status(500).send(publicErrorMessage(error, "Failed to build confirmation page. Please try again."));
  }
});

if (process.env.NODE_ENV === "production" && !getFirebaseClientConfig()) {
  console.warn(
    "[MMS] Firebase web config missing (FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_APP_ID, …). Add to .env, then run npm run build:pages before pushing docs/ to GitHub."
  );
}

function warmLeaderboardCaches() {
  return getCachedDfsLeaderboardScoringContext();
}

const LEADERBOARD_WARM_DELAY_MS = Number(process.env.LEADERBOARD_WARM_DELAY_MS) || 5000;

process.on("SIGTERM", () => {
  console.log("[MMS] SIGTERM received — Render is stopping this instance (deploy, restart, or memory limit).");
});

if (require.main === module) {
  const HOST = process.env.HOST || "0.0.0.0";
  app.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
    if (SITE_BASE_PATH) {
      console.log(`[MMS] SITE_BASE_PATH=${SITE_BASE_PATH}`);
    }
    if (STATIC_EXPORT) {
      console.log("[MMS] STATIC_EXPORT: client-side leaderboard scoring only.");
    } else if (isFirebaseAdminConfigured()) {
      console.log("[MMS] Leaderboard: server-side Firestore reads enabled.");
    } else {
      console.warn(
        "[MMS] Leaderboard: FIREBASE_SERVICE_ACCOUNT_JSON not set — browser will load lineups from Firestore (expected on GitHub Pages)."
      );
    }
    if (!STATIC_EXPORT) {
      setTimeout(() => {
        warmLeaderboardCaches()
          .then(() => {
            console.log("[MMS] Leaderboard data cache warmed.");
          })
          .catch((err) => {
            console.error("[MMS] Leaderboard cache warm failed:", err.message);
          });
      }, LEADERBOARD_WARM_DELAY_MS);
    }
  });
}
