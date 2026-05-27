#!/usr/bin/env node
/**
 * Verifies position-aware absence rules (no-position neutral, duplicate positions).
 * Run: node scripts/verify-matchup-positions.js
 */
const {
  sumAbsenceDeltas,
  countFieldingSlots,
  positionPdw,
  isRelevantDefensivePosition,
} = require("../lib/matchupPositions");
const {
  computeTeamMissingMultiplier,
  rosterEntriesFromNames,
  fieldingPresentCount,
} = require("../lib/matchupMissingPlayers");

const norm = (n) => n.toLowerCase();

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const ratings = new Map([
  ["star", 1.2],
  ["avg", 0.1],
  ["weak", -0.8],
  ["bench", -0.5],
]);

const roster = rosterEntriesFromNames(
  ["Star", "Avg", "Weak", "Bench", "NoPos"],
  norm,
  new Map([
    ["star", "SS"],
    ["avg", "SS"],
    ["weak", "LF"],
    ["bench", ""],
    ["nopos", null],
  ])
);

const { total: dupDelta } = sumAbsenceDeltas(
  roster.filter((e) => e.norm === "star" || e.norm === "avg"),
  roster,
  ratings
);
const { total: starOnly } = sumAbsenceDeltas(
  roster.filter((e) => e.norm === "star"),
  roster,
  ratings
);

assert(positionPdw("") === 1.0, "empty position should be neutral PDW");
assert(positionPdw(null) === 1.0, "null position should be neutral PDW");
assert(!isRelevantDefensivePosition(""), "empty position is not defensive");

const activeAll = roster;
const activeNoStar = roster.filter((e) => e.norm !== "star");
assert(countFieldingSlots(activeAll) === 2, "SS+LF duplicate SS counts as 2 slots");
assert(
  fieldingPresentCount(activeNoStar, roster) === 2,
  "missing SS still leaves LF + duplicate SS slot filled by avg"
);

const noPosDelta = sumAbsenceDeltas(
  roster.filter((e) => e.norm === "nopos"),
  roster,
  ratings
).total;
const weakDelta = sumAbsenceDeltas(
  roster.filter((e) => e.norm === "weak"),
  roster,
  ratings
).total;

assert(
  weakDelta < noPosDelta,
  `LF missing should be worse than no-position (weak=${weakDelta}, nopos=${noPosDelta})`
);

assert(
  Math.abs(dupDelta - starOnly) < 13.5,
  "second SS missing should not apply a second full defensive loss (delta gap < one SS PDW×10)"
);

console.log("PASS: Position rules (neutral no-pos, duplicate position defense once).");
console.log(`  duplicate SS delta ${dupDelta.toFixed(2)} vs single SS ${starOnly.toFixed(2)}`);
console.log(`  no-position missing delta ${noPosDelta.toFixed(2)} (offense-only)`);
