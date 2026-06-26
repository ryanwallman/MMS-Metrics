"use strict";

const { normalizePlayerName } = require("./dfs");
const { buildMatchupLeagueContext } = require("./matchupLeagueContext");
const { predictMatchupGame } = require("./matchupPredict");
const { applyMissingPlayersToProfile } = require("./matchupMissingPlayers");
const {
  filterScheduleGamesBeforeIso,
  buildStats2026ByPlayerFromGamelogsBefore,
} = require("./matchupHistoricalSnapshot");
const {
  missedPlayerNormsForTeamGame,
  mapMissedNormsToRoster,
} = require("./matchupGamelogMissing");
const {
  filterReplacementsForDate,
  applyReplacementsToPlayerNames,
} = require("./playerReplacements");
const { normalizedNameToPosition } = require("../data/playerPositions2026");
const {
  normalizeScheduleTeamId,
  pickRosterEntry,
} = require("./teamRosters");
const {
  extractCalibrationFeatures,
  favoredWinPctFromHomeProb,
  isCloseCallWinPct,
} = require("./matchupWinProbCalibration");
const {
  isPastPlayedScheduleGame,
  defaultScheduleReferenceIso,
} = require("./powerRankingsCore");
const { isRegularSeasonScheduleGame, filterRegularSeasonScheduleGames } = require("./regularSeasonSchedule");

function safeText(value) {
  return (value || "").toString().trim();
}

function weekdayFromIso(iso) {
  const [y, m, d] = safeText(iso).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0).getDay();
}

function weekNumberForGameIso(iso, sundayIsosSorted) {
  const gameIso = safeText(iso);
  if (!gameIso || !Array.isArray(sundayIsosSorted) || !sundayIsosSorted.length) return null;

  const wd = weekdayFromIso(gameIso);
  if (wd === 0) {
    const ix = sundayIsosSorted.indexOf(gameIso);
    return ix >= 0 ? ix + 1 : null;
  }

  for (let i = 0; i < sundayIsosSorted.length; i += 1) {
    if (sundayIsosSorted[i] >= gameIso) return i + 1;
  }
  return sundayIsosSorted.length;
}

function finishedScheduleGameDedupeKey(g) {
  const awayId = normalizeScheduleTeamId(g.awayId);
  const homeId = normalizeScheduleTeamId(g.homeId);
  const gid = safeText(g.gameId);
  if (gid) return `gid|${gid}`;
  return `m|${g.isoDate || ""}|${[awayId, homeId].sort().join("|")}`;
}

function listUniqueFinishedGames(parsedGames, referenceIso) {
  const ref = safeText(referenceIso) || defaultScheduleReferenceIso();
  const seen = new Set();
  const out = [];
  for (const g of parsedGames || []) {
    if (!isRegularSeasonScheduleGame(g)) continue;
    if (!isPastPlayedScheduleGame(g, ref)) continue;
    const key = finishedScheduleGameDedupeKey(g);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(g);
  }
  return out;
}

function buildPositionByNormMap(playerNames) {
  const map = new Map();
  for (const name of playerNames || []) {
    const norm = normalizePlayerName(name);
    const pos = normalizedNameToPosition[norm];
    if (pos) map.set(norm, pos);
  }
  return map;
}

function buildMissingSetForTeam({
  teamId,
  opponentTeamId,
  gameIso,
  gamelogs,
  teamCodeById,
  effectivePlayers,
}) {
  const missing = new Set();
  const code = teamCodeById.get(normalizeScheduleTeamId(teamId));
  const oppCode = teamCodeById.get(normalizeScheduleTeamId(opponentTeamId));
  if (!code || !gameIso) return missing;

  const missed = missedPlayerNormsForTeamGame({
    iso: gameIso,
    teamCode: code,
    opponentCode: oppCode || "",
    gamelogs,
  });
  for (const norm of mapMissedNormsToRoster(missed, effectivePlayers)) {
    missing.add(norm);
  }
  return missing;
}

function actualWinnerSide(game) {
  if (game.awayScore > game.homeScore) return "away";
  if (game.homeScore > game.awayScore) return "home";
  return "tie";
}

function predictedWinnerSide(prediction) {
  const away = Number(prediction?.winPct?.away);
  const home = Number(prediction?.winPct?.home);
  if (!Number.isFinite(away) || !Number.isFinite(home)) return null;
  if (away > home) return "away";
  if (home > away) return "home";
  return null;
}

