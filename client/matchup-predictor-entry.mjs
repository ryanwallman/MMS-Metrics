/**
 * Browser bundle: recalculate matchup prediction when lineups change on static pages.
 */
import { normalizePlayerName, load2026GamelogsByPlayer, resolveGamesForViewToken } from "../lib/dfs.js";
import { applyMissingPlayersToProfile } from "../lib/matchupMissingPlayers.js";
import { buildMatchupLineupEnrichment } from "../lib/matchupLineupClient.js";
import {
  predictMatchupGame,
  enrichMatchupPredictionLines,
  alignProjectedRunsToWinFavorite,
} from "../lib/matchupPredict.js";
import { applyWinProbCalibration } from "../lib/matchupWinProbCalibration.js";
import {
  getCachedPlayerReplacements,
  applyReplacementsToPlayerNames,
  remapLineupNorms,
  buildRosterEntriesWithReplacements,
  serializeReplacementsForClient,
  filterReplacementsForDate,
} from "../lib/playerReplacements.js";
import { getCachedDfsLeaderboardScoringContext, loadWeeklySchedule } from "../lib/dfsLeaderboardScoringContext.js";
import {
  findParsedGameForMatchup,
  isParsedGameFinished,
  gradeMatchupModelBets,
} from "../lib/matchupGameResult.js";
import { buildMatchupOptionsForGames } from "../lib/matchupScheduleChrome.js";
import { applyGamelogMissingForFinishedGame } from "../lib/matchupGamelogMissing.js";
import {
  loadTeamRosters,
  buildTeamCodeById,
} from "../lib/teamRosters.js";
import { load2026StatsByPlayer } from "../lib/stats2026Loader.js";
import { loadCaptainTeamCodeById } from "../lib/powerRankingsCaptains.js";
import { SCHEDULE_URL } from "../lib/sheetUrls.js";
import { csvTextCache } from "../lib/fetchCsvText.js";
import {
  loadLiveMatchupSeasonRecord,
  countFinishedScheduleGames,
} from "../lib/matchupLiveSeasonRecord.js";

function mapFromObject(obj) {
  return new Map(Object.entries(obj || {}));
}

function mapToObject(map) {
  const out = {};
  if (!map) return out;
  for (const [k, v] of map.entries()) out[k] = v;
  return out;
}

function mergeNormSubsetIntoObject(target, map, norms) {
  if (!map || !target) return;
  for (const norm of norms) {
    if (map.has(norm)) target[norm] = map.get(norm);
  }
}

function statsRowForNorm(statsMap, norm) {
  const row = statsMap?.get(norm);
  if (!row) return null;
  return { PA: row.PA, Runs: row.Runs, RBI: row.RBI };
}

function deserializeReplacementMap(obj) {
  const byOriginalNorm = new Map();
  for (const [norm, entry] of Object.entries(obj || {})) {
    if (!entry?.replacementNorm) continue;
    byOriginalNorm.set(norm, entry);
  }
  return byOriginalNorm;
}

function effectiveNormsFromCtx(ctx) {
  const norms = new Set();
  for (const name of [...(ctx.awayPlayers || []), ...(ctx.homePlayers || [])]) {
    const n = normalizePlayerName(name);
    if (n) norms.add(n);
  }
  return norms;
}

/**
 * Fetch live replacements + scoring data so static pages stay current without rebuild.
 */
async function hydrateMatchupReplacements(ctx) {
  if (!ctx) return ctx;

  const [replacements, scoring] = await Promise.all([
    getCachedPlayerReplacements(),
    getCachedDfsLeaderboardScoringContext(),
  ]);

  const { byOriginalNorm } = replacements;
  const gameIsoDate = ctx.gameIsoDate || null;
  const activeReplacements = filterReplacementsForDate(byOriginalNorm, gameIsoDate);
  const origAway = ctx.awayPlayersOriginal || ctx.awayPlayers || [];
  const origHome = ctx.homePlayersOriginal || ctx.homePlayers || [];

  ctx.awayPlayersOriginal = [...origAway];
  ctx.homePlayersOriginal = [...origHome];
  ctx.awayPlayers = applyReplacementsToPlayerNames(origAway, activeReplacements);
  ctx.homePlayers = applyReplacementsToPlayerNames(origHome, activeReplacements);
  ctx.replacementByOriginalNorm = serializeReplacementsForClient(activeReplacements);

  const norms = effectiveNormsFromCtx(ctx);
  const { offenseRatingByNorm, stats2026ByPlayer } = scoring.scoringDeps || {};

  ctx.offenseRatingByNorm = ctx.offenseRatingByNorm || {};
  ctx.stats2026ByPlayer = ctx.stats2026ByPlayer || {};
  mergeNormSubsetIntoObject(ctx.offenseRatingByNorm, offenseRatingByNorm, norms);
  for (const norm of norms) {
    const row = statsRowForNorm(stats2026ByPlayer, norm);
    if (row) ctx.stats2026ByPlayer[norm] = row;
  }

  const positionByNorm = mapFromObject(ctx.positionByNorm);
  for (const sidePlayers of [origAway, origHome]) {
    const entries = buildRosterEntriesWithReplacements(
      sidePlayers,
      normalizePlayerName,
      positionByNorm,
      activeReplacements
    );
    for (const e of entries) {
      if (e.position) positionByNorm.set(e.norm, e.position);
    }
  }
  ctx.positionByNorm = mapToObject(positionByNorm);

  return ctx;
}

