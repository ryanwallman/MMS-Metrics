/**
 * Browser bundle: recalculate matchup prediction when lineups change on static pages.
 */
import { normalizePlayerName } from "../lib/dfs.js";
import { applyMissingPlayersToProfile } from "../lib/matchupMissingPlayers.js";
import {
  predictMatchupGame,
  enrichMatchupPredictionLines,
  americanMoneylinePair,
} from "../lib/matchupPredict.js";

function mapFromObject(obj) {
  return new Map(Object.entries(obj || {}));
}

function predictFromPayload(ctx, awayMissingList, homeMissingList) {
  const awayMissing = new Set((awayMissingList || []).map((n) => normalizePlayerName(n)).filter(Boolean));
  const homeMissing = new Set((homeMissingList || []).map((n) => normalizePlayerName(n)).filter(Boolean));

  const offenseRatingByNorm = mapFromObject(ctx.offenseRatingByNorm);
  const stats2026ByPlayer = mapFromObject(ctx.stats2026ByPlayer);
  const defenseZByNorm = mapFromObject(ctx.defenseZByNorm);

  let awayProfile = applyMissingPlayersToProfile(
    ctx.awayBaseProfile,
    ctx.awayPlayers,
    awayMissing,
    offenseRatingByNorm,
    stats2026ByPlayer,
    defenseZByNorm,
    normalizePlayerName
  );
  let homeProfile = applyMissingPlayersToProfile(
    ctx.homeBaseProfile,
    ctx.homePlayers,
    homeMissing,
    offenseRatingByNorm,
    stats2026ByPlayer,
    defenseZByNorm,
    normalizePlayerName
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
  window.MmsMatchupPredictor = { predictFromPayload };
}

export { predictFromPayload };
