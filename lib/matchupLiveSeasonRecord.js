"use strict";

const { normalizePlayerName, buildTeamCodeById, load2026GamelogsByPlayer } = require("./dfs");
const { computeMatchupPredictorRecord } = require("./matchupPredictorRecord");
const { isParsedGameFinished } = require("./matchupGameResult");
const { csvTextCache } = require("./fetchCsvText");
const { SCHEDULE_URL } = require("./sheetUrls");
const {
  loadWeeklySchedule,
  loadCareerByPlayer,
  load2025HistoricalByPlayer,
} = require("./dfsLeaderboardScoringContext");
const {
  loadTeamRosters,
  buildNameToTeamIdMap,
  buildRosterByTeamId,
} = require("./teamRosters");
const { load2026StatsByPlayer } = require("./stats2026Loader");
const { getCachedPlayerReplacements } = require("./playerReplacements");
const { loadCaptainTeamCodeById } = require("./powerRankingsCaptains");

function loadDefensiveRatingsNormalizedMap() {
  const map = new Map();
  try {
    const manual = require("./data/defensiveRatings2026");
    for (const [k, v] of Object.entries(manual.normalizedNameToDefense || {})) {
      const n = Number(v);
      map.set(normalizePlayerName(k), Number.isFinite(n) ? n : 0);
    }
  } catch {
    /* optional manual ratings */
  }
  return map;
}

function countFinishedScheduleGames(parsedGames) {
  let n = 0;
  for (const g of parsedGames || []) {
    if (isParsedGameFinished(g)) n += 1;
  }
  return n;
}

async function gatherMatchupSeasonRecordDeps() {
  const [
    teams,
    careerByPlayer,
    hist2025ByPlayer,
    stats2026ByPlayer,
    defenseMap,
    replacements,
    gamelogs,
    captainTeamCodeById,
    schedulePayload,
  ] = await Promise.all([
    loadTeamRosters(),
    loadCareerByPlayer(),
    load2025HistoricalByPlayer(),
    load2026StatsByPlayer(),
    Promise.resolve(loadDefensiveRatingsNormalizedMap()),
    getCachedPlayerReplacements(),
    load2026GamelogsByPlayer(),
    loadCaptainTeamCodeById(),
    loadWeeklySchedule(),
  ]);

  const { byOriginalNorm } = replacements;
  const teamCodeById = new Map([
    ...buildTeamCodeById(teams, stats2026ByPlayer),
    ...captainTeamCodeById,
  ]);

  return {
    parsedScheduleGames: schedulePayload.parsedGames || [],
    teams,
    rosterByTeamId: buildRosterByTeamId(teams),
    nameToTeamId: buildNameToTeamIdMap(teams),
    careerByPlayer,
    hist2025ByPlayer,
    stats2026ByPlayer,
    defenseMap,
    gamelogs,
    teamCodeById,
    replacementByOriginalNorm: byOriginalNorm,
    sundayIsosSorted: schedulePayload.sundayIsosSorted,
  };
}

/**
 * @param {{ refreshSchedule?: boolean }} [opts]
 */
async function loadLiveMatchupSeasonRecord(opts = {}) {
  if (opts.refreshSchedule) {
    csvTextCache.invalidate(SCHEDULE_URL);
  }
  const deps = await gatherMatchupSeasonRecordDeps();
  const record = computeMatchupPredictorRecord(deps);
  if (!record?.decided) return null;
  return record;
}

module.exports = {
  loadLiveMatchupSeasonRecord,
  gatherMatchupSeasonRecordDeps,
  countFinishedScheduleGames,
};
