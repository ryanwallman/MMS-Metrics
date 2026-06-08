"use strict";

const { normalizePlayerName } = require("./dfs");

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
const { normalizeScheduleTeamId } = require("./teamRosters");
const {
  applyCriticalRosterRunProjection,
  applyCriticalRosterWinCap,
} = require("./matchupMissingPlayers");

function safeText(value) {
  return (value || "").toString().trim();
}

function finishedScheduleGameDedupeKey(g) {
  const awayId = normalizeScheduleTeamId(g.awayId);
  const homeId = normalizeScheduleTeamId(g.homeId);
  const gid = safeText(g.gameId);
  if (gid) return `gid|${gid}`;
  return `m|${g.isoDate || ""}|${[awayId, homeId].sort().join("|")}`;
}

const MATCHUP_LOGIT_SCALE = 0.6;
const MATCHUP_HOME_FIELD_LOGIT = 0.1;
/** Win %: mostly from projected run margin; talent index is a minority tie-breaker. */
const MATCHUP_WIN_WEIGHT_FROM_RUNS = 0.82;
const MATCHUP_WIN_WEIGHT_FROM_TALENT = 0.18;
/** Softer run-margin curve (~2-run edge ≈ 62% before shrink). */
const MATCHUP_RUN_MARGIN_LOGIT = 0.26;
/** Pull final win % toward 50% so extremes land ~70/30 not 90/10 (0.5 → half the distance from coin flip). */
const MATCHUP_WIN_PROB_SHRINK = 0.5;
/** Season standings projection: same model family, sharper than matchup lines (allows 18–4 type spreads). */
const SEASON_PROJ_RUN_MARGIN_LOGIT = 0.34;
const SEASON_PROJ_LOGIT_SCALE = 0.72;
const SEASON_PROJ_WIN_WEIGHT_FROM_RUNS = 0.8;
const SEASON_PROJ_WIN_WEIGHT_FROM_TALENT = 0.2;
const SEASON_PROJ_WIN_PROB_SHRINK = 0.82;
/** Composite team strength weights (sum = 1). */
const MATCHUP_POWER_WEIGHT_OFFENSE = 0.35;
const MATCHUP_POWER_WEIGHT_RUN_PROD = 0.12;
const MATCHUP_POWER_WEIGHT_RUNS_FOR = 0.1;
const MATCHUP_POWER_WEIGHT_RUNS_AGAINST = 0.08;
const MATCHUP_POWER_WEIGHT_TEAM_OVERALL = 0.22;
const MATCHUP_POWER_WEIGHT_WIN_PCT = 0.08;
const MATCHUP_POWER_WEIGHT_SOS = 0.05;
/** Run projection: roster + schedule runs for/against. */
const MATCHUP_RUN_OFF_Z_PCT = 0.08;
const MATCHUP_RUN_DEF_Z_PCT = 0.06;
const MATCHUP_SCHEDULE_RUNS_BLEND = 0.55;
const MATCHUP_OPP_RUNS_AGAINST_SCALE = 0.45;
/** When defense is short-handed (<10 fielders), lean harder on inflated runs-against. */
const MATCHUP_SHORT_HANDED_RA_SCALE_MAX = 1.05;
const MATCHUP_SHORT_HANDED_DEF_Z_PCT_MAX = 0.16;
const MATCHUP_SHORT_HANDED_SCHEDULE_BLEND_FLOOR = 0.08;
const MATCHUP_AWAY_RUN_FACTOR = 0.97;
const MATCHUP_HOME_RUN_FACTOR = 1.03;
const DEFAULT_LEAGUE_RUNS_PER_TEAM = 11.5;

function opponentShortHandedSlots(profile) {
  const slots = profile?.shortHandedSlots;
  if (slots != null && Number.isFinite(slots) && slots > 0) return slots;
  const raMult = profile?.runsAgainstMultiplier;
  if (raMult != null && raMult > 1.01) return 1;
  return 0;
}

/** How much schedule runs-for vs roster/defense projection when the opposing defense is short-handed. */
function matchupScheduleBlendWeight(attackerProfile, defenderProfile) {
  const slotsShort = opponentShortHandedSlots(defenderProfile);
  if (
    slotsShort <= 0 ||
    attackerProfile?.runsPerGame == null ||
    (attackerProfile?.scheduleGames ?? 0) < 2
  ) {
    return MATCHUP_SCHEDULE_RUNS_BLEND;
  }
  return Math.max(
    MATCHUP_SHORT_HANDED_SCHEDULE_BLEND_FLOOR,
    MATCHUP_SCHEDULE_RUNS_BLEND - 0.11 * slotsShort
  );
}

