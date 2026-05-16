require("dotenv").config();

const express = require("express");
const Papa = require("papaparse");
const fs = require("fs/promises");
const path = require("path");
const { getFirebaseClientConfig } = require("./lib/firebaseClientConfig");
const { fetchCsvText } = require("./lib/fetchCsvText");
const {
  buildWeeklyLeaderboardFromLineups,
  buildCumulativeLeaderboardFromLineups,
} = require("./lib/dfsLeaderboard");
const { canonicalRostersByTeamId } = require("./data/customRosters2026");
const { careerIncludes2025Set } = require("./data/careerIncludes2025Names");
const {
  parseMissingNorms,
  serializeMissingNorms,
  enrichRosterForMatchupView,
  applyMissingPlayersToProfile,
} = require("./lib/matchupMissingPlayers");
const {
  DFS_LINEUP_SIZE,
  DFS_SALARY_CAP,
  DFS_SCORING,
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
} = require("./lib/dfs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "512kb" }));

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
app.use(express.static(path.join(__dirname, "public")));

/** Main site navigation (shared header on all primary pages). */
const SITE_NAV = Object.freeze([
  { id: "home", label: "League Leaders", href: "/" },
  { id: "matchup", label: "Matchup Predictor", href: "/matchup-predictor" },
  { id: "dfs", label: "DFS Lineup", href: "/dfs" },
  { id: "power", label: "Power Rankings", href: "/rankings/power" },
]);

function renderPage(res, view, locals = {}) {
  res.render(view, {
    siteNav: SITE_NAV,
    generatedAt: locals.generatedAt || new Date().toISOString(),
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
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load CSV (${response.status}) from ${url}`);
  }
  const csvText = await response.text();
  return Papa.parse(csvText).data;
}

function buildTeamMap(indexRows) {
  const teamMap = new Map();

  for (let i = 1; i < indexRows.length; i += 1) {
    const row = indexRows[i];
    const teamId = safeText(row[4]); // Column E
    const captain = safeText(row[5]); // Column F
    const teamName = safeText(row[7]); // Column H
    const jerseyColor = safeText(row[10]) || "#1f2937"; // Column K
    const numberColor = safeText(row[11]) || "#ffffff"; // Column L
    if (!teamId || !captain) continue;
    teamMap.set(teamId, { teamId, captain, teamName, jerseyColor, numberColor });
  }

  return teamMap;
}

function buildRosterByCaptain(rosterRows) {
  const rosterMap = new Map();

  function extractRosterRange(captainRowIndex, playerStartRowIndex, startCol, endCol) {
    for (let col = startCol; col <= endCol; col += 1) {
      const captain = safeText(rosterRows[captainRowIndex] && rosterRows[captainRowIndex][col]);
      if (!captain) continue;

      const players = [];
      for (let r = playerStartRowIndex; r < playerStartRowIndex + 13; r += 1) {
        const player = safeText(rosterRows[r] && rosterRows[r][col]);
        if (player) players.push(player);
      }

      rosterMap.set(captain, players);
    }
  }

  extractRosterRange(1, 3, 0, 18); // Top half
  extractRosterRange(16, 18, 0, 18); // Bottom half
  return rosterMap;
}

function normalizePlayerName(name) {
  let s = safeText(name).toLowerCase().replace(/[.'’]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
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

function isTruthyRookie(value) {
  const text = safeText(value).toLowerCase();
  return text === "y" || text === "yes" || text === "true" || text === "1";
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

async function loadTeamRosters() {
  const [indexRows, rosterRows] = await Promise.all([
    fetchCsvRows(INDEX_URL),
    fetchCsvRows(ROSTER_URL),
  ]);

  const teamMap = buildTeamMap(indexRows);
  const rosterByCaptain = buildRosterByCaptain(rosterRows);
  const teams = [];

  for (let id = 1; id <= 18; id += 1) {
    const teamId = String(id);
    const teamMeta = teamMap.get(teamId) || { teamId, captain: "", teamName: `Team ${teamId}` };
    const players =
      canonicalRostersByTeamId[teamId] ||
      rosterByCaptain.get(teamMeta.captain) ||
      [];
    teams.push({ ...teamMeta, players });
  }

  return teams;
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
  return sortScheduleGameRows(chunk).map(({ _iso, ...rest }) => rest);
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

async function loadWeeklySchedule() {
  const [scheduleRows, teams] = await Promise.all([fetchCsvRows(SCHEDULE_URL), loadTeamRosters()]);
  const parsedGames = buildParsedScheduleGames(scheduleRows, teams);

  const uniqueIsosSorted = Array.from(new Set(parsedGames.map((g) => g.isoDate))).sort((a, b) => a.localeCompare(b));
  const sundayIsosSorted = uniqueIsosSorted.filter((iso) => weekdayFromIso(iso) === 0);
  const dateLabelByIso = new Map();
  for (const g of parsedGames) {
    if (!dateLabelByIso.has(g.isoDate)) dateLabelByIso.set(g.isoDate, g.dateDisplay);
  }

  const seen = new Set();
  /** @type {Map<string, Array<{home: string, away: string, location: string, time: string, date: string, result: string, gameId: string, _iso: string}>>} */
  const gamesByIso = new Map();

  for (const g of parsedGames) {
    const wd = weekdayFromIso(g.isoDate);
    if (wd !== 0 && wd !== 3) continue;

    const matchupIds = [g.awayId, g.homeId].sort((a, b) => a.localeCompare(b));
    const dedupeKey = `${g.isoDate}|${matchupIds[0]}|${matchupIds[1]}|${g.time}|${g.field}|${g.venueLabel}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const awayTeamId = String(Number(safeText(g.awayId).replace(/\s+/g, "")));
    const homeTeamId = String(Number(safeText(g.homeId).replace(/\s+/g, "")));

    const resultText = formatFinishedScheduleResult(g.awayScore, g.homeScore, g.resultCsv, g.winnerCsv);
    const row = {
      home: g.homeName,
      away: g.awayName,
      awayTeamId,
      homeTeamId,
      location: (g.venueLabel && g.venueLabel.trim()) || g.field || "-",
      time: g.time || "-",
      date: g.dateDisplay || "",
      result: resultText,
      gameId: g.gameId,
      _iso: g.isoDate,
    };
    if (!gamesByIso.has(g.isoDate)) gamesByIso.set(g.isoDate, []);
    gamesByIso.get(g.isoDate).push(row);
  }

  for (const iso of gamesByIso.keys()) {
    gamesByIso.set(iso, sortScheduleGameRows(gamesByIso.get(iso)));
  }

  /** One chronological dropdown: Sundays show date then week number; Wednesdays show date only. */
  const scheduleOptions = [];
  let sundayCounter = 0;
  for (const iso of uniqueIsosSorted) {
    const wd = weekdayFromIso(iso);
    const dl = dateLabelByIso.get(iso) || iso;
    if (wd === 0) {
      sundayCounter += 1;
      scheduleOptions.push({
        value: `W${sundayCounter}`,
        label: `${dl} • Week ${sundayCounter}`,
      });
    } else if (wd === 3) {
      scheduleOptions.push({
        value: `D${scheduleIsoToCompactDigits(iso)}`,
        label: dl,
      });
    }
  }

  const allScheduleViews = scheduleOptions.map((o) => o.value);

  const rosterByTeamId = {};
  for (const t of teams) {
    rosterByTeamId[t.teamId] = {
      teamName: t.teamName,
      captain: t.captain,
      jerseyColor: t.jerseyColor,
      numberColor: t.numberColor,
      players: Array.isArray(t.players) ? t.players : [],
    };
  }

  const scheduleRosterPayloadB64 = buildScheduleRosterPayloadB64(rosterByTeamId, teams);

  return {
    scheduleOptions,
    allScheduleViews,
    gamesByIso,
    sundayIsosSorted,
    uniqueIsosSorted,
    dateLabelByIso,
    rosterByTeamId,
    scheduleRosterPayloadB64,
  };
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
      games = sortScheduleGameRows(rows).map(({ _iso, ...rest }) => rest);
      summaryLine = payload.dateLabelByIso.get(iso) || iso;
    } else {
      games = [];
      summaryLine = "Invalid Wednesday selection.";
    }
  }

  return { selectedView: selected, games, summaryLine };
}

