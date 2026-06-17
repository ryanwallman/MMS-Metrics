/**
 * Browser bundle: recalculate matchup prediction when lineups change on static pages.
 * Live dropdown / season record / MG polling lives in matchup-predictor-live.mjs.
 */
import { normalizePlayerName } from "../lib/dfs.js";
import { applyMissingPlayersToProfile } from "../lib/matchupMissingPlayers.js";
import { buildMatchupLineupEnrichment } from "../lib/matchupLineupClient.js";
import {
  predictMatchupGame,
  enrichMatchupPredictionLines,
} from "../lib/matchupPredict.js";
import {
  refreshLivePlayerReplacements,
  applyReplacementsToPlayerNames,
  remapLineupNorms,
  buildRosterEntriesWithReplacements,
  serializeReplacementsForClient,
  filterReplacementsForDate,
  activeReplacementsSignature,
} from "../lib/playerReplacements.js";
import { getCachedDfsLeaderboardScoringContext, loadWeeklySchedule } from "../lib/dfsLeaderboardScoringContext.js";
import {
  findParsedGameForMatchup,
  isParsedGameFinished,
  gradeMatchupModelBets,
} from "../lib/matchupGameResult.js";
import { invalidateSourceCsvCache, SOURCE_KEYS } from "../lib/sheetUrls.js";

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

async function hydrateMatchupReplacements(ctx, preloadedReplacements = null) {
  if (!ctx) return ctx;

  const replacements = preloadedReplacements || (await refreshLivePlayerReplacements());
  const scoring = await getCachedDfsLeaderboardScoringContext();

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

  const prediction = predictMatchupGame(awayProfile, homeProfile, ctx.leagueNorms, ctx.runBase);
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

function watchMatchupLiveScores({ ctx, getPrediction, onFinished, pollMs = DEFAULT_SCORE_POLL_MS }) {
  if (!ctx || ctx.isFinishedGame) return () => {};

  let stopped = false;
  let timer = null;

  async function check() {
    if (stopped || ctx.isFinishedGame) return;
    try {
      await invalidateSourceCsvCache(SOURCE_KEYS.schedule);
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

function applyBenchToForm(awayNorms, homeNorms) {
  const awayInput = document.getElementById("awayMissing");
  const homeInput = document.getElementById("homeMissing");
  if (awayInput) awayInput.value = (awayNorms || []).join(",");
  if (homeInput) homeInput.value = (homeNorms || []).join(",");
}

let lastReplacementSig = null;

async function refreshMatchupReplacementsLive(ctx, { force = false } = {}) {
  if (!ctx) return false;

  const replacements = await refreshLivePlayerReplacements();
  const newSig = activeReplacementsSignature(replacements.byOriginalNorm, ctx.gameIsoDate);
  if (!force && newSig === lastReplacementSig) return false;
  lastReplacementSig = newSig;

  await hydrateMatchupReplacements(ctx, replacements);

  const activeMap = deserializeReplacementMap(ctx.replacementByOriginalNorm);

  if (window.MmsMatchupPredictorUi?.applyReplacementDisplay) {
    window.MmsMatchupPredictorUi.applyReplacementDisplay(
      ctx.awayPlayersOriginal,
      "away",
      activeMap
    );
    window.MmsMatchupPredictorUi.applyReplacementDisplay(
      ctx.homePlayersOriginal,
      "home",
      activeMap
    );
  }

  const { away, home } = benchNormsFromForm();
  const remappedAway = remapLineupNorms(away, activeMap);
  const remappedHome = remapLineupNorms(home, activeMap);
  applyBenchToForm(remappedAway, remappedHome);

  if (window.__MMS_MATCHUP_BENCH__?.applyServerMissing) {
    window.__MMS_MATCHUP_BENCH__.applyServerMissing(remappedAway, remappedHome);
    return true;
  }

  if (!ctx.isFinishedGame && window.MmsMatchupPredictorUi?.updatePredictionUi) {
    const prediction = predictFromPayload(ctx, remappedAway, remappedHome);
    window.MmsMatchupPredictorUi.updatePredictionUi(prediction);
    const enrichment = buildMatchupLineupEnrichment(ctx, remappedAway, remappedHome);
    window.MmsMatchupPredictorUi.updateLineupUi(enrichment);
  }

  return true;
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
  if (!ctx) return;

  if (ctx.isFinishedGame && ctx.gameResult) {
    window.MmsMatchupPredictorUi?.renderGameResultUi?.(ctx.gameResult);
    return;
  }

  if (!document.querySelector(".matchup-prediction:not(.matchup-prediction--final)")) return;

  scoreWatchStop = watchMatchupLiveScores({
    ctx,
    getPrediction: () => {
      const { away, home } = benchNormsFromForm();
      return predictFromPayload(ctx, away, home);
    },
    onFinished: (gameResult) => {
      window.MmsMatchupPredictorUi?.renderGameResultUi?.(gameResult);
      window.MmsMatchupPredictorLive?.refreshSeasonRecord?.({ force: true });
      window.MmsMatchupPredictorLive?.refreshLiveGamelogMissing?.(ctx);
    },
  });
}

if (typeof window !== "undefined") {
  window.MmsMatchupPredictor = {
    predictFromPayload,
    buildLineupEnrichment: buildMatchupLineupEnrichment,
    hydrateMatchupReplacements,
    refreshMatchupReplacementsLive,
    watchMatchupLiveScores,
  };

  const kickScoreWatch = () => window.setTimeout(autoStartScoreWatcher, 1500);
  const kickReplacementRefresh = () => {
    const ctx = window.__MATCHUP_CLIENT__;
    if (ctx) void refreshMatchupReplacementsLive(ctx, { force: true });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      kickReplacementRefresh();
      kickScoreWatch();
    });
  } else {
    kickReplacementRefresh();
    kickScoreWatch();
  }
}

export {
  predictFromPayload,
  buildMatchupLineupEnrichment,
  hydrateMatchupReplacements,
  refreshMatchupReplacementsLive,
  watchMatchupLiveScores,
};
