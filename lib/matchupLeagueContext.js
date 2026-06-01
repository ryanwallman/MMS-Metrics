"use strict";

const {
  collectLeagueOffenseBundles,
  weightedMomentsPerMetric,
  buildOffensivePlayerRows,
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

function buildMatchupLeagueContext({
  teams,
  careerByPlayer,
  hist2025ByPlayer,
  stats2026ByPlayer,
  parsedScheduleGames,
  defenseMap,
  rosterByTeamId,
}) {
  const standingsMap = buildTeamStandingsFromScheduleGames(parsedScheduleGames, teams);
  const runBase = leagueRunScoringBaseline(parsedScheduleGames);
  const scheduleRunRates = buildTeamScheduleRunRates(parsedScheduleGames, teams);

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
