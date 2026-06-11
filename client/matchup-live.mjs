/**
 * Live schedule chrome, season record, and MG roster refresh for all matchup pages.
 */
import {
  resolveGamesForViewToken,
  referenceIsoForScheduleYear,
  filterScheduleOptionsForMatchupPredictorMode,
} from "../lib/dfs.js";
import { loadWeeklySchedule } from "../lib/dfsLeaderboardScoringContext.js";
import { SCHEDULE_CALENDAR_YEAR } from "../lib/sheetUrls.js";
import { matchupModeFromPathname } from "../lib/matchupPredictorStaticNav.js";
import {
  findParsedGameForMatchup,
  isParsedGameFinished,
} from "../lib/matchupGameResult.js";
import { buildMatchupOptionsForGames } from "../lib/matchupScheduleChrome.js";
import { applyGamelogMissingForFinishedGame } from "../lib/matchupGamelogMissing.js";
import {
  loadLiveMatchupSeasonRecord,
  countFinishedScheduleGames,
} from "../lib/matchupLiveSeasonRecord.js";
import {
  load2026GamelogsByPlayer,
  normalizePlayerName,
  buildTeamCodeById,
} from "../lib/dfs.js";
import { loadTeamRosters } from "../lib/teamRosters.js";
import { load2026StatsByPlayer } from "../lib/stats2026Loader.js";
import { loadCaptainTeamCodeById } from "../lib/powerRankingsCaptains.js";
import { invalidateSourceCsvCache, SOURCE_KEYS } from "../lib/sheetUrls.js";

const DEFAULT_POLL_MS = Number(process.env.MATCHUP_SCORE_POLL_MS) || 90_000;

let liveWatchStarted = false;
let seasonRecordWatchTimer = null;
let liveChromeTimer = null;
let lastFinishedGameCount = null;
let lastRecordKey = null;
let lastMatchupOptionsSig = null;
let lastGamelogMissingSig = null;
let lastViewOptionsSig = null;
let lastScheduleSignature = null;

function safeText(value) {
  return (value || "").toString().trim();
}

function recordSignature(record) {
  if (!record) return "";
  return `${record.wins}|${record.losses}|${record.decided}`;
}

function scheduleSignature(parsedGames) {
  let n = 0;
  let scoreSig = "";
  for (const g of parsedGames || []) {
    if (g?.awayScore == null || g?.homeScore == null) continue;
    n += 1;
    scoreSig += `|${g.isoDate}:${g.awayId}-${g.homeId}:${g.awayScore}-${g.homeScore}`;
  }
  return `${n}:${scoreSig}`;
}

export async function refreshMatchupViewSelect() {
  const viewSelect = document.getElementById("view");
  if (!viewSelect) return;

  await invalidateSourceCsvCache(SOURCE_KEYS.schedule);
  const payload = await loadWeeklySchedule();
  const mode = matchupModeFromPathname(window.location.pathname || "");
  const refIso = referenceIsoForScheduleYear(SCHEDULE_CALENDAR_YEAR);
  const options = filterScheduleOptionsForMatchupPredictorMode(
    payload.scheduleOptions || [],
    payload,
    refIso,
    Date.now(),
    mode
  );
  const sig = options.map((o) => `${o.value}:${o.label}`).join("|");
  if (sig === lastViewOptionsSig) return;
  lastViewOptionsSig = sig;

  const current = String(viewSelect.value || "").trim().toUpperCase();
  viewSelect.innerHTML = "";
  if (!options.length) {
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "No dates available";
    viewSelect.appendChild(blank);
    return;
  }

  for (const opt of options) {
    const el = document.createElement("option");
    el.value = opt.value;
    el.textContent = opt.label;
    if (safeText(opt.value).toUpperCase() === current) el.selected = true;
    viewSelect.appendChild(el);
  }

  const url = new URL(window.location.href);
  const queryView = safeText(url.searchParams.get("view")).toUpperCase();
  if (queryView && [...viewSelect.options].some((o) => o.value.toUpperCase() === queryView)) {
    viewSelect.value = queryView;
  }
}

