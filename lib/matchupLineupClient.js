"use strict";

const { normalizePlayerName } = require("./dfs");
const { enrichRosterForMatchupView } = require("./matchupMissingPlayers");

function mapFromObject(obj) {
  return new Map(Object.entries(obj || {}));
}

function buildSideLineupState(playersOriginal, teamName, benchNorms, ctxMaps, byOriginalNorm) {
  const missingSet = new Set(
    (benchNorms || []).map((n) => normalizePlayerName(n)).filter(Boolean)
  );
  const rosterEntry = { players: playersOriginal || [], teamName: teamName || "" };
  return enrichRosterForMatchupView(
    rosterEntry,
    ctxMaps.offenseRatingByNorm,
    missingSet,
    normalizePlayerName,
    ctxMaps.stats2026ByPlayer,
    ctxMaps.positionByNorm,
    byOriginalNorm
  );
}

function alertsForSide(roster, teamSide, teamName) {
  return (roster?.lineupAlerts || []).map((a) => ({
    ...a,
    teamSide,
    teamName: teamName || roster?.teamName || "",
  }));
}

function replacementMapFromCtx(ctx) {
  const raw = ctx?.replacementByOriginalNorm;
  if (!raw || typeof raw !== "object") return null;
  const map = new Map();
  for (const [norm, entry] of Object.entries(raw)) {
    if (entry?.replacementNorm) map.set(norm, entry);
  }
  return map.size ? map : null;
}

/**
 * Browser payload: roster enrichment + MMS rule alerts for both teams.
 */
function buildMatchupLineupEnrichment(ctx, awayBenchNorms, homeBenchNorms) {
  const offenseRatingByNorm = mapFromObject(ctx.offenseRatingByNorm);
  const stats2026ByPlayer = mapFromObject(ctx.stats2026ByPlayer);
  const positionByNorm = mapFromObject(ctx.positionByNorm);
  const maps = { offenseRatingByNorm, stats2026ByPlayer, positionByNorm };

  const awayName = ctx.awayLabel || "Away";
  const homeName = ctx.homeLabel || "Home";
  const byOriginalNorm = replacementMapFromCtx(ctx);
  const awayOriginal = ctx.awayPlayersOriginal || ctx.awayPlayers;
  const homeOriginal = ctx.homePlayersOriginal || ctx.homePlayers;

  const away = buildSideLineupState(awayOriginal, awayName, awayBenchNorms, maps, byOriginalNorm);
  const home = buildSideLineupState(homeOriginal, homeName, homeBenchNorms, maps, byOriginalNorm);

  const lineupRuleAlerts = [
    ...alertsForSide(away, "away", awayName),
    ...alertsForSide(home, "home", homeName),
  ];

  return { away, home, lineupRuleAlerts };
}

module.exports = {
  buildMatchupLineupEnrichment,
};
