/** Draft rounds 11–13 are C-players for MMS missing-player rules. */
const C_PLAYER_ROUNDS = Object.freeze([11, 12, 13]);
const FIELDING_SPOTS = 10;

function parseMissingNorms(param, normalizeName = (x) => String(x || "").trim().toLowerCase()) {
  const s = String(param || "").trim();
  if (!s) return new Set();
  return new Set(
    s
      .split(/[,|]/)
      .map((x) => normalizeName(x.trim()))
      .filter(Boolean)
  );
}

function serializeMissingNorms(set) {
  if (!set || !set.size) return "";
  return [...set].join(",");
}

function rosterEntriesFromNames(playerNames, normalizeName = (x) => String(x || "").trim().toLowerCase()) {
  return (playerNames || []).map((name, idx) => ({
    round: idx + 1,
    norm: normalizeName(name),
    name: String(name || "").trim(),
  }));
}

function formatSignedNumber(n, decimals = 2) {
  if (n == null || !Number.isFinite(n)) return null;
  const s = n.toFixed(decimals);
  return n >= 0 ? `+${s}` : s;
}

/** Who bats twice for the 11th lineup spot (C rule or missing-round rule). */
function resolveDoubleBatter(entries, missingSet) {
  const present = entries.filter((e) => !missingSet.has(e.norm));
  const missing = entries.filter((e) => missingSet.has(e.norm));
  const presentCount = present.length;

  const cSlots = entries.filter((e) => C_PLAYER_ROUNDS.includes(e.round));
  const cPresent = cSlots.filter((e) => !missingSet.has(e.norm));
  const cMissingCount = cSlots.length - cPresent.length;
  const player10 = entries.find((e) => e.round === 10);

  if (presentCount !== 8) {
    if (cMissingCount === 2 && cPresent.length === 1) {
      const c = cPresent[0];
      return {
        norm: c.norm,
        name: c.name,
        round: c.round,
        rule: "c-one-present",
        ruleLabel: "C-player bats twice",
        reason:
          "Two of three C-players (rounds 11–13) are missing. The remaining C-player bats twice and may pinch-run once.",
      };
    }
    if (cMissingCount >= 3 && player10 && !missingSet.has(player10.norm)) {
      return {
        norm: player10.norm,
        name: player10.name,
        round: player10.round,
        rule: "c-all-out-round-10",
        ruleLabel: "Round 10 bats twice",
        reason:
          "All three C-players (rounds 11–13) are out. The round 10 pick bats twice and may pinch-run once.",
      };
    }
  }

  if (presentCount === 10 && missing.length === 3) {
    const missingRounds = missing.map((m) => m.round);
    const total = missingRounds.reduce((s, r) => s + r, 0);
    const avg = total / missingRounds.length;
    const targetRound = Math.ceil(avg);

    const pickDoubleBatter = (fromRound, direction) => {
      if (direction === "down") {
        for (let r = fromRound; r >= 1; r -= 1) {
          const slot = entries.find((e) => e.round === r);
          if (slot && !missingSet.has(slot.norm)) return slot;
        }
      } else {
        for (let r = fromRound; r <= 13; r += 1) {
          const slot = entries.find((e) => e.round === r);
          if (slot && !missingSet.has(slot.norm)) return slot;
        }
      }
      return null;
    };

    const slot =
      pickDoubleBatter(targetRound, "down") || pickDoubleBatter(targetRound + 1, "up");
    if (slot) {
      return {
        norm: slot.norm,
        name: slot.name,
        round: slot.round,
        rule: "11th-batter",
        ruleLabel: "11th spot — bats twice",
        reason: `Ten players are active with three missing (rounds ${missingRounds.join(", ")}). Missing-round average ${avg.toFixed(2)} rounds up to slot ${targetRound}; ${slot.name} (round ${slot.round}) bats a second time for the full game.`,
        missingRounds,
        targetRound,
      };
    }
  }

  return null;
}