export async function refreshMatchupScheduleChrome() {
  const viewSelect = document.getElementById("view");
  const matchupSelect = document.getElementById("matchup");
  if (!viewSelect || !matchupSelect) return;

  await invalidateSourceCsvCache(SOURCE_KEYS.schedule);
  const payload = await loadWeeklySchedule();
  await refreshMatchupViewSelect();

  const schedSig = scheduleSignature(payload.parsedGames);
  if (schedSig !== lastScheduleSignature) {
    lastScheduleSignature = schedSig;
    lastRecordKey = null;
  }

  const viewToken = String(viewSelect.value || "").trim();
  if (!viewToken) return;

  const games = resolveGamesForViewToken(viewToken, payload);
  const options = buildMatchupOptionsForGames(games);
  const sig = options.map((o) => `${o.value}:${o.label}`).join("|");
  if (sig === lastMatchupOptionsSig) return;
  lastMatchupOptionsSig = sig;

  const current = matchupSelect.value;
  const placeholder =
    matchupSelect.querySelector('option[value=""]')?.textContent || "— Select a game —";

  matchupSelect.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = placeholder;
  if (!current) blank.selected = true;
  matchupSelect.appendChild(blank);

  for (const opt of options) {
    const el = document.createElement("option");
    el.value = opt.value;
    el.textContent = opt.label;
    if (opt.value === current) el.selected = true;
    matchupSelect.appendChild(el);
  }

  matchupSelect.disabled = options.length === 0;
}

function applyGamelogMissingToDom(awayNorms, homeNorms) {
  const awayInput = document.getElementById("awayMissing");
  const homeInput = document.getElementById("homeMissing");
  if (awayInput) awayInput.value = (awayNorms || []).join(",");
  if (homeInput) homeInput.value = (homeNorms || []).join(",");

  const awaySet = new Set(awayNorms || []);
  const homeSet = new Set(homeNorms || []);
  document.querySelectorAll("[data-lineup-toggle]").forEach((btn) => {
    const side = btn.getAttribute("data-side");
    const norm = btn.getAttribute("data-norm");
    const onBench = (side === "away" ? awaySet : homeSet).has(norm);
    btn.textContent = onBench ? "Bench" : "Active";
    btn.classList.toggle("matchup-status-btn--active", !onBench);
    btn.classList.toggle("matchup-status-btn--missing", onBench);
    btn.setAttribute("aria-pressed", onBench ? "true" : "false");
    const row = btn.closest(".matchup-roster-item");
    if (row) row.classList.toggle("matchup-roster-item--benched", onBench);
  });

  const ctx = window.__MATCHUP_CLIENT__;
  if (ctx && window.MmsMatchupPredictor?.buildLineupEnrichment) {
    window.MmsMatchupPredictorUi?.updateLineupUi?.(
      window.MmsMatchupPredictor.buildLineupEnrichment(ctx, awayNorms || [], homeNorms || [])
    );
  }

  window.__MMS_MATCHUP_BENCH__?.applyServerMissing?.(awayNorms, homeNorms);
}

