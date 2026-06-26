"use strict";

const { normalizeScheduleTeamId } = require("./teamRosters");
const { enrichMatchupPredictionLines } = require("./matchupPredict");
const { defaultScheduleReferenceIso } = require("./powerRankingsCore");

function safeText(value) {
  return (value || "").toString().trim();
}

function parseLineNumber(value) {
  const n = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function isParsedGameFinished(game, referenceIso) {
  if (
    game == null ||
    !Number.isFinite(game.awayScore) ||
    !Number.isFinite(game.homeScore) ||
    game.awayScore === game.homeScore
  ) {
    return false;
  }
  const ref = safeText(referenceIso) || defaultScheduleReferenceIso();
  if (safeText(game.isoDate) > ref) return false;
  return true;
}

function findParsedGameForMatchup(parsedGames, selectedGame, viewIso = null) {
  if (!selectedGame || !parsedGames?.length) return null;

  const awayId = normalizeScheduleTeamId(selectedGame.awayTeamId);
  const homeId = normalizeScheduleTeamId(selectedGame.homeTeamId);
  const gameId = safeText(selectedGame.gameId);
  const iso = safeText(selectedGame.isoDate || selectedGame._iso || viewIso);

  const matchesTeams = (g) =>
    normalizeScheduleTeamId(g.awayId) === awayId &&
    normalizeScheduleTeamId(g.homeId) === homeId;

  if (gameId) {
    const byId = parsedGames.find((g) => safeText(g.gameId) === gameId && matchesTeams(g));
    if (byId) return byId;
  }

  if (iso) {
    const byIso = parsedGames.find((g) => matchesTeams(g) && g.isoDate === iso);
    if (byIso) return byIso;
  }

  const sameTeams = parsedGames.filter(matchesTeams);
  if (sameTeams.length === 1) return sameTeams[0];
  return null;
}

function betStatusFromCompare(actual, line, pickHigher) {
  if (actual == null || line == null) return null;
  if (Math.abs(actual - line) < 1e-9) return "push";
  if (pickHigher) return actual > line ? "hit" : "miss";
  return actual < line ? "hit" : "miss";
}

function gradeRunLine(actualMarginForFavorite, spread) {
  if (actualMarginForFavorite == null || spread == null) return null;
  if (Math.abs(actualMarginForFavorite - spread) < 1e-9) return "push";
  return actualMarginForFavorite > spread ? "hit" : "miss";
}

/**
 * Grade model lines against a finished game. Model implied picks:
 * - ML: favorite (higher win %)
 * - O/U: over if projected total > line, else under
 * - Run line: projected favorite covers if margin beats displayed spread
 */
function gradeMatchupModelBets(parsedGame, prediction, awayLabel, homeLabel) {
  if (!isParsedGameFinished(parsedGame) || !prediction) return null;

  enrichMatchupPredictionLines(prediction);

  const awayScore = parsedGame.awayScore;
  const homeScore = parsedGame.homeScore;
  const actualTotal = awayScore + homeScore;
  const marginHome = homeScore - awayScore;
  const marginAway = awayScore - homeScore;

  let winnerSide = null;
  if (awayScore > homeScore) winnerSide = "away";
  else if (homeScore > awayScore) winnerSide = "home";
  else winnerSide = "tie";

  const awayWinPct = Number(prediction.winPct?.away);
  const homeWinPct = Number(prediction.winPct?.home);
  const mlFavoriteSide =
    prediction.favoriteSide ||
    (awayWinPct > homeWinPct ? "away" : homeWinPct > awayWinPct ? "home" : null);

  const ouLine = parseLineNumber(prediction.lines?.overUnder);
  const projectedTotal = parseLineNumber(prediction.projectedRuns?.total);
  const ouPick =
    ouLine != null && projectedTotal != null
      ? projectedTotal > ouLine
        ? "over"
        : projectedTotal < ouLine
          ? "under"
          : "push"
      : null;

  let ouStatus = null;
  if (ouLine != null && ouPick && ouPick !== "push") {
    ouStatus =
      ouPick === "over"
        ? betStatusFromCompare(actualTotal, ouLine, true)
        : betStatusFromCompare(actualTotal, ouLine, false);
  } else if (ouLine != null && actualTotal === ouLine) {
    ouStatus = "push";
  }

  let ouActualSide = null;
  if (ouLine != null && Number.isFinite(actualTotal)) {
    if (actualTotal > ouLine) ouActualSide = "over";
    else if (actualTotal < ouLine) ouActualSide = "under";
    else ouActualSide = "push";
  }

  const runLine = prediction.lines?.runLine || {};
  const runLineSide = runLine.side;
  const runLineSpread = parseLineNumber(runLine.value);
  let runLineStatus = null;
  if (runLineSide && runLineSpread != null) {
    const favMargin = runLineSide === "home" ? marginHome : marginAway;
    runLineStatus = gradeRunLine(favMargin, runLineSpread);
  }

  const moneylineAwayStatus =
    winnerSide === "tie" ? "push" : winnerSide === "away" ? "hit" : winnerSide ? "miss" : null;
  const moneylineHomeStatus =
    winnerSide === "tie" ? "push" : winnerSide === "home" ? "hit" : winnerSide ? "miss" : null;

  const modelMoneylineStatus =
    mlFavoriteSide === "away"
      ? moneylineAwayStatus
      : mlFavoriteSide === "home"
        ? moneylineHomeStatus
        : null;

  return {
    awayScore,
    homeScore,
    total: actualTotal,
    winnerSide,
    winnerLabel:
      winnerSide === "away"
        ? awayLabel
        : winnerSide === "home"
          ? homeLabel
          : "Tie",
    awayLabel,
    homeLabel,
    bets: {
      overUnder: {
        line: prediction.lines?.overUnder ?? "—",
        pick: ouPick,
        actualTotal,
        actualSide: ouActualSide,
        status: ouStatus,
      },
      runLine: {
        side: runLineSide,
        line: runLine.value ?? "—",
        status: runLineStatus,
      },
      moneyline: {
        favoriteSide: mlFavoriteSide,
        status: modelMoneylineStatus,
      },
      moneylineAway: { status: moneylineAwayStatus },
      moneylineHome: { status: moneylineHomeStatus },
    },
    modelPrediction: prediction,
  };
}

module.exports = {
  isParsedGameFinished,
  findParsedGameForMatchup,
  gradeMatchupModelBets,
};
