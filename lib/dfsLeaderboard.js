const {
  DFS_LINEUP_SIZE,
  buildDfsPlayerPool,
  buildLeaderboardSlateFromToken,
  scoreLineupForSlate,
} = require("./dfs");

function safeText(value) {
  return (value || "").toString().trim();
}

/** Never show a full email on the leaderboard — use the part before @ only. */
function leaderboardDisplayName(raw) {
  const s = safeText(raw);
  if (!s) return "Player";
  const at = s.indexOf("@");
  if (at === -1) return s;
  const local = safeText(s.slice(0, at));
  return local || "Player";
}

function normalizeLineupRecord(data, id) {
  const norms = Array.isArray(data.playerNorms) ? data.playerNorms : [];
  const playerSalaries = Array.isArray(data.playerSalaries)
    ? data.playerSalaries.map((n) => Number(n) || 0)
    : null;
  let salaryUsed = Number(data.salaryUsed) || 0;
  if (
    playerSalaries &&
    playerSalaries.length === norms.length &&
    playerSalaries.length === 8
  ) {
    salaryUsed = playerSalaries.reduce((s, n) => s + n, 0);
  }
  return {
    id: id || data.id || "",
    userId: data.userId || "",
    displayName: data.displayName || "Player",
    slateId: (data.slateId || "").toUpperCase(),
    playerNorms: norms,
    playerSalaries,
    salaryUsed,
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

function isLeaderboardSlateId(slateId) {
  const s = slateId || "";
  return /^W\d+$/.test(s) || /^D\d{8}$/.test(s);
}

async function fetchAllWeekLineups(db) {
  const snap = await db.collection("lineups").get();
  return snap.docs.map(normalizeLineupDoc).filter((row) => isLeaderboardSlateId(row.slateId));
}

/** Firestore client or Admin SDK — same snapshot shape. */
async function fetchLineupsForLeaderboard(db, tab, selectedWeek) {
  const tabNorm = safeText(tab).toLowerCase() === "cumulative" ? "cumulative" : "weekly";
  if (tabNorm === "weekly" && selectedWeek) {
    return fetchLineupsForSlate(db, safeText(selectedWeek).toUpperCase());
  }
  return fetchAllWeekLineups(db);
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

/** Compare key for tie detection (null / unfinished slates group together). */
function leaderboardPointsKey(points) {
  if (points == null || points === "") return null;
  const n = Number(points);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
}

/**
 * Competition ranking with tie labels: shared scores get T-1, T-2, …; unique scores get 1, 2, 3.
 * Assumes rows are already sorted by points descending.
 */
function assignLeaderboardRanks(sortedRows) {
  if (!sortedRows.length) return [];

  const out = [];
  let position = 1;
  let i = 0;

  while (i < sortedRows.length) {
    const key = leaderboardPointsKey(sortedRows[i].points);
    let j = i + 1;
    while (j < sortedRows.length && leaderboardPointsKey(sortedRows[j].points) === key) {
      j += 1;
    }
    const groupSize = j - i;
    const rankNum = position;
    const rankDisplay = groupSize > 1 ? `T-${rankNum}` : String(rankNum);

    for (let k = i; k < j; k += 1) {
      out.push({
        ...sortedRows[k],
        rank: rankNum,
        rankDisplay,
      });
    }
    position += groupSize;
    i = j;
  }

  return out;
}

function buildWeeklyLeaderboardFromLineups(lineups, slate, scoringDeps) {
  const normalized = (lineups || []).map((row) =>
    row.playerNorms ? normalizeLineupRecord(row, row.id) : row
  );
  const scoringContext = buildScoringContext({ ...scoringDeps, slate });
  const scored = normalized.map((lineup) => scoreLineupDoc(lineup, slate, scoringContext));
  const withDisplay = scored.map((row) => ({
    ...row,
    displayName: leaderboardDisplayName(row.displayName),
  }));
  const rows = assignLeaderboardRanks(sortByPointsDesc(withDisplay));

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
  refIso,
  activeSlateToken = ""
) {
  const pastWeeks = weekOptions.filter((w) => w.isPast);
  const normalized = (lineups || [])
    .map((row) => (row.playerNorms ? normalizeLineupRecord(row, row.id) : row))
    .filter((row) => isLeaderboardSlateId(row.slateId));

  const active = safeText(activeSlateToken).toUpperCase();
  const hasFullLineupForSlate = (userId, slateId) => {
    if (!userId || !slateId) return false;
    return normalized.some(
      (l) =>
        l.userId === userId &&
        l.slateId === slateId &&
        Array.isArray(l.playerNorms) &&
        l.playerNorms.length === DFS_LINEUP_SIZE
    );
  };

  const byUser = new Map();
  for (const lineup of normalized) {
    if (!lineup.userId) continue;
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

  const scoringContextBySlate = new Map();
  function scoringContextForSlate(slate) {
    const key = slate?.viewToken || "";
    if (!key) return buildScoringContext({ ...scoringDeps, slate });
    if (!scoringContextBySlate.has(key)) {
      scoringContextBySlate.set(key, buildScoringContext({ ...scoringDeps, slate }));
    }
    return scoringContextBySlate.get(key);
  }

  for (const week of pastWeeks) {
    const slate = buildLeaderboardSlateFromToken(week.value, schedulePayload, refIso);
    if (!slate) continue;

    const scoringContext = scoringContextForSlate(slate);
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

  const rows = assignLeaderboardRanks(
    sortByPointsDesc(
      [...byUser.values()].map((user) => ({
        userId: user.userId,
        displayName: leaderboardDisplayName(user.displayName),
        points: Math.round(user.totalPoints * 10) / 10,
        weeksPlayed: user.weeksPlayed,
        weekScores: user.weekScores,
        hasStats: user.weekScores.some((w) => w.hasStats),
        hasOpenSlateLineup: hasFullLineupForSlate(user.userId, active),
      }))
    )
  );

  return {
    pastWeekCount: pastWeeks.length,
    rows,
    entryCount: rows.length,
    activeSlateToken: active || null,
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
  activeSlateToken = "",
}) {
  const lineups = await fetchAllWeekLineups(db);
  return buildCumulativeLeaderboardFromLineups(
    lineups,
    weekOptions,
    scoringDeps,
    schedulePayload,
    refIso,
    activeSlateToken
  );
}

module.exports = {
  normalizeLineupRecord,
  fetchLineupsForLeaderboard,
  assignLeaderboardRanks,
  buildWeeklyLeaderboard,
  buildWeeklyLeaderboardFromLineups,
  buildCumulativeLeaderboard,
  buildCumulativeLeaderboardFromLineups,
};
