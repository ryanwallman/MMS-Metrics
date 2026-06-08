"use strict";

function safeText(value) {
  return (value || "").toString().trim();
}

function matchupGameKey(game) {
  const away = safeText(game.awayTeamId);
  const home = safeText(game.homeTeamId);
  return `${away}|${home}`;
}

function buildMatchupOptionLabel(game) {
  return `${game.away} @ ${game.home}${game.time && game.time !== "-" ? ` · ${game.time}` : ""}${
    game.result ? ` · ${game.result}` : ""
  }`;
}

function buildMatchupOptionsForGames(games) {
  return (games || []).map((g) => ({
    value: matchupGameKey(g),
    label: buildMatchupOptionLabel(g),
    game: g,
  }));
}

function findGameByMatchupKey(games, key) {
  const want = safeText(key);
  if (!want) return null;
  return (games || []).find((g) => matchupGameKey(g) === want) || null;
}

module.exports = {
  matchupGameKey,
  buildMatchupOptionLabel,
  buildMatchupOptionsForGames,
  findGameByMatchupKey,
};
