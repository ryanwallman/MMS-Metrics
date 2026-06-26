/**
 * Live league data URLs — loaded from the metrics_sources Google Sheet registry.
 */
const { csvTextCache, invalidateCsvUrlCache } = require("./fetchCsvText");
const {
  SOURCE_KEYS,
  getMetricsSourceUrl,
  invalidateMetricsSourcesRegistry,
  loadMetricsSourcesRegistry,
  browserUrlToCsvFetchUrl,
  metricsSourcesRegistryCsvUrl,
  publishedCsvUrlFromSheetLink,
} = require("./metricsSourcesRegistry");

/** @deprecated Use live all-time stats from metrics_sources registry (B10). */
const HIST_2025_STATS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj9_UhD3MyWbDfD3zlwO7mcOOjpcmSc2OrPYXa6UEeii422rpHFBBn2AXkf5KP_OKtJrcobvlT_J7d/pub?output=csv";

/** Power rankings captain column — URL from metrics_sources registry. */
async function getCaptainMappingCsvUrl() {
  const u = process.env.CAPTAIN_MAPPING_CSV_URL;
  if (u && u.trim()) return u.trim();
  return getMetricsSourceUrl(SOURCE_KEYS.captainMapping);
}

const SCHEDULE_CALENDAR_YEAR = Number(process.env.SCHEDULE_CALENDAR_YEAR) || 2026;

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

async function getAllTimeStatsCsvUrl() {
  const override = (process.env.ALL_TIME_STATS_CSV_URL || "").trim();
  if (override) return publishedCsvUrlFromSheetLink(override);
  return getMetricsSourceUrl(SOURCE_KEYS.allTimeStats);
}

/** Invalidate cached CSV data for a live source (keeps URL registry cache). */
async function invalidateSourceCsvCache(sourceKey) {
  const registry = await loadMetricsSourcesRegistry();
  const url = registry[sourceKey];
  if (url) invalidateCsvUrlCache(url);
}

/** Drop cached registry + CSV for one live source (after URL change in registry sheet). */
async function invalidateLiveSourceCsvCache(sourceKey) {
  const registry = await loadMetricsSourcesRegistry();
  const url = registry[sourceKey];
  invalidateMetricsSourcesRegistry();
  if (url) invalidateCsvUrlCache(url);
}

module.exports = {
  HIST_2025_STATS_URL,
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
  getAllTimeStatsCsvUrl,
  googleSheetCsvExportUrl,
};
