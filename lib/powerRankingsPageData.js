/**
 * Power rankings page data — live Google Sheets (schedule, stats, rosters, career, captains).
 */
const { normalizePlayerName } = require("./dfs");
const { loadTeamRosters, normalizeScheduleTeamId } = require("./teamRosters");
const { SCHEDULE_URL } = require("./sheetUrls");
const { load2026StatsByPlayer } = require("./stats2026Loader");
const { loadPowerRankingsCaptainMap } = require("./powerRankingsCaptains");
const {
  loadCareerByPlayer,
  load2025HistoricalByPlayer,
  buildParsedScheduleGames,
  fetchCsvRows,
  loadWeeklySchedule,
} = require("./dfsLeaderboardScoringContext");
const {
  collectLeagueOffenseBundles,
  weightedMomentsPerMetric,
  buildOffensivePlayerRows,
  buildTeamStandingsFromScheduleGames,
  buildTeamOffenseSections,
  TEAM_OVERALL_WEIGHT_PLAYER,
  TEAM_OVERALL_WEIGHT_RECORD,
  TEAM_OVERALL_WEIGHT_SOS,
} = require("./offenseRankingsPage");
const {
  REGULAR_SEASON_GAMES,
  buildPowerRankingsCurrentRows,
  projectSeasonStandings,
  attachPowerRatingsToProjections,
  attachCaptainsToProjectionRows,
} = require("./powerRankingsCore");
const { buildPlayoffBracketFirstRound } = require("./playoffBracket");
const {
  leagueRunScoringBaseline,
  buildTeamScheduleRunRates,
  buildDefenseZByNorm,
  buildTeamMatchupProfiles,
  buildMatchupLeagueNorms,
} = require("./matchupPredict");
const { buildPowerRankingsVizData } = require("./powerRankingsVizData");

function safeText(value) {
  return (value || "").toString().trim();
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function loadDefensiveRatingsNormalizedMap() {
  const map = new Map();
  try {
    const manual = require("./data/defensiveRatings2026");
    for (const [k, v] of Object.entries(manual.normalizedNameToDefense || {})) {
      map.set(normalizePlayerName(k), toNumber(v));
    }
  } catch {
    /* optional manual ratings */
  }
  return map;
}

async function buildPowerRankingsPageData() {
  const [
    teams,
    careerByPlayer,
    hist2025ByPlayer,
    stats2026ByPlayer,
    scheduleRows,
    defenseMap,
    captainMap,
    schedulePayload,
  ] = await Promise.all([
    loadTeamRosters(),
    loadCareerByPlayer(),
    load2025HistoricalByPlayer(),
    load2026StatsByPlayer(),
    fetchCsvRows(SCHEDULE_URL),
    Promise.resolve(loadDefensiveRatingsNormalizedMap()),
    loadPowerRankingsCaptainMap(),
    loadWeeklySchedule(),
  ]);

  const bundles = collectLeagueOffenseBundles(careerByPlayer, hist2025ByPlayer, stats2026ByPlayer);
  const { moments } = weightedMomentsPerMetric(bundles);
  const leagueRows = buildOffensivePlayerRows(
    teams,
    careerByPlayer,
    hist2025ByPlayer,
    stats2026ByPlayer,
    moments
  );

  const parsedScheduleGames = buildParsedScheduleGames(scheduleRows, teams);
  const standingsMap = buildTeamStandingsFromScheduleGames(parsedScheduleGames, teams);
  const teamSections = buildTeamOffenseSections(teams, leagueRows, standingsMap);
  const currentRankings = buildPowerRankingsCurrentRows(teamSections, captainMap);

  const runBase = leagueRunScoringBaseline(parsedScheduleGames);
  const scheduleRunRates = buildTeamScheduleRunRates(parsedScheduleGames, teams);
  const offenseRatingByNorm = new Map(leagueRows.map((r) => [r.norm, r.rating]));
  const teamOverallById = new Map();
  for (const sec of teamSections) {
    teamOverallById.set(normalizeScheduleTeamId(sec.teamId), sec);
  }

  const rosterByTeamId = {};
  for (const t of teams) {
    rosterByTeamId[t.teamId] = { players: t.players || [], teamName: t.teamName };
  }

  const { zByNorm: defenseZByNorm } = buildDefenseZByNorm(defenseMap, stats2026ByPlayer);
  const teamProfiles = buildTeamMatchupProfiles(
    teams,
    rosterByTeamId,
    offenseRatingByNorm,
    stats2026ByPlayer,
    defenseZByNorm,
    standingsMap,
    teamOverallById,
    scheduleRunRates
  );
  const leagueNorms = buildMatchupLeagueNorms(teamProfiles);

  const projection = projectSeasonStandings(
    teams,
    standingsMap,
    teamProfiles,
    leagueNorms,
    runBase,
    parsedScheduleGames
  );
  attachPowerRatingsToProjections(projection.rows, teamSections);
  attachCaptainsToProjectionRows(projection.rows, captainMap);

  const vizData = buildPowerRankingsVizData(
    schedulePayload,
    teams,
    leagueRows,
    stats2026ByPlayer
  );

  return {
    regularSeasonGames: REGULAR_SEASON_GAMES,
    currentRankings,
    projectionRows: projection.rows,
    playoffBracket: buildPlayoffBracketFirstRound(projection.rows),
    remainingGamesSimulated: projection.remainingGamesSimulated,
    remainingGamesTotal: projection.remainingGamesTotal,
    teamOverallWeights: {
      player: TEAM_OVERALL_WEIGHT_PLAYER,
      record: TEAM_OVERALL_WEIGHT_RECORD,
      sos: TEAM_OVERALL_WEIGHT_SOS,
    },
    vizData,
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = {
  buildPowerRankingsPageData,
  REGULAR_SEASON_GAMES,
};