function playerRunProd2026(norm, stats2026ByPlayer) {
  const row = stats2026ByPlayer.get(norm);
  if (!row) return null;
  const pa = Number(row.PA);
  if (pa <= 0) return null;
  const rp = (Number(row.Runs) + Number(row.RBI)) / pa;
  return Number.isFinite(rp) ? rp : null;
}

/**
 * Second lineup turn only helps if the double batter is better than who's missing.
 * Returns 0–1 weight (0 = no credit, 1 = full extra turn in the model).
 */
function evaluateSecondTurnWeight(doubleBatter, missing, offenseRatingByNorm, stats2026ByPlayer) {
  if (!doubleBatter || !missing.length) {
    return {
      weight: 0,
      dbRating: null,
      replacementRating: null,
      replacementRunProd: null,
      gapRating: null,
      gapRunProd: null,
      verdict: "none",
      missingNames: [],
    };
  }

  const dbRating = offenseRatingByNorm.get(doubleBatter.norm);
  const dbRatingN = dbRating != null && Number.isFinite(dbRating) ? dbRating : 0;
  const dbRun = playerRunProd2026(doubleBatter.norm, stats2026ByPlayer);

  let repNum = 0;
  let repDen = 0;
  let repRunNum = 0;
  let repRunDen = 0;
  for (const m of missing) {
    const w = draftRoundWeight(m.round);
    const r = offenseRatingByNorm.get(m.norm);
    if (r != null && Number.isFinite(r)) {
      repNum += r * w;
      repDen += w;
    }
    const rp = playerRunProd2026(m.norm, stats2026ByPlayer);
    if (rp != null) {
      repRunNum += rp * w;
      repRunDen += w;
    }
  }

  const replacementRating = repDen > 0 ? repNum / repDen : 0;
  const replacementRunProd = repRunDen > 0 ? repRunNum / repRunDen : null;
  const gapRating = dbRatingN - replacementRating;
  const gapRunProd =
    dbRun != null && replacementRunProd != null ? dbRun - replacementRunProd : null;

  // Blend rating gap + run-prod gap when both exist
  let score = gapRating;
  if (gapRunProd != null) {
    score = 0.65 * gapRating + 0.35 * gapRunProd * 4;
  }
  const weight = Math.max(0, Math.min(1, 0.5 + 0.5 * Math.tanh(score * 1.75)));

  let verdict = "even";
  if (weight < 0.18) verdict = "much-weaker";
  else if (weight < 0.42) verdict = "weaker";
  else if (weight < 0.58) verdict = "even";
  else if (weight < 0.82) verdict = "better";
  else verdict = "much-better";

  return {
    weight,
    dbRating: dbRatingN,
    replacementRating,
    replacementRunProd,
    gapRating,
    gapRunProd,
    verdict,
    missingNames: missing.map((m) => m.name),
  };
}

