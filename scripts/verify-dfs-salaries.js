#!/usr/bin/env node
/**
 * Sanity-check DFS salary ladder: bottom 20% at $5k, rest from $5,100 up without large gaps.
 */
const { buildDfsPlayerPool } = require("../lib/dfs");
const {
  DFS_SALARY_MIN,
  DFS_SALARY_NON_BOTTOM_MIN,
  DFS_BOTTOM_TIER_PCT,
} = require("../lib/dfs");

function mockPool(n) {
  const pool = [];
  for (let i = 0; i < n; i += 1) {
    const rating = i / Math.max(1, n - 1);
    pool.push({
      norm: `player${i}`,
      name: `Player ${i}`,
      teamName: "T",
      offenseRating: rating,
      salary: 3000 + Math.round(rating * 9000),
    });
  }
  return pool;
}

function buildMinimalSlate() {
  return {
    teamIds: new Set(["1", "2"]),
    games: [
      { awayTeamId: "1", homeTeamId: "2", away: "A", home: "B", _iso: "2026-05-01" },
    ],
  };
}

const teams = [
  { teamId: "1", teamName: "Alpha", players: ["Player 0", "Player 1", "Player 2"] },
  { teamId: "2", teamName: "Beta", players: ["Player 3", "Player 4", "Player 5"] },
];

const offenseRatingByNorm = new Map(
  ["player0", "player1", "player2", "player3", "player4", "player5"].map((n, i) => [
    n,
    i / 5,
  ])
);

const stats2026ByPlayer = new Map();
const pool = buildDfsPlayerPool({
  teams,
  slate: buildMinimalSlate(),
  offenseRatingByNorm,
  scheduleRunRates: new Map(),
  stats2026ByPlayer,
  teamCodeById: new Map(),
});

const atMin = pool.filter((p) => p.salary === DFS_SALARY_MIN);
const nonMin = pool.filter((p) => p.salary > DFS_SALARY_MIN).sort((a, b) => a.salary - b.salary);

const expectedBottom = Math.max(1, Math.ceil(pool.length * DFS_BOTTOM_TIER_PCT));
if (atMin.length < expectedBottom) {
  console.error(`Expected at least ${expectedBottom} at $${DFS_SALARY_MIN}, got ${atMin.length}`);
  process.exit(1);
}

if (nonMin.length && nonMin[0].salary > DFS_SALARY_NON_BOTTOM_MIN + 100) {
  console.error(
    `First non-bottom salary ${nonMin[0].salary} should be near $${DFS_SALARY_NON_BOTTOM_MIN}, not a big jump`
  );
  process.exit(1);
}

for (let i = 1; i < nonMin.length; i += 1) {
  const gap = nonMin[i].salary - nonMin[i - 1].salary;
  if (gap > 500) {
    console.error(`Gap too large between ${nonMin[i - 1].salary} and ${nonMin[i].salary}`);
    process.exit(1);
  }
}

console.log("DFS salary ladder OK:", {
  poolSize: pool.length,
  atMin: atMin.length,
  nonMinRange:
    nonMin.length > 0
      ? `$${nonMin[0].salary} – $${nonMin[nonMin.length - 1].salary}`
      : "n/a",
});