function matchupOpponentDefenseScales(defenderProfile) {
  const slotsShort = opponentShortHandedSlots(defenderProfile);
  const raMult = defenderProfile?.runsAgainstMultiplier ?? 1;
  if (slotsShort <= 0) {
    return {
      runsAgainstScale: MATCHUP_OPP_RUNS_AGAINST_SCALE,
      defenseZScale: MATCHUP_RUN_DEF_Z_PCT,
    };
  }
  const severity = Math.min(1, (raMult - 1) / 2.5);
  return {
    runsAgainstScale:
      MATCHUP_OPP_RUNS_AGAINST_SCALE +
      (MATCHUP_SHORT_HANDED_RA_SCALE_MAX - MATCHUP_OPP_RUNS_AGAINST_SCALE) * severity,
    defenseZScale:
      MATCHUP_RUN_DEF_Z_PCT +
      (MATCHUP_SHORT_HANDED_DEF_Z_PCT_MAX - MATCHUP_RUN_DEF_Z_PCT) *
        Math.min(1, slotsShort / 4),
  };
}

function rosterStatWeights(playerNames, stats2026ByPlayer) {
  return (playerNames || []).map((name) => {
    const norm = normalizePlayerName(name);
    const row = stats2026ByPlayer.get(norm);
    const pa = row ? toNumber(row.PA) : 0;
    return { norm, name, pa: pa > 0 ? pa : 1 };
  });
}

function paWeightedAverage(weights, valueFn) {
  let num = 0;
  let den = 0;
  for (const w of weights) {
    const v = valueFn(w);
    if (v == null || !Number.isFinite(v)) continue;
    num += v * w.pa;
    den += w.pa;
  }
  return den > 0 ? num / den : null;
}

function meanAndStd(values) {
  const xs = values.filter((v) => v != null && Number.isFinite(v));
  if (!xs.length) return { mean: 0, std: 1 };
  const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
  const variance = xs.reduce((s, v) => s + (v - mean) ** 2, 0) / xs.length;
  return { mean, std: Math.sqrt(Math.max(variance, 1e-10)) };
}

function zFrom(value, mean, std) {
  if (value == null || !Number.isFinite(value)) return 0;
  return (value - mean) / std;
}

function leagueRunScoringBaseline(parsedGames) {
  const seen = new Set();
  let totalRuns = 0;
  let games = 0;
  for (const g of parsedGames) {
    if (!Number.isFinite(g.awayScore) || !Number.isFinite(g.homeScore)) continue;
    const key = finishedScheduleGameDedupeKey(g);
    if (seen.has(key)) continue;
    seen.add(key);
    totalRuns += g.awayScore + g.homeScore;
    games += 1;
  }
  const avgTotal = games > 0 ? totalRuns / games : DEFAULT_LEAGUE_RUNS_PER_TEAM * 2;
  const avgPerTeam = avgTotal / 2;
  return {
    gamesSampled: games,
    avgTotalRuns: avgTotal,
    avgRunsPerTeam: avgPerTeam,
    avgRunsAgainstPerGame: avgPerTeam,
  };
}

/** Runs scored / allowed per team from completed schedule games. */
function buildTeamScheduleRunRates(parsedGames, teams) {
  const rec = new Map();
  for (const t of teams) {
    const id = normalizeScheduleTeamId(t.teamId);
    rec.set(id, { runsFor: 0, runsAgainst: 0, games: 0 });
  }

  const seen = new Set();
  for (const g of parsedGames) {
    if (!Number.isFinite(g.awayScore) || !Number.isFinite(g.homeScore)) continue;
    const key = finishedScheduleGameDedupeKey(g);
    if (seen.has(key)) continue;
    seen.add(key);

    const awayId = normalizeScheduleTeamId(g.awayId);
    const homeId = normalizeScheduleTeamId(g.homeId);
    if (!rec.has(awayId) || !rec.has(homeId)) continue;

    rec.get(awayId).runsFor += g.awayScore;
    rec.get(awayId).runsAgainst += g.homeScore;
    rec.get(awayId).games += 1;
    rec.get(homeId).runsFor += g.homeScore;
    rec.get(homeId).runsAgainst += g.awayScore;
    rec.get(homeId).games += 1;
  }

  const rates = new Map();
  for (const [id, r] of rec.entries()) {
    const g = r.games;
    rates.set(id, {
      gamesPlayed: g,
      runsFor: r.runsFor,
      runsAgainst: r.runsAgainst,
      runsPerGame: g > 0 ? r.runsFor / g : null,
      runsAgainstPerGame: g > 0 ? r.runsAgainst / g : null,
      runDiffPerGame: g > 0 ? (r.runsFor - r.runsAgainst) / g : null,
    });
  }
  return rates;
}

