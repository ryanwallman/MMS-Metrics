"use strict";

const { normalizePlayerName } = require("./dfs");
const { findParsedGameForMatchup, isParsedGameFinished } = require("./matchupGameResult");
const { normalizeScheduleTeamId } = require("./teamRosters");

function safeText(value) {
  return (value || "").toString().trim();
}

function isMissedGameFlag(value) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && n === 1;
}

/**
 * Normalized player names with MG=1 for a team on a specific game date.
 * When opponentCode is set, filters to that matchup (doubleheaders on same day).
 */
function missedPlayerNormsForTeamGame({
  iso,
  teamCode,
  opponentCode = "",
  gamelogs,
  normalizeName = normalizePlayerName,
}) {
  const out = new Set();
  const gameIso = safeText(iso);
  const code = safeText(teamCode).toUpperCase();
  const opp = safeText(opponentCode).toUpperCase();
  if (!gameIso || !code || !gamelogs?.bySlateKey) return out;

  const slateKey = `${gameIso}|${code}`;
  const entries = gamelogs.bySlateKey.get(slateKey) || [];
  for (const entry of entries) {
    if (!entry?.missedGame) continue;
    if (opp && safeText(entry.opponentCode).toUpperCase() !== opp) continue;
    const norm = normalizeName(entry.norm || entry.player || "");
    if (norm) out.add(norm);
  }
  return out;
}

/** Keep only missed norms that appear on the effective roster for this game. */
function mapMissedNormsToRoster(missedNorms, playerNames, normalizeName = normalizePlayerName) {
  const rosterNorms = new Set(
    (playerNames || []).map((name) => normalizeName(name)).filter(Boolean)
  );
  const out = new Set();
  for (const norm of missedNorms) {
    if (rosterNorms.has(norm)) out.add(norm);
  }
  return out;
}

function applyGamelogMissingForFinishedGame({
  awayMissingSet,
  homeMissingSet,
  selectedGame,
  viewIso,
  parsedScheduleGames,
  gamelogs,
  teamCodeById,
  awayEffectivePlayers,
  homeEffectivePlayers,
  normalizeName = normalizePlayerName,
}) {
  if (!selectedGame || !gamelogs?.bySlateKey?.size || !teamCodeById?.size) return;

  const parsedGame = findParsedGameForMatchup(parsedScheduleGames, selectedGame, viewIso);
  if (!isParsedGameFinished(parsedGame)) return;

  const gameIso = safeText(selectedGame.isoDate || viewIso);
  if (!gameIso) return;

  const awayId = normalizeScheduleTeamId(selectedGame.awayTeamId);
  const homeId = normalizeScheduleTeamId(selectedGame.homeTeamId);
  const awayCode = teamCodeById.get(awayId);
  const homeCode = teamCodeById.get(homeId);
  if (!awayCode && !homeCode) return;

  if (awayCode) {
    const missed = missedPlayerNormsForTeamGame({
      iso: gameIso,
      teamCode: awayCode,
      opponentCode: homeCode || "",
      gamelogs,
      normalizeName,
    });
    for (const norm of mapMissedNormsToRoster(missed, awayEffectivePlayers, normalizeName)) {
      awayMissingSet.add(norm);
    }
  }

  if (homeCode) {
    const missed = missedPlayerNormsForTeamGame({
      iso: gameIso,
      teamCode: homeCode,
      opponentCode: awayCode || "",
      gamelogs,
      normalizeName,
    });
    for (const norm of mapMissedNormsToRoster(missed, homeEffectivePlayers, normalizeName)) {
      homeMissingSet.add(norm);
    }
  }
}

module.exports = {
  isMissedGameFlag,
  missedPlayerNormsForTeamGame,
  mapMissedNormsToRoster,
  applyGamelogMissingForFinishedGame,
};
