/**
 * Captain names for power rankings — URL from metrics_sources registry.
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
  const teamCodeById = new Map();

  if (!rows?.length) return { byTeamId, byLabel, teamCodeById };

  const header = (rows[0] || []).map((x) => safeText(x));
  const hasNamedHeader = header.some((h) => /team name/i.test(h) || /team id/i.test(h));
  let startRow = hasNamedHeader ? 1 : 0;

  let colTeamLabel = 0;
  let colCaptain = 1;
  let colTeamCode = -1;
  if (hasNamedHeader) {
    colTeamLabel = header.findIndex((h) => /team name/i.test(h));
    colCaptain = header.findIndex((h) => /^captain$/i.test(h));
    colTeamCode = header.findIndex((h) => /team id/i.test(h));
    if (colTeamLabel < 0) colTeamLabel = 0;
    if (colCaptain < 0) colCaptain = 1;
  }

  for (let i = startRow; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || !row.length) continue;
    const teamLabel = safeText(row[colTeamLabel]);
    const captain = safeText(row[colCaptain]);
    if (!teamLabel || !captain) continue;

    const teamId = extractTeamIdFromLabel(teamLabel);
    if (teamId) byTeamId.set(teamId, captain);
    byLabel.set(normalizeCaptainLookupLabel(teamLabel), captain);

    const teamCode =
      colTeamCode >= 0 ? safeText(row[colTeamCode]).toUpperCase() : "";
    if (teamId && teamCode) teamCodeById.set(teamId, teamCode);
  }

  return { byTeamId, byLabel, teamCodeById };
}

async function loadCaptainTeamCodeById() {
  const map = await loadPowerRankingsCaptainMap();
  return map?.teamCodeById || new Map();
}

async function loadPowerRankingsCaptainMap() {
  return captainMapCache.get("map", async () => {
    const url = await getCaptainMappingCsvUrl();
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
  loadCaptainTeamCodeById,
  lookupPowerRankingsCaptain,
  parseCaptainMappingRows,
  extractTeamIdFromLabel,
};
