const {
  DFS_LINEUP_SIZE,
  buildDfsPlayerPool,
  buildWeekSlateFromToken,
  scoreLineupForSlate,
} = require("./dfs");

function normalizeLineupRecord(data, id) {
  const norms = Array.isArray(data.playerNorms) ? data.playerNorms : [];
  return {
    id: id || data.id || "",
    userId: data.userId || "",
    displayName: data.displayName || "Player",
    slateId: (data.slateId || "").toUpperCase(),
    playerNorms: norms,
    salaryUsed: Number(data.salaryUsed) || 0,
    updatedAt: data.updatedAt || null,
  };
}

function normalizeLineupDoc(doc) {
  return normalizeLineupRecord(doc.data(), doc.id);
}

async function fetchLineupsForSlate(db, slateId) {
  const slate = (slateId || "").toUpperCase();
  const snap = await db.collection("lineups").where("slateId", "==", slate).get();
  return snap.docs.map(normalizeLineupDoc);
}

async function fetchAllWeekLineups(db) {
  const snap = await db.collection("lineups").get();
  return snap.docs.map(normalizeLineupDoc).filter((row) => /^W\d+$/.test(row.slateId));
}

function scoreLineupDoc(lineup, slate, scoringContext) {
  const { poolByNorm, teamCodeById, gamelogs } = scoringContext;
  if (!slate?.isPast) {
    return {
      ...lineup,
      points: null,
      breakdown: [],
      hasStats: false,
      incomplete: lineup.playerNorms.length !== DFS_LINEUP_SIZE,
    };
  }

  if (lineup.playerNorms.length !== DFS_LINEUP_SIZE) {
    return {
      ...lineup,
      points: 0,
      breakdown: [],
      hasStats: false,
      incomplete: true,
    };
  }

  const scored = scoreLineupForSlate(
    lineup.playerNorms,
    poolByNorm,
    slate,
    teamCodeById,
    gamelogs
  );
  const hasStats = scored.breakdown.some((row) => row.games > 0);

  return {
    ...lineup,
    points: scored.total,
    breakdown: scored.breakdown,
    hasStats,
    incomplete: false,
  };
}

function buildScoringContext({
  teams,
  slate,
  offenseRatingByNorm,
  scheduleRunRates,
  stats2026ByPlayer,
  teamCodeById,
  gamelogs,
}) {
  const playerPool = buildDfsPlayerPool({
    teams,
    slate,
    offenseRatingByNorm,
    scheduleRunRates,
    stats2026ByPlayer,
    teamCodeById,
  });
  const poolByNorm = new Map(playerPool.map((p) => [p.norm, p]));
  return { poolByNorm, teamCodeById, gamelogs };
}

function sortByPointsDesc(rows) {
  return rows.slice().sort((a, b) => {
    const pa = a.points == null ? -1 : a.points;
    const pb = b.points == null ? -1 : b.points;
    if (pb !== pa) return pb - pa;
    return (a.displayName || "").localeCompare(b.displayName || "", undefined, {
      sensitivity: "base",
    });
  });
}

function buildWeeklyLeaderboardFromLineups(lineups, slate, scoringDeps) {
  const normalized = (lineups || []).map((row) =>
    row.playerNorms ? normalizeLineupRecord(row, row.id) : row
  );
  const scoringContext = buildScoringContext({ ...scoringDeps, slate });
  const rows = sortByPointsDesc(
    normalized.map((lineup) => scoreLineupDoc(lineup, slate, scoringContext))
  ).map((row, index) => ({ ...row, rank: index + 1 }));

  return {
    slate,
    rows,
    entryCount: rows.length,
  };
}

function buildCumulativeLeaderboardFromLineups(
  lineups,
  weekOptions,
  scoringDeps,
  schedulePayload,
  refIso
) {
  const pastWeeks = weekOptions.filter((w) => w.isPast);
  const normalized = (lineups || [])
    .map((row) => (row.playerNorms ? normalizeLineupRecord(row, row.id) : row))
    .filter((row) => /^W\d+$/.test(row.slateId));

  const byUser = new Map();
  for (const lineup of normalized) {
    if (!byUser.has(lineup.userId)) {
      byUser.set(lineup.userId, {
        userId: lineup.userId,
        displayName: lineup.displayName,
        weeksPlayed: 0,
        weekScores: [],
        totalPoints: 0,
      });
    }
    const user = byUser.get(lineup.userId);
    if (lineup.displayName && lineup.displayName !== "Player") {
      user.displayName = lineup.displayName;
    }
  }

  for (const week of pastWeeks) {
    const slate = buildWeekSlateFromToken(week.value, schedulePayload, refIso);
    if (!slate) continue;

    const scoringContext = buildScoringContext({ ...scoringDeps, slate });
    const weekLineups = normalized.filter((l) => l.slateId === week.value);

    for (const lineup of weekLineups) {
      if (!byUser.has(lineup.userId)) continue;
      const scored = scoreLineupDoc(lineup, slate, scoringContext);
      const pts = scored.points == null ? 0 : scored.points;
      const user = byUser.get(lineup.userId);
      user.weekScores.push({
        slateId: week.value,
        label: week.label,
        points: pts,
        hasStats: scored.hasStats,
      });
      user.totalPoints = Math.round((user.totalPoints + pts) * 10) / 10;
      user.weeksPlayed += 1;
    }
  }

  const rows = sortByPointsDesc(
    [...byUser.values()]
      .filter((user) => user.weeksPlayed > 0)
      .map((user) => ({
        userId: user.userId,
        displayName: user.displayName,
        points: user.totalPoints,
        weeksPlayed: user.weeksPlayed,
        weekScores: user.weekScores,
        hasStats: user.weekScores.some((w) => w.hasStats),
      }))
  ).map((row, index) => ({ ...row, rank: index + 1 }));

  return {
    pastWeekCount: pastWeeks.length,
    rows,
    entryCount: rows.length,
  };
}

async function buildWeeklyLeaderboard({ db, slate, scoringDeps }) {
  const lineups = await fetchLineupsForSlate(db, slate.viewToken);
  return buildWeeklyLeaderboardFromLineups(lineups, slate, scoringDeps);
}

async function buildCumulativeLeaderboard({
  db,
  weekOptions,
  scoringDeps,
  schedulePayload,
  refIso,
}) {
  const lineups = await fetchAllWeekLineups(db);
  return buildCumulativeLeaderboardFromLineups(
    lineups,
    weekOptions,
    scoringDeps,
    schedulePayload,
    refIso
  );
}

module.exports = {
  normalizeLineupRecord,
  buildWeeklyLeaderboard,
  buildWeeklyLeaderboardFromLineups,
  buildCumulativeLeaderboard,
  buildCumulativeLeaderboardFromLineups,
};
