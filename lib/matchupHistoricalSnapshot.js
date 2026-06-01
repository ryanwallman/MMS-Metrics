"use strict";

const { normalizePlayerName } = require("./dfs");

function safeText(value) {
  return (value || "").toString().trim();
}

function toNumber(value) {
  const n = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Completed schedule rows strictly before a matchup date (pre-game snapshot). */
function filterScheduleGamesBeforeIso(parsedGames, iso) {
  const cutoff = safeText(iso);
  if (!cutoff) return parsedGames || [];
  return (parsedGames || []).filter((g) => safeText(g.isoDate) < cutoff);
}

/**
 * Aggregate 2026 batting lines from game logs through the day before `beforeIso`.
 * Excludes missed-game (MG) rows from production totals.
 */
function buildStats2026ByPlayerFromGamelogsBefore(gamelogs, beforeIso) {
  const cutoff = safeText(beforeIso);
  const out = new Map();
  if (!cutoff || !gamelogs?.byNorm) return out;

  for (const [norm, entries] of gamelogs.byNorm.entries()) {
    let pa = 0;
    let ab = 0;
    let hits = 0;
    let runs = 0;
    let rbi = 0;
    let bb = 0;
    let singles = 0;
    let doubles = 0;
    let triples = 0;
    let hr = 0;
    let tb = 0;
    let playerName = "";
    const teamTally = new Map();

    for (const e of entries) {
      if (safeText(e.iso) >= cutoff) continue;
      if (e.missedGame) continue;

      pa += toNumber(e.pa);
      ab += toNumber(e.ab);
      hits += toNumber(e.hits);
      runs += toNumber(e.runs);
      rbi += toNumber(e.rbi);
      bb += toNumber(e.bb);
      singles += toNumber(e.singles);
      doubles += toNumber(e.doubles);
      triples += toNumber(e.triples);
      hr += toNumber(e.hr);
      tb += toNumber(e.tb);

      if (!playerName && e.player) playerName = safeText(e.player);
      const code = safeText(e.teamCode).toUpperCase();
      if (code) teamTally.set(code, (teamTally.get(code) || 0) + 1);
    }

    if (pa <= 0) continue;
    if (tb <= 0) {
      tb = singles + doubles * 2 + triples * 3 + hr * 4;
    }

    let teamCode = "";
    let bestTeamN = 0;
    for (const [code, n] of teamTally.entries()) {
      if (n > bestTeamN) {
        teamCode = code;
        bestTeamN = n;
      }
    }

    out.set(norm, {
      Player: playerName || norm,
      Team: teamCode,
      PA: String(pa),
      AB: String(ab),
      Hits: String(hits),
      Runs: String(runs),
      RBI: String(rbi),
      BB: String(bb),
      "1B": String(singles),
      "2B": String(doubles),
      "3B": String(triples),
      HR: String(hr),
      TB: String(tb),
    });
  }

  return out;
}

module.exports = {
  filterScheduleGamesBeforeIso,
  buildStats2026ByPlayerFromGamelogsBefore,
  normalizePlayerName,
};
