/**
 * Browser bundle: recalculate matchup prediction when lineups change on static pages.
 */
import { normalizePlayerName } from "../lib/dfs.js";
import { applyMissingPlayersToProfile } from "../lib/matchupMissingPlayers.js";
import { buildMatchupLineupEnrichment } from "../lib/matchupLineupClient.js";
import {
  predictMatchupGame,
  enrichMatchupPredictionLines,
  americanMoneylinePair,
} from "../lib/matchupPredict.js";
import {
  getCachedPlayerReplacements,
  applyReplacementsToPlayerNames,
  remapLineupNorms,
  buildRosterEntriesWithReplacements,
  serializeReplacementsForClient,
  filterReplacementsForDate,
} from "../lib/playerReplacements.js";
import { getCachedDfsLeaderboardScoringContext } from "../lib/dfsLeaderboardScoringContext.js";

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
  enrichMatchupPredictionLines(prediction);
  const moneylines = americanMoneylinePair(prediction.winPct.away / 100, prediction.winPct.home / 100);
  prediction.lines.moneylineAway = moneylines.away;
  prediction.lines.moneylineHome = moneylines.home;
  prediction.awayLabel = ctx.awayLabel;
  prediction.homeLabel = ctx.homeLabel;
  return prediction;
}

if (typeof window !== "undefined") {
  window.MmsMatchupPredictor = {
    predictFromPayload,
    buildLineupEnrichment: buildMatchupLineupEnrichment,
    hydrateMatchupReplacements,
  };
}

export { predictFromPayload, buildMatchupLineupEnrichment, hydrateMatchupReplacements };