function predictFromPayload(ctx, awayMissingList, homeMissingList) {
  const byOriginalNorm = deserializeReplacementMap(ctx.replacementByOriginalNorm);
  const awayBench = remapLineupNorms(awayMissingList, byOriginalNorm);
  const homeBench = remapLineupNorms(homeMissingList, byOriginalNorm);

  const awayMissing = new Set(awayBench.map((n) => normalizePlayerName(n)).filter(Boolean));
  const homeMissing = new Set(homeBench.map((n) => normalizePlayerName(n)).filter(Boolean));

  const offenseRatingByNorm = mapFromObject(ctx.offenseRatingByNorm);
  const stats2026ByPlayer = mapFromObject(ctx.stats2026ByPlayer);
  const defenseZByNorm = mapFromObject(ctx.defenseZByNorm);
  const positionByNorm = mapFromObject(ctx.positionByNorm);

  let awayProfile = applyMissingPlayersToProfile(
    ctx.awayBaseProfile,
    ctx.awayPlayers,
    awayMissing,
    offenseRatingByNorm,
    stats2026ByPlayer,
    defenseZByNorm,
    normalizePlayerName,
    positionByNorm
  );
  let homeProfile = applyMissingPlayersToProfile(
    ctx.homeBaseProfile,
    ctx.homePlayers,
    homeMissing,
    offenseRatingByNorm,
    stats2026ByPlayer,
    defenseZByNorm,
    normalizePlayerName,
    positionByNorm
  );

  let prediction = predictMatchupGame(awayProfile, homeProfile, ctx.leagueNorms, ctx.runBase);
  if (!ctx.isFinishedGame && ctx.calibrationWeights?.length) {
    prediction = applyWinProbCalibration(
      awayProfile,
      homeProfile,
      prediction,
      ctx.calibrationWeights
    );
  }
  enrichMatchupPredictionLines(prediction);
  prediction.awayLabel = ctx.awayLabel;
  prediction.homeLabel = ctx.homeLabel;
  return prediction;
}

const DEFAULT_SCORE_POLL_MS = Number(process.env.MATCHUP_SCORE_POLL_MS) || 90_000;

function selectedGameFromCtx(ctx) {
  if (!ctx) return null;
  return {
    awayTeamId: ctx.awayBaseProfile?.teamId,
    homeTeamId: ctx.homeBaseProfile?.teamId,
    isoDate: ctx.gameIsoDate,
    gameId: ctx.gameId || "",
  };
}

/**
 * Poll the live schedule sheet and swap to final-result UI when scores appear.
 */
function watchMatchupLiveScores({ ctx, getPrediction, onFinished, pollMs = DEFAULT_SCORE_POLL_MS }) {
  if (!ctx || ctx.isFinishedGame) return () => {};

  let stopped = false;
  let timer = null;

  async function check() {
    if (stopped || ctx.isFinishedGame) return;
    try {
      csvTextCache.invalidate(SCHEDULE_URL);
      const schedule = await loadWeeklySchedule();
      const parsedGame = findParsedGameForMatchup(
        schedule.parsedGames,
        selectedGameFromCtx(ctx),
        ctx.gameIsoDate
      );
      if (!isParsedGameFinished(parsedGame)) return;

      const prediction =
        typeof getPrediction === "function" ? getPrediction() : ctx.gameResult?.modelPrediction;
      if (!prediction) return;

      const gameResult = gradeMatchupModelBets(
        parsedGame,
        prediction,
        ctx.awayLabel,
        ctx.homeLabel
      );
      if (!gameResult) return;

      ctx.isFinishedGame = true;
      ctx.gameResult = gameResult;
      stopped = true;
      if (timer) clearInterval(timer);
      if (typeof onFinished === "function") onFinished(gameResult);
    } catch (err) {
      console.error("Matchup score poll failed", err);
    }
  }

  void check();
  timer = window.setInterval(() => {
    void check();
  }, Math.max(30_000, Number(pollMs) || DEFAULT_SCORE_POLL_MS));

  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
  };
}

let scoreWatchStop = null;
let seasonRecordWatchTimer = null;
let liveChromeTimer = null;
let lastFinishedGameCount = null;
let lastRecordKey = null;
let lastMatchupOptionsSig = null;
let lastGamelogMissingSig = null;