function evaluateFinishedMatchupGames({
  parsedScheduleGames,
  teams,
  rosterByTeamId,
  nameToTeamId,
  careerByPlayer,
  hist2025ByPlayer,
  stats2026ByPlayer,
  defenseMap,
  gamelogs,
  teamCodeById,
  replacementByOriginalNorm,
  sundayIsosSorted,
  referenceIso,
}) {
  const regularSeasonSchedule = filterRegularSeasonScheduleGames(parsedScheduleGames);
  const finished = listUniqueFinishedGames(regularSeasonSchedule, referenceIso);
  const contextByIso = new Map();
  const rows = [];

  for (const game of finished) {
    const gameIso = safeText(game.isoDate);
    const awayId = normalizeScheduleTeamId(game.awayId);
    const homeId = normalizeScheduleTeamId(game.homeId);
    if (!gameIso || !awayId || !homeId) continue;

    let ctx = contextByIso.get(gameIso);
    if (!ctx) {
      const histStats = buildStats2026ByPlayerFromGamelogsBefore(gamelogs, gameIso);
      const activeStats2026 = histStats.size ? histStats : stats2026ByPlayer;
      const histGames = filterScheduleGamesBeforeIso(regularSeasonSchedule, gameIso);
      ctx = {
        ...buildMatchupLeagueContext({
          teams,
          careerByPlayer,
          hist2025ByPlayer,
          stats2026ByPlayer: activeStats2026,
          parsedScheduleGames: histGames,
          defenseMap,
          rosterByTeamId,
          byOriginalNorm: replacementByOriginalNorm,
        }),
        activeStats2026,
      };
      contextByIso.set(gameIso, ctx);
    }

    const matchupReplacements = filterReplacementsForDate(replacementByOriginalNorm, gameIso);
    const awayRoster = pickRosterEntry(rosterByTeamId, nameToTeamId, awayId, game.awayName);
    const homeRoster = pickRosterEntry(rosterByTeamId, nameToTeamId, homeId, game.homeName);
    const awayPlayers = applyReplacementsToPlayerNames(awayRoster?.players, matchupReplacements);
    const homePlayers = applyReplacementsToPlayerNames(homeRoster?.players, matchupReplacements);
    if (!awayPlayers?.length || !homePlayers?.length) continue;

    const awayMissing = buildMissingSetForTeam({
      teamId: awayId,
      opponentTeamId: homeId,
      gameIso,
      gamelogs,
      teamCodeById,
      effectivePlayers: awayPlayers,
    });
    const homeMissing = buildMissingSetForTeam({
      teamId: homeId,
      opponentTeamId: awayId,
      gameIso,
      gamelogs,
      teamCodeById,
      effectivePlayers: homePlayers,
    });

    let awayProfile = ctx.teamProfiles.get(awayId);
    let homeProfile = ctx.teamProfiles.get(homeId);
    if (!awayProfile || !homeProfile) continue;

    const awayPositionByNorm = buildPositionByNormMap(awayPlayers);
    const homePositionByNorm = buildPositionByNormMap(homePlayers);

    awayProfile = applyMissingPlayersToProfile(
      awayProfile,
      awayPlayers,
      awayMissing,
      ctx.offenseRatingByNorm,
      ctx.activeStats2026,
      ctx.defenseZByNorm,
      normalizePlayerName,
      awayPositionByNorm
    );
    homeProfile = applyMissingPlayersToProfile(
      homeProfile,
      homePlayers,
      homeMissing,
      ctx.offenseRatingByNorm,
      ctx.activeStats2026,
      ctx.defenseZByNorm,
      normalizePlayerName,
      homePositionByNorm
    );

    const prediction = predictMatchupGame(
      awayProfile,
      homeProfile,
      ctx.leagueNorms,
      ctx.runBase
    );
    const predictedSide = predictedWinnerSide(prediction);
    const actualSide = actualWinnerSide(game);
    const homeWinPct = Number(prediction?.winPct?.home);
    const awayWinPct = Number(prediction?.winPct?.away);
    const favoredWinPct = favoredWinPctFromHomeProb(
      Number.isFinite(homeWinPct) ? homeWinPct / 100 : null
    );
    const correct =
      !predictedSide || actualSide === "tie" ? null : predictedSide === actualSide;
    const isCloseCall = isCloseCallWinPct(favoredWinPct);
    const isCloseMiss = isCloseCall && correct === false;

    rows.push({
      isoDate: gameIso,
      weekday: weekdayFromIso(gameIso),
      weekNumber: weekNumberForGameIso(gameIso, sundayIsosSorted),
      awayId,
      homeId,
      awayName: safeText(game.awayName || awayRoster?.teamName || game.away),
      homeName: safeText(game.homeName || homeRoster?.teamName || game.home),
      awayScore: game.awayScore,
      homeScore: game.homeScore,
      predictedSide,
      actualSide,
      correct,
      homeWinPct: Number.isFinite(homeWinPct) ? Math.round(homeWinPct * 10) / 10 : null,
      awayWinPct: Number.isFinite(awayWinPct) ? Math.round(awayWinPct * 10) / 10 : null,
      favoredWinPct: favoredWinPct != null ? Math.round(favoredWinPct * 10) / 10 : null,
      isCloseCall,
      isCloseMiss,
      features: extractCalibrationFeatures(awayProfile, homeProfile, prediction),
      label: `${safeText(game.awayName || awayRoster?.teamName || game.away)} @ ${safeText(game.homeName || homeRoster?.teamName || game.home)}`,
      matchupKey: `${awayId}|${homeId}`,
    });
  }

  rows.sort((a, b) => (a.isoDate || "").localeCompare(b.isoDate || ""));
  return rows;
}

function computeMatchupPredictorRecord(input) {
  const rows = evaluateFinishedMatchupGames(input);
  let wins = 0;
  let losses = 0;
  for (const row of rows) {
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

module.exports = {
  evaluateFinishedMatchupGames,
  computeMatchupPredictorRecord,
  actualWinnerSide,
  predictedWinnerSide,
  weekNumberForGameIso,
};
