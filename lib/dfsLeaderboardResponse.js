const {
  buildWeeklyLeaderboardFromLineups,
  buildCumulativeLeaderboardFromLineups,
  slateSummaryForClient,
} = require("./dfsLeaderboard");
const {
  buildLeaderboardSlateFromToken,
  defaultLeaderboardWeek,
  listLeaderboardSlateOptions,
  referenceIsoForScheduleYear,
  resolveActiveDfsSlateToken,
  slateHasGamelogDates,
} = require("./dfs");
const { getCachedDfsLeaderboardScoringContext } = require("./dfsLeaderboardScoringContext");
const { SCHEDULE_CALENDAR_YEAR } = require("./sheetUrls");

function safeText(value) {
  return (value || "").toString().trim();
}

/** Weekly + season leaderboards for one page load. */
async function buildLeaderboardPageResponse(selectedWeek, lineupsForWeek, allLineups = null) {
  const { schedulePayload, gamelogs, scoringDeps } = await getCachedDfsLeaderboardScoringContext();
  const refIso = referenceIsoForScheduleYear(SCHEDULE_CALENDAR_YEAR);
  const nowMs = Date.now();
  const weekOptions = listLeaderboardSlateOptions(schedulePayload, refIso, nowMs);
  const week =
    selectedWeek && weekOptions.some((w) => w.value === selectedWeek)
      ? selectedWeek
      : defaultLeaderboardWeek(weekOptions, schedulePayload, refIso, nowMs);

  const slate = buildLeaderboardSlateFromToken(week, schedulePayload, refIso, nowMs);
  const weekly =
    slate && Array.isArray(lineupsForWeek)
      ? await buildWeeklyLeaderboardFromLineups(lineupsForWeek, slate, scoringDeps)
      : { rows: [], entryCount: 0 };

  const seasonLineups = Array.isArray(allLineups) ? allLineups : lineupsForWeek || [];
  const activeSlateToken = resolveActiveDfsSlateToken(schedulePayload, refIso, nowMs);
  const season = buildCumulativeLeaderboardFromLineups(
    seasonLineups,
    weekOptions,
    scoringDeps,
    schedulePayload,
    refIso,
    activeSlateToken
  );

  return {
    selectedWeek: week,
    weekly,
    season,
    scheduleYear: SCHEDULE_CALENDAR_YEAR,
    hasGamelogData: gamelogs.byNorm.size > 0,
    slateHasBoxScoresForWeek: slate ? slateHasGamelogDates(slate, gamelogs) : false,
    slate: slateSummaryForClient(slate),
  };
}

/** @deprecated alias — prefer buildLeaderboardPageResponse */
async function buildWeeklyLeaderboardResponse(selectedWeek, lineups) {
  return buildLeaderboardPageResponse(selectedWeek, lineups, lineups);
}

module.exports = { buildLeaderboardPageResponse, buildWeeklyLeaderboardResponse };
