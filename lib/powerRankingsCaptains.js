/**
 * Captain names for power rankings only — from captain_mapping Google Sheet.
 * https://docs.google.com/spreadsheets/d/1xIQsuZQI5skEQ_KEic6cXDOaFDdX4oHXVtl9FBov0-o/
 */
const Papa = require("papaparse");
const { fetchCsvText } = require("./fetchCsvText");
const { getCaptainMappingCsvUrl } = require("./sheetUrls");
const { createMemoryCache } = require("./memoryCache");
const { normalizeScheduleTeamId } = require("./teamRosters");

const captainMapCache = createMemoryCache(
  Number(process.env.CAPTAIN_MAPPING_CACHE_TTL_MS) ||
    Number(process.env.CSV_CACHE_TTL_MS) ||
    10 * 60 * 1000,
  "power-rankings-captains"
);

function safeText(value) {
  return (value || "").toString().trim();
}

/** Match sheet column A labels like "PRINCETON BRAIN & SPINE (#3)". */
function extractTeamIdFromLabel(label) {
  const m = safeText(label).match(/\(#\s*(\d{1,2})\s*\)/i);
  if (!m) return "";
  const n = Number(m[1]);
  return Number.isInteger(n) && n >= 1 && n <= 18 ? String(n) : "";
}

function normalizeCaptainLookupLabel(label) {
  return safeText(label)
    .replace(/&amp;/gi, "&")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseCaptainMappingRows(rows) {
  const byTeamId = new Map();
  const byLabel = new Map();

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || !row.length) continue;
    const teamLabel = safeText(row[0]);
    const captain = safeText(row[1]);
    if (!teamLabel || !captain) continue;

    const teamId = extractTeamIdFromLabel(teamLabel);
    if (teamId) byTeamId.set(teamId, captain);
    byLabel.set(normalizeCaptainLookupLabel(teamLabel), captain);
  }

  return { byTeamId, byLabel };
}

async function loadPowerRankingsCaptainMap() {
  return captainMapCache.get("map", async () => {
    const url = getCaptainMappingCsvUrl();
    const csvText = await fetchCsvText(url);
    const rows = Papa.parse(csvText).data;
    return parseCaptainMappingRows(rows);
  });
}

function lookupPowerRankingsCaptain(captainMap, teamId, teamName) {
  if (!captainMap) return "";
  const id = normalizeScheduleTeamId(teamId);
  if (id && captainMap.byTeamId.has(id)) {
    return captainMap.byTeamId.get(id);
  }

  const displayLabel = `${safeText(teamName)} (#${id})`;
  const byDisplay = captainMap.byLabel.get(normalizeCaptainLookupLabel(displayLabel));
  if (byDisplay) return byDisplay;

  const byName = captainMap.byLabel.get(normalizeCaptainLookupLabel(teamName));
  return byName || "";
}

module.exports = {
  loadPowerRankingsCaptainMap,
  lookupPowerRankingsCaptain,
  parseCaptainMappingRows,
  extractTeamIdFromLabel,
};
