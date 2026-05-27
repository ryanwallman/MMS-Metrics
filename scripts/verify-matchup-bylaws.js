#!/usr/bin/env node
/**
 * Verifies MMS missing-player / lineup rules against bylaws scenarios.
 * Run: node scripts/verify-matchup-bylaws.js
 */
const {
  rosterEntriesFromNames,
  resolveDoubleBatter,
  evaluateMissingPlayerRules,
  MIN_PLAYERS_TO_START,
  FORFEIT_PLAYER_COUNT,
} = require("../lib/matchupMissingPlayers");

const norm = (n) => String(n || "").trim().toLowerCase();
const names = Array.from({ length: 13 }, (_, i) => `Player R${i + 1}`);
const entries = rosterEntriesFromNames(names, norm);

function missingSet(rounds) {
  return new Set(rounds.map((r) => norm(`Player R${r}`)));
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

console.log("=== MMS bylaws lineup rule verification ===\n");

// 8 players: no double batter
const m8 = missingSet([9, 10, 11, 12, 13]);
assert(resolveDoubleBatter(entries, m8) === null, "8 active → no double batter");

// 2 C out, 1 C in (9 active) → C bats twice
const m9c = missingSet([1, 2, 3, 4, 11, 12]);
const db9 = resolveDoubleBatter(entries, m9c);
assert(db9 && db9.rule === "c-one-present", "9 active, 2 C missing → remaining C bats twice");

// All 3 C out (10 active) → round 10 bats twice
const m10c = missingSet([1, 2, 3, 11, 12, 13]);
const db10c = resolveDoubleBatter(entries, m10c);
assert(db10c && db10c.rule === "c-all-out-round-10", "10 active, all C out → R10 bats twice");

// 10 active, 3 missing (3,6,8) → mean rule → round 7 (slot 6 out)
const m10368 = missingSet([3, 6, 8]);
const dbMean = resolveDoubleBatter(entries, m10368);
assert(dbMean && dbMean.rule === "11th-batter" && dbMean.round === 7, "10 active, out 3/6/8 → R7 bats twice (R6 slot out)");

// Example 2: out 1,2,13 → avg 5.33 → ceil 6
const m101213 = missingSet([1, 2, 13]);
const dbEx2 = resolveDoubleBatter(entries, m101213);
assert(dbEx2 && dbEx2.round === 6, "10 active, out 1/2/13 → R6 bats twice");

const alerts7 = evaluateMissingPlayerRules(entries, missingSet([8, 9, 10, 11, 12, 13]), new Map(), new Map());
assert(
  alerts7.some((a) => a.kind === "forfeit"),
  "7 active → forfeit alert"
);

const alerts8 = evaluateMissingPlayerRules(entries, m8, new Map(), new Map());
assert(
  alerts8.some((a) => a.kind === "eight-player"),
  "8 active → eight-player bylaws note"
);

const alerts10 = evaluateMissingPlayerRules(entries, missingSet([3, 6, 8]), new Map(), new Map());
assert(
  alerts10.some((a) => a.kind === "eleven-spots"),
  "10 active → 11-spots required alert"
);

console.log("All bylaws lineup checks passed.");
console.log(`  MIN_PLAYERS_TO_START=${MIN_PLAYERS_TO_START} FORFEIT_AT=${FORFEIT_PLAYER_COUNT}`);