function buildDefenseZByNorm(defenseMap, stats2026ByPlayer) {
  const raw = [];
  for (const [norm, def] of defenseMap.entries()) {
    if (Number.isFinite(def)) raw.push(def);
  }
  const { mean, std } = meanAndStd(raw);
  const zByNorm = new Map();
  for (const [norm, def] of defenseMap.entries()) {
    if (!Number.isFinite(def)) continue;
    zByNorm.set(norm, zFrom(def, mean, std));
  }
  return { zByNorm, mean, std };
}

function buildTeamMatchupProfiles(
  teams,
  rosterByTeamId,
  offenseRatingByNorm,
  stats2026ByPlayer,
  defenseZByNorm,
  standingsMap,
  teamOverallById,
  scheduleRunRates
) {
  const profiles = new Map();
  for (const t of teams) {
    const sid = normalizeScheduleTeamId(t.teamId);
    const roster = rosterByTeamId[t.teamId] || rosterByTeamId[sid] || { players: t.players || [] };
    const weights = rosterStatWeights(roster.players || t.players, stats2026ByPlayer);

    const offenseRating = paWeightedAverage(weights, (w) => offenseRatingByNorm.get(w.norm));
    const runProd2026 = paWeightedAverage(weights, (w) => {
      const row = stats2026ByPlayer.get(w.norm);
      const pa = row ? toNumber(row.PA) : 0;
      if (pa <= 0) return null;
      return (toNumber(row.Runs) + toNumber(row.RBI)) / pa;
    });
    const defenseZ = paWeightedAverage(weights, (w) => {
      const z = defenseZByNorm.get(w.norm);
      return z != null && Number.isFinite(z) ? z : null;
    });

    const st = standingsMap?.get(sid);
    const overall = teamOverallById.get(sid) ?? teamOverallById.get(t.teamId);
    const rr = scheduleRunRates?.get(sid);

    profiles.set(sid, {
      teamId: sid,
      teamName: roster.teamName || t.teamName,
      offenseRating,
      runProd2026,
      defenseZ: defenseZ ?? 0,
      winPct: st?.winPct ?? null,
      sosOppWinPct: st?.sosOppWinPct ?? null,
      teamOverall: overall?.teamOffenseRating ?? null,
      rosterPlayerRating: offenseRating,
      scheduleGames: rr?.gamesPlayed ?? 0,
      runsPerGame: rr?.runsPerGame ?? null,
      runsAgainstPerGame: rr?.runsAgainstPerGame ?? null,
      runDiffPerGame: rr?.runDiffPerGame ?? null,
    });
  }
  return profiles;
}

function buildMatchupLeagueNorms(profiles) {
  const list = [...profiles.values()];
  return {
    offense: meanAndStd(list.map((p) => p.offenseRating)),
    runProd: meanAndStd(list.map((p) => p.runProd2026)),
    runsPerGame: meanAndStd(list.map((p) => p.runsPerGame)),
    runsAgainstPerGame: meanAndStd(list.map((p) => p.runsAgainstPerGame)),
    teamOverall: meanAndStd(list.map((p) => p.teamOverall)),
    winPct: meanAndStd(list.map((p) => p.winPct)),
    sos: meanAndStd(list.map((p) => p.sosOppWinPct)),
    defenseZ: meanAndStd(list.map((p) => p.defenseZ)),
  };
}

