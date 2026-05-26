/**
 * League data loaders used to score DFS leaderboard lineups (server + browser bundle).
 */
const Papa = require("papaparse");
const { fetchCsvText } = require("./fetchCsvText");
const { createMemoryCache } = require("./memoryCache");
const {
  buildTeamCodeById,
  load2026GamelogsByPlayer,
  normalizePlayerName,
  DFS_OFFENSE_RATING_WEIGHT_HISTORICAL,
  DFS_OFFENSE_RATING_WEIGHT_2026,
} = require("./dfs");
const {
  SCHEDULE_URL,
  HIST_2025_STATS_URL,
  SCHEDULE_CALENDAR_YEAR,
  getStats2026CsvUrl,
  resolveCareerCsvSource,
} = require("./sheetUrls");

const OFFENSE_RATING_WEIGHT_HISTORICAL = 0.7;
const OFFENSE_RATING_WEIGHT_2026 = 0.3;
const OFFENSE_METRIC_WEIGHTS = Object.freeze({
  ops: 0.52,
  iso: 0.16,
  tbPerPa: 0.26,
  runProd: 0.06,
});
const OFFENSE_METRIC_KEYS = Object.keys(OFFENSE_METRIC_WEIGHTS);

let nodeReadCareerCsv = null;

function setNodeCareerReader(fn) {
  nodeReadCareerCsv = typeof fn === "function" ? fn : null;
}

function safeText(value) {
  return (value || "").toString().trim();
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function fetchCsvRows(url) {
  const csvText = await fetchCsvText(url);
  return Papa.parse(csvText).data;
}

const { loadTeamRosters } = require("./teamRosters");
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

function weekdayFromIso(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).getDay();
}

function scheduleIsoToCompactDigits(isoDate) {
  return safeText(isoDate).replace(/\D+/g, "");
}

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

function scheduleColumnFirstOf(normalizedHeaders, candidates) {
  const h = normalizedHeaders;
  for (const c of candidates) {
    const i = h.indexOf(c);
    if (i >= 0) return i;
  }
  return -1;
}

