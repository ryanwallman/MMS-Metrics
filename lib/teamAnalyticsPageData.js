"use strict";

const {
  buildTeamCodeById,
  buildCodeToTeamId,
  parse2026GamelogsFromCsvText,
} = require("./dfs");
const { loadTeamRosters, normalizeScheduleTeamId } = require("./teamRosters");
const { getGamelogs2026CsvUrl } = require("./sheetUrls");
const { load2026StatsByPlayer } = require("./stats2026Loader");
const { fetchCsvText } = require("./fetchCsvText");
const { fetchCsvRows, buildParsedScheduleGames } = require("./dfsLeaderboardScoringContext");
const { SCHEDULE_URL } = require("./sheetUrls");
const { buildTeamLineupAnalytics, buildLeagueLineupRankings } = require("./teamAnalytics");
const Papa = require("papaparse");

const SHARED_CACHE_MS =
  Number(process.env.TEAM_ANALYTICS_SHARED_CACHE_MS) ||
  Number(process.env.CSV_CACHE_TTL_MS) ||
  10 * 60 * 1000;

let sharedCache = null;
let sharedCacheExpiresAt = 0;
let sharedInflight = null;

function safeText(value) {
  return (value || "").toString().trim();
}

function parseGamelogDataAsOf(csvText) {
  try {
    const parsed = Papa.parse(csvText, { skipEmptyLines: false });
    const rows = parsed.data || [];
    for (const row of rows) {
      for (let i = 0; i < (row?.length || 0); i += 1) {
        const label = safeText(row[i]).replace(/^\ufeff/, "");
        if (label === "Data As Of") return safeText(row[i + 1]) || null;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function loadTeamAnalyticsSharedDataFresh() {
  const [teams, stats2026ByPlayer, scheduleRows, gamelogCsvText] = await Promise.all([
    loadTeamRosters(),
    load2026StatsByPlayer(),
    fetchCsvRows(SCHEDULE_URL),
    fetchCsvText(getGamelogs2026CsvUrl()),
  ]);

  const gamelogs = parse2026GamelogsFromCsvText(gamelogCsvText);
  const teamCodeById = buildTeamCodeById(teams, stats2026ByPlayer);
  const codeToTeamId = buildCodeToTeamId(teamCodeById);
  const parsedScheduleGames = buildParsedScheduleGames(scheduleRows, teams);
  const leagueRankings = buildLeagueLineupRankings({
    teams,
    teamCodeById,
    codeToTeamId,
    gamelogs,
    parsedScheduleGames,
  });

  return {
    teams,
    teamCodeById,
    codeToTeamId,
    gamelogs,
    parsedScheduleGames,
    leagueRankings,
    generatedAt: new Date().toISOString(),
    dataAsOf: parseGamelogDataAsOf(gamelogCsvText),
  };
}

async function loadTeamAnalyticsSharedData() {
  const now = Date.now();
  if (sharedCache && now < sharedCacheExpiresAt) {
    return sharedCache;
  }
  if (sharedInflight) return sharedInflight;

  sharedInflight = loadTeamAnalyticsSharedDataFresh()
    .then((result) => {
      sharedCache = result;
      sharedCacheExpiresAt = Date.now() + SHARED_CACHE_MS;
      return result;
    })
    .finally(() => {
      sharedInflight = null;
    });

  return sharedInflight;
}

async function buildTeamAnalyticsPageData(teamId = null) {
  const shared = await loadTeamAnalyticsSharedData();
  const normalizedTeamId = teamId ? normalizeScheduleTeamId(teamId) : null;

  const base = {
    generatedAt: shared.generatedAt,
    dataAsOf: shared.dataAsOf,
    leagueRankings: shared.leagueRankings,
    team: null,
    analytics: null,
    error: null,
  };

  if (!normalizedTeamId) return base;

  const team = shared.teams.find((t) => normalizeScheduleTeamId(t.teamId) === normalizedTeamId);
  if (!team) {
    return { ...base, error: "Team not found", teamId: normalizedTeamId };
  }

  const teamCode = shared.teamCodeById.get(normalizedTeamId);
  if (!teamCode) {
    return {
      ...base,
      error: "Could not resolve team code from 2026 stats sheet.",
      teamId: normalizedTeamId,
      team: {
        teamId: normalizedTeamId,
        teamName: team.teamName,
        captain: team.captain,
      },
    };
  }

  const analytics = buildTeamLineupAnalytics({
    teamId: normalizedTeamId,
    teamCode,
    gamelogs: shared.gamelogs,
    codeToTeamId: shared.codeToTeamId,
    parsedScheduleGames: shared.parsedScheduleGames,
  });

  return {
    ...base,
    team: {
      teamId: normalizedTeamId,
      teamName: team.teamName,
      captain: team.captain,
      teamCode,
      jerseyColor: team.jerseyColor,
      numberColor: team.numberColor,
    },
    analytics,
  };
}

module.exports = {
  buildTeamAnalyticsPageData,
  parseGamelogDataAsOf,
};
