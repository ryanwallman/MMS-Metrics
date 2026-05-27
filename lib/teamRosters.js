/**
 * Team index + roster grid from published Google Sheets (shared by server + scoring bundle).
 */
const Papa = require("papaparse");
const { canonicalRostersByTeamId } = require("../data/customRosters2026");
const { fetchCsvText } = require("./fetchCsvText");
const { INDEX_URL, ROSTER_URL } = require("./sheetUrls");

function safeText(value) {
  return (value || "").toString().trim();
}

async function fetchCsvRows(url) {
  const csvText = await fetchCsvText(url);
  return Papa.parse(csvText).data;
}

function buildTeamMap(indexRows) {
  const teamMap = new Map();

  for (let i = 1; i < indexRows.length; i += 1) {
    const row = indexRows[i];
    const teamId = safeText(row[4]); // Column E — Team #
    const captain = safeText(row[5]); // Column F — CAPTAINS
    const teamName = safeText(row[7]); // Column H — TEAM NAME
    const jerseyColor = safeText(row[10]) || "#1f2937"; // Column K — Primary Color
    const numberColor = safeText(row[11]) || "#ffffff"; // Column L — Secondary Color
    if (!teamId || !captain) continue;
    teamMap.set(teamId, { teamId, captain, teamName, jerseyColor, numberColor });
  }

  return teamMap;
}

/** Roster sheet: captains on row 2 / 17, players in columns below each captain. */
function buildRosterByCaptain(rosterRows) {
  const rosterMap = new Map();

  function extractRosterRange(captainRowIndex, playerStartRowIndex, startCol, endCol) {
    for (let col = startCol; col <= endCol; col += 1) {
      const captain = safeText(rosterRows[captainRowIndex] && rosterRows[captainRowIndex][col]);
      if (!captain) continue;

      const players = [];
      for (let r = playerStartRowIndex; r < playerStartRowIndex + 13; r += 1) {
        const player = safeText(rosterRows[r] && rosterRows[r][col]);
        if (player) players.push(player);
      }

      rosterMap.set(captain, players);
    }
  }

  extractRosterRange(1, 3, 0, 18); // Top half
  extractRosterRange(16, 18, 0, 18); // Bottom half
  return rosterMap;
}

function normalizeScheduleTeamId(id) {
  const n = Number(safeText(id).replace(/\s+/g, ""));
  return Number.isInteger(n) && n >= 1 && n <= 18 ? String(n) : safeText(id);
}

/** Lowercase + collapse spaces — must match server schedule.ejs normalization. */
function normalizeScheduleTeamLabel(value) {
  return safeText(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function buildNameToTeamIdMap(teams) {
  const nameToTeamId = {};
  for (const t of teams) {
    const key = normalizeScheduleTeamLabel(t.teamName);
    if (key && nameToTeamId[key] === undefined) nameToTeamId[key] = t.teamId;
  }
  return nameToTeamId;
}

function buildRosterByTeamId(teams) {
  const rosterByTeamId = {};
  for (const t of teams) {
    const entry = {
      teamName: t.teamName,
      captain: t.captain || "",
      jerseyColor: t.jerseyColor,
      numberColor: t.numberColor,
      players: Array.isArray(t.players) ? t.players : [],
    };
    rosterByTeamId[String(t.teamId)] = entry;
    rosterByTeamId[normalizeScheduleTeamId(t.teamId)] = entry;
  }
  return rosterByTeamId;
}

/**
 * Same roster/captain resolution as the matchup predictor (team #, then schedule name).
 */
function pickRosterEntry(rosterByTeamId, nameToTeamId, teamId, displayName) {
  const id = safeText(teamId);
  let entry = id && rosterByTeamId[id] ? rosterByTeamId[id] : null;

  if (entry && Array.isArray(entry.players) && entry.players.length) {
    return { ...entry, teamId: id };
  }

  const altKey = normalizeScheduleTeamLabel(displayName);
  const altId = altKey ? nameToTeamId[altKey] : null;
  const altEntry =
    altId != null && altId !== "" ? rosterByTeamId[String(altId)] : null;
  if (altEntry && Array.isArray(altEntry.players) && altEntry.players.length) {
    return { ...altEntry, teamId: String(altId) };
  }

  if (entry) return { ...entry, teamId: id };
  if (altEntry) return { ...altEntry, teamId: String(altId) };
  return {
    teamId: id || String(altId || ""),
    teamName: safeText(displayName) || "Team",
    captain: "",
    jerseyColor: "",
    numberColor: "",
    players: [],
  };
}

function resolveTeamCaptain(teamId, teamName, teams) {
  const rosterByTeamId = buildRosterByTeamId(teams);
  const nameToTeamId = buildNameToTeamIdMap(teams);
  return pickRosterEntry(rosterByTeamId, nameToTeamId, teamId, teamName).captain || "";
}

async function loadTeamRosterContext() {
  const [indexRows, rosterRows] = await Promise.all([
    fetchCsvRows(INDEX_URL),
    fetchCsvRows(ROSTER_URL),
  ]);

  const teamMap = buildTeamMap(indexRows);
  const rosterByCaptain = buildRosterByCaptain(rosterRows);
  const teams = [];

  for (let id = 1; id <= 18; id += 1) {
    const teamId = String(id);
    const teamMeta = teamMap.get(teamId) || { teamId, captain: "", teamName: `Team ${teamId}` };
    const players =
      canonicalRostersByTeamId[teamId] ||
      rosterByCaptain.get(teamMeta.captain) ||
      [];
    teams.push({ ...teamMeta, players });
  }

  return { teams, rosterByCaptain };
}

async function loadTeamRosters() {
  const { teams } = await loadTeamRosterContext();
  return teams;
}

module.exports = {
  buildTeamMap,
  buildRosterByCaptain,
  buildNameToTeamIdMap,
  buildRosterByTeamId,
  pickRosterEntry,
  resolveTeamCaptain,
  loadTeamRosterContext,
  loadTeamRosters,
  normalizeScheduleTeamId,
  normalizeScheduleTeamLabel,
};