function teamCompositePower(profile, norms, isHome) {
  const zOff = zFrom(profile.offenseRating, norms.offense.mean, norms.offense.std);
  const zRun = zFrom(profile.runProd2026, norms.runProd.mean, norms.runProd.std);
  const zRf = zFrom(profile.runsPerGame, norms.runsPerGame.mean, norms.runsPerGame.std);
  const zRa = zFrom(
    profile.runsAgainstPerGame != null ? -profile.runsAgainstPerGame : null,
    -norms.runsAgainstPerGame.mean,
    norms.runsAgainstPerGame.std
  );
  const zTeam = zFrom(profile.teamOverall, norms.teamOverall.mean, norms.teamOverall.std);
  const zRec = zFrom(profile.winPct, norms.winPct.mean, norms.winPct.std);
  const zSos = zFrom(profile.sosOppWinPct, norms.sos.mean, norms.sos.std);

  let power =
    MATCHUP_POWER_WEIGHT_OFFENSE * zOff +
    MATCHUP_POWER_WEIGHT_RUN_PROD * zRun +
    MATCHUP_POWER_WEIGHT_RUNS_FOR * zRf +
    MATCHUP_POWER_WEIGHT_RUNS_AGAINST * zRa +
    MATCHUP_POWER_WEIGHT_TEAM_OVERALL * zTeam +
    MATCHUP_POWER_WEIGHT_WIN_PCT * zRec +
    MATCHUP_POWER_WEIGHT_SOS * zSos;

  if (isHome) power += MATCHUP_HOME_FIELD_LOGIT / MATCHUP_LOGIT_SCALE;

  return {
    power,
    components: { zOff, zRun, zRf, zRa, zTeam, zRec, zSos },
  };
}

function shrinkWinProbTowardEven(p, shrink = MATCHUP_WIN_PROB_SHRINK) {
  if (!Number.isFinite(p)) return 0.5;
  return 0.5 + shrink * (p - 0.5);
}

function logisticWinProb(homePower, awayPower, logitScale = MATCHUP_LOGIT_SCALE) {
  const diff = (homePower - awayPower) * logitScale;
  const pHome = 1 / (1 + Math.exp(-diff));
  return {
    home: pHome,
    away: 1 - pHome,
  };
}

/** Win chance from projected home − away runs (softball game-to-game variance). */
function winProbFromRunMargin(homeRuns, awayRuns, runMarginLogit = MATCHUP_RUN_MARGIN_LOGIT) {
  const margin = homeRuns - awayRuns;
  const pHome = 1 / (1 + Math.exp(-runMarginLogit * margin));
  return { home: pHome, away: 1 - pHome, margin };
}

/** Win probs for power-rankings season sim — sharper than matchup predictor display. */
function predictSeasonGameWinProbs(awayProfile, homeProfile, norms, runBase) {
  const awayPow = teamCompositePower(awayProfile, norms, false);
  const homePow = teamCompositePower(homeProfile, norms, true);

  const awayRuns = projectTeamRuns(
    awayProfile,
    homeProfile,
    norms,
    runBase,
    MATCHUP_AWAY_RUN_FACTOR
  );
  const homeRuns = projectTeamRuns(
    homeProfile,
    awayProfile,
    norms,
    runBase,
    MATCHUP_HOME_RUN_FACTOR
  );

  const winFromRuns = winProbFromRunMargin(homeRuns, awayRuns, SEASON_PROJ_RUN_MARGIN_LOGIT);
  const winFromTalent = logisticWinProb(homePow.power, awayPow.power, SEASON_PROJ_LOGIT_SCALE);
  const pHomeRaw =
    SEASON_PROJ_WIN_WEIGHT_FROM_RUNS * winFromRuns.home +
    SEASON_PROJ_WIN_WEIGHT_FROM_TALENT * winFromTalent.home;
  const pHome = shrinkWinProbTowardEven(pHomeRaw, SEASON_PROJ_WIN_PROB_SHRINK);

  return { away: 1 - pHome, home: pHome };
}