/** How much the model shifts when the double batter gets a weighted second lineup turn. */
function buildDoubleBatterImpact(
  doubleBatter,
  activeEntries,
  missing,
  offenseRatingByNorm,
  stats2026ByPlayer
) {
  if (!doubleBatter || !activeEntries.length) return null;

  const norm = doubleBatter.norm;
  const rating = offenseRatingByNorm.get(norm);
  const runProd = playerRunProd2026(norm, stats2026ByPlayer);
  const secondTurn = evaluateSecondTurnWeight(
    doubleBatter,
    missing,
    offenseRatingByNorm,
    stats2026ByPlayer
  );

  const weights1x = activeFieldingWeights(activeEntries, offenseRatingByNorm, stats2026ByPlayer, null, 0);
  const weightsAdj = activeFieldingWeights(
    activeEntries,
    offenseRatingByNorm,
    stats2026ByPlayer,
    norm,
    secondTurn.weight
  );

  const off1 = paWeightedFromWeights(weights1x, (w) => offenseRatingByNorm.get(w.norm));
  const offAdj = paWeightedFromWeights(weightsAdj, (w) => offenseRatingByNorm.get(w.norm));
  const run1 = paWeightedFromWeights(weights1x, (w) => playerRunProd2026(w.norm, stats2026ByPlayer));
  const runAdj = paWeightedFromWeights(weightsAdj, (w) => playerRunProd2026(w.norm, stats2026ByPlayer));

  const totalPa1 = weights1x.reduce((s, w) => s + w.pa, 0);
  const totalPaAdj = weightsAdj.reduce((s, w) => s + w.pa, 0);
  const slot1 = weights1x.find((w) => w.norm === norm);
  const slotAdj = weightsAdj.find((w) => w.norm === norm);
  const share1 = slot1 && totalPa1 > 0 ? (slot1.pa / totalPa1) * 100 : null;
  const shareAdj = slotAdj && totalPaAdj > 0 ? (slotAdj.pa / totalPaAdj) * 100 : null;

  const offenseBoost =
    off1 != null && offAdj != null && Number.isFinite(off1) && Number.isFinite(offAdj)
      ? offAdj - off1
      : null;
  const runProdBoost =
    run1 != null && runAdj != null && Number.isFinite(run1) && Number.isFinite(runAdj)
      ? runAdj - run1
      : null;

  const secondTurnPct = Math.round(secondTurn.weight * 100);

  return {
    offensiveRating: rating != null && Number.isFinite(rating) ? rating : null,
    offensiveRatingLabel: formatSignedNumber(rating),
    runProd2026: runProd,
    runProdLabel: runProd != null ? runProd.toFixed(3) : null,
    offenseRatingBoost: offenseBoost,
    offenseRatingBoostLabel: formatSignedNumber(offenseBoost),
    runProdBoost: runProdBoost,
    runProdBoostLabel: runProdBoost != null ? formatSignedNumber(runProdBoost, 3) : null,
    lineupSharePctOneTurn: share1 != null ? Math.round(share1 * 10) / 10 : null,
    lineupSharePctTwoTurns: shareAdj != null ? Math.round(shareAdj * 10) / 10 : null,
    secondTurnWeight: secondTurn.weight,
    secondTurnPct,
    missingNames: secondTurn.missingNames,
    missingNamesLabel: secondTurn.missingNames.join(", "),
    replacementRating: secondTurn.replacementRating,
    replacementRatingLabel: formatSignedNumber(secondTurn.replacementRating),
    gapRating: secondTurn.gapRating,
    gapRatingLabel: formatSignedNumber(secondTurn.gapRating),
    comparisonVerdict: secondTurn.verdict,
  };
}

function alertWithDoubleBatter(base, doubleBatter, impact) {
  if (!doubleBatter) return base;
  return {
    ...base,
    doubleBatter: {
      ...doubleBatter,
      impact,
    },
  };
}

function enrichRosterForMatchupView(
  rosterEntry,
  offenseRatingByNorm,
  missingSet,
  normalizeName,
  stats2026ByPlayer = new Map()
) {
  if (!rosterEntry) return rosterEntry;

  const playerNames = rosterEntry.players || [];
  const entries = rosterEntriesFromNames(playerNames, normalizeName);
  const doubleBatter = resolveDoubleBatter(entries, missingSet);
  const activeEntries = entries.filter((e) => !missingSet.has(e.norm));

  const playersDetailed = entries.map((e) => ({
    ...e,
    rating: offenseRatingByNorm.get(e.norm) ?? null,
    missing: missingSet.has(e.norm),
    hitsTwice: doubleBatter != null && doubleBatter.norm === e.norm,
  }));

  const active = playersDetailed.filter((p) => !p.missing);
  const bench = playersDetailed.filter((p) => p.missing);
  const lineupAlerts = evaluateMissingPlayerRules(
    entries,
    missingSet,
    offenseRatingByNorm,
    stats2026ByPlayer
  );

  return {
    ...rosterEntry,
    playersDetailed,
    bench,
    activeCount: active.length,
    lineupAlerts,
    doubleBatter,
  };
}

/**
 * MMS missing-player / lineup rules (2026 season).
 * Returns highlight alerts when a rule affects batting lineup.
 */
