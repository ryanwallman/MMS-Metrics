/**
 * Live league data URLs — loaded from the metrics_sources Google Sheet registry.
 * Static / historical sources (2025 stats, career file) stay here.
 */
const { csvTextCache } = require("./fetchCsvText");
const {
  SOURCE_KEYS,
  getMetricsSourceUrl,
  invalidateMetricsSourcesRegistry,
  loadMetricsSourcesRegistry,
  browserUrlToCsvFetchUrl,
  metricsSourcesRegistryCsvUrl,
} = require("./metricsSourcesRegistry");

/** 2025 season stats (historical; not in live registry). */
const HIST_2025_STATS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj9_UhD3MyWbDfD3zlwO7mcOOjpcmSc2OrPYXa6UEeii422rpHFBBn2AXkf5KP_OKtJrcobvlT_J7d/pub?output=csv";

/** Power rankings captain column — URL from metrics_sources registry. */
async function getCaptainMappingCsvUrl() {
  const u = process.env.CAPTAIN_MAPPING_CSV_URL;
  if (u && u.trim()) return u.trim();
  return getMetricsSourceUrl(SOURCE_KEYS.captainMapping);
}

/** Default career stats for static hosting (copied to public/data/csv/career.csv). */
const CAREER_CSV_PUBLIC_URL = "/data/csv/career.csv";

const SCHEDULE_CALENDAR_YEAR = Number(process.env.SCHEDULE_CALENDAR_YEAR) || 2026;

let careerCsvFilePath = null;

function googleSheetCsvExportUrl(spreadsheetId, gid) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
}

async function getScheduleUrl() {
  return getMetricsSourceUrl(SOURCE_KEYS.schedule);
}

async function getIndexUrl() {
  return getMetricsSourceUrl(SOURCE_KEYS.index);
}

async function getRosterUrl() {
  return getMetricsSourceUrl(SOURCE_KEYS.rosters);
}

async function getGamelogs2026CsvUrl() {
  return getMetricsSourceUrl(SOURCE_KEYS.gamelogs2026);
}

async function getStats2026CsvUrl() {
  return getMetricsSourceUrl(SOURCE_KEYS.stats2026);
}

async function getReplacementsCsvUrl() {
  return getMetricsSourceUrl(SOURCE_KEYS.replacements);
}

function setCareerCsvFilePath(filePath) {
  careerCsvFilePath = filePath ? String(filePath) : null;
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

/** Invalidate cached CSV data for a live source (keeps URL registry cache). */
async function invalidateSourceCsvCache(sourceKey) {
  const registry = await loadMetricsSourcesRegistry();
  const url = registry[sourceKey];
  if (url) csvTextCache.invalidate(url);
}

/** Drop cached registry + CSV for one live source (after URL change in registry sheet). */
async function invalidateLiveSourceCsvCache(sourceKey) {
  const registry = await loadMetricsSourcesRegistry();
  const url = registry[sourceKey];
  invalidateMetricsSourcesRegistry();
  if (url) csvTextCache.invalidate(url);
}

module.exports = {
  HIST_2025_STATS_URL,
  CAREER_CSV_PUBLIC_URL,
  SCHEDULE_CALENDAR_YEAR,
  SOURCE_KEYS,
  metricsSourcesRegistryCsvUrl,
  browserUrlToCsvFetchUrl,
  loadMetricsSourcesRegistry,
  invalidateMetricsSourcesRegistry,
  invalidateSourceCsvCache,
  invalidateLiveSourceCsvCache,
  getScheduleUrl,
  getIndexUrl,
  getRosterUrl,
  getGamelogs2026CsvUrl,
  getStats2026CsvUrl,
  getCaptainMappingCsvUrl,
  getReplacementsCsvUrl,
  googleSheetCsvExportUrl,
  setCareerCsvFilePath,
  getCareerCsvSource,
  resolveCareerCsvSource,
  configureCareerCsvForBrowser,
};
