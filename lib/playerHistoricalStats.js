"use strict";

const Papa = require("papaparse");
const { normalizePlayerName } = require("./dfs");

function safeText(value) {
  return (value || "").toString().trim();
}

function toNumber(value) {
  const n = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function headerIndex(headers, candidates) {
  const lower = headers.map((h) => safeText(h).toLowerCase());
  for (const c of candidates) {
    const i = lower.indexOf(c);
    if (i >= 0) return i;
  }
  return -1;
}

/** Parse league all-time / career batting totals CSV into a normalized player map. */
function parsePlayerHistoricalStatsCsv(csvText) {
  const rows = Papa.parse(csvText).data;
  const headers = (rows[0] || []).map((h) => safeText(h));
  const dataRows = rows.slice(1);
  const idx = {
    name: headerIndex(headers, ["player_name", "player", "name"]),
    seasons: headerIndex(headers, ["seasons"]),
    pa: headerIndex(headers, ["pa"]),
    ab: headerIndex(headers, ["ab"]),
    h: headerIndex(headers, ["h", "hits"]),
    r: headerIndex(headers, ["r", "runs"]),
    rbi: headerIndex(headers, ["rbi"]),
    bb: headerIndex(headers, ["bb"]),
    tb: headerIndex(headers, ["tb"]),
    singles: headerIndex(headers, ["1b", "singles"]),
    doubles: headerIndex(headers, ["2b", "doubles"]),
    triples: headerIndex(headers, ["3b", "triples"]),
    hr: headerIndex(headers, ["hr", "home runs"]),
  };

  if (idx.name === -1) {
    throw new Error("All-time stats CSV missing player name column.");
  }

  const byPlayer = new Map();
  for (const row of dataRows) {
    const name = safeText(row[idx.name]);
    if (!name) continue;

    const ab = idx.ab >= 0 ? toNumber(row[idx.ab]) : 0;
    const bb = idx.bb >= 0 ? toNumber(row[idx.bb]) : 0;
    const h = idx.h >= 0 ? toNumber(row[idx.h]) : 0;
    const r = idx.r >= 0 ? toNumber(row[idx.r]) : 0;
    const rbi = idx.rbi >= 0 ? toNumber(row[idx.rbi]) : 0;
    let tb = idx.tb >= 0 ? toNumber(row[idx.tb]) : 0;
    if (tb <= 0 && idx.singles >= 0) {
      const singles = toNumber(row[idx.singles]);
      const doubles = idx.doubles >= 0 ? toNumber(row[idx.doubles]) : 0;
      const triples = idx.triples >= 0 ? toNumber(row[idx.triples]) : 0;
      const hr = idx.hr >= 0 ? toNumber(row[idx.hr]) : 0;
      tb = singles + doubles * 2 + triples * 3 + hr * 4;
    }
    const pa = idx.pa >= 0 ? toNumber(row[idx.pa]) : ab + bb;

    byPlayer.set(normalizePlayerName(name), {
      player: name,
      seasons: idx.seasons >= 0 ? toNumber(row[idx.seasons]) : null,
      pa,
      ab,
      h,
      r,
      rbi,
      bb,
      tb,
    });
  }

  return byPlayer;
}

/** Parse 2025 season batting totals CSV (legacy column layout). */
function parse2025SeasonStatsCsv(csvText) {
  const rows = Papa.parse(csvText).data;
  const headers = (rows[0] || []).map((h) => safeText(h));
  const dataRows = rows.slice(1);
  const nameIndex = headerIndex(headers, ["player", "player_name", "name"]);
  if (nameIndex === -1) {
    throw new Error("2025 season stats CSV missing Player column.");
  }

  const byPlayer = new Map();
  for (const row of dataRows) {
    const playerName = safeText(row[nameIndex]);
    if (!playerName) continue;
    const singles = toNumber(row[6]);
    const doubles = toNumber(row[7]);
    const triples = toNumber(row[8]);
    const homers = toNumber(row[9]);
    const bb = toNumber(row[10]);
    const ab = toNumber(row[2]);
    byPlayer.set(normalizePlayerName(playerName), {
      player: playerName,
      team: safeText(row[1]),
      pa: ab + bb,
      ab,
      h: toNumber(row[3]),
      r: toNumber(row[4]),
      rbi: toNumber(row[5]),
      bb,
      tb: singles + doubles * 2 + triples * 3 + homers * 4,
    });
  }
  return byPlayer;
}

module.exports = {
  parsePlayerHistoricalStatsCsv,
  parse2025SeasonStatsCsv,
};
