#!/usr/bin/env node
/**
 * Verifies missing-player impact on matchup predictions.
 * Run: node scripts/verify-matchup-missing.js
 */
const {
  applyMissingPlayersToProfile,
  computeTeamMissingMultiplier,
  rosterEntriesFromNames,
} = require("../lib/matchupMissingPlayers");

const MATCHUP_POWER_WEIGHT_OFFENSE = 0.35;
const MATCHUP_POWER_WEIGHT_RUN_PROD = 0.12;
const MATCHUP_POWER_WEIGHT_RUNS_FOR = 0.1;
const MATCHUP_POWER_WEIGHT_TEAM_OVERALL = 0.22;
const MATCHUP_LOGIT_SCALE = 0.6;
const MATCHUP_RUN_MARGIN_LOGIT = 0.26;
const MATCHUP_WIN_WEIGHT_FROM_RUNS = 0.82;
const MATCHUP_WIN_WEIGHT_FROM_TALENT = 0.18;
const MATCHUP_WIN_PROB_SHRINK = 0.5;
const MATCHUP_SCHEDULE_RUNS_BLEND = 0.55;
const MATCHUP_RUN_OFF_Z_PCT = 0.08;

function meanAndStd(vals) {
  const v = vals.filter((x) => x != null && Number.isFinite(x));
  if (!v.length) return { mean: 0, std: 1 };
  const mean = v.reduce((s, x) => s + x, 0) / v.length;
  const variance = v.reduce((s, x) => s + (x - mean) ** 2, 0) / v.length;
  return { mean, std: Math.sqrt(variance) || 1 };
}

function zFrom(x, mean, std) {
  if (x == null || !Number.isFinite(x)) return 0;
  return (x - mean) / (std || 1);
}

function teamPower(profile, norms) {
  const zOff = zFrom(profile.offenseRating, norms.offense.mean, norms.offense.std);
  const zRun = zFrom(profile.runProd2026, norms.runProd.mean, norms.runProd.std);
  const zRf = zFrom(profile.runsPerGame, norms.runsPerGame.mean, norms.runsPerGame.std);
  const zTeam = zFrom(profile.teamOverall, norms.teamOverall.mean, norms.teamOverall.std);
  return (
    MATCHUP_POWER_WEIGHT_OFFENSE * zOff +
    MATCHUP_POWER_WEIGHT_RUN_PROD * zRun +
    MATCHUP_POWER_WEIGHT_RUNS_FOR * zRf +
    MATCHUP_POWER_WEIGHT_TEAM_OVERALL * zTeam
  );
}

function projectRuns(profile, norms, leagueAvg = 11.5) {
  const zOff = zFrom(profile.offenseRating, norms.offense.mean, norms.offense.std);
  const zRun = zFrom(profile.runProd2026, norms.runProd.mean, norms.runProd.std);
  const zRf = zFrom(profile.runsPerGame, norms.runsPerGame.mean, norms.runsPerGame.std);
  const offBlend = 0.5 * zOff + 0.25 * zRun + 0.25 * zRf;
  let mult = 1 + MATCHUP_RUN_OFF_Z_PCT * offBlend;
  const rosterProj = leagueAvg * mult;
  const rpg = profile.runsPerGame ?? leagueAvg;
  return MATCHUP_SCHEDULE_RUNS_BLEND * rpg + (1 - MATCHUP_SCHEDULE_RUNS_BLEND) * rosterProj;
}

function winPct(homeRuns, awayRuns, homePow, awayPow) {
  const margin = homeRuns - awayRuns;
  const pRuns = 1 / (1 + Math.exp(-MATCHUP_RUN_MARGIN_LOGIT * margin));
  const pTalent = 1 / (1 + Math.exp(-(homePow - awayPow) * MATCHUP_LOGIT_SCALE));
  const raw = MATCHUP_WIN_WEIGHT_FROM_RUNS * pRuns + MATCHUP_WIN_WEIGHT_FROM_TALENT * pTalent;
  return 0.5 + MATCHUP_WIN_PROB_SHRINK * (raw - 0.5);
}

function buildNorms(profiles) {
  const list = profiles;
  return {
    offense: meanAndStd(list.map((p) => p.offenseRating)),
    runProd: meanAndStd(list.map((p) => p.runProd2026)),
    runsPerGame: meanAndStd(list.map((p) => p.runsPerGame)),
    teamOverall: meanAndStd(list.map((p) => p.teamOverall)),
  };
}

function predict(away, home, norms) {
  const awayPow = teamPower(away, norms);
  const homePow = teamPower(home, norms);
  const awayRuns = projectRuns(away, norms);
  const homeRuns = projectRuns(home, norms);
  const homeWin = winPct(homeRuns, awayRuns, homePow, awayPow);
  return {
    awayWin: (1 - homeWin) * 100,
    homeWin: homeWin * 100,
    awayRuns,
    homeRuns,
    awayOff: away.offenseRating,
    homeOff: home.offenseRating,
    awayMult: away.teamMultiplier,
    homeMult: home.teamMultiplier,
  };
}