function projectRosterExpectedRuns(profile, opponentProfile, norms, runBase, venueFactor) {
  const zOff = zFrom(profile.offenseRating, norms.offense.mean, norms.offense.std);
  const zRun = zFrom(profile.runProd2026, norms.runProd.mean, norms.runProd.std);
  const zRf = zFrom(profile.runsPerGame, norms.runsPerGame.mean, norms.runsPerGame.std);
  const offBlend = 0.5 * zOff + 0.25 * zRun + 0.25 * zRf;
  const defOpp = opponentProfile.defenseZ ?? 0;
  const oppRa = opponentProfile.runsAgainstPerGame;
  const leagueRa = runBase.avgRunsAgainstPerGame || runBase.avgRunsPerTeam;
  const { runsAgainstScale, defenseZScale } = matchupOpponentDefenseScales(opponentProfile);

  let mult =
    (1 + MATCHUP_RUN_OFF_Z_PCT * offBlend) *
    (1 - defenseZScale * defOpp) *
    venueFactor;

  if (oppRa != null && leagueRa > 0) {
    const oppAllowFactor = oppRa / leagueRa;
    mult *= 1 + runsAgainstScale * (oppAllowFactor - 1);
  }

  return Math.max(2, runBase.avgRunsPerTeam * mult);
}

function projectTeamRuns(profile, opponentProfile, norms, runBase, venueFactor) {
  const rosterProj = projectRosterExpectedRuns(profile, opponentProfile, norms, runBase, venueFactor);

  if (profile.runsPerGame != null && profile.scheduleGames >= 2) {
    const w = matchupScheduleBlendWeight(profile, opponentProfile);
    return Math.max(2, w * profile.runsPerGame + (1 - w) * rosterProj);
  }

  return rosterProj;
}

function roundMatchupN(n, dec = 1) {
  if (!Number.isFinite(n)) return null;
  const f = 10 ** dec;
  return Math.round(n * f) / f;
}

/** Betting lines: nearest whole or half (11.4 → 11.5, 12.1 → 12, 12.8 → 13). */
function roundToNearestHalf(n) {
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 2) / 2;
}

function formatBettingLineNumber(n) {
  const v = roundToNearestHalf(n);
  if (v == null) return null;
  return Math.abs(v % 1) < 1e-9 ? String(Math.round(v)) : v.toFixed(1);
}

function formatRunLineSpread(marginHome) {
  if (marginHome == null || !Number.isFinite(marginHome)) return null;
  const label = formatBettingLineNumber(marginHome);
  if (label == null) return null;
  return marginHome > 0 ? `+${label}` : label;
}

/** Projected winner + formatted away–home score for the lines table. */
function buildPredictedFinalScore(proj, homeWinProb = 0.5) {
  if (!proj) {
    return { winnerSide: null, score: null };
  }
  const margin = proj.marginHome;
  const homeWins = margin > 1e-9 || (Math.abs(margin) <= 1e-9 && homeWinProb >= 0.5);
  return {
    winnerSide: homeWins ? "home" : "away",
    score: proj.impliedScore,
  };
}

/** After win-% adjustment, nudge projected runs so the favored team scores more. */
function alignProjectedRunsToWinFavorite(prediction) {
  if (!prediction?.projectedRuns || !prediction?.winPct) return prediction;
  const awayR = Number(prediction.projectedRuns.away);
  const homeR = Number(prediction.projectedRuns.home);
  if (!Number.isFinite(awayR) || !Number.isFinite(homeR)) return prediction;

  const homeFavoriteByWin = prediction.winPct.home >= prediction.winPct.away;
  const runsAligned =
    (homeFavoriteByWin && homeR > awayR) || (!homeFavoriteByWin && awayR > homeR);
  if (runsAligned) return prediction;

  let newAway = awayR;
  let newHome = homeR;
  if (homeFavoriteByWin) newHome = awayR + 0.5;
  else newAway = homeR + 0.5;

  const runs = finalizeRunProjection(newAway, newHome);
  if (!runs) return prediction;

  prediction.projectedRuns = {
    away: runs.awayDisplay,
    home: runs.homeDisplay,
    total: runs.totalDisplay,
    marginHome: runs.marginDisplay,
  };
  prediction.lines = prediction.lines || {};
  prediction.lines.overUnder = runs.overUnder;
  prediction.lines.impliedScore = runs.impliedScore;
  prediction.lines.finalScore = null;
  prediction.lines.runLine = null;
  return enrichMatchupPredictionLines(prediction);
}

