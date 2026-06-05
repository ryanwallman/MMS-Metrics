"use strict";

const CALIBRATION_FEATURE_NAMES = [
  "bias",
  "modelHomeWin",
  "strengthDiff",
  "winFromRunsHome",
  "offenseDiff",
  "missingDiff",
  "winPctDiff",
  "runDiff",
  "defDiff",
];

const MIN_CALIBRATION_TRAINING_GAMES = 6;
const CLOSE_CALL_WIN_PCT = 55;

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function sigmoid(z) {
  if (z >= 0) {
    const ez = Math.exp(-z);
    return 1 / (1 + ez);
  }
  const ez = Math.exp(z);
  return ez / (1 + ez);
}

function extractCalibrationFeatures(awayProfile, homeProfile, prediction) {
  const pHome = toNum(prediction?.winPct?.home, 50) / 100;
  const strengthDiff =
    toNum(prediction?.strength?.home) - toNum(prediction?.strength?.away);
  const winFromRunsHome = toNum(prediction?.winPctFromRuns?.home, 50) / 100;
  const offenseDiff =
    toNum(homeProfile?.offenseRating) - toNum(awayProfile?.offenseRating);
  const missingDiff =
    toNum(awayProfile?.missingCount) - toNum(homeProfile?.missingCount);
  const winPctDiff = toNum(homeProfile?.winPct, 0.5) - toNum(awayProfile?.winPct, 0.5);
  const runDiff = toNum(homeProfile?.runsPerGame) - toNum(awayProfile?.runsPerGame);
  const defDiff =
    toNum(awayProfile?.runsAgainstPerGame) - toNum(homeProfile?.runsAgainstPerGame);

  return {
    names: CALIBRATION_FEATURE_NAMES,
    values: [
      1,
      pHome,
      strengthDiff,
      winFromRunsHome,
      offenseDiff,
      missingDiff,
      winPctDiff,
      runDiff,
      defDiff,
    ],
  };
}

function trainingSampleFromGameRow(row) {
  if (!row?.features?.values?.length || row.actualSide === "tie") return null;
  const homeWon = row.actualSide === "home" ? 1 : 0;
  return { values: row.features.values, label: homeWon };
}

function trainLogisticRegression(samples, options = {}) {
  const learningRate = options.learningRate ?? 0.12;
  const epochs = options.epochs ?? 900;
  const l2 = options.l2 ?? 0.02;
  if (!samples?.length) return null;

  const d = samples[0].values.length;
  const weights = new Array(d).fill(0);

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const grad = new Array(d).fill(0);
    for (const sample of samples) {
      let z = 0;
      for (let i = 0; i < d; i += 1) z += weights[i] * sample.values[i];
      const err = sigmoid(z) - sample.label;
      for (let i = 0; i < d; i += 1) grad[i] += err * sample.values[i];
    }
    const n = samples.length;
    for (let i = 0; i < d; i += 1) {
      const reg = i === 0 ? 0 : l2 * weights[i];
      weights[i] -= learningRate * (grad[i] / n + reg);
    }
  }
  return weights;
}

function predictHomeWinProb(values, weights) {
  if (!weights?.length || !values?.length) return null;
  let z = 0;
  for (let i = 0; i < weights.length; i += 1) z += weights[i] * values[i];
  return sigmoid(z);
}

function predictedSideFromHomeProb(pHome) {
  if (pHome == null || !Number.isFinite(pHome)) return null;
  if (pHome > 0.5) return "home";
  if (pHome < 0.5) return "away";
  return null;
}

function favoredWinPctFromHomeProb(pHome) {
  if (pHome == null) return null;
  return Math.max(pHome, 1 - pHome) * 100;
}

function isCloseCallWinPct(favoredWinPct) {
  return favoredWinPct != null && favoredWinPct < CLOSE_CALL_WIN_PCT;
}

function gradeSidePick(predictedSide, actualSide) {
  if (!predictedSide || actualSide === "tie") return null;
  return predictedSide === actualSide;
}

function buildCalibrationWeights(gameRows) {
  const samples = (gameRows || [])
    .map(trainingSampleFromGameRow)
    .filter(Boolean);
  if (samples.length < MIN_CALIBRATION_TRAINING_GAMES) {
    return { weights: null, trainingGames: samples.length };
  }
  const weights = trainLogisticRegression(samples);
  return { weights, trainingGames: samples.length, featureNames: CALIBRATION_FEATURE_NAMES };
}

