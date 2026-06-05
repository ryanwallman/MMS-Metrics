#!/usr/bin/env node
"use strict";

require("dotenv").config();

const fs = require("fs/promises");
const {
  setNodeCareerReader,
  loadCareerByPlayer,
  load2025HistoricalByPlayer,
  loadWeeklySchedule,
} = require("../lib/dfsLeaderboardScoringContext");
setNodeCareerReader((filePath) => fs.readFile(filePath, "utf8"));

const { load2026StatsByPlayer } = require("../lib/stats2026Loader");
const {
  loadTeamRosters,
  buildNameToTeamIdMap,
  buildRosterByTeamId,
} = require("../lib/teamRosters");
const { loadCaptainTeamCodeById } = require("../lib/powerRankingsCaptains");
const { getCachedPlayerReplacements } = require("../lib/playerReplacements");
const { load2026GamelogsByPlayer, buildTeamCodeById, normalizePlayerName } = require("../lib/dfs");
const path = require("path");
const { CSV_CAREER: CAREER_CSV_PATH } = require("../lib/dataPaths");
const { setCareerCsvFilePath } = require("../lib/sheetUrls");
delete process.env.CAREER_CSV_URL;
setCareerCsvFilePath(path.resolve(CAREER_CSV_PATH));
const { computeMatchupPredictorAudit } = require("../lib/matchupPredictorAudit");
const {
  evaluateCalibratedRow,
  buildCalibrationWeights,
} = require("../lib/matchupWinProbCalibration");
const { evaluateFinishedMatchupGames } = require("../lib/matchupPredictorRecord");

function loadDefensiveRatingsNormalizedMap() {
  const map = new Map();
  try {
    const manual = require("../data/defensiveRatings2026");
    for (const [k, v] of Object.entries(manual.normalizedNameToDefense || {})) {
      map.set(normalizePlayerName(k), Number(v) || 0);
    }
  } catch {
    /* optional */
  }
  return map;
}

async function loadAuditInput() {
  const [
    teams,
    careerByPlayer,
    hist2025ByPlayer,
    stats2026ByPlayer,
    payload,
    defenseMap,
    replacements,
    gamelogs,
    captainTeamCodeById,
  ] = await Promise.all([
    loadTeamRosters(),
    loadCareerByPlayer(),
    load2025HistoricalByPlayer(),
    load2026StatsByPlayer(),
    loadWeeklySchedule(),
    Promise.resolve(loadDefensiveRatingsNormalizedMap()),
    getCachedPlayerReplacements(),
    load2026GamelogsByPlayer(),
    loadCaptainTeamCodeById(),
  ]);

  const { byOriginalNorm } = replacements;
  const teamCodeById = new Map([
    ...buildTeamCodeById(teams, stats2026ByPlayer),
    ...captainTeamCodeById,
  ]);

  return {
    parsedScheduleGames: payload.parsedGames || [],
    teams,
    rosterByTeamId: buildRosterByTeamId(teams),
    nameToTeamId: buildNameToTeamIdMap(teams),
    careerByPlayer,
    hist2025ByPlayer,
    stats2026ByPlayer,
    defenseMap,
    gamelogs,
    teamCodeById,
    replacementByOriginalNorm: byOriginalNorm,
    sundayIsosSorted: payload.sundayIsosSorted,
  };
}

function summarize(rows, weights) {
  let wins = 0;
  let losses = 0;
  for (const row of rows) {
    const cal = evaluateCalibratedRow(row, weights);
    if (cal.correct === true) wins += 1;
    else if (cal.correct === false) losses += 1;
  }
  const decided = wins + losses;
  return {
    wins,
    losses,
    decided,
    winPct: decided ? Math.round((wins / decided) * 1000) / 10 : null,
  };
}

async function main() {
  const input = await loadAuditInput();
  const audit = computeMatchupPredictorAudit(input);
  const rows = evaluateFinishedMatchupGames(input);
  const { weights } = buildCalibrationWeights(rows);

  console.log("Base model:", audit.wins, "-", audit.losses, `(${audit.winPct}%)`);
  if (audit.calibratedRecord) {
    const cr = audit.calibratedRecord;
    console.log("Walk-forward calibrated:", cr.wins, "-", cr.losses, `(${cr.winPct}%)`);
  }
  if (weights?.length) {
    const fullCal = summarize(rows, weights);
    console.log("Full-sample calibrated:", fullCal.wins, "-", fullCal.losses, `(${fullCal.winPct}%)`);
    console.log("Calibration weights:", weights.map((w) => Math.round(w * 1000) / 1000).join(", "));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
