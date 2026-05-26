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

async function loadTeamRosters() {
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

  return teams;
}

module.exports = {
  buildTeamMap,
  buildRosterByCaptain,
  loadTeamRosters,
};
