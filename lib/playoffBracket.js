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
 * Bottom four teams play PIG (15v18, 16v17); top 14 plus two PIG winners seed 1–16.
 * Only round 1 is shown — later rounds reseed.
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
      winnerMainSeed: 15,
    },
    {
      id: "pig-16-17",
      highSeed: 16,
      lowSeed: 17,
      high: teamByProjectedRank(projectionRows, 16),
      away: teamByProjectedRank(projectionRows, 17),
      winnerMainSeed: 16,
    },
  ];

  const mainMatchups = [];
  for (let highSeed = 1; highSeed <= 8; highSeed += 1) {
    const lowSeed = 17 - highSeed;
    const high = teamByProjectedRank(projectionRows, highSeed);
    let low = null;
    let lowTbd = false;
    let pigNote = null;

    if (lowSeed === 15) {
      lowTbd = true;
      pigNote = "🐷 Winner of #15 vs #18";
    } else if (lowSeed === 16) {
      lowTbd = true;
      pigNote = "🐷 Winner of #16 vs #17";
    } else {
      low = teamByProjectedRank(projectionRows, lowSeed);
    }

    mainMatchups.push({
      matchupIndex: highSeed,
      highSeed,
      lowSeed,
      high,
      low,
      lowTbd,
      pigNote,
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