function buildScheduleDiamondLocationLabel(fieldMain, fieldShort) {
  const parts = [];
  for (const p of [fieldMain, fieldShort]) {
    const t = safeText(p);
    if (!t || t === "-") continue;
    if (parts.length && parts[parts.length - 1] === t) continue;
    parts.push(t);
  }
  return parts.join(" · ");
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
    const field = idx.field >= 0 ? safeText(row[idx.field]) : "";
    const fieldShort = idx.shortField >= 0 ? safeText(row[idx.shortField]) : "";
    parsedGames.push({
      awayId,
      homeId,
      awayName: safeText(row[idx.awayTeam]) || teamNameById.get(awayId) || `Team ${awayId}`,
      homeName: safeText(row[idx.homeTeam]) || teamNameById.get(homeId) || `Team ${homeId}`,
      dateDisplay,
      isoDate: parsedDate.iso,
      field,
      venueLabel: buildScheduleDiamondLocationLabel(field, fieldShort),
      time: idx.time >= 0 ? safeText(row[idx.time]) : "",
      gameId: idx.gameId >= 0 ? safeText(row[idx.gameId]) : "",
      rowIndex: i,
      awayScore: optionalScheduleScore(idx.awayScore >= 0 ? row[idx.awayScore] : ""),
      homeScore: optionalScheduleScore(idx.homeScore >= 0 ? row[idx.homeScore] : ""),
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

function normalizeScheduleTeamLabel(value) {
  return safeText(value).toLowerCase().replace(/\s+/g, " ");
}

function buildScheduleRosterPayloadB64(rosterByTeamId, teams) {
  const nameToTeamId = {};
  for (const t of teams) {
    const key = normalizeScheduleTeamLabel(t.teamName);
    if (key && !nameToTeamId[key]) nameToTeamId[key] = t.teamId;
  }
  const body = JSON.stringify({ byTeamId: rosterByTeamId, nameToTeamId });
  if (typeof Buffer !== "undefined") {
    return Buffer.from(body, "utf8").toString("base64");
  }
  const bytes = new TextEncoder().encode(body);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function loadWeeklySchedule() {
  const [scheduleRows, teams] = await Promise.all([fetchCsvRows(SCHEDULE_URL), loadTeamRosters()]);
  const parsedGames = buildParsedScheduleGames(scheduleRows, teams);
  const uniqueIsosSorted = Array.from(new Set(parsedGames.map((g) => g.isoDate))).sort((a, b) =>
    a.localeCompare(b)
  );
  const dateLabelByIso = new Map();
  for (const g of parsedGames) {
    if (!dateLabelByIso.has(g.isoDate)) dateLabelByIso.set(g.isoDate, g.dateDisplay);
  }
  const seen = new Set();
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
    const row = {
      home: g.homeName,
      away: g.awayName,
      awayTeamId,
      homeTeamId,
      location: (g.venueLabel && g.venueLabel.trim()) || g.field || "-",
      time: g.time || "-",
      date: g.dateDisplay || "",
      result: formatFinishedScheduleResult(g.awayScore, g.homeScore, g.resultCsv, g.winnerCsv),
      gameId: g.gameId,
      _iso: g.isoDate,
    };
    if (!gamesByIso.has(g.isoDate)) gamesByIso.set(g.isoDate, []);
    gamesByIso.get(g.isoDate).push(row);
  }
  for (const iso of gamesByIso.keys()) {
    gamesByIso.set(iso, sortScheduleGameRows(gamesByIso.get(iso)));
  }
  const scheduleOptions = [];
  let sundayCounter = 0;
  for (const iso of uniqueIsosSorted) {
    const wd = weekdayFromIso(iso);
    const dl = dateLabelByIso.get(iso) || iso;
    if (wd === 0) {
      sundayCounter += 1;
      scheduleOptions.push({ value: `W${sundayCounter}`, label: `${dl} • Week ${sundayCounter}` });
    } else if (wd === 3) {
      scheduleOptions.push({
        value: `D${scheduleIsoToCompactDigits(iso)}`,
        label: dl,
      });
    }
  }
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
  return {
    scheduleOptions,
    allScheduleViews: scheduleOptions.map((o) => o.value),
    gamesByIso,
    sundayIsosSorted: uniqueIsosSorted.filter((iso) => weekdayFromIso(iso) === 0),
    uniqueIsosSorted,
    dateLabelByIso,
    rosterByTeamId,
    scheduleRosterPayloadB64: buildScheduleRosterPayloadB64(rosterByTeamId, teams),
    parsedGames,
  };
}

async function load2026StatsByPlayer() {
  const csvText = await fetchCsvText(getStats2026CsvUrl());
  const rows = Papa.parse(csvText).data;
  const headers = (rows[1] || []).map((h) => safeText(h));
  const dataRows = rows.slice(2);
  const nameIndex = headers.findIndex((h) => h.toLowerCase() === "player");
  if (nameIndex === -1) throw new Error("2026 stats CSV missing Player column.");
  const statsByPlayer = new Map();
  for (const row of dataRows) {
    const playerName = safeText(row[nameIndex]);
    if (!playerName) continue;
    const stats = {};
    for (let i = 0; i < headers.length; i += 1) stats[headers[i]] = safeText(row[i]);
    statsByPlayer.set(normalizePlayerName(playerName), stats);
  }
  return statsByPlayer;
}

async function load2025HistoricalByPlayer() {
  const rows = await fetchCsvRows(HIST_2025_STATS_URL);
  const headers = (rows[0] || []).map((h) => safeText(h));
  const dataRows = rows.slice(1);
  const nameIndex = headers.findIndex((h) => h.toLowerCase() === "player");
  if (nameIndex === -1) throw new Error("2025 historical CSV missing Player column.");
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
    byPlayer.set(normalizePlayerName(playerName), {
      player: playerName,
      team: safeText(row[1]),
      pa: ab + bb,
      ab,
      h: toNumber(row[3]),
      r: toNumber(row[4]),
      rbi: toNumber(row[5]),
      bb,
      tb: singles + doubles * 2 + triples * 3 + homers * 4,
    });
  }
  return byPlayer;
}

async function loadCareerByPlayer() {
  const src = resolveCareerCsvSource();
  let csvText;
  if (src.type === "file") {
    if (!nodeReadCareerCsv) {
      throw new Error("Career CSV file read is not configured (Node only).");
    }
    csvText = await nodeReadCareerCsv(src.path);
  } else {
    csvText = await fetchCsvText(src.url);
  }
  const rows = Papa.parse(csvText).data;
  const headers = (rows[0] || []).map((h) => safeText(h).toLowerCase());
  const dataRows = rows.slice(1);
  const idx = {
    name: headers.indexOf("player_name"),
    pa: headers.indexOf("pa"),
    ab: headers.indexOf("ab"),
    h: headers.indexOf("h"),
    r: headers.indexOf("r"),
    rbi: headers.indexOf("rbi"),
    bb: headers.indexOf("bb"),
    tb: headers.indexOf("tb"),
  };
  if (idx.name === -1) throw new Error("Career CSV missing player_name column.");
  const byPlayer = new Map();
  for (const row of dataRows) {
    const name = safeText(row[idx.name]);
    if (!name) continue;
    byPlayer.set(normalizePlayerName(name), {
      player: name,
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
    for (const k of OFFENSE_METRIC_KEYS) moments[k] = { mu: 0, sigma: 1 };
    return { moments, totPa };
  }
  for (const key of OFFENSE_METRIC_KEYS) {
    const mu = observations.reduce((s, o) => s + o.pa * o.bundle[key], 0) / totPa;
    const variance =
      observations.reduce((s, o) => s + o.pa * (o.bundle[key] - mu) ** 2, 0) / totPa;
    moments[key] = { mu, sigma: Math.sqrt(Math.max(variance, 1e-10)) };
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
  return computeOffenseRateBundle(
    pa,
    row2026.AB,
    row2026.BB,
    row2026.Hits,
    row2026.TB,
    row2026.Runs,
    row2026.RBI
  );
}

function blendedOffenseRating(composite26, compositeHist, has26, hasHist, blendWeights) {
  const wHist = blendWeights?.historical ?? OFFENSE_RATING_WEIGHT_HISTORICAL;
  const w26 = blendWeights?.y2026 ?? OFFENSE_RATING_WEIGHT_2026;
  if (has26 && hasHist) {
    return wHist * compositeHist + w26 * composite26;
  }
  if (has26) return composite26;
  if (hasHist) return compositeHist;
  return 0;
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
      const composite26 = z26 ? compositeZFromZScores(z26) : 0;
      const has26 = z26 != null;
      const histSample = historicalPaAndBundleForPlayer(norm, careerByPlayer, hist2025ByPlayer);
      const rawHist = histSample?.bundle ?? null;
      const zHist = rawHist ? zScoresFromBundle(rawHist, moments) : null;
      const compositeHist = zHist ? compositeZFromZScores(zHist) : null;
      const hasHist = zHist != null;
      const ratingRaw = blendedOffenseRating(composite26, compositeHist ?? 0, has26, hasHist);
      rows.push({
        norm,
        rating: Number.isFinite(ratingRaw) ? Math.round(ratingRaw * 100) / 100 : 0,
      });
    }
  }
  return rows;
}

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
    });
  }
  return rates;
}

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
  const parsedScheduleGames = schedulePayload.parsedGames || [];
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
  const { parsedGames: _pg, ...scheduleForClient } = schedulePayload;
  return {
    schedulePayload: scheduleForClient,
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

const dfsScoringContextCache = createMemoryCache(
  Number(process.env.DFS_SCORING_CACHE_TTL_MS) || 10 * 60 * 1000,
  "dfs-scoring"
);

function getCachedDfsLeaderboardScoringContext() {
  return dfsScoringContextCache.get("leaderboard-scoring", loadDfsLeaderboardScoringContext);
}

module.exports = {
  loadDfsLeaderboardScoringContext,
  getCachedDfsLeaderboardScoringContext,
  loadWeeklySchedule,
  setNodeCareerReader,
};