function applyWinProbCalibration(awayProfile, homeProfile, prediction, weights) {
  if (!weights?.length || !prediction) return prediction;
  const features = extractCalibrationFeatures(awayProfile, homeProfile, prediction);
  const pHome = predictHomeWinProb(features.values, weights);
  if (pHome == null) return prediction;
  const pAway = 1 - pHome;
  const rawWinPct = {
    away: prediction.winPct?.away,
    home: prediction.winPct?.home,
  };
  const adjusted = {
    ...prediction,
    winPct: {
      away: round1(pAway * 100),
      home: round1(pHome * 100),
    },
    calibration: {
      applied: true,
      rawWinPct,
    },
  };
  const {
    enrichMatchupPredictionLines,
    alignProjectedRunsToWinFavorite,
  } = require("./matchupPredict");
  adjusted.lines = { ...(adjusted.lines || {}), finalScore: null, runLine: null };
  return alignProjectedRunsToWinFavorite(enrichMatchupPredictionLines(adjusted));
}

/** Matchup win probs (0–1) with optional ML calibration — used by power rankings season sim. */
function calibratedMatchupWinProbs(awayProfile, homeProfile, leagueNorms, runBase, weights) {
  const { predictMatchupGame } = require("./matchupPredict");
  let prediction = predictMatchupGame(awayProfile, homeProfile, leagueNorms, runBase);
  if (weights?.length) {
    prediction = applyWinProbCalibration(awayProfile, homeProfile, prediction, weights);
  }
  return {
    away: toNum(prediction?.winPct?.away, 50) / 100,
    home: toNum(prediction?.winPct?.home, 50) / 100,
  };
}

function evaluateCalibratedRow(row, weights) {
  const pHome = weights?.length
    ? predictHomeWinProb(row.features.values, weights)
    : toNum(row.homeWinPct, 50) / 100;
  const predictedSide = predictedSideFromHomeProb(pHome);
  const favoredWinPct = favoredWinPctFromHomeProb(pHome);
  const correct = gradeSidePick(predictedSide, row.actualSide);
  return {
    predictedSide,
    favoredWinPct: favoredWinPct != null ? round1(favoredWinPct) : null,
    homeWinPct: pHome != null ? round1(pHome * 100) : row.homeWinPct,
    correct,
    isCloseCall: isCloseCallWinPct(favoredWinPct),
    isCloseMiss: isCloseCallWinPct(favoredWinPct) && correct === false,
  };
}

function buildWalkForwardWeeklyAudit(gameRows) {
  const sorted = [...(gameRows || [])].sort((a, b) =>
    (a.isoDate || "").localeCompare(b.isoDate || "")
  );
  const weekMap = new Map();

  for (const row of sorted) {
    const wk = row.weekNumber;
    if (wk == null) continue;
    if (!weekMap.has(wk)) {
      weekMap.set(wk, { weekNumber: wk, games: [], priorGames: [] });
    }
    weekMap.get(wk).games.push(row);
  }

  const weeks = [];
  const prior = [];

  for (const wk of [...weekMap.keys()].sort((a, b) => a - b)) {
    const bucket = weekMap.get(wk);
    const trainSamples = prior
      .map(trainingSampleFromGameRow)
      .filter(Boolean);
    const weights =
      trainSamples.length >= MIN_CALIBRATION_TRAINING_GAMES
        ? trainLogisticRegression(trainSamples)
        : null;

    let baseWins = 0;
    let baseLosses = 0;
    let calWins = 0;
    let calLosses = 0;
    let closeMisses = 0;

    for (const game of bucket.games) {
      if (game.correct === true) baseWins += 1;
      else if (game.correct === false) baseLosses += 1;

      const cal = evaluateCalibratedRow(game, weights);
      if (cal.correct === true) calWins += 1;
      else if (cal.correct === false) calLosses += 1;
      if (game.isCloseMiss) closeMisses += 1;
    }

    weeks.push({
      weekNumber: wk,
      viewToken: `W${wk}`,
      games: bucket.games.length,
      base: { wins: baseWins, losses: baseLosses },
      calibrated:
        weights && calWins + calLosses > 0
          ? { wins: calWins, losses: calLosses, trainingGames: trainSamples.length }
          : null,
      closeMisses,
      trainingGames: trainSamples.length,
    });

    prior.push(...bucket.games);
  }

  return weeks;
}

module.exports = {
  CALIBRATION_FEATURE_NAMES,
  MIN_CALIBRATION_TRAINING_GAMES,
  CLOSE_CALL_WIN_PCT,
  extractCalibrationFeatures,
  trainLogisticRegression,
  predictHomeWinProb,
  buildCalibrationWeights,
  applyWinProbCalibration,
  calibratedMatchupWinProbs,
  evaluateCalibratedRow,
  buildWalkForwardWeeklyAudit,
  isCloseCallWinPct,
  favoredWinPctFromHomeProb,
};