function evaluateMissingPlayerRules(
  entries,
  missingSet,
  offenseRatingByNorm = new Map(),
  stats2026ByPlayer = new Map()
) {
  const alerts = [];
  const present = entries.filter((e) => !missingSet.has(e.norm));
  const missing = entries.filter((e) => missingSet.has(e.norm));
  const presentCount = present.length;
  const doubleBatter = resolveDoubleBatter(entries, missingSet);
  const impact =
    doubleBatter && offenseRatingByNorm.size
      ? buildDoubleBatterImpact(
          doubleBatter,
          present,
          missing,
          offenseRatingByNorm,
          stats2026ByPlayer
        )
      : null;

  if (doubleBatter) {
    alerts.push(
      alertWithDoubleBatter(
        {
          severity: "rule",
          kind: "double-batter",
          title: doubleBatter.ruleLabel,
          message: `${doubleBatter.name} (round ${doubleBatter.round}) takes the extra turn in the batting order.`,
        },
        doubleBatter,
        impact
      )
    );
  }

  if (presentCount < FIELDING_SPOTS) {
    alerts.push({
      severity: "warning",
      kind: "roster-warning",
      title: "Short-handed",
      message: `Only ${presentCount} players are available (fewer than ${FIELDING_SPOTS} fielding spots). This team is at a significant disadvantage.`,
    });
  }

  return alerts;
}

function paWeightedFromWeights(weights, valueFn) {
  let num = 0;
  let den = 0;
  for (const w of weights) {
    const v = valueFn(w);
    if (v == null || !Number.isFinite(v)) continue;
    num += v * w.pa;
    den += w.pa;
  }
  if (den <= 0) return null;
  return num / den;
}

function activeFieldingWeights(
  activeEntries,
  offenseRatingByNorm,
  stats2026ByPlayer,
  doubleBatterNorm = null,
  secondTurnWeight = 0
) {
  let pool = activeEntries;
  if (pool.length > FIELDING_SPOTS) {
    pool = [...pool]
      .sort(
        (a, b) =>
          (offenseRatingByNorm.get(b.norm) ?? -999) - (offenseRatingByNorm.get(a.norm) ?? -999)
      )
      .slice(0, FIELDING_SPOTS);
  }
  const extra =
    secondTurnWeight > 0 && Number.isFinite(secondTurnWeight) ? Math.min(1, secondTurnWeight) : 0;
  return pool.map((e) => {
    const row = stats2026ByPlayer.get(e.norm);
    const paRaw = row ? Number(row.PA) : 0;
    let pa = paRaw > 0 ? paRaw : 1;
    if (doubleBatterNorm && e.norm === doubleBatterNorm && extra > 0) {
      pa *= 1 + extra;
    }
    return { norm: e.norm, name: e.name, pa, round: e.round };
  });
}

/** Median draft slot (1–13 scale); picks above/below drive whether missing helps or hurts. */
const DRAFT_ROUND_MEDIAN = 6.5;
const ROSTER_FULL_SIZE = 13;

/** R1 ≈ 1.0, each later round slightly less impact when a player is out. */
function draftRoundWeight(round) {
  return Math.max(0.06, (14 - round) / 13);
}

/** Higher offensive +/- ratings amplify the penalty for that missing player. */
function playerRatingWeight(rating) {
  const r = rating != null && Number.isFinite(rating) ? rating : 0;
  return Math.max(0.4, Math.min(1.9, 0.7 + r * 0.42));
}

function averageMissingRound(missing) {
  if (!missing.length) return null;
  return missing.reduce((s, m) => s + m.round, 0) / missing.length;
}

/**
 * Player quality vs 6.5 median round + offensive +/-.
 * Positive = good player (missing them lowers team mult). Negative = weak (missing boosts mult).
 */
function playerTalentScore(m, offenseRatingByNorm) {
  const rating = offenseRatingByNorm.get(m.norm);
  const r = rating != null && Number.isFinite(rating) ? rating : 0;
  const roundScore = (DRAFT_ROUND_MEDIAN - m.round) / DRAFT_ROUND_MEDIAN;
  const ratingScore = r / 1.75;
  return 0.52 * ratingScore + 0.48 * roundScore;
}