async function refreshMatchupScheduleChrome() {
  const viewSelect = document.getElementById("view");
  const matchupSelect = document.getElementById("matchup");
  if (!viewSelect || !matchupSelect) return;

  csvTextCache.invalidate(SCHEDULE_URL);
  const payload = await loadWeeklySchedule();
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

  const ctx = typeof window !== "undefined" ? window.__MATCHUP_CLIENT__ : null;
  if (ctx && window.MmsMatchupPredictor?.buildLineupEnrichment) {
    window.MmsMatchupPredictorUi?.updateLineupUi?.(
      window.MmsMatchupPredictor.buildLineupEnrichment(ctx, awayNorms || [], homeNorms || [])
    );
  }
}

async function refreshLiveGamelogMissing(ctx) {
  if (!ctx?.awayBaseProfile?.teamId || !ctx?.homeBaseProfile?.teamId) return;

  csvTextCache.invalidate(SCHEDULE_URL);
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

async function refreshLiveMatchupChrome() {
  try {
    await refreshMatchupScheduleChrome();
    const ctx = typeof window !== "undefined" ? window.__MATCHUP_CLIENT__ : null;
    if (ctx) await refreshLiveGamelogMissing(ctx);
  } catch (err) {
    console.error("Matchup live chrome refresh failed", err);
  }
}

function recordSignature(record) {
  if (!record) return "";
  return `${record.wins}|${record.losses}|${record.decided}`;
}

async function refreshSeasonRecord({ force = false } = {}) {
  try {
    if (!force) {
      csvTextCache.invalidate(SCHEDULE_URL);
      const schedule = await loadWeeklySchedule();
      const finishedCount = countFinishedScheduleGames(schedule.parsedGames);
      if (
        lastFinishedGameCount != null &&
        finishedCount === lastFinishedGameCount &&
        lastRecordKey
      ) {
        return;
      }
      lastFinishedGameCount = finishedCount;
    }

    const record = await loadLiveMatchupSeasonRecord({ refreshSchedule: force });
    if (!record) return;
    const key = recordSignature(record);
    if (key === lastRecordKey) return;
    lastRecordKey = key;
    window.MmsMatchupPredictorUi?.updatePredictorRecordUi?.(record);
  } catch (err) {
    console.error("Matchup season record refresh failed", err);
  }
}

function benchNormsFromForm() {
  function parseList(value) {
    return String(value || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const awayInput = document.getElementById("awayMissing");
  const homeInput = document.getElementById("homeMissing");
  return {
    away: parseList(awayInput?.value),
    home: parseList(homeInput?.value),
  };
}

function autoStartScoreWatcher() {
  if (scoreWatchStop) return;
  const ctx = typeof window !== "undefined" ? window.__MATCHUP_CLIENT__ : null;
  if (!ctx || ctx.isFinishedGame) return;
  if (!document.querySelector(".matchup-prediction:not(.matchup-prediction--final)")) return;

  scoreWatchStop = watchMatchupLiveScores({
    ctx,
    getPrediction: () => {
      const { away, home } = benchNormsFromForm();
      return predictFromPayload(ctx, away, home);
    },
    onFinished: (gameResult) => {
      window.MmsMatchupPredictorUi?.renderGameResultUi?.(gameResult);
      void refreshSeasonRecord({ force: true });
      void refreshLiveGamelogMissing(ctx);
    },
  });
}

function autoStartSeasonRecordWatcher() {
  if (seasonRecordWatchTimer) return;
  if (!document.getElementById("matchupForm")) return;

  void refreshSeasonRecord({ force: true });
  seasonRecordWatchTimer = window.setInterval(() => {
    void refreshSeasonRecord();
  }, Math.max(30_000, DEFAULT_SCORE_POLL_MS));
}

function autoStartLiveChromeWatcher() {
  if (liveChromeTimer) return;
  if (!document.getElementById("matchupForm")) return;

  void refreshLiveMatchupChrome();
  liveChromeTimer = window.setInterval(() => {
    void refreshLiveMatchupChrome();
  }, Math.max(30_000, DEFAULT_SCORE_POLL_MS));
}

if (typeof window !== "undefined") {
  window.MmsMatchupPredictor = {
    predictFromPayload,
    buildLineupEnrichment: buildMatchupLineupEnrichment,
    hydrateMatchupReplacements,
    watchMatchupLiveScores,
    refreshSeasonRecord,
    refreshLiveMatchupChrome,
  };

  const kickLiveUpdates = () => {
    window.setTimeout(autoStartScoreWatcher, 1500);
    window.setTimeout(autoStartSeasonRecordWatcher, 2000);
    window.setTimeout(autoStartLiveChromeWatcher, 2500);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", kickLiveUpdates);
  } else {
    kickLiveUpdates();
  }
}

export {
  predictFromPayload,
  buildMatchupLineupEnrichment,
  hydrateMatchupReplacements,
  watchMatchupLiveScores,
  refreshSeasonRecord,
  refreshLiveMatchupChrome,
};
