/**
 * Build DFS lineup player pool + slate context (server and GitHub Pages client).
 */
const { SCHEDULE_CALENDAR_YEAR } = require("./sheetUrls");
const {
  buildDfsPlayerPool,
  buildDfsSlateOptions,
  filterVisibleDfsSlateOptions,
  resolveNextLineupLockDeadline,
  buildSlateFromToken,
  buildSlatePointsByNorm,
  buildLastWeekPointsByNorm,
  scoreLineupFromPointsMap,
  resolvePreviousDfsSlate,
  referenceIsoForScheduleYear,
  DFS_LINEUP_SIZE,
  DFS_SALARY_CAP,
} = require("./dfs");
const {
  getCachedDfsLeaderboardScoringContext,
  loadWeeklySchedule,
} = require("./dfsLeaderboardScoringContext");
const { remapLineupNorms } = require("./playerReplacements");

function normalizePlayerName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {object} opts
 * @param {string} opts.slateToken - W# or DYYYYMMDD
 * @param {string[]} [opts.lineupNorms] - optional saved lineup norms
 */
async function buildDfsLineupPageData({ slateToken, lineupNorms = [] }) {
  const [{ schedulePayload: scheduleLite, gamelogs, scoringDeps }, scheduleFull] =
    await Promise.all([getCachedDfsLeaderboardScoringContext(), loadWeeklySchedule()]);

  const schedulePayload = scheduleFull.parsedGames?.length
    ? scheduleFull
    : { ...scheduleLite, parsedGames: scheduleFull.parsedGames || [] };

  const refIso = referenceIsoForScheduleYear(SCHEDULE_CALENDAR_YEAR);
  const nowMs = Date.now();
  const fullSlateOptions = buildDfsSlateOptions(schedulePayload, refIso, nowMs);
  const slateOptions = filterVisibleDfsSlateOptions(fullSlateOptions);
  const activeSlateToken = fullSlateOptions.find((o) => o.canEdit)?.value ?? null;

  const token = String(slateToken || activeSlateToken || "")
    .trim()
    .toUpperCase();
  let slate = buildSlateFromToken(token, schedulePayload, refIso, fullSlateOptions, nowMs);
  if (!slate) {
    slate = {
      viewToken: "",
      slateType: null,
      games: [],
      teamIds: new Set(),
      isoDates: [],
      label: "No slate available",
      isPast: false,
      canEdit: false,
      isViewOnly: false,
      isFuture: false,
      isLocked: true,
      isActive: false,
      weekNumber: null,
    };
  }

  const {
    teams,
    offenseRatingByNorm,
    scheduleRunRates,
    stats2026ByPlayer,
    teamCodeById,
    replacementByOriginalNorm,
  } = scoringDeps;

  const playerPool = buildDfsPlayerPool({
    teams,
    slate,
    offenseRatingByNorm,
    scheduleRunRates,
    stats2026ByPlayer,
    teamCodeById,
    replacementByOriginalNorm,
  });

  const poolByNorm = new Map(playerPool.map((p) => [p.norm, p]));
  const remappedNorms = remapLineupNorms(lineupNorms, replacementByOriginalNorm);
  const norms = remappedNorms
    .filter((n) => poolByNorm.has(n))
    .slice(0, DFS_LINEUP_SIZE);

  const showSlateStats = Boolean(slate && !slate.canEdit);
  let slateStats = { byNorm: {}, hasStats: false };
  if (showSlateStats && playerPool.length) {
    slateStats = buildSlatePointsByNorm(playerPool, slate, gamelogs);
  }

  const playerPoolWithStats = playerPool.map((p) => {
    const row = slateStats.byNorm[p.norm] || { points: 0, games: 0 };
    return {
      ...p,
      slatePoints: row.points,
      slateGames: row.games,
      doubleHeader: Boolean(p.doubleHeader || row.games >= 2),
    };
  });

  const salaryUsed = norms.reduce((sum, n) => sum + (poolByNorm.get(n)?.salary || 0), 0);

  let lastWeekPreview = null;
  const prevSlate =
    slate.viewToken && /^W\d+$/i.test(slate.viewToken)
      ? resolvePreviousDfsSlate(slate.viewToken, schedulePayload)
      : null;
  if (prevSlate) {
    const { byNorm, hasStats } = buildLastWeekPointsByNorm(playerPool, prevSlate, gamelogs);
    lastWeekPreview = {
      slateLabel: prevSlate.label,
      viewToken: prevSlate.viewToken,
      byNorm,
      hasStats,
      scored:
        norms.length > 0 ? scoreLineupFromPointsMap(norms, poolByNorm, byNorm) : null,
    };
  }

  const fetchedAt = new Date().toISOString();
  const lockDeadline = slate.canEdit
    ? resolveNextLineupLockDeadline(fullSlateOptions, slate, nowMs)
    : { deadlineMs: null, deadlineLabel: "" };

  return {
    fetchedAt,
    lockDeadlineMs: lockDeadline.deadlineMs,
    lockDeadlineLabel: lockDeadline.deadlineLabel,
    slate,
    slateOptions,
    activeSlateToken,
    allSlatesLocked: !activeSlateToken,
    selectedSlate: slate.viewToken || token,
    playerPool: playerPoolWithStats,
    showSlateStats,
    lineupNorms: norms,
    salaryUsed,
    salaryCap: DFS_SALARY_CAP,
    salaryRemaining: DFS_SALARY_CAP - salaryUsed,
    lastWeekPreview,
    hasGamelogData: gamelogs.byNorm.size > 0,
  };
}

module.exports = { buildDfsLineupPageData, normalizePlayerName };