/** Bottom ~15% of league offensive +/- (missing them matters far less). */
function isBottomTierOffense(rating, offenseRatingByNorm) {
  if (rating == null || !Number.isFinite(rating)) return false;
  const all = [...offenseRatingByNorm.values()].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (all.length < 4) return rating < -0.35;
  const p15 = all[Math.max(0, Math.floor(all.length * 0.15) - 1)];
  return rating <= p15 + 1e-9;
}

/**
 * Team strength multiplier: 1.0 with full healthy roster logic.
 * ≥10 active: good missing → mult down, bad missing → mult up (exponential in count).
 * <10 active: almost always crushes the team; only bottom-tier +/- missing softens slightly.
 */
function computeTeamMissingMultiplier(missing, presentCount, offenseRatingByNorm) {
  if (!missing.length) {
    return {
      offense: 1,
      run: 1,
      defense: 1,
      regime: "full",
      avgMissingRound: null,
      roundGap: 0,
    };
  }

  const avgRound = averageMissingRound(missing);
  const roundGap = avgRound != null ? DRAFT_ROUND_MEDIAN - avgRound : 0;

  if (presentCount < FIELDING_SPOTS) {
    const slotsShort = FIELDING_SPOTS - presentCount;
    let perPlayerFactor = 1;

    for (const m of missing) {
      const rating = offenseRatingByNorm.get(m.norm) ?? 0;
      const bottomTier = isBottomTierOffense(rating, offenseRatingByNorm);

      if (bottomTier) {
        // League-bottom +/-: barely softens the short-handed hit (never flips it positive).
        perPlayerFactor *= 0.985;
        continue;
      }

      const score = playerTalentScore(m, offenseRatingByNorm);
      const talentW = Math.max(0.5, 0.78 + Math.abs(rating) * 0.42);
      const roundW = draftRoundWeight(m.round);
      const cut = Math.min(0.22, 0.14 * talentW * roundW * (0.95 + Math.max(0, score)));
      perPlayerFactor *= 1 - cut;
    }

    // Mandatory crush for <10 fielders — almost always hurts no matter who is out.
    const shortCrush = Math.pow(0.5, slotsShort);
    let mult = shortCrush * perPlayerFactor;
    mult = Math.max(0.08, Math.min(0.78, mult));

    return {
      offense: mult,
      run: mult * 0.95,
      defense: mult * 0.94,
      regime: "short-handed",
      avgMissingRound: avgRound,
      roundGap,
    };
  }

  let mult = 1;
  const impacts = missing.map((m) => playerTalentScore(m, offenseRatingByNorm));
  const n = impacts.length;

  for (let i = 0; i < n; i += 1) {
    const imp = impacts[i];
    const compound = Math.pow(1.55, i);
    const delta = -imp * 0.24 * compound;
    mult *= 1 + delta;
  }

  const avgImpact = impacts.reduce((s, v) => s + v, 0) / n;
  if (avgImpact > 0.05) {
    mult *= Math.pow(0.78, Math.pow(n, 1.65) * Math.min(1.55, avgImpact));
  } else if (avgImpact < -0.05) {
    mult *= Math.pow(1.14, Math.pow(n, 1.5) * Math.min(1.55, Math.abs(avgImpact)));
  }

  mult = Math.max(0.08, Math.min(1.5, mult));

  return {
    offense: mult,
    run: mult,
    defense: mult,
    regime: "lineup-adjust",
    avgMissingRound: avgRound,
    roundGap,
  };
}