function buildNameToTeamIdMap(teams) {
  const nameToTeamId = {};
  for (const t of teams) {
    const key = normalizeScheduleTeamLabel(t.teamName);
    if (key && nameToTeamId[key] === undefined) nameToTeamId[key] = t.teamId;
  }
  return nameToTeamId;
}

function pickRosterEntry(rosterByTeamId, nameToTeamId, teamId, displayName) {
  const id = safeText(teamId);
  let entry = id && rosterByTeamId[id] ? rosterByTeamId[id] : null;

  if (entry && Array.isArray(entry.players) && entry.players.length) {
    return { ...entry, teamId: id };
  }

  const altKey = normalizeScheduleTeamLabel(displayName);
  const altId = altKey ? nameToTeamId[altKey] : null;
  const altEntry =
    altId != null && altId !== "" ? rosterByTeamId[String(altId)] : null;
  if (altEntry && Array.isArray(altEntry.players) && altEntry.players.length) {
    return { ...altEntry, teamId: String(altId) };
  }

  if (entry) return { ...entry, teamId: id };
  if (altEntry) return { ...altEntry, teamId: String(altId) };
  return {
    teamId: id || String(altId || ""),
    teamName: safeText(displayName) || "Team",
    captain: "",
    jerseyColor: "",
    numberColor: "",
    players: [],
  };
}

function matchupGameKey(game) {
  const away = safeText(game.awayTeamId);
  const home = safeText(game.homeTeamId);
  return `${away}|${home}`;
}

function findGameByMatchupKey(games, key) {
  const want = safeText(key);
  if (!want) return null;
  return games.find((g) => matchupGameKey(g) === want) || null;
}