/** Ensure lines table fields exist (covers stale in-memory server or older prediction payloads). */
function enrichMatchupPredictionLines(prediction) {
  if (!prediction?.projectedRuns || !prediction?.winPct) return prediction;
  const awayR = Number(prediction.projectedRuns.away);
  const homeR = Number(prediction.projectedRuns.home);
  if (!Number.isFinite(awayR) || !Number.isFinite(homeR)) return prediction;

  const pHome = prediction.winPct.home / 100;
  const runs = {
    away: awayR,
    home: homeR,
    marginHome: homeR - awayR,
    impliedScore: `${prediction.projectedRuns.away} – ${prediction.projectedRuns.home}`,
  };

  prediction.lines = prediction.lines || {};
  if (!prediction.lines.finalScore?.winnerSide) {
    prediction.lines.finalScore = buildPredictedFinalScore(runs, pHome);
  }
  if (!prediction.lines.runLine?.value) {
    prediction.lines.runLine = buildFavoriteRunLine(runs, pHome);
  }
  const moneylines = americanMoneylineFromRunLine(prediction.lines.runLine);
  prediction.lines.moneylineAway = moneylines.away;
  prediction.lines.moneylineHome = moneylines.home;
  return prediction;
}

/** Run line: spread magnitude on the projected favorite (win prob breaks ties). */
function buildFavoriteRunLine(proj, homeWinProb = 0.5) {
  if (!proj || !Number.isFinite(proj.marginHome)) {
    return { side: null, value: null };
  }
  const margin = proj.marginHome;
  const homeFavorite = margin > 1e-9 || (Math.abs(margin) <= 1e-9 && homeWinProb >= 0.5);
  let magnitude = Math.abs(margin);
  if (magnitude < 1e-9) magnitude = 0.5;
  const label = formatBettingLineNumber(magnitude);
  if (label == null) return { side: null, value: null };
  return {
    side: homeFavorite ? "home" : "away",
    value: label,
  };
}

/** Build all betting/run displays from finalized half-point team totals. */
function finalizeRunProjection(away, home) {
  if (away == null || home == null || !Number.isFinite(away) || !Number.isFinite(home)) {
    return null;
  }
  const marginHome = home - away;
  const total = away + home;
  return {
    away,
    home,
    total,
    marginHome,
    awayDisplay: formatBettingLineNumber(away),
    homeDisplay: formatBettingLineNumber(home),
    totalDisplay: formatBettingLineNumber(total),
    marginDisplay: formatRunLineSpread(marginHome),
    impliedScore: `${formatBettingLineNumber(away)} – ${formatBettingLineNumber(home)}`,
    overUnder: formatBettingLineNumber(total),
    runLineHome: formatRunLineSpread(marginHome),
  };
}

/** Single source of truth: half-point team totals → total, margin, and all displayed lines. */
function buildRoundedRunProjection(awayRunsRaw, homeRunsRaw) {
  const away = roundToNearestHalf(awayRunsRaw);
  const home = roundToNearestHalf(homeRunsRaw);
  if (away == null || home == null) return null;
  return finalizeRunProjection(away, home);
}

/** If rounding ties the score, give the projected favorite +0.5 runs (home on a pick'em). */
function resolveTiedRunProjection(proj, homeIsFavorite) {
  if (!proj || Math.abs(proj.marginHome) > 1e-9) return proj;
  if (homeIsFavorite) {
    return finalizeRunProjection(proj.away, proj.home + 0.5);
  }
  return finalizeRunProjection(proj.away + 0.5, proj.home);
}

