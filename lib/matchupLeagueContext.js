"use strict";

const {
  collectLeagueOffenseBundles,
  weightedMomentsPerMetric,
  buildOffensivePlayerRows,
  extendOffenseRatingsForReplacements,
  buildTeamStandingsFromScheduleGames,
  buildTeamOffenseSections,
} = require("./offenseRankingsPage");
const {
  leagueRunScoringBaseline,
  buildTeamScheduleRunRates,
  buildDefenseZByNorm,
  buildTeamMatchupProfiles,
  buildMatchupLeagueNorms,
} = require("./matchupPredict");
const { normalizeScheduleTeamId } = require("./teamRosters");
const {
  filterPastPlayedScheduleGames,
  defaultScheduleReferenceIso,
} = require("./powerRankingsCore");

function buildMatchupLeagueContext({
  teams,
  careerByPlayer,
  hist2025ByPlayer,
  stats2026ByPlayer,
  parsedScheduleGames,
  defenseMap,
  rosterByTeamId,
  byOriginalNorm = null,
  referenceIso = null,
}) {
  const refIso = referenceIso || defaultScheduleReferenceIso();
  const gamesForRecord = filterPastPlayedScheduleGames(parsedScheduleGames, refIso);
  const standingsMap = buildTeamStandingsFromScheduleGames(gamesForRecord, teams);
  const runBase = leagueRunScoringBaseline(gamesForRecord);
  const scheduleRunRates = buildTeamScheduleRunRates(gamesForRecord, teams);

  const bundles = collectLeagueOffenseBundles(careerByPlayer, hist2025ByPlayer, stats2026ByPlayer);
  const { moments } = weightedMomentsPerMetric(bundles);
  const leagueRows = buildOffensivePlayerRows(
    teams,
    careerByPlayer,
    hist2025ByPlayer,
    stats2026ByPlayer,
    moments
  );
  const offenseRatingByNorm = new Map(leagueRows.map((r) => [r.norm, r.rating]));
  extendOffenseRatingsForReplacements(
    offenseRatingByNorm,
    byOriginalNorm,
    careerByPlayer,
    hist2025ByPlayer,
    stats2026ByPlayer,
    moments
  );

  const teamSections = buildTeamOffenseSections(teams, leagueRows, standingsMap);
  const teamOverallById = new Map();
  for (const sec of teamSections) {
    const sid = normalizeScheduleTeamId(sec.teamId);
    teamOverallById.set(sid, sec);
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

  return {
    standingsMap,
    runBase,
    scheduleRunRates,
    offenseRatingByNorm,
    defenseZByNorm,
    teamProfiles,
    leagueNorms,
  };
}

module.exports = { buildMatchupLeagueContext };