export async function refreshLiveGamelogMissing(ctx = window.__MATCHUP_CLIENT__) {
  if (!ctx?.awayBaseProfile?.teamId || !ctx?.homeBaseProfile?.teamId) return;

  await invalidateSourceCsvCache(SOURCE_KEYS.schedule);
  await invalidateSourceCsvCache(SOURCE_KEYS.gamelogs2026);

  const [schedule, gamelogs, teams, stats2026, captainCodes] = await Promise.all([
    loadWeeklySchedule(),
    load2026GamelogsByPlayer(),
    loadTeamRosters(),
    load2026StatsByPlayer(),
    loadCaptainTeamCodeById(),
  ]);

  const selectedGame = {
    awayTeamId: ctx.awayBaseProfile.teamId,
    homeTeamId: ctx.homeBaseProfile.teamId,
    isoDate: ctx.gameIsoDate,
    gameId: ctx.gameId || "",
    away: ctx.awayLabel,
    home: ctx.homeLabel,
  };

  const parsedGame = findParsedGameForMatchup(
    schedule.parsedGames,
    selectedGame,
    ctx.gameIsoDate
  );
  if (!isParsedGameFinished(parsedGame)) return;

  const teamCodeById = new Map([
    ...buildTeamCodeById(teams, stats2026),
    ...captainCodes,
  ]);

  const awayMissingSet = new Set();
  const homeMissingSet = new Set();
  applyGamelogMissingForFinishedGame({
    awayMissingSet,
    homeMissingSet,
    selectedGame,
    viewIso: ctx.gameIsoDate,
    parsedScheduleGames: schedule.parsedGames,
    gamelogs,
    teamCodeById,
    awayEffectivePlayers: ctx.awayPlayers || [],
    homeEffectivePlayers: ctx.homePlayers || [],
    normalizeName: normalizePlayerName,
  });

  const sig = `${[...awayMissingSet].sort().join(",")}|${[...homeMissingSet].sort().join(",")}`;
  if (sig === lastGamelogMissingSig) return;
  lastGamelogMissingSig = sig;

  applyGamelogMissingToDom([...awayMissingSet], [...homeMissingSet]);
}

export async function refreshSeasonRecord({ force = false } = {}) {
  try {
    if (!force) {
      await invalidateSourceCsvCache(SOURCE_KEYS.schedule);
      await invalidateSourceCsvCache(SOURCE_KEYS.gamelogs2026);
      const schedule = await loadWeeklySchedule();
      const finishedCount = countFinishedScheduleGames(schedule.parsedGames);
      const schedSig = scheduleSignature(schedule.parsedGames);
      if (
        lastFinishedGameCount != null &&
        finishedCount === lastFinishedGameCount &&
        schedSig === lastScheduleSignature &&
        lastRecordKey
      ) {
        return;
      }
      lastFinishedGameCount = finishedCount;
      lastScheduleSignature = schedSig;
    }

    const record = await loadLiveMatchupSeasonRecord({ refreshSchedule: true });
    if (!record) return;
    const key = recordSignature(record);
    if (key === lastRecordKey) return;
    lastRecordKey = key;
    window.__MATCHUP_PREDICTOR_RECORD__ = record;
    window.MmsMatchupPredictorUi?.updatePredictorRecordUi?.(record);
  } catch (err) {
    console.error("Matchup season record refresh failed", err);
  }
}

export async function refreshLiveMatchupChrome() {
  try {
    await refreshMatchupScheduleChrome();
    const ctx = window.__MATCHUP_CLIENT__;
    if (ctx) await refreshLiveGamelogMissing(ctx);
  } catch (err) {
    console.error("Matchup live chrome refresh failed", err);
  }
}

function startLiveWatchers() {
  if (liveWatchStarted) return;
  if (!document.getElementById("matchupForm")) return;
  liveWatchStarted = true;

  const pollMs = Math.max(30_000, DEFAULT_POLL_MS);

  void refreshLiveMatchupChrome();
  void refreshSeasonRecord({ force: true });

  seasonRecordWatchTimer = window.setInterval(() => {
    void refreshSeasonRecord();
  }, pollMs);

  liveChromeTimer = window.setInterval(() => {
    void refreshLiveMatchupChrome();
  }, pollMs);
}

export function bootMatchupLiveWatchers() {
  const kick = () => window.setTimeout(startLiveWatchers, 800);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", kick);
  } else {
    kick();
  }
}

if (typeof window !== "undefined") {
  window.MmsMatchupPredictorLive = {
    refreshMatchupViewSelect,
    refreshMatchupScheduleChrome,
    refreshSeasonRecord,
    refreshLiveGamelogMissing,
    refreshLiveMatchupChrome,
    bootMatchupLiveWatchers,
  };
  bootMatchupLiveWatchers();
}
