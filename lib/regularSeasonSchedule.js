"use strict";

const REGULAR_SEASON_GAMES = 22;

function safeText(value) {
  return (value || "").toString().trim();
}

/** September rows on the schedule sheet are playoffs or stale — not regular season. */
function isRegularSeasonScheduleGame(game) {
  const iso = safeText(game?.isoDate);
  if (!iso) return true;
  const parts = iso.split("-");
  if (parts.length < 2) return true;
  const month = Number(parts[1]);
  return month !== 9;
}

function filterRegularSeasonScheduleGames(parsedGames) {
  return (parsedGames || []).filter(isRegularSeasonScheduleGame);
}

module.exports = {
  REGULAR_SEASON_GAMES,
  isRegularSeasonScheduleGame,
  filterRegularSeasonScheduleGames,
};