/** Recompute matchup profile after benching players; penalize short roster and high draft picks. */
function applyMissingPlayersToProfile(
  baseProfile,
  rosterPlayerNames,
  missingSet,
  offenseRatingByNorm,
  stats2026ByPlayer,
  defenseZByNorm,
  normalizeName
) {
  const entries = rosterEntriesFromNames(rosterPlayerNames, normalizeName);
  const active = entries.filter((e) => !missingSet.has(e.norm));
  const missing = entries.filter((e) => missingSet.has(e.norm));
  const presentCount = active.length;

  const doubleBatter = resolveDoubleBatter(entries, missingSet);
  const secondTurn = doubleBatter
    ? evaluateSecondTurnWeight(doubleBatter, missing, offenseRatingByNorm, stats2026ByPlayer)
    : { weight: 0 };
  const weights = activeFieldingWeights(
    active,
    offenseRatingByNorm,
    stats2026ByPlayer,
    doubleBatter ? doubleBatter.norm : null,
    secondTurn.weight
  );

  const offenseRating = paWeightedFromWeights(weights, (w) => offenseRatingByNorm.get(w.norm));
  const runProd2026 = paWeightedFromWeights(weights, (w) => {
    const row = stats2026ByPlayer.get(w.norm);
    const pa = row ? Number(row.PA) : 0;
    if (pa <= 0) return null;
    return (Number(row.Runs) + Number(row.RBI)) / pa;
  });
  const defenseZ = paWeightedFromWeights(weights, (w) => {
    const z = defenseZByNorm.get(w.norm);
    return z != null && Number.isFinite(z) ? z : null;
  });

  const teamMult = computeTeamMissingMultiplier(
    missing,
    presentCount,
    offenseRatingByNorm
  );

  const anchorOff =
    baseProfile.offenseRating != null && Number.isFinite(baseProfile.offenseRating)
      ? baseProfile.offenseRating
      : offenseRating ?? 0;
  const anchorRun =
    baseProfile.runProd2026 != null && Number.isFinite(baseProfile.runProd2026)
      ? baseProfile.runProd2026
      : runProd2026 ?? 0;
  const anchorDef =
    baseProfile.defenseZ != null && Number.isFinite(baseProfile.defenseZ)
      ? baseProfile.defenseZ
      : defenseZ ?? 0;

  let lineupHoleDrag = 0;
  if (doubleBatter && missing.length > 0 && secondTurn.weight < 0.45) {
    lineupHoleDrag = (0.45 - secondTurn.weight) * 0.45 * Math.min(missing.length, 5);
  }

  const runScale = Math.pow(teamMult.offense, 0.9);
  const adjustedOffense = anchorOff * teamMult.offense - lineupHoleDrag;
  const adjustedRunProd = anchorRun * teamMult.run;
  const adjustedDefense = anchorDef * teamMult.defense;

  const baseTeam = baseProfile.teamOverall;
  const adjustedTeamOverall =
    baseTeam != null && Number.isFinite(baseTeam) ? baseTeam * teamMult.offense : baseTeam;

  const runsPerGame =
    baseProfile.runsPerGame != null && Number.isFinite(baseProfile.runsPerGame)
      ? baseProfile.runsPerGame * runScale
      : baseProfile.runsPerGame;

  const lineupAlerts = evaluateMissingPlayerRules(
    entries,
    missingSet,
    offenseRatingByNorm,
    stats2026ByPlayer
  );

  return {
    ...baseProfile,
    offenseRating: adjustedOffense,
    runProd2026: adjustedRunProd,
    defenseZ: adjustedDefense,
    runsPerGame,
    teamOverall: adjustedTeamOverall,
    rosterPlayerRating: adjustedOffense,
    presentCount,
    missingCount: missing.length,
    lineupAlerts,
    teamMultiplier: teamMult.offense,
  };
}

module.exports = {
  DRAFT_ROUND_MEDIAN,
  ROSTER_FULL_SIZE,
  playerTalentScore,
  computeTeamMissingMultiplier,
  C_PLAYER_ROUNDS,
  FIELDING_SPOTS,
  parseMissingNorms,
  serializeMissingNorms,
  rosterEntriesFromNames,
  resolveDoubleBatter,
  evaluateSecondTurnWeight,
  buildDoubleBatterImpact,
  enrichRosterForMatchupView,
  evaluateMissingPlayerRules,
  applyMissingPlayersToProfile,
};