function predictMatchupGame(awayProfile, homeProfile, norms, runBase) {
  const awayPow = teamCompositePower(awayProfile, norms, false);
  const homePow = teamCompositePower(homeProfile, norms, true);

  let awayRuns = projectTeamRuns(
    awayProfile,
    homeProfile,
    norms,
    runBase,
    MATCHUP_AWAY_RUN_FACTOR
  );
  let homeRuns = projectTeamRuns(
    homeProfile,
    awayProfile,
    norms,
    runBase,
    MATCHUP_HOME_RUN_FACTOR
  );
  ({ away: awayRuns, home: homeRuns } = applyCriticalRosterRunProjection(
    awayProfile,
    homeProfile,
    awayRuns,
    homeRuns
  ));
  let runs = buildRoundedRunProjection(awayRuns, homeRuns);
  if (!runs) {
    return {
      winPct: { away: 50, home: 50 },
      winPctFromRuns: { away: 50, home: 50 },
      projectedRuns: { away: "—", home: "—", total: "—", marginHome: "—" },
      scheduleRates: { away: {}, home: {} },
      lines: {
        overUnder: "—",
        finalScore: { winnerSide: null, score: "—" },
        runLine: { side: null, value: "—" },
        impliedScore: "—",
      },
      strength: { away: 0, home: 0 },
      runBaselineGames: runBase.gamesSampled,
      leagueAvgRunsPerTeam: roundMatchupN(runBase.avgRunsPerTeam, 1),
    };
  }

  const winFromTalent = logisticWinProb(homePow.power, awayPow.power);
  let winFromRuns = winProbFromRunMargin(runs.home, runs.away);
  const pHomeRaw =
    MATCHUP_WIN_WEIGHT_FROM_RUNS * winFromRuns.home +
    MATCHUP_WIN_WEIGHT_FROM_TALENT * winFromTalent.home;
  let pHome = shrinkWinProbTowardEven(pHomeRaw);
  let pAway = 1 - pHome;
  ({ away: pAway, home: pHome } = applyCriticalRosterWinCap(
    awayProfile,
    homeProfile,
    pAway,
    pHome
  ));

  runs = resolveTiedRunProjection(runs, pHome >= pAway);
  winFromRuns = winProbFromRunMargin(runs.home, runs.away);

  return {
    winPct: {
      away: roundMatchupN(pAway * 100, 1),
      home: roundMatchupN(pHome * 100, 1),
    },
    winPctFromRuns: {
      away: roundMatchupN(winFromRuns.away * 100, 1),
      home: roundMatchupN(winFromRuns.home * 100, 1),
    },
    projectedRuns: {
      away: runs.awayDisplay,
      home: runs.homeDisplay,
      total: runs.totalDisplay,
      marginHome: runs.marginDisplay,
    },
    scheduleRates: {
      away: {
        runsPerGame: roundMatchupN(awayProfile.runsPerGame, 1),
        runsAgainstPerGame: roundMatchupN(awayProfile.runsAgainstPerGame, 1),
      },
      home: {
        runsPerGame: roundMatchupN(homeProfile.runsPerGame, 1),
        runsAgainstPerGame: roundMatchupN(homeProfile.runsAgainstPerGame, 1),
      },
    },
    lines: {
      overUnder: runs.overUnder,
      finalScore: buildPredictedFinalScore(runs, pHome),
      runLine: buildFavoriteRunLine(runs, pHome),
      impliedScore: runs.impliedScore,
    },
    strength: {
      away: roundMatchupN(awayPow.power, 2),
      home: roundMatchupN(homePow.power, 2),
    },
    runBaselineGames: runBase.gamesSampled,
    leagueAvgRunsPerTeam: roundMatchupN(runBase.avgRunsPerTeam, 1),
  };
}

/** ~4.5% hold — e.g. -110 / +100 on a pick'em, not symmetric +110 / -110. */
const MONEYLINE_OVERROUND = 1.045;
const MONEYLINE_STANDARD_FAVORITE = -110;
const MONEYLINE_STANDARD_UNDERDOG = 100;
const MONEYLINE_PICKEM_THRESHOLD = 0.025;

function americanFromImpliedProb(implied) {
  const imp = Math.min(0.999, Math.max(0.001, implied));
  if (imp >= 0.5) return -Math.round((100 * imp) / (1 - imp));
  return Math.round((100 * (1 - imp)) / imp);
}

function roundMoneylineAmerican(n) {
  const sign = n < 0 ? -1 : 1;
  let abs = Math.abs(n);
  if (abs >= 1000) abs = Math.round(abs / 50) * 50;
  else if (abs >= 200) abs = Math.round(abs / 10) * 10;
  else abs = Math.round(abs / 5) * 5;
  abs = Math.max(abs, 100);
  return sign * abs;
}

function formatAmericanMoneyline(n) {
  return n < 0 ? String(n) : `+${n}`;
}

