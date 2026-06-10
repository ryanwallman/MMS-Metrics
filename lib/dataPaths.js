const path = require("path");

const REPO_ROOT = path.join(__dirname, "..");
const DATA_CSV = path.join(REPO_ROOT, "data", "csv");
const DATA_TEMPLATES = path.join(REPO_ROOT, "data", "templates");

const { getGamelogs2026CsvUrl, getStats2026CsvUrl, googleSheetCsvExportUrl } = require("./sheetUrls");

/** League CSV files still read from disk (optional local copies in repo). */
module.exports = {
  REPO_ROOT,
  DATA_CSV,
  DATA_TEMPLATES,
  getGamelogs2026CsvUrl,
  getStats2026CsvUrl,
  googleSheetCsvExportUrl,
  CSV_CAREER: path.join(DATA_CSV, "career.csv"),
  /** Optional local copy; live app uses Google Sheet. See `archive/reference/stats2025.csv`. */
  CSV_2025_STATS: path.join(REPO_ROOT, "archive", "reference", "stats2025.csv"),
  XLSX_DEFENSIVE_TEMPLATE: path.join(
    DATA_TEMPLATES,
    "mms_defensive_ratings_2026_template.xlsx"
  ),
};
