"use strict";

const PLAYOFF_TEAM_COUNT = 18;
const DIRECT_PLAYOFF_SEEDS = 14;

function teamByProjectedRank(rows, rank) {
  const row = (rows || []).find((r) => r.projectedRank === rank);
  if (!row) return null;
  return {
    seed: rank,
    teamId: row.teamId,
    teamName: row.teamName,
    captain: row.captain || null,
    projectedRecord: row.projectedRecord,
  };
}

/**
 * First-round playoff bracket from projected final standings.
 * PIG is fixed: #15 vs #18 and #16 vs #17. Top 14 plus two PIG winners seed 1–16.
 * Reseeding assigns which PIG winner lands in the #15 / #16 slots, so seeds 1 and 2
 * do not have guaranteed opponents until after play-in.
 */
function buildPlayoffBracketFirstRound(projectionRows) {
  const count = (projectionRows || []).length;
  if (count < PLAYOFF_TEAM_COUNT) {
    return {
      ok: false,
      reason: `Need ${PLAYOFF_TEAM_COUNT} teams for the playoff bracket; got ${count}.`,
    };
  }

  const pigGames = [
    {
      id: "pig-15-18",
      highSeed: 15,
      lowSeed: 18,
      high: teamByProjectedRank(projectionRows, 15),
      away: teamByProjectedRank(projectionRows, 18),
    },
    {
      id: "pig-16-17",
      highSeed: 16,
      lowSeed: 17,
      high: teamByProjectedRank(projectionRows, 16),
      away: teamByProjectedRank(projectionRows, 17),
    },
  ];

  const mainMatchups = [];
  for (let highSeed = 1; highSeed <= 8; highSeed += 1) {
    const lowSeed = 17 - highSeed;
    const high = teamByProjectedRank(projectionRows, highSeed);
    const lowTbd = lowSeed >= 15;
    const low = lowTbd ? null : teamByProjectedRank(projectionRows, lowSeed);

    mainMatchups.push({
      matchupIndex: highSeed,
      highSeed,
      lowSeed,
      high,
      low,
      lowTbd,
      pigNote: lowTbd ? "Reseeded PIG winner" : null,
    });
  }

  return {
    ok: true,
    directPlayoffSeeds: DIRECT_PLAYOFF_SEEDS,
    pigGames,
    mainMatchups,
  };
}

module.exports = {
  PLAYOFF_TEAM_COUNT,
  DIRECT_PLAYOFF_SEEDS,
  buildPlayoffBracketFirstRound,
};
