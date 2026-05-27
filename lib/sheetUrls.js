/**
 * Published sheet / CSV URLs for league data (browser + server).
 * Override via env when sheets move.
 */
const INDEX_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS4gZ_lSTJs9QfCC-FCDFLCSX8q88t6txvtDgKFinSQJqX0seyYhK5wHr0WwwjRaA1mxZdETC0CGNMz/pub?gid=1191877237&single=true&output=csv";
const SCHEDULE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS4gZ_lSTJs9QfCC-FCDFLCSX8q88t6txvtDgKFinSQJqX0seyYhK5wHr0WwwjRaA1mxZdETC0CGNMz/pub?gid=0&single=true&output=csv";
const ROSTER_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFhhdnzm2I_PVTkR4FDL-pbBhf_K53gMj6Pk5u8vtfYTXN9569QbdTRG9pZBuIFpQuWIpT9tJMbLY1/pub?gid=1722495492&single=true&output=csv";
const HIST_2025_STATS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj9_UhD3MyWbDfD3zlwO7mcOOjpcmSc2OrPYXa6UEeii422rpHFBBn2AXkf5KP_OKtJrcobvlT_J7d/pub?output=csv";

const SHEET_2026_GAMELOGS_ID = "1QGoXil2fphTqS-SlapUNgAOIDoI8uaQNXooW9h_oH2w";
const SHEET_2026_GAMELOGS_GID = "1060099039";
const SHEET_2026_STATS_ID = "1v1d1lfel2GYuaocKQubLSk4Yd7VeTTLDlLMU-HNnc7Q";
const SHEET_2026_STATS_GID = "1197022486";

/** Power rankings captain column only (captain_mapping tab). */
const CAPTAIN_MAPPING_SHEET_ID = "1xIQsuZQI5skEQ_KEic6cXDOaFDdX4oHXVtl9FBov0-o";
const CAPTAIN_MAPPING_GID = "0";

/** Default career stats for static hosting (copied to public/data/csv/career.csv). */
const CAREER_CSV_PUBLIC_URL = "/data/csv/career.csv";

const SCHEDULE_CALENDAR_YEAR = Number(process.env.SCHEDULE_CALENDAR_YEAR) || 2026;

let careerCsvFilePath = null;

/** Node server: path to data/csv/career.csv on disk. */
function setCareerCsvFilePath(filePath) {
  careerCsvFilePath = filePath ? String(filePath) : null;
}

function googleSheetCsvExportUrl(spreadsheetId, gid) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
}

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

function getCaptainMappingCsvUrl() {
  const u = process.env.CAPTAIN_MAPPING_CSV_URL;
  if (u && u.trim()) return u.trim();
  return googleSheetCsvExportUrl(CAPTAIN_MAPPING_SHEET_ID, CAPTAIN_MAPPING_GID);
}

function getCareerCsvSource() {
  const url = (process.env.CAREER_CSV_URL || "").trim();
  if (url) return { type: "url", url };
  if (careerCsvFilePath) return { type: "file", path: careerCsvFilePath };
  return { type: "url", url: CAREER_CSV_PUBLIC_URL };
}

function configureCareerCsvForBrowser(publicUrl = CAREER_CSV_PUBLIC_URL) {
  if (typeof globalThis !== "undefined") {
    globalThis.__MMS_CAREER_CSV_URL__ = publicUrl;
  }
}

function resolveCareerCsvSource() {
  const override =
    typeof globalThis !== "undefined" && globalThis.__MMS_CAREER_CSV_URL__
      ? String(globalThis.__MMS_CAREER_CSV_URL__).trim()
      : "";
  if (override) return { type: "url", url: override };
  return getCareerCsvSource();
}

module.exports = {
  INDEX_URL,
  SCHEDULE_URL,
  ROSTER_URL,
  HIST_2025_STATS_URL,
  CAREER_CSV_PUBLIC_URL,
  SCHEDULE_CALENDAR_YEAR,
  getGamelogs2026CsvUrl,
  getStats2026CsvUrl,
  getCaptainMappingCsvUrl,
  CAPTAIN_MAPPING_SHEET_ID,
  CAPTAIN_MAPPING_GID,
  googleSheetCsvExportUrl,
  setCareerCsvFilePath,
  getCareerCsvSource,
  resolveCareerCsvSource,
  configureCareerCsvForBrowser,
};
