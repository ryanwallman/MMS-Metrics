const {
  buildWeeklyLeaderboardFromLineups,
  slateSummaryForClient,
} = require("./dfsLeaderboard");
const {
  buildLeaderboardSlateFromToken,
  defaultLeaderboardWeek,
  listLeaderboardSlateOptions,
  referenceIsoForScheduleYear,
  slateHasGamelogDates,
} = require("./dfs");
const { getCachedDfsLeaderboardScoringContext } = require("./dfsLeaderboardScoringContext");
const { SCHEDULE_CALENDAR_YEAR } = require("./sheetUrls");

function safeText(value) {
  return (value || "").toString().trim();
}

/** Weekly leaderboard: lineups for one slateId → fantasy points for that slate. */
async function buildWeeklyLeaderboardResponse(selectedWeek, lineups) {
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
    slate && Array.isArray(lineups)
      ? await buildWeeklyLeaderboardFromLineups(lineups, slate, scoringDeps)
      : { rows: [], entryCount: 0 };

  return {
    selectedWeek: week,
    weekly,
    hasGamelogData: gamelogs.byNorm.size > 0,
    slateHasBoxScoresForWeek: slate ? slateHasGamelogDates(slate, gamelogs) : false,
    slate: slateSummaryForClient(slate),
  };
}

module.exports = { buildWeeklyLeaderboardResponse };
