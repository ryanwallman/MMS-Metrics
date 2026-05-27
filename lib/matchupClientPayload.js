"use strict";

const { normalizePlayerName } = require("./dfs");

function mapSubsetForNorms(map, norms) {
  const out = {};
  if (!map) return out;
  for (const norm of norms) {
    if (map.has(norm)) out[norm] = map.get(norm);
  }
  return out;
}

function statsSubsetForNorms(statsMap, norms) {
  const out = {};
  for (const norm of norms) {
    const row = statsMap.get(norm);
    if (!row) continue;
    out[norm] = {
      PA: row.PA,
      Runs: row.Runs,
      RBI: row.RBI,
    };
  }
  return out;
}

/**
 * Serializable payload for browser-side matchup prediction (GitHub Pages).
 */
function buildMatchupClientPayload({
  awayBaseProfile,
  homeBaseProfile,
  leagueNorms,
  runBase,
  awayPlayers,
  homePlayers,
  awayLabel,
  homeLabel,
  offenseRatingByNorm,
  stats2026ByPlayer,
  defenseZByNorm,
}) {
  if (!awayBaseProfile || !homeBaseProfile || !leagueNorms || !runBase) return null;

  const norms = new Set();
  for (const name of awayPlayers || []) {
    const n = normalizePlayerName(name);
    if (n) norms.add(n);
  }
  for (const name of homePlayers || []) {
    const n = normalizePlayerName(name);
    if (n) norms.add(n);
  }

  return {
    leagueNorms,
    runBase,
    awayBaseProfile,
    homeBaseProfile,
    awayPlayers: awayPlayers || [],
    homePlayers: homePlayers || [],
    awayLabel: awayLabel || "Away",
    homeLabel: homeLabel || "Home",
    offenseRatingByNorm: mapSubsetForNorms(offenseRatingByNorm, norms),
    stats2026ByPlayer: statsSubsetForNorms(stats2026ByPlayer, norms),
    defenseZByNorm: mapSubsetForNorms(defenseZByNorm, norms),
  };
}

module.exports = { buildMatchupClientPayload };
