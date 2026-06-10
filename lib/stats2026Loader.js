/**
 * 2026 season stats CSV (Google Sheet publish URL).
 */
const Papa = require("papaparse");
const { fetchCsvText } = require("./fetchCsvText");
const { getStats2026CsvUrl } = require("./sheetUrls");
const { normalizePlayerName } = require("./dfs");

function safeText(value) {
  return (value || "").toString().trim();
}

async function load2026StatsByPlayer() {
  const csvText = await fetchCsvText(await getStats2026CsvUrl());
  const rows = Papa.parse(csvText).data;
  const headers = (rows[1] || []).map((h) => safeText(h));
  const dataRows = rows.slice(2);
  const nameIndex = headers.findIndex((h) => h.toLowerCase() === "player");
  if (nameIndex === -1) {
    throw new Error("2026 stats CSV missing Player column.");
  }

  const statsByPlayer = new Map();
  for (const row of dataRows) {
    const playerName = safeText(row[nameIndex]);
    if (!playerName) continue;
    const stats = {};
    for (let i = 0; i < headers.length; i += 1) {
      stats[headers[i]] = safeText(row[i]);
    }
    statsByPlayer.set(normalizePlayerName(playerName), stats);
  }
  return statsByPlayer;
}

module.exports = { load2026StatsByPlayer };