const norm = (x) => String(x).trim().toLowerCase();
const names = Array.from({ length: 13 }, (_, i) => `Player${i + 1}`);
const ratings = new Map(names.map((n, i) => [norm(n), 1.9 - i * 0.13]));
const stats = new Map(names.map((n, i) => [norm(n), { PA: 50, Runs: 14 - i, RBI: 16 - i }]));
const def = new Map(names.map((n, i) => [norm(n), 0.55 - i * 0.04]));

const fullProfile = {
  offenseRating: 1.15,
  runProd2026: 0.3,
  defenseZ: 0.35,
  teamOverall: 0.65,
  runsPerGame: 12.5,
  runsAgainstPerGame: 10.8,
};

const opponent = {
  offenseRating: 0.35,
  runProd2026: 0.22,
  defenseZ: 0.1,
  teamOverall: 0.2,
  runsPerGame: 10.5,
  runsAgainstPerGame: 11.2,
  teamMultiplier: 1,
};

function applyMissing(rounds) {
  const missingSet = new Set(rounds.map((r) => norm(`Player${r}`)));
  return applyMissingPlayersToProfile(
    fullProfile,
    names,
    missingSet,
    ratings,
    stats,
    def,
    norm
  );
}

const leagueProfiles = [fullProfile, opponent];
const fixedNorms = buildNorms(leagueProfiles);

const scenarios = [
  { label: "Full roster (away)", missing: [] },
  { label: "Away missing R1", missing: [1] },
  { label: "Away missing R1+R2", missing: [1, 2] },
  { label: "Away missing R1+R2+R3", missing: [1, 2, 3] },
  { label: "Away missing R11-13", missing: [11, 12, 13] },
  { label: "Away 9 active — 4th out R4 (decent)", missing: [10, 11, 12, 4] },
  { label: "Away 9 active — 4th out R13 (bottom)", missing: [10, 11, 12, 13] },
];

console.log("=== Matchup missing-player verification ===\n");
console.log("Uses FIXED league norms (not rebuilt after missing) — same fix as server.\n");

let baseline = null;
for (const sc of scenarios) {
  const away = sc.missing.length ? applyMissing(sc.missing) : { ...fullProfile, teamMultiplier: 1 };
  const pred = predict(away, opponent, fixedNorms);
  if (!baseline) baseline = pred;
  const entries = rosterEntriesFromNames(names, norm);
  const missing = entries.filter((e) => sc.missing.includes(e.round));
  const mult = computeTeamMissingMultiplier(missing, 13 - sc.missing.length, ratings);

  console.log(sc.label);
  console.log(
    `  mult=${(away.teamMultiplier ?? 1).toFixed(3)} (${mult.regime})  offense=${away.offenseRating.toFixed(2)}  awayWin=${pred.awayWin.toFixed(1)}%  runs=${pred.awayRuns.toFixed(1)}`
  );
  if (baseline && sc.missing.length) {
    console.log(
      `  Δ vs full: win ${(pred.awayWin - baseline.awayWin).toFixed(1)} pts  runs ${(pred.awayRuns - baseline.awayRuns).toFixed(1)}`
    );
  }
  console.log();
}

const r1 = applyMissing([1]);
const r123 = applyMissing([1, 2, 3]);
const p1 = predict(r1, opponent, fixedNorms);
const p3 = predict(r123, opponent, fixedNorms);
const p0 = predict({ ...fullProfile, teamMultiplier: 1 }, opponent, fixedNorms);
const drop1 = p0.awayWin - p1.awayWin;
const drop3 = p0.awayWin - p3.awayWin;
console.log("Exponential check (early stars out):");
console.log(`  1 star missing: win drops ${drop1.toFixed(1)} pts`);
console.log(`  3 stars missing: win drops ${drop3.toFixed(1)} pts`);
console.log(`  ratio 3★/1★: ${(drop3 / Math.max(drop1, 0.1)).toFixed(2)}x (want >> 2x)`);

if (drop3 < 8) {
  console.error("\nFAIL: Missing 3 top players should swing win % by at least ~8 points.");
  process.exit(1);
}
if (drop3 < drop1 * 1.8) {
  console.error("\nFAIL: Three stars out should hurt much more than 1.8× one star.");
  process.exit(1);
}

const shortStar = applyMissing([10, 11, 12, 4]);
const shortScrub = applyMissing([10, 11, 12, 13]);
const pShortStar = predict(shortStar, opponent, fixedNorms);
const pShortScrub = predict(shortScrub, opponent, fixedNorms);
console.log("\nShort-handed (9 active, 4 missing):");
console.log(
  `  4th out is R4 (decent): mult=${shortStar.teamMultiplier.toFixed(3)} win=${pShortStar.awayWin.toFixed(1)}%`
);
console.log(
  `  4th out is R13 (bottom +/-): mult=${shortScrub.teamMultiplier.toFixed(3)} win=${pShortScrub.awayWin.toFixed(1)}%`
);
if (shortStar.teamMultiplier >= shortScrub.teamMultiplier) {
  console.error("FAIL: Short-handed with a decent 4th out should hurt more than with bottom-tier 4th out.");
  process.exit(1);
}
if (shortScrub.teamMultiplier > 0.72) {
  console.error("FAIL: Short-handed should stay well below 1.0 even if missing scrubs.");
  process.exit(1);
}
console.log("\nPASS: Missing players materially move predictions.");
