"use strict";

const { evaluateFinishedMatchupGames } = require("./matchupPredictorRecord");
const {
  buildCalibrationWeights,
  buildWalkForwardWeeklyAudit,
  CLOSE_CALL_WIN_PCT,
} = require("./matchupWinProbCalibration");
const { matchupKeyToSlug } = require("./matchupSlug");
const { createMemoryCache } = require("./memoryCache");

const auditCache = createMemoryCache(
  Number(process.env.MATCHUP_RECORD_CACHE_TTL_MS) ||
    Number(process.env.CSV_CACHE_TTL_MS) ||
    5 * 60 * 1000,
  "matchup-predictor-audit"
);

function summarizeRecord(gameRows) {
  let wins = 0;
  let losses = 0;
  for (const row of gameRows || []) {
    if (row.correct === true) wins += 1;
    else if (row.correct === false) losses += 1;
  }
  return {
    wins,
    losses,
    decided: wins + losses,
    winPct: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 1000) / 10 : null,
  };
}

function compactDayDigitsFromIso(iso) {
  return safeText(iso).replace(/-/g, "");
}

function safeText(value) {
  return (value || "").toString().trim();
}

function viewTokenForGame(row) {
  if (row.weekNumber != null && row.weekday === 0) return `W${row.weekNumber}`;
  if (row.isoDate) return `D${compactDayDigitsFromIso(row.isoDate)}`;
  if (row.weekNumber != null) return `W${row.weekNumber}`;
  return "";
}

function formatGameLink(row) {
  const view = viewTokenForGame(row);
  const slug = matchupKeyToSlug(row.matchupKey);
  if (!view || !slug) return null;
  return `/matchup-predictor/view/${encodeURIComponent(view)}/matchup/${encodeURIComponent(slug)}`;
}

function buildCloseMisses(gameRows) {
  return (gameRows || [])
    .filter((row) => row.isCloseMiss)
    .sort((a, b) => (a.isoDate || "").localeCompare(b.isoDate || ""))
    .map((row) => ({
      isoDate: row.isoDate,
      weekNumber: row.weekNumber,
      label: row.label,
      predictedSide: row.predictedSide,
      predictedTeam: row.predictedSide === "home" ? row.homeName : row.awayName,
      favoredWinPct: row.favoredWinPct,
      actualSide: row.actualSide,
      actualWinner:
        row.actualSide === "home" ? row.homeName : row.actualSide === "away" ? row.awayName : "Tie",
      score: `${row.awayScore}–${row.homeScore}`,
      viewToken: viewTokenForGame(row),
      matchupKey: row.matchupKey,
      link: formatGameLink(row),
    }));
}

function walkForwardCalibratedRecord(weeks) {
  let wins = 0;
  let losses = 0;
  for (const wk of weeks || []) {
    const block = wk.calibrated || wk.base;
    wins += block.wins;
    losses += block.losses;
  }
  return {
    wins,
    losses,
    decided: wins + losses,
    winPct: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 1000) / 10 : null,
  };
}

function computeMatchupPredictorAudit(input) {
  const gameRows = evaluateFinishedMatchupGames(input);
  const record = summarizeRecord(gameRows);
  const weeks = buildWalkForwardWeeklyAudit(gameRows);
  const closeMisses = buildCloseMisses(gameRows);
  const calibration = buildCalibrationWeights(gameRows);
  const calibratedRecord = walkForwardCalibratedRecord(weeks);

  return {
    ...record,
    weeks,
    closeMisses,
    closeCallThresholdPct: CLOSE_CALL_WIN_PCT,
    calibration: {
      ...calibration,
      weights: calibration.weights ? calibration.weights.map((w) => round4(w)) : null,
    },
    calibratedRecord,
    evaluatedGames: gameRows.length,
  };
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

async function getMatchupPredictorAudit(input) {
  return auditCache.get("audit", async () => computeMatchupPredictorAudit(input));
}

async function getMatchupCalibrationForProjections(input) {
  const audit = await getMatchupPredictorAudit(input);
  return {
    weights: audit?.calibration?.weights || null,
    trainingGames: audit?.calibration?.trainingGames ?? 0,
    mlEnabled: Boolean(audit?.calibration?.weights?.length),
  };
}

module.exports = {
  computeMatchupPredictorAudit,
  getMatchupPredictorAudit,
  getMatchupCalibrationForProjections,
  summarizeRecord,
};