/** Favorite juice: |negative line| must exceed the plus side (house wins). */
function enforceMoneylineHouseEdge(favoriteOdds, underdogOdds) {
  let fav =
    favoriteOdds < 0 ? favoriteOdds : MONEYLINE_STANDARD_FAVORITE;
  let dog =
    underdogOdds > 0 ? underdogOdds : MONEYLINE_STANDARD_UNDERDOG;

  if (fav > MONEYLINE_STANDARD_FAVORITE) fav = MONEYLINE_STANDARD_FAVORITE;

  fav = roundMoneylineAmerican(fav);
  dog = roundMoneylineAmerican(dog);

  while (Math.abs(fav) <= dog) {
    fav -= 5;
    if (dog > MONEYLINE_STANDARD_UNDERDOG) dog -= 5;
    else dog = MONEYLINE_STANDARD_UNDERDOG;
  }

  if (dog > MONEYLINE_STANDARD_UNDERDOG && Math.abs(fav) <= MONEYLINE_STANDARD_UNDERDOG) {
    dog = MONEYLINE_STANDARD_UNDERDOG;
    if (Math.abs(fav) <= dog) fav = MONEYLINE_STANDARD_FAVORITE;
  }

  return [fav, dog];
}

/** Parse run-line magnitude (e.g. "1.5" → 1.5). */
function parseRunLineMagnitude(value) {
  if (value == null) return null;
  const n = parseFloat(String(value).replace(/[^\d.+-]/g, ""));
  return Number.isFinite(n) ? Math.abs(n) : null;
}

/**
 * Moneyline derived from run-line spread: 0.5 → -110 / +100, +15 juice per extra 0.5 run.
 */
function americanMoneylineFromRunLine(runLine) {
  const side = runLine?.side;
  if (!side) return { away: "—", home: "—" };

  let mag = parseRunLineMagnitude(runLine?.value);
  if (mag == null) mag = 0.5;
  mag = Math.max(0.5, mag);

  const halfSteps = Math.max(0, Math.round((mag - 0.5) / 0.5));
  let favOdds = MONEYLINE_STANDARD_FAVORITE - halfSteps * 15;
  let dogOdds = MONEYLINE_STANDARD_UNDERDOG + halfSteps * 10;
  [favOdds, dogOdds] = enforceMoneylineHouseEdge(favOdds, dogOdds);

  if (side === "away") {
    return {
      away: formatAmericanMoneyline(favOdds),
      home: formatAmericanMoneyline(dogOdds),
    };
  }
  return {
    away: formatAmericanMoneyline(dogOdds),
    home: formatAmericanMoneyline(favOdds),
  };
}

/** Legacy win-probability moneylines (kept for tests / fallback). */
function americanMoneylinePair(probAway, probHome) {
  const sum = probAway + probHome;
  if (sum <= 0) return { away: "—", home: "—" };

  const qAway = probAway / sum;
  const qHome = probHome / sum;

  if (Math.abs(qAway - qHome) < MONEYLINE_PICKEM_THRESHOLD) {
    const [fav, dog] = enforceMoneylineHouseEdge(
      MONEYLINE_STANDARD_FAVORITE,
      MONEYLINE_STANDARD_UNDERDOG
    );
    return {
      away: formatAmericanMoneyline(dog),
      home: formatAmericanMoneyline(fav),
    };
  }

  const awayIsFav = qAway > qHome;
  const qFav = awayIsFav ? qAway : qHome;
  const minFavImp = 110 / 210;

  let impFav = Math.max(qFav * MONEYLINE_OVERROUND, minFavImp);
  impFav = Math.min(impFav, 0.95);
  let impDog = MONEYLINE_OVERROUND - impFav;
  if (impDog >= 0.5) {
    impDog = 0.495;
    impFav = MONEYLINE_OVERROUND - impDog;
  }

  let favAmerican = roundMoneylineAmerican(americanFromImpliedProb(impFav));
  let dogAmerican = roundMoneylineAmerican(americanFromImpliedProb(impDog));
  [favAmerican, dogAmerican] = enforceMoneylineHouseEdge(favAmerican, dogAmerican);

  if (awayIsFav) {
    return {
      away: formatAmericanMoneyline(favAmerican),
      home: formatAmericanMoneyline(dogAmerican),
    };
  }
  return {
    away: formatAmericanMoneyline(dogAmerican),
    home: formatAmericanMoneyline(favAmerican),
  };
}

module.exports = {
  leagueRunScoringBaseline,
  buildTeamScheduleRunRates,
  buildDefenseZByNorm,
  buildTeamMatchupProfiles,
  buildMatchupLeagueNorms,
  predictMatchupGame,
  predictSeasonGameWinProbs,
  enrichMatchupPredictionLines,
  alignProjectedRunsToWinFavorite,
  americanMoneylinePair,
  americanMoneylineFromRunLine,
  roundMatchupN,
  finishedScheduleGameDedupeKey,
};
