"use strict";

const { normalizePlayerName } = require("./dfs");
const { enrichRosterForMatchupView, evaluateMissingPlayerRules } = require("./matchupMissingPlayers");

function mapFromObject(obj) {
  return new Map(Object.entries(obj || {}));
}

function buildSideLineupState(players, teamName, benchNorms, ctxMaps) {
  const missingSet = new Set(
    (benchNorms || []).map((n) => normalizePlayerName(n)).filter(Boolean)
  );
  const rosterEntry = { players: players || [], teamName: teamName || "" };
  return enrichRosterForMatchupView(
    rosterEntry,
    ctxMaps.offenseRatingByNorm,
    missingSet,
    normalizePlayerName,
    ctxMaps.stats2026ByPlayer,
    ctxMaps.positionByNorm
  );
}

function alertsForSide(roster, teamSide, teamName) {
  return (roster?.lineupAlerts || []).map((a) => ({
    ...a,
    teamSide,
    teamName: teamName || roster?.teamName || "",
  }));
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

  const away = buildSideLineupState(ctx.awayPlayers, awayName, awayBenchNorms, maps);
  const home = buildSideLineupState(ctx.homePlayers, homeName, homeBenchNorms, maps);

  const lineupRuleAlerts = [
    ...alertsForSide(away, "away", awayName),
    ...alertsForSide(home, "home", homeName),
  ];

  return { away, home, lineupRuleAlerts };
}

module.exports = {
  buildMatchupLineupEnrichment,
};