function buildMatchupOptionsForGames(games) {
  return games.map((g) => ({
    value: matchupGameKey(g),
    label: `${g.away} @ ${g.home}${g.time && g.time !== "-" ? ` · ${g.time}` : ""}${
      g.result ? ` · ${g.result}` : ""
    }`,
    game: g,
  }));
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

async function load2026StatsByPlayer() {
  const csvText = await fetchCsvText(getStats2026CsvUrl());
  const rows = Papa.parse(csvText).data;
  // Row 1 is metadata, row 2 is header.
  const headers = (rows[1] || []).map((h) => safeText(h));
  const dataRows = rows.slice(2);
  const nameIndex = headers.findIndex((h) => h.toLowerCase() === "player");
  if (nameIndex === -1) {
    throw new Error("2026 stats CSV missing Player column.");
  }

  const statsByPlayer = new Map();
  for (const row of dataRows) {
    const playerName = safeText(row[nameIndex]);
    if (!playerName) continue;
    const stats = {};
    for (let i = 0; i < headers.length; i += 1) {
      stats[headers[i]] = safeText(row[i]);
    }
    statsByPlayer.set(normalizePlayerName(playerName), stats);
  }
  return statsByPlayer;
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
const TEAM_OVERALL_WEIGHT_PLAYER = 0.3;
const TEAM_OVERALL_WEIGHT_RECORD = 0.5;
const TEAM_OVERALL_WEIGHT_SOS = 0.2;
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

/** Rating = 70% hist + 30% 2026 when both exist; else the single available composite. */
function blendedOffenseRating(composite26, compositeHist, has26, hasHist) {
  if (has26 && hasHist) {
    return (
      OFFENSE_RATING_WEIGHT_HISTORICAL * compositeHist +
      OFFENSE_RATING_WEIGHT_2026 * composite26
    );
  }
  if (has26) return composite26;
  if (hasHist) return compositeHist;
  return neutralCompositeZ();
}

function buildOffensivePlayerRows(teams, careerByPlayer, hist2025ByPlayer, stats2026ByPlayer, moments) {
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

      const ratingRaw = blendedOffenseRating(composite26, compositeHist ?? 0, has26, hasHist);
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

function buildPowerRankingsCurrentRows(teamSections) {
  return teamSections.map((t, i) => ({
    rank: i + 1,
    teamId: t.teamId,
    teamName: t.teamName,
    powerRating: t.teamOffenseRating,
    rosterRating: t.teamPlayerRating,
    wins: t.teamWins,
    losses: t.teamLosses,
    gamesPlayed: t.teamWins + t.teamLosses,
    winPct: t.teamWinPct,
    sosOppWinPct: t.teamSosOppWinPct,
  }));
}

/**
 * Project final W-L using current record + expected wins on remaining schedule
 * (matchup predictor win % per game).
 */
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

/** Secondary talent index (roster/record/SOS) — minority blend into win %. */
const MATCHUP_LOGIT_SCALE = 0.6;
const MATCHUP_HOME_FIELD_LOGIT = 0.1;
/** Win %: mostly from projected run margin; talent index is a minority tie-breaker. */
const MATCHUP_WIN_WEIGHT_FROM_RUNS = 0.82;
const MATCHUP_WIN_WEIGHT_FROM_TALENT = 0.18;
/** Softer run-margin curve (~2-run edge ≈ 62% before shrink). */
const MATCHUP_RUN_MARGIN_LOGIT = 0.26;
/** Pull final win % toward 50% so extremes land ~70/30 not 90/10 (0.5 → half the distance from coin flip). */
const MATCHUP_WIN_PROB_SHRINK = 0.5;
/** Season standings projection: same model family, sharper than matchup lines (allows 18–4 type spreads). */
const SEASON_PROJ_RUN_MARGIN_LOGIT = 0.34;
const SEASON_PROJ_LOGIT_SCALE = 0.72;
const SEASON_PROJ_WIN_WEIGHT_FROM_RUNS = 0.8;
const SEASON_PROJ_WIN_WEIGHT_FROM_TALENT = 0.2;
const SEASON_PROJ_WIN_PROB_SHRINK = 0.82;
/** Composite team strength weights (sum = 1). */
const MATCHUP_POWER_WEIGHT_OFFENSE = 0.35;
const MATCHUP_POWER_WEIGHT_RUN_PROD = 0.12;
const MATCHUP_POWER_WEIGHT_RUNS_FOR = 0.1;
const MATCHUP_POWER_WEIGHT_RUNS_AGAINST = 0.08;
const MATCHUP_POWER_WEIGHT_TEAM_OVERALL = 0.22;
const MATCHUP_POWER_WEIGHT_WIN_PCT = 0.08;
const MATCHUP_POWER_WEIGHT_SOS = 0.05;
/** Run projection: roster + schedule runs for/against. */
const MATCHUP_RUN_OFF_Z_PCT = 0.08;
const MATCHUP_RUN_DEF_Z_PCT = 0.06;
const MATCHUP_SCHEDULE_RUNS_BLEND = 0.55;
const MATCHUP_OPP_RUNS_AGAINST_SCALE = 0.45;
const MATCHUP_AWAY_RUN_FACTOR = 0.97;
const MATCHUP_HOME_RUN_FACTOR = 1.03;
const DEFAULT_LEAGUE_RUNS_PER_TEAM = 11.5;

function rosterStatWeights(playerNames, stats2026ByPlayer) {
  return (playerNames || []).map((name) => {
    const norm = normalizePlayerName(name);
    const row = stats2026ByPlayer.get(norm);
    const pa = row ? toNumber(row.PA) : 0;
    return { norm, name, pa: pa > 0 ? pa : 1 };
  });
}

function paWeightedAverage(weights, valueFn) {
  let num = 0;
  let den = 0;
  for (const w of weights) {
    const v = valueFn(w);
    if (v == null || !Number.isFinite(v)) continue;
    num += v * w.pa;
    den += w.pa;
  }
  return den > 0 ? num / den : null;
}

function meanAndStd(values) {
  const xs = values.filter((v) => v != null && Number.isFinite(v));
  if (!xs.length) return { mean: 0, std: 1 };
  const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
  const variance = xs.reduce((s, v) => s + (v - mean) ** 2, 0) / xs.length;
  return { mean, std: Math.sqrt(Math.max(variance, 1e-10)) };
}

function zFrom(value, mean, std) {
  if (value == null || !Number.isFinite(value)) return 0;
  return (value - mean) / std;
}

function leagueRunScoringBaseline(parsedGames) {
  const seen = new Set();
  let totalRuns = 0;
  let games = 0;
  for (const g of parsedGames) {
    if (!Number.isFinite(g.awayScore) || !Number.isFinite(g.homeScore)) continue;
    const key = finishedScheduleGameDedupeKey(g);
    if (seen.has(key)) continue;
    seen.add(key);
    totalRuns += g.awayScore + g.homeScore;
    games += 1;
  }
  const avgTotal = games > 0 ? totalRuns / games : DEFAULT_LEAGUE_RUNS_PER_TEAM * 2;
  const avgPerTeam = avgTotal / 2;
  return {
    gamesSampled: games,
    avgTotalRuns: avgTotal,
    avgRunsPerTeam: avgPerTeam,
    avgRunsAgainstPerGame: avgPerTeam,
  };
}

/** Runs scored / allowed per team from completed schedule games. */
function buildTeamScheduleRunRates(parsedGames, teams) {
  const rec = new Map();
  for (const t of teams) {
    const id = normalizeScheduleTeamId(t.teamId);
    rec.set(id, { runsFor: 0, runsAgainst: 0, games: 0 });
  }

  const seen = new Set();
  for (const g of parsedGames) {
    if (!Number.isFinite(g.awayScore) || !Number.isFinite(g.homeScore)) continue;
    const key = finishedScheduleGameDedupeKey(g);
    if (seen.has(key)) continue;
    seen.add(key);

    const awayId = normalizeScheduleTeamId(g.awayId);
    const homeId = normalizeScheduleTeamId(g.homeId);
    if (!rec.has(awayId) || !rec.has(homeId)) continue;

    rec.get(awayId).runsFor += g.awayScore;
    rec.get(awayId).runsAgainst += g.homeScore;
    rec.get(awayId).games += 1;
    rec.get(homeId).runsFor += g.homeScore;
    rec.get(homeId).runsAgainst += g.awayScore;
    rec.get(homeId).games += 1;
  }

  const rates = new Map();
  for (const [id, r] of rec.entries()) {
    const g = r.games;
    rates.set(id, {
      gamesPlayed: g,
      runsFor: r.runsFor,
      runsAgainst: r.runsAgainst,
      runsPerGame: g > 0 ? r.runsFor / g : null,
      runsAgainstPerGame: g > 0 ? r.runsAgainst / g : null,
      runDiffPerGame: g > 0 ? (r.runsFor - r.runsAgainst) / g : null,
    });
  }
  return rates;
}

function buildDefenseZByNorm(defenseMap, stats2026ByPlayer) {
  const raw = [];
  for (const [norm, def] of defenseMap.entries()) {
    if (Number.isFinite(def)) raw.push(def);
  }
  const { mean, std } = meanAndStd(raw);
  const zByNorm = new Map();
  for (const [norm, def] of defenseMap.entries()) {
    if (!Number.isFinite(def)) continue;
    zByNorm.set(norm, zFrom(def, mean, std));
  }
  return { zByNorm, mean, std };
}

function buildTeamMatchupProfiles(
  teams,
  rosterByTeamId,
  offenseRatingByNorm,
  stats2026ByPlayer,
  defenseZByNorm,
  standingsMap,
  teamOverallById,
  scheduleRunRates
) {
  const profiles = new Map();
  for (const t of teams) {
    const sid = normalizeScheduleTeamId(t.teamId);
    const roster = rosterByTeamId[t.teamId] || rosterByTeamId[sid] || { players: t.players || [] };
    const weights = rosterStatWeights(roster.players || t.players, stats2026ByPlayer);

    const offenseRating = paWeightedAverage(weights, (w) => offenseRatingByNorm.get(w.norm));
    const runProd2026 = paWeightedAverage(weights, (w) => {
      const row = stats2026ByPlayer.get(w.norm);
      const pa = row ? toNumber(row.PA) : 0;
      if (pa <= 0) return null;
      return (toNumber(row.Runs) + toNumber(row.RBI)) / pa;
    });
    const defenseZ = paWeightedAverage(weights, (w) => {
      const z = defenseZByNorm.get(w.norm);
      return z != null && Number.isFinite(z) ? z : null;
    });

    const st = standingsMap?.get(sid);
    const overall = teamOverallById.get(sid) ?? teamOverallById.get(t.teamId);
    const rr = scheduleRunRates?.get(sid);

    profiles.set(sid, {
      teamId: sid,
      teamName: roster.teamName || t.teamName,
      offenseRating,
      runProd2026,
      defenseZ: defenseZ ?? 0,
      winPct: st?.winPct ?? null,
      sosOppWinPct: st?.sosOppWinPct ?? null,
      teamOverall: overall?.teamOffenseRating ?? null,
      rosterPlayerRating: offenseRating,
      scheduleGames: rr?.gamesPlayed ?? 0,
      runsPerGame: rr?.runsPerGame ?? null,
      runsAgainstPerGame: rr?.runsAgainstPerGame ?? null,
      runDiffPerGame: rr?.runDiffPerGame ?? null,
    });
  }
  return profiles;
}

function buildMatchupLeagueNorms(profiles) {
  const list = [...profiles.values()];
  return {
    offense: meanAndStd(list.map((p) => p.offenseRating)),
    runProd: meanAndStd(list.map((p) => p.runProd2026)),
    runsPerGame: meanAndStd(list.map((p) => p.runsPerGame)),
    runsAgainstPerGame: meanAndStd(list.map((p) => p.runsAgainstPerGame)),
    teamOverall: meanAndStd(list.map((p) => p.teamOverall)),
    winPct: meanAndStd(list.map((p) => p.winPct)),
    sos: meanAndStd(list.map((p) => p.sosOppWinPct)),
    defenseZ: meanAndStd(list.map((p) => p.defenseZ)),
  };
}

function teamCompositePower(profile, norms, isHome) {
  const zOff = zFrom(profile.offenseRating, norms.offense.mean, norms.offense.std);
  const zRun = zFrom(profile.runProd2026, norms.runProd.mean, norms.runProd.std);
  const zRf = zFrom(profile.runsPerGame, norms.runsPerGame.mean, norms.runsPerGame.std);
  const zRa = zFrom(
    profile.runsAgainstPerGame != null ? -profile.runsAgainstPerGame : null,
    -norms.runsAgainstPerGame.mean,
    norms.runsAgainstPerGame.std
  );
  const zTeam = zFrom(profile.teamOverall, norms.teamOverall.mean, norms.teamOverall.std);
  const zRec = zFrom(profile.winPct, norms.winPct.mean, norms.winPct.std);
  const zSos = zFrom(profile.sosOppWinPct, norms.sos.mean, norms.sos.std);

  let power =
    MATCHUP_POWER_WEIGHT_OFFENSE * zOff +
    MATCHUP_POWER_WEIGHT_RUN_PROD * zRun +
    MATCHUP_POWER_WEIGHT_RUNS_FOR * zRf +
    MATCHUP_POWER_WEIGHT_RUNS_AGAINST * zRa +
    MATCHUP_POWER_WEIGHT_TEAM_OVERALL * zTeam +
    MATCHUP_POWER_WEIGHT_WIN_PCT * zRec +
    MATCHUP_POWER_WEIGHT_SOS * zSos;

  if (isHome) power += MATCHUP_HOME_FIELD_LOGIT / MATCHUP_LOGIT_SCALE;

  return {
    power,
    components: { zOff, zRun, zRf, zRa, zTeam, zRec, zSos },
  };
}

function shrinkWinProbTowardEven(p, shrink = MATCHUP_WIN_PROB_SHRINK) {
  if (!Number.isFinite(p)) return 0.5;
  return 0.5 + shrink * (p - 0.5);
}

function logisticWinProb(homePower, awayPower, logitScale = MATCHUP_LOGIT_SCALE) {
  const diff = (homePower - awayPower) * logitScale;
  const pHome = 1 / (1 + Math.exp(-diff));
  return {
    home: pHome,
    away: 1 - pHome,
  };
}

/** Win chance from projected home − away runs (softball game-to-game variance). */
function winProbFromRunMargin(homeRuns, awayRuns, runMarginLogit = MATCHUP_RUN_MARGIN_LOGIT) {
  const margin = homeRuns - awayRuns;
  const pHome = 1 / (1 + Math.exp(-runMarginLogit * margin));
  return { home: pHome, away: 1 - pHome, margin };
}

/** Win probs for power-rankings season sim — sharper than matchup predictor display. */
function predictSeasonGameWinProbs(awayProfile, homeProfile, norms, runBase) {
  const awayPow = teamCompositePower(awayProfile, norms, false);
  const homePow = teamCompositePower(homeProfile, norms, true);

  const awayRuns = projectTeamRuns(
    awayProfile,
    homeProfile,
    norms,
    runBase,
    MATCHUP_AWAY_RUN_FACTOR
  );
  const homeRuns = projectTeamRuns(
    homeProfile,
    awayProfile,
    norms,
    runBase,
    MATCHUP_HOME_RUN_FACTOR
  );

  const winFromRuns = winProbFromRunMargin(homeRuns, awayRuns, SEASON_PROJ_RUN_MARGIN_LOGIT);
  const winFromTalent = logisticWinProb(homePow.power, awayPow.power, SEASON_PROJ_LOGIT_SCALE);
  const pHomeRaw =
    SEASON_PROJ_WIN_WEIGHT_FROM_RUNS * winFromRuns.home +
    SEASON_PROJ_WIN_WEIGHT_FROM_TALENT * winFromTalent.home;
  const pHome = shrinkWinProbTowardEven(pHomeRaw, SEASON_PROJ_WIN_PROB_SHRINK);

  return { away: 1 - pHome, home: pHome };
}

function projectRosterExpectedRuns(profile, opponentProfile, norms, runBase, venueFactor) {
  const zOff = zFrom(profile.offenseRating, norms.offense.mean, norms.offense.std);
  const zRun = zFrom(profile.runProd2026, norms.runProd.mean, norms.runProd.std);
  const zRf = zFrom(profile.runsPerGame, norms.runsPerGame.mean, norms.runsPerGame.std);
  const offBlend = 0.5 * zOff + 0.25 * zRun + 0.25 * zRf;
  const defOpp = opponentProfile.defenseZ ?? 0;
  const oppRa = opponentProfile.runsAgainstPerGame;
  const leagueRa = runBase.avgRunsAgainstPerGame || runBase.avgRunsPerTeam;

  let mult =
    (1 + MATCHUP_RUN_OFF_Z_PCT * offBlend) * (1 - MATCHUP_RUN_DEF_Z_PCT * defOpp) * venueFactor;

  if (oppRa != null && leagueRa > 0) {
    const oppAllowFactor = oppRa / leagueRa;
    mult *= 1 + MATCHUP_OPP_RUNS_AGAINST_SCALE * (oppAllowFactor - 1);
  }

  return Math.max(2, runBase.avgRunsPerTeam * mult);
}

function projectTeamRuns(profile, opponentProfile, norms, runBase, venueFactor) {
  const rosterProj = projectRosterExpectedRuns(profile, opponentProfile, norms, runBase, venueFactor);

  if (profile.runsPerGame != null && profile.scheduleGames >= 2) {
    const w = MATCHUP_SCHEDULE_RUNS_BLEND;
    return Math.max(2, w * profile.runsPerGame + (1 - w) * rosterProj);
  }

  return rosterProj;
}

function roundMatchupN(n, dec = 1) {
  if (!Number.isFinite(n)) return null;
  const f = 10 ** dec;
  return Math.round(n * f) / f;
}

/** Betting lines: nearest whole or half (11.4 → 11.5, 12.1 → 12, 12.8 → 13). */
function roundToNearestHalf(n) {
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 2) / 2;
}

function formatBettingLineNumber(n) {
  const v = roundToNearestHalf(n);
  if (v == null) return null;
  return Math.abs(v % 1) < 1e-9 ? String(Math.round(v)) : v.toFixed(1);
}

function formatRunLineSpread(marginHome) {
  if (marginHome == null || !Number.isFinite(marginHome)) return null;
  const label = formatBettingLineNumber(marginHome);
  if (label == null) return null;
  return marginHome > 0 ? `+${label}` : label;
}

/** Projected winner + formatted away–home score for the lines table. */
function buildPredictedFinalScore(proj, homeWinProb = 0.5) {
  if (!proj) {
    return { winnerSide: null, score: null };
  }
  const margin = proj.marginHome;
  const homeWins = margin > 1e-9 || (Math.abs(margin) <= 1e-9 && homeWinProb >= 0.5);
  return {
    winnerSide: homeWins ? "home" : "away",
    score: proj.impliedScore,
  };
}

/** Ensure lines table fields exist (covers stale in-memory server or older prediction payloads). */
function enrichMatchupPredictionLines(prediction) {
  if (!prediction?.projectedRuns || !prediction?.winPct) return prediction;
  const awayR = Number(prediction.projectedRuns.away);
  const homeR = Number(prediction.projectedRuns.home);
  if (!Number.isFinite(awayR) || !Number.isFinite(homeR)) return prediction;

  const pHome = prediction.winPct.home / 100;
  const runs = {
    away: awayR,
    home: homeR,
    marginHome: homeR - awayR,
    impliedScore: `${prediction.projectedRuns.away} – ${prediction.projectedRuns.home}`,
  };

  prediction.lines = prediction.lines || {};
  if (!prediction.lines.finalScore?.winnerSide) {
    prediction.lines.finalScore = buildPredictedFinalScore(runs, pHome);
  }
  if (!prediction.lines.runLine?.value) {
    prediction.lines.runLine = buildFavoriteRunLine(runs, pHome);
  }
  return prediction;
}

/** Run line: always +spread on the projected favorite (win prob breaks ties). */
function buildFavoriteRunLine(proj, homeWinProb = 0.5) {
  if (!proj || !Number.isFinite(proj.marginHome)) {
    return { side: null, value: null };
  }
  const margin = proj.marginHome;
  const homeFavorite = margin > 1e-9 || (Math.abs(margin) <= 1e-9 && homeWinProb >= 0.5);
  let magnitude = Math.abs(margin);
  if (magnitude < 1e-9) magnitude = 0.5;
  const label = formatBettingLineNumber(magnitude);
  if (label == null) return { side: null, value: null };
  return {
    side: homeFavorite ? "home" : "away",
    value: `+${label}`,
  };
}

/** Build all betting/run displays from finalized half-point team totals. */
function finalizeRunProjection(away, home) {
  if (away == null || home == null || !Number.isFinite(away) || !Number.isFinite(home)) {
    return null;
  }
  const marginHome = home - away;
  const total = away + home;
  return {
    away,
    home,
    total,
    marginHome,
    awayDisplay: formatBettingLineNumber(away),
    homeDisplay: formatBettingLineNumber(home),
    totalDisplay: formatBettingLineNumber(total),
    marginDisplay: formatRunLineSpread(marginHome),
    impliedScore: `${formatBettingLineNumber(away)} – ${formatBettingLineNumber(home)}`,
    overUnder: formatBettingLineNumber(total),
    runLineHome: formatRunLineSpread(marginHome),
  };
}

/** Single source of truth: half-point team totals → total, margin, and all displayed lines. */
function buildRoundedRunProjection(awayRunsRaw, homeRunsRaw) {
  const away = roundToNearestHalf(awayRunsRaw);
  const home = roundToNearestHalf(homeRunsRaw);
  if (away == null || home == null) return null;
  return finalizeRunProjection(away, home);
}

/** If rounding ties the score, give the projected favorite +0.5 runs (home on a pick'em). */
function resolveTiedRunProjection(proj, homeIsFavorite) {
  if (!proj || Math.abs(proj.marginHome) > 1e-9) return proj;
  if (homeIsFavorite) {
    return finalizeRunProjection(proj.away, proj.home + 0.5);
  }
  return finalizeRunProjection(proj.away + 0.5, proj.home);
}

function predictMatchupGame(awayProfile, homeProfile, norms, runBase) {
  const awayPow = teamCompositePower(awayProfile, norms, false);
  const homePow = teamCompositePower(homeProfile, norms, true);

  const awayRuns = projectTeamRuns(
    awayProfile,
    homeProfile,
    norms,
    runBase,
    MATCHUP_AWAY_RUN_FACTOR
  );
  const homeRuns = projectTeamRuns(
    homeProfile,
    awayProfile,
    norms,
    runBase,
    MATCHUP_HOME_RUN_FACTOR
  );
  let runs = buildRoundedRunProjection(awayRuns, homeRuns);
  if (!runs) {
    return {
      winPct: { away: 50, home: 50 },
      winPctFromRuns: { away: 50, home: 50 },
      projectedRuns: { away: "—", home: "—", total: "—", marginHome: "—" },
      scheduleRates: { away: {}, home: {} },
      lines: {
        overUnder: "—",
        finalScore: { winnerSide: null, score: "—" },
        runLine: { side: null, value: "—" },
        impliedScore: "—",
      },
      strength: { away: 0, home: 0 },
      runBaselineGames: runBase.gamesSampled,
      leagueAvgRunsPerTeam: roundMatchupN(runBase.avgRunsPerTeam, 1),
    };
  }

  const winFromTalent = logisticWinProb(homePow.power, awayPow.power);
  let winFromRuns = winProbFromRunMargin(runs.home, runs.away);
  const pHomeRaw =
    MATCHUP_WIN_WEIGHT_FROM_RUNS * winFromRuns.home +
    MATCHUP_WIN_WEIGHT_FROM_TALENT * winFromTalent.home;
  const pHome = shrinkWinProbTowardEven(pHomeRaw);
  const pAway = 1 - pHome;

  runs = resolveTiedRunProjection(runs, pHome >= pAway);
  winFromRuns = winProbFromRunMargin(runs.home, runs.away);

  return {
    winPct: {
      away: roundMatchupN(pAway * 100, 1),
      home: roundMatchupN(pHome * 100, 1),
    },
    winPctFromRuns: {
      away: roundMatchupN(winFromRuns.away * 100, 1),
      home: roundMatchupN(winFromRuns.home * 100, 1),
    },
    projectedRuns: {
      away: runs.awayDisplay,
      home: runs.homeDisplay,
      total: runs.totalDisplay,
      marginHome: runs.marginDisplay,
    },
    scheduleRates: {
      away: {
        runsPerGame: roundMatchupN(awayProfile.runsPerGame, 1),
        runsAgainstPerGame: roundMatchupN(awayProfile.runsAgainstPerGame, 1),
      },
      home: {
        runsPerGame: roundMatchupN(homeProfile.runsPerGame, 1),
        runsAgainstPerGame: roundMatchupN(homeProfile.runsAgainstPerGame, 1),
      },
    },
    lines: {
      overUnder: runs.overUnder,
      finalScore: buildPredictedFinalScore(runs, pHome),
      runLine: buildFavoriteRunLine(runs, pHome),
      impliedScore: runs.impliedScore,
    },
    strength: {
      away: roundMatchupN(awayPow.power, 2),
      home: roundMatchupN(homePow.power, 2),
    },
    runBaselineGames: runBase.gamesSampled,
    leagueAvgRunsPerTeam: roundMatchupN(runBase.avgRunsPerTeam, 1),
  };
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

function buildLeagueLeaders(players) {
  const topN = (items, field, n = 5, minAB = 0) =>
    items
      .filter((p) => toNumber(p.AB) >= minAB)
      .slice()
      .sort((a, b) => toNumber(b[field]) - toNumber(a[field]))
      .slice(0, n);

  const leaders = [
    { title: "OPS", field: "OPS", minAB: 0 },
    { title: "AVG", field: "AVG", minAB: 0 },
    { title: "OBP", field: "OBP", minAB: 0 },
    { title: "SLG", field: "SLG", minAB: 0 },
    { title: "Hits", field: "Hits", minAB: 0 },
    { title: "Runs", field: "Runs", minAB: 0 },
    { title: "RBI", field: "RBI", minAB: 0 },
    { title: "HR", field: "HR", minAB: 0 },
  ].map((category) => ({
    ...category,
    players: topN(players, category.field, 5, category.minAB),
  }));

  const topRookies = players
    .filter((p) => isTruthyRookie(p.IsRookie))
    .slice()
    .sort((a, b) => toNumber(b.AVG) - toNumber(a.AVG))
    .slice(0, 5);

  return { leaders, topRookies };
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
    res.status(500).send(`Failed to load league leaders: ${error.message}`);
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
    const [teams, careerByPlayer, hist2025ByPlayer, stats2026ByPlayer, scheduleRows, defenseMap] =
      await Promise.all([
        loadTeamRosters(),
        loadCareerByPlayer(),
        load2025HistoricalByPlayer(),
        load2026StatsByPlayer(),
        fetchCsvRows(SCHEDULE_URL),
        loadDefensiveRatingsNormalizedMap(),
      ]);

    const bundles = collectLeagueOffenseBundles(careerByPlayer, hist2025ByPlayer, stats2026ByPlayer);
    const { moments } = weightedMomentsPerMetric(bundles);
    const leagueRows = buildOffensivePlayerRows(
      teams,
      careerByPlayer,
      hist2025ByPlayer,
      stats2026ByPlayer,
      moments
    );

    const parsedScheduleGames = buildParsedScheduleGames(scheduleRows, teams);
    const standingsMap = buildTeamStandingsFromScheduleGames(parsedScheduleGames, teams);
    const teamSections = buildTeamOffenseSections(teams, leagueRows, standingsMap);
    const currentRankings = buildPowerRankingsCurrentRows(teamSections);

    const runBase = leagueRunScoringBaseline(parsedScheduleGames);
    const scheduleRunRates = buildTeamScheduleRunRates(parsedScheduleGames, teams);
    const offenseRatingByNorm = new Map(leagueRows.map((r) => [r.norm, r.rating]));
    const teamOverallById = new Map();
    for (const sec of teamSections) {
      teamOverallById.set(normalizeScheduleTeamId(sec.teamId), sec);
    }

    const rosterByTeamId = {};
    for (const t of teams) {
      rosterByTeamId[t.teamId] = { players: t.players || [], teamName: t.teamName };
    }

    const { zByNorm: defenseZByNorm } = buildDefenseZByNorm(defenseMap, stats2026ByPlayer);
    const teamProfiles = buildTeamMatchupProfiles(
      teams,
      rosterByTeamId,
      offenseRatingByNorm,
      stats2026ByPlayer,
      defenseZByNorm,
      standingsMap,
      teamOverallById,
      scheduleRunRates
    );
    const leagueNorms = buildMatchupLeagueNorms(teamProfiles);

    const projection = projectSeasonStandings(
      teams,
      standingsMap,
      teamProfiles,
      leagueNorms,
      runBase,
      parsedScheduleGames
    );
    attachPowerRatingsToProjections(projection.rows, teamSections);

    renderPage(res, "power-rankings", {
      navActive: "power",
      pageTitle: "Power Rankings",
      regularSeasonGames: REGULAR_SEASON_GAMES,
      currentRankings,
      projectionRows: projection.rows,
      remainingGamesSimulated: projection.remainingGamesSimulated,
      remainingGamesTotal: projection.remainingGamesTotal,
      teamOverallWeights: {
        player: TEAM_OVERALL_WEIGHT_PLAYER,
        record: TEAM_OVERALL_WEIGHT_RECORD,
        sos: TEAM_OVERALL_WEIGHT_SOS,
      },
    });
  } catch (error) {
    res.status(500).send(`Failed to build power rankings: ${error.message}`);
  }
});

/** Defense rankings hidden for now. */
app.get("/rankings/defense", (req, res) => {
  res.redirect(302, "/");
});

app.get("/defense-rankings", (req, res) => {
  res.redirect(302, "/");
});

/** ~4.5% hold — e.g. -110 / +100 on a pick'em, not symmetric +110 / -110. */
const MONEYLINE_OVERROUND = 1.045;
const MONEYLINE_STANDARD_FAVORITE = -110;
const MONEYLINE_STANDARD_UNDERDOG = 100;
const MONEYLINE_PICKEM_THRESHOLD = 0.025;

function americanFromImpliedProb(implied) {
  const imp = Math.min(0.999, Math.max(0.001, implied));
  if (imp >= 0.5) return -Math.round((100 * imp) / (1 - imp));
  return Math.round((100 * (1 - imp)) / imp);
}

function roundMoneylineAmerican(n) {
  const sign = n < 0 ? -1 : 1;
  let abs = Math.abs(n);
  if (abs >= 1000) abs = Math.round(abs / 50) * 50;
  else if (abs >= 200) abs = Math.round(abs / 10) * 10;
  else abs = Math.round(abs / 5) * 5;
  abs = Math.max(abs, 100);
  return sign * abs;
}

function formatAmericanMoneyline(n) {
  return n < 0 ? String(n) : `+${n}`;
}

/** Favorite juice: |negative line| must exceed the plus side (house wins). */
function enforceMoneylineHouseEdge(favoriteOdds, underdogOdds) {
  let fav =
    favoriteOdds < 0 ? favoriteOdds : MONEYLINE_STANDARD_FAVORITE;
  let dog =
    underdogOdds > 0 ? underdogOdds : MONEYLINE_STANDARD_UNDERDOG;

  if (fav > MONEYLINE_STANDARD_FAVORITE) fav = MONEYLINE_STANDARD_FAVORITE;

  fav = roundMoneylineAmerican(fav);
  dog = roundMoneylineAmerican(dog);

  while (Math.abs(fav) <= dog) {
    fav -= 5;
    if (dog > MONEYLINE_STANDARD_UNDERDOG) dog -= 5;
    else dog = MONEYLINE_STANDARD_UNDERDOG;
  }

  if (dog > MONEYLINE_STANDARD_UNDERDOG && Math.abs(fav) <= MONEYLINE_STANDARD_UNDERDOG) {
    dog = MONEYLINE_STANDARD_UNDERDOG;
    if (Math.abs(fav) <= dog) fav = MONEYLINE_STANDARD_FAVORITE;
  }

  return [fav, dog];
}

/** Paired moneylines with overround; home is -110 / +100 on a true pick'em. */
function americanMoneylinePair(probAway, probHome) {
  const sum = probAway + probHome;
  if (sum <= 0) return { away: "—", home: "—" };

  const qAway = probAway / sum;
  const qHome = probHome / sum;

  if (Math.abs(qAway - qHome) < MONEYLINE_PICKEM_THRESHOLD) {
    const [fav, dog] = enforceMoneylineHouseEdge(
      MONEYLINE_STANDARD_FAVORITE,
      MONEYLINE_STANDARD_UNDERDOG
    );
    return {
      away: formatAmericanMoneyline(dog),
      home: formatAmericanMoneyline(fav),
    };
  }

  const awayIsFav = qAway > qHome;
  const qFav = awayIsFav ? qAway : qHome;
  const minFavImp = 110 / 210;

  let impFav = Math.max(qFav * MONEYLINE_OVERROUND, minFavImp);
  impFav = Math.min(impFav, 0.95);
  let impDog = MONEYLINE_OVERROUND - impFav;
  if (impDog >= 0.5) {
    impDog = 0.495;
    impFav = MONEYLINE_OVERROUND - impDog;
  }

  let favAmerican = roundMoneylineAmerican(americanFromImpliedProb(impFav));
  let dogAmerican = roundMoneylineAmerican(americanFromImpliedProb(impDog));
  [favAmerican, dogAmerican] = enforceMoneylineHouseEdge(favAmerican, dogAmerican);

  if (awayIsFav) {
    return {
      away: formatAmericanMoneyline(favAmerican),
      home: formatAmericanMoneyline(dogAmerican),
    };
  }
  return {
    away: formatAmericanMoneyline(dogAmerican),
    home: formatAmericanMoneyline(favAmerican),
  };
}

app.get("/dfs", async (req, res) => {
  try {
    const [
      teams,
      careerByPlayer,
      hist2025ByPlayer,
      stats2026ByPlayer,
      schedulePayload,
      gamelogs,
    ] = await Promise.all([
      loadTeamRosters(),
      loadCareerByPlayer(),
      load2025HistoricalByPlayer(),
      load2026StatsByPlayer(),
      loadWeeklySchedule(),
      load2026GamelogsByPlayer(),
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
      moments
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
    });

    const poolByNorm = new Map(playerPool.map((p) => [p.norm, p]));
    const lineupNorms = safeText(req.query.lineup)
      .split(",")
      .map((s) => normalizePlayerName(s))
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
      return { ...p, slatePoints: row.points, slateGames: row.games };
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

    renderPage(res, "dfs-lineup", {
      navActive: "dfs",
      refIso,
      slate,
      slateOptions,
      activeSlateToken,
      allSlatesLocked,
      canEdit,
      selectedSlate: slate?.viewToken || "",
      playerPool: playerPoolWithStats,
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
    res.status(500).send(`DFS page failed: ${error.message}`);
  }
});

async function loadDfsLeaderboardScoringContext() {
  const [
    teams,
    careerByPlayer,
    hist2025ByPlayer,
    stats2026ByPlayer,
    schedulePayload,
    gamelogs,
  ] = await Promise.all([
    loadTeamRosters(),
    loadCareerByPlayer(),
    load2025HistoricalByPlayer(),
    load2026StatsByPlayer(),
    loadWeeklySchedule(),
    load2026GamelogsByPlayer(),
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
    moments
  );
  const offenseRatingByNorm = new Map(leagueRows.map((r) => [r.norm, r.rating]));
  const teamCodeById = buildTeamCodeById(teams, stats2026ByPlayer);

  return {
    teams,
    schedulePayload,
    gamelogs,
    scoringDeps: {
      teams,
      offenseRatingByNorm,
      scheduleRunRates,
      stats2026ByPlayer,
      teamCodeById,
      gamelogs,
    },
  };
}

app.post("/api/dfs/leaderboard/score", async (req, res) => {
  try {
    const tab = safeText(req.body?.tab).toLowerCase() === "cumulative" ? "cumulative" : "weekly";
    const selectedWeek = safeText(req.body?.selectedWeek).toUpperCase();
    const lineups = Array.isArray(req.body?.lineups) ? req.body.lineups : [];

    const { schedulePayload, gamelogs, scoringDeps } = await loadDfsLeaderboardScoringContext();
    const refIso = referenceIsoForScheduleYear(SCHEDULE_CALENDAR_YEAR);
    const nowMs = Date.now();
    const weekOptions = listLeaderboardSlateOptions(schedulePayload, refIso, nowMs);
    const week =
      selectedWeek && weekOptions.some((w) => w.value === selectedWeek)
        ? selectedWeek
        : defaultLeaderboardWeek(weekOptions);

    const slate = buildLeaderboardSlateFromToken(week, schedulePayload, refIso, nowMs);

    let weekly = { rows: [], entryCount: 0 };
    let cumulative = { rows: [], entryCount: 0, pastWeekCount: 0 };

    if (tab === "weekly" && slate) {
      weekly = buildWeeklyLeaderboardFromLineups(lineups, slate, scoringDeps);
    } else if (tab === "cumulative") {
      const activeSlateToken = resolveActiveDfsSlateToken(schedulePayload, refIso, nowMs) || "";
      cumulative = buildCumulativeLeaderboardFromLineups(
        lineups,
        weekOptions,
        scoringDeps,
        schedulePayload,
        refIso,
        activeSlateToken
      );
    }

    res.json({
      tab,
      selectedWeek: week,
      weekly,
      cumulative,
      hasGamelogData: gamelogs.byNorm.size > 0,
      slateHasBoxScoresForWeek: slate ? slateHasGamelogDates(slate, gamelogs) : false,
      slate: slate
        ? {
            label: slate.label,
            isPast: slate.isPast,
            viewToken: slate.viewToken,
            slateType: slate.slateType,
          }
        : null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Leaderboard scoring failed." });
  }
});

app.get("/dfs/leaderboard", async (req, res) => {
  try {
    const tab = safeText(req.query.tab).toLowerCase() === "weekly" ? "weekly" : "cumulative";
    const weekParam = safeText(req.query.week).toUpperCase();

    const { schedulePayload, gamelogs } = await loadDfsLeaderboardScoringContext();
    const refIso = referenceIsoForScheduleYear(SCHEDULE_CALENDAR_YEAR);
    const nowMs = Date.now();
    const weekOptions = listLeaderboardSlateOptions(schedulePayload, refIso, nowMs);
    const selectedWeek =
      weekParam && weekOptions.some((w) => w.value === weekParam)
        ? weekParam
        : defaultLeaderboardWeek(weekOptions);

    const slate = buildLeaderboardSlateFromToken(selectedWeek, schedulePayload, refIso, nowMs);
    const activeSlateToken = resolveActiveDfsSlateToken(schedulePayload, refIso, nowMs) || "";
    const activeSlateOpt = weekOptions.find((o) => o.value === activeSlateToken);
    const activeSlateLabel = activeSlateOpt
      ? `${activeSlateOpt.label}${activeSlateOpt.isPast ? " (locked)" : " — open for lineups"}`
      : "No open slate (season may be complete or between slates).";
    const firebaseClientConfig = getFirebaseClientConfig();
    const pastWeekCount = weekOptions.filter((w) => w.isPast).length;

    renderPage(res, "dfs-leaderboard", {
      navActive: "dfs",
      tab,
      weekOptions,
      selectedWeek,
      slate,
      pastWeekCount,
      activeSlateToken,
      activeSlateLabel,
      hasGamelogData: gamelogs.byNorm.size > 0,
      firebaseClientConfig,
      firebaseEnabled: !!firebaseClientConfig,
      scoringRules: DFS_SCORING,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send(`DFS leaderboard failed: ${error.message}`);
  }
});

app.get("/matchup-predictor", async (req, res) => {
  try {
    const [
      payload,
      teams,
      careerByPlayer,
      hist2025ByPlayer,
      stats2026ByPlayer,
      scheduleRows,
      defenseMap,
    ] = await Promise.all([
      loadWeeklySchedule(),
      loadTeamRosters(),
      loadCareerByPlayer(),
      load2025HistoricalByPlayer(),
      load2026StatsByPlayer(),
      fetchCsvRows(SCHEDULE_URL),
      loadDefensiveRatingsNormalizedMap(),
    ]);

    let viewParam = safeText(req.query.view);
    if (!viewParam && req.query.week !== undefined && req.query.week !== null && safeText(req.query.week) !== "") {
      const wk = safeText(req.query.week);
      viewParam = /^W\d+$/i.test(wk) ? `W${Number(wk.slice(1))}` : `W${parseWeekIndex(wk, 1)}`;
    }
    if (!viewParam) {
      const wedDigits = safeText(req.query.wed).replace(/^D/i, "").toUpperCase();
      if (/^\d{8}$/.test(wedDigits)) viewParam = `D${wedDigits}`;
    }
    if (!viewParam) {
      viewParam =
        pickSmartDefaultScheduleView(localCalendarIso(), payload) ||
        payload.scheduleOptions.find((o) => /^W\d+$/i.test(o.value))?.value ||
        payload.scheduleOptions[0]?.value ||
        "";
    }

    const scheduleOptions = payload.scheduleOptions || [];
    const { selectedView, games, summaryLine } = resolveScheduleGamesForView(viewParam, payload);

    const matchupOptions = buildMatchupOptionsForGames(games);
    const validMatchupKeys = new Set(matchupOptions.map((o) => o.value));
    let selectedMatchup = safeText(req.query.matchup);
    if (!validMatchupKeys.has(selectedMatchup)) selectedMatchup = "";

    const nameToTeamId = buildNameToTeamIdMap(teams);
    const rosterByTeamId = payload.rosterByTeamId || {};

    const parsedScheduleGames = buildParsedScheduleGames(scheduleRows, teams);
    const standingsMap = buildTeamStandingsFromScheduleGames(parsedScheduleGames, teams);
    const runBase = leagueRunScoringBaseline(parsedScheduleGames);
    const scheduleRunRates = buildTeamScheduleRunRates(parsedScheduleGames, teams);

    const bundles = collectLeagueOffenseBundles(careerByPlayer, hist2025ByPlayer, stats2026ByPlayer);
    const { moments } = weightedMomentsPerMetric(bundles);
    const leagueRows = buildOffensivePlayerRows(
      teams,
      careerByPlayer,
      hist2025ByPlayer,
      stats2026ByPlayer,
      moments
    );
    const offenseRatingByNorm = new Map(leagueRows.map((r) => [r.norm, r.rating]));

    const teamSections = buildTeamOffenseSections(teams, leagueRows, standingsMap);
    const teamOverallById = new Map();
    for (const sec of teamSections) {
      const sid = normalizeScheduleTeamId(sec.teamId);
      teamOverallById.set(sid, sec);
    }

    const { zByNorm: defenseZByNorm } = buildDefenseZByNorm(defenseMap, stats2026ByPlayer);
    const teamProfiles = buildTeamMatchupProfiles(
      teams,
      rosterByTeamId,
      offenseRatingByNorm,
      stats2026ByPlayer,
      defenseZByNorm,
      standingsMap,
      teamOverallById,
      scheduleRunRates
    );
    const leagueNorms = buildMatchupLeagueNorms(teamProfiles);

    const awayMissingSet = parseMissingNorms(req.query.awayMissing, normalizePlayerName);
    const homeMissingSet = parseMissingNorms(req.query.homeMissing, normalizePlayerName);
    const awayMissingSerialized = serializeMissingNorms(awayMissingSet);
    const homeMissingSerialized = serializeMissingNorms(homeMissingSet);

    let selectedGame = null;
    let awayRoster = null;
    let homeRoster = null;
    let prediction = null;
    let lineupRuleAlerts = [];

    if (selectedMatchup) {
      selectedGame = findGameByMatchupKey(games, selectedMatchup);
      if (selectedGame) {
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

        awayRoster = enrichRosterForMatchupView(
          awayRoster,
          offenseRatingByNorm,
          awayMissingSet,
          normalizePlayerName,
          stats2026ByPlayer
        );
        homeRoster = enrichRosterForMatchupView(
          homeRoster,
          offenseRatingByNorm,
          homeMissingSet,
          normalizePlayerName,
          stats2026ByPlayer
        );

        const awayId = normalizeScheduleTeamId(selectedGame.awayTeamId);
        const homeId = normalizeScheduleTeamId(selectedGame.homeTeamId);
        let awayProfile = teamProfiles.get(awayId);
        let homeProfile = teamProfiles.get(homeId);

        if (awayProfile && awayRoster?.players?.length) {
          awayProfile = applyMissingPlayersToProfile(
            awayProfile,
            awayRoster.players,
            awayMissingSet,
            offenseRatingByNorm,
            stats2026ByPlayer,
            defenseZByNorm,
            normalizePlayerName
          );
          teamProfiles.set(awayId, awayProfile);
        }
        if (homeProfile && homeRoster?.players?.length) {
          homeProfile = applyMissingPlayersToProfile(
            homeProfile,
            homeRoster.players,
            homeMissingSet,
            offenseRatingByNorm,
            stats2026ByPlayer,
            defenseZByNorm,
            normalizePlayerName
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
          // Fixed league norms (full-roster baseline) — do not rebuild from adjusted profiles or
          // missing-player penalties get normalized away in z-scores.
          prediction = predictMatchupGame(awayProfile, homeProfile, leagueNorms, runBase);
          prediction.missingImpact = {
            away: {
              teamMultiplier: awayProfile.teamMultiplier ?? 1,
              offenseRating: awayProfile.offenseRating,
              presentCount: awayProfile.presentCount,
              missingCount: awayProfile.missingCount,
            },
            home: {
              teamMultiplier: homeProfile.teamMultiplier ?? 1,
              offenseRating: homeProfile.offenseRating,
              presentCount: homeProfile.presentCount,
              missingCount: homeProfile.missingCount,
            },
          };
          enrichMatchupPredictionLines(prediction);
          const moneylines = americanMoneylinePair(
            prediction.winPct.away / 100,
            prediction.winPct.home / 100
          );
          prediction.lines.moneylineAway = moneylines.away;
          prediction.lines.moneylineHome = moneylines.home;
          prediction.awayLabel = awayRoster.teamName || selectedGame.away;
          prediction.homeLabel = homeRoster.teamName || selectedGame.home;
        }
      }
    }

    renderPage(res, "matchup-predictor", {
      navActive: "matchup",
      pageTitle: "Matchup Predictor",
      scheduleOptions,
      selectedView,
      scheduleSummary: summaryLine,
      matchupOptions,
      selectedMatchup,
      selectedGame,
      awayRoster,
      homeRoster,
      prediction,
      awayMissingSerialized,
      homeMissingSerialized,
      lineupRuleAlerts,
    });
  } catch (error) {
    res.status(500).send(`Failed to load matchup predictor: ${error.message}`);
  }
});

/** Schedule page hidden for now. */
app.get("/schedule", (req, res) => {
  res.redirect(302, "/");
});

async function renderLeagueLeadersPage(res) {
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
    res.status(500).send(`Failed to build confirmation page: ${error.message}`);
  }
});

const HOST = process.env.HOST || "0.0.0.0";

if (process.env.NODE_ENV === "production" && !getFirebaseClientConfig()) {
  console.warn(
    "[MMS] Firebase web config missing (FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_APP_ID, …). Set the same names as .env in your host environment (e.g. Render → Environment) and redeploy."
  );
}

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
