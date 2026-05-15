const path = require("path");

const REPO_ROOT = path.join(__dirname, "..");
const DATA_CSV = path.join(REPO_ROOT, "data", "csv");
const DATA_TEMPLATES = path.join(REPO_ROOT, "data", "templates");

/** Built from your sheet URLs: …/d/{id}/edit?gid={gid} → export?format=csv&gid= */
const SHEET_2026_GAMELOGS_ID = "1QGoXil2fphTqS-SlapUNgAOIDoI8uaQNXooW9h_oH2w";
const SHEET_2026_GAMELOGS_GID = "1060099039";
const SHEET_2026_STATS_ID = "1v1d1lfel2GYuaocKQubLSk4Yd7VeTTLDlLMU-HNnc7Q";
const SHEET_2026_STATS_GID = "1197022486";

function googleSheetCsvExportUrl(spreadsheetId, gid) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
}

/** Override with env for tests or if the sheet moves. */
function getGamelogs2026CsvUrl() {
  const u = process.env.GAMELOGS_2026_CSV_URL;
  if (u && u.trim()) return u.trim();
  return googleSheetCsvExportUrl(SHEET_2026_GAMELOGS_ID, SHEET_2026_GAMELOGS_GID);
}

function getStats2026CsvUrl() {
  const u = process.env.STATS_2026_CSV_URL;
  if (u && u.trim()) return u.trim();
  return googleSheetCsvExportUrl(SHEET_2026_STATS_ID, SHEET_2026_STATS_GID);
}

/** League CSV files still read from disk (optional local copies in repo). */
module.exports = {
  REPO_ROOT,
  DATA_CSV,
  DATA_TEMPLATES,
  getGamelogs2026CsvUrl,
  getStats2026CsvUrl,
  googleSheetCsvExportUrl,
  CSV_CAREER: path.join(DATA_CSV, "career.csv"),
  CSV_2025_STATS: path.join(DATA_CSV, "stats2025.csv"),
  XLSX_DEFENSIVE_TEMPLATE: path.join(
    DATA_TEMPLATES,
    "mms_defensive_ratings_2026_template.xlsx"
  ),
};
