const { createMemoryCache } = require("./memoryCache");
const {
  DFS_LINEUP_SIZE,
  buildDfsPlayerPool,
  buildLeaderboardSlateFromToken,
  buildSlatePointsByNorm,
  normalizePlayerName,
  scoreLineupFromPointsMap,
} = require("./dfs");

/** Per-slate player points map (same as DFS lineup pool “Pts” column) — built once per slate. */
const slatePointsCache = createMemoryCache(
  Number(process.env.SLATE_POINTS_CACHE_TTL_MS) || 10 * 60 * 1000,
  "slate-points"
);

function safeText(value) {
  return (value || "").toString().trim();
}

function lineupUpdatedMs(updatedAt) {
  if (!updatedAt) return 0;
  if (typeof updatedAt === "number" && Number.isFinite(updatedAt)) return updatedAt;
  if (typeof updatedAt.toMillis === "function") return updatedAt.toMillis();
  if (updatedAt.seconds != null) {
    return Number(updatedAt.seconds) * 1000 + (Number(updatedAt.nanoseconds) || 0) / 1e6;
  }
  const d = new Date(updatedAt);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function applyLatestDisplayName(user, lineup) {
  const name = safeText(lineup.displayName);
  if (!name || name === "Player") return;
  const ts = lineupUpdatedMs(lineup.updatedAt);
  if (ts >= (user.displayNameAt || 0)) {
    user.displayName = lineup.displayName;
    user.displayNameAt = ts;
  }
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

function buildSlatePointsContext(scoringDeps, slate) {
  const scoringContext = buildScoringContext({ ...scoringDeps, slate });
  const playerPool = [...scoringContext.poolByNorm.values()];
  const slateStats = buildSlatePointsByNorm(playerPool, slate, scoringDeps.gamelogs);
  return {
    poolByNorm: scoringContext.poolByNorm,
    pointsByNorm: slateStats.byNorm,
    slateHasStats: slateStats.hasStats,
  };
}

async function getSlatePointsContext(scoringDeps, slate) {
  const key = slate?.viewToken || "";
  if (!key) return buildSlatePointsContext(scoringDeps, slate);
  return slatePointsCache.get(key, () => buildSlatePointsContext(scoringDeps, slate));
}

/** Match lineup builder: score when the slate is locked / view-only, not while still editable. */
function slateAllowsLineupScoring(slate) {
  if (!slate) return false;
  return slate.canEdit !== true;
}

function resolveLineupNormsForPool(playerNorms, poolByNorm) {
  const out = [];
  const seen = new Set();
  if (!poolByNorm || typeof poolByNorm.has !== "function") return out;
  for (const raw of playerNorms || []) {
    const candidates = [safeText(raw), normalizePlayerName(raw)].filter(Boolean);
    let matched = null;
    for (const c of candidates) {
      if (poolByNorm.has(c)) {
        matched = c;
        break;
      }
    }
    if (!matched) continue;
    if (seen.has(matched)) continue;
    seen.add(matched);
    out.push(matched);
  }
  return out;
}

/** Sum precomputed pool points (same path as the DFS lineup builder slate score card). */
function scoreLineupDoc(lineup, slate, slatePointsCtx) {
  const { poolByNorm, pointsByNorm } = slatePointsCtx;
  if (!slateAllowsLineupScoring(slate)) {
    return {
      ...lineup,
      points: null,
      breakdown: [],
      hasStats: false,
      incomplete: lineup.playerNorms.length !== DFS_LINEUP_SIZE,
    };
  }

  const resolvedNorms = resolveLineupNormsForPool(lineup.playerNorms, poolByNorm);
  if (resolvedNorms.length !== DFS_LINEUP_SIZE) {
    return {
      ...lineup,
      points: 0,
      breakdown: [],
      hasStats: false,
      incomplete: true,
    };
  }

  const scored = scoreLineupFromPointsMap(resolvedNorms, poolByNorm, pointsByNorm);
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
  replacementByOriginalNorm = null,
}) {
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

async function buildWeeklyLeaderboardFromLineups(lineups, slate, scoringDeps) {
  const normalized = (lineups || []).map((row) =>
    row.playerNorms ? normalizeLineupRecord(row, row.id) : row
  );
  const slatePointsCtx = await getSlatePointsContext(scoringDeps, slate);
  const scored = normalized.map((lineup) => scoreLineupDoc(lineup, slate, slatePointsCtx));
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
        displayNameAt: 0,
        weeksPlayed: 0,
        weekScores: [],
        totalPoints: 0,
      });
    }
    applyLatestDisplayName(byUser.get(lineup.userId), lineup);
  }

  const scoringContextBySlate = new Map();
  function scoringContextForSlate(slate) {
    const key = slate?.viewToken || "";
    if (!key) return buildSlatePointsContext(scoringDeps, slate);
    if (!scoringContextBySlate.has(key)) {
      scoringContextBySlate.set(key, buildSlatePointsContext(scoringDeps, slate));
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
  return await buildWeeklyLeaderboardFromLineups(lineups, slate, scoringDeps);
}

function slateSummaryForClient(slate) {
  if (!slate) return null;
  return {
    label: slate.label,
    isPast: !!slate.isPast,
    viewToken: slate.viewToken,
    slateType: slate.slateType,
    canEdit: slate.canEdit === true,
    isLocked: slate.canEdit !== true,
  };
}

function slateIsLocked(slate) {
  return slateAllowsLineupScoring(slate);
}

async function fetchLineupByUserAndSlate(db, slateId, userId) {
  const slate = safeText(slateId).toUpperCase();
  const uid = safeText(userId);
  if (!slate || !uid) return null;
  const snap = await db.collection("lineups").doc(`${slate}_${uid}`).get();
  if (!snap.exists) return null;
  return normalizeLineupDoc(snap);
}

/** Read-only lineup card for a locked slate (leaderboard “view lineup”). */
async function buildLineupDetailView(lineup, slateToken, scoringDeps, schedulePayload, refIso, nowMs) {
  const slate = buildLeaderboardSlateFromToken(slateToken, schedulePayload, refIso, nowMs);
  if (!slate) {
    return { error: "Slate not found." };
  }
  if (!slateIsLocked(slate)) {
    return {
      error: "Lineups stay private until the slate locks.",
      locked: false,
    };
  }
  if (!lineup) {
    return { error: "No saved lineup for this player on this slate." };
  }

  const slatePointsCtx = await getSlatePointsContext(scoringDeps, slate);
  const scored = scoreLineupDoc(lineup, slate, slatePointsCtx);
  const salaryByNorm = {};
  (lineup.playerNorms || []).forEach((norm, i) => {
    const sal = lineup.playerSalaries?.[i];
    if (sal != null && Number.isFinite(Number(sal))) {
      salaryByNorm[norm] = Number(sal);
    }
  });

  const players = (scored.breakdown || []).map((row) => ({
    norm: row.norm,
    name: row.name,
    points: row.points,
    games: row.games,
    salary: salaryByNorm[row.norm] ?? null,
  }));

  return {
    slate: slateSummaryForClient(slate),
    displayName: leaderboardDisplayName(lineup.displayName),
    userId: lineup.userId,
    totalPoints: scored.points,
    salaryUsed: lineup.salaryUsed,
    players,
    incomplete: scored.incomplete,
  };
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
  normalizeLineupDoc,
  fetchLineupsForSlate,
  fetchAllWeekLineups,
  fetchLineupByUserAndSlate,
  fetchLineupsForLeaderboard,
  assignLeaderboardRanks,
  slateSummaryForClient,
  slateIsLocked,
  buildLineupDetailView,
  buildWeeklyLeaderboard,
  buildWeeklyLeaderboardFromLineups,
  buildCumulativeLeaderboard,
  buildCumulativeLeaderboardFromLineups,
};
