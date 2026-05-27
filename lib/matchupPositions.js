"use strict";

/**
 * Position defensive weights (PDW) for matchup absence engine.
 * Players with no assigned position use PDW 1.0 (offense-only; no defensive penalty when missing).
 */
const POSITION_PDW = Object.freeze({
  SS: 1.35,
  C: 1.25,
  CF: 1.25,
  P: 1.15,
  "2B": 1.1,
  "3B": 1.05,
  LF: 1.0,
  "1B": 0.95,
  RF: 0.9,
  DH: 0.5,
});

/** Defensive loss scale per absence (see L5). */
const DEFENSIVE_LOSS_SCALE = 10;

const IRRELEVANT_POSITION_TOKENS = new Set([
  "",
  "N/A",
  "NA",
  "NONE",
  "NO POSITION",
  "NO POS",
  "BENCH",
  "BN",
  "—",
  "-",
]);

function safeText(value) {
  return (value || "").toString().trim();
}

/** Normalize sheet/UI position labels to canonical codes (SS, 2B, …). */
function normalizePositionCode(raw) {
  const s = safeText(raw).toUpperCase().replace(/\./g, "");
  if (!s || IRRELEVANT_POSITION_TOKENS.has(s)) return null;
  if (s === "SHORTSTOP") return "SS";
  if (s === "CATCHER") return "C";
  if (s === "CENTER" || s === "CENTERFIELD" || s === "CENTRE") return "CF";
  if (s === "PITCHER") return "P";
  if (s === "SECOND" || s === "SECONDBASE") return "2B";
  if (s === "THIRD" || s === "THIRDBASE") return "3B";
  if (s === "LEFT" || s === "LEFTFIELD") return "LF";
  if (s === "FIRST" || s === "FIRSTBASE") return "1B";
  if (s === "RIGHT" || s === "RIGHTFIELD") return "RF";
  if (s === "DESIGNATED" || s === "DESIGNATEDHITTER") return "DH";
  if (POSITION_PDW[s] != null) return s;
  return null;
}

/** True when the player has a defensive position that participates in fielding / absence defense. */
function isRelevantDefensivePosition(positionCode) {
  return normalizePositionCode(positionCode) != null;
}

/**
 * PDW for PPS / absence. No position → 1.0 (neutral, not bench/DH penalty).
 */
function positionPdw(rawPosition) {
  const code = normalizePositionCode(rawPosition);
  if (!code) return 1.0;
  return POSITION_PDW[code] ?? 1.0;
}

/** Unique defensive position slots filled among active players (duplicate positions count once). */
function countFieldingSlots(activeEntries) {
  const slots = new Set();
  for (const e of activeEntries || []) {
    const code = normalizePositionCode(e.position);
    if (code) slots.add(code);
  }
  return slots.size;
}

function rosterHasPositionData(entries) {
  return (entries || []).some((e) => isRelevantDefensivePosition(e.position));
}

function averagePor(entries, offenseRatingByNorm) {
  let sum = 0;
  let n = 0;
  for (const e of entries || []) {
    const por = offenseRatingByNorm.get(e.norm);
    if (por != null && Number.isFinite(por)) {
      sum += por;
      n += 1;
    }
  }
  return n > 0 ? sum / n : 0;
}

/**
 * L5 absence deltas with duplicate-position defense (only first missing player per position
 * incurs Defensive_Loss) and no defensive loss when position is irrelevant.
 */
function sumAbsenceDeltas(missing, allEntries, offenseRatingByNorm) {
  const teamAvgPor = averagePor(allEntries, offenseRatingByNorm);
  const lostPositions = new Set();
  let total = 0;

  for (const m of missing || []) {
    const por = offenseRatingByNorm.get(m.norm);
    const porN = por != null && Number.isFinite(por) ? por : 0;
    /** Losing a better hitter hurts the team (negative delta). */
    const offensiveImpact = teamAvgPor - porN;

    let defensiveLoss = 0;
    const code = normalizePositionCode(m.position);
    if (code && !lostPositions.has(code)) {
      defensiveLoss = positionPdw(code) * DEFENSIVE_LOSS_SCALE;
      lostPositions.add(code);
    }

    total += -defensiveLoss + offensiveImpact;
  }

  return { total, teamAvgPor, lostPositions };
}

/**
 * Map summed absence deltas to offense/defense multipliers (aligned with existing profile scaling).
 */
function multipliersFromAbsenceSum(absenceSum, missingCount) {
  if (!missingCount) {
    return {
      offense: 1,
      run: 1,
      defense: 1,
      runsAgainst: 1,
      regime: "full",
    };
  }

  const scaled = absenceSum / (12 + missingCount * 2.5);
  const offenseMult = Math.max(0.08, Math.min(1.45, Math.exp(scaled * 0.55)));
  const defenseMult = Math.max(0.12, Math.min(1.35, Math.exp(scaled * 0.42)));

  return {
    offense: offenseMult,
    run: offenseMult,
    defense: defenseMult,
    runsAgainst: 1,
    regime: "absence-engine",
  };
}

module.exports = {
  POSITION_PDW,
  DEFENSIVE_LOSS_SCALE,
  normalizePositionCode,
  isRelevantDefensivePosition,
  positionPdw,
  countFieldingSlots,
  rosterHasPositionData,
  sumAbsenceDeltas,
  multipliersFromAbsenceSum,
};
