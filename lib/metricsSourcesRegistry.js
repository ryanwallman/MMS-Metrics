"use strict";

/**
 * Live data URL registry — loaded from the metrics_sources Google Sheet at runtime.
 * https://docs.google.com/spreadsheets/d/1ZHYmP92Gr5mM8jH6N3q0js3zbdNjb9gnB_29o7fBRd4/edit
 */
const Papa = require("papaparse");
const { fetchCsvText } = require("./fetchCsvText");
const { createMemoryCache } = require("./memoryCache");

const METRICS_SOURCES_SHEET_ID = "1ZHYmP92Gr5mM8jH6N3q0js3zbdNjb9gnB_29o7fBRd4";
const METRICS_SOURCES_GID = "0";

const SOURCE_KEYS = Object.freeze({
  schedule: "schedule",
  index: "index",
  rosters: "rosters",
  gamelogs2026: "gamelogs2026",
  stats2026: "stats2026",
  replacements: "replacements",
  captainMapping: "captainMapping",
});

const REQUIRED_KEYS = Object.freeze([
  SOURCE_KEYS.schedule,
  SOURCE_KEYS.index,
  SOURCE_KEYS.rosters,
  SOURCE_KEYS.gamelogs2026,
  SOURCE_KEYS.stats2026,
  SOURCE_KEYS.replacements,
  SOURCE_KEYS.captainMapping,
]);

function safeText(value) {
  return (value || "").toString().trim();
}

function metricsSourcesRegistryCsvUrl() {
  const override = (process.env.METRICS_SOURCES_REGISTRY_CSV_URL || "").trim();
  if (override) return override;
  return `https://docs.google.com/spreadsheets/d/${METRICS_SOURCES_SHEET_ID}/export?format=csv&gid=${METRICS_SOURCES_GID}`;
}

function resolveSourceKey(name) {
  const n = safeText(name).toLowerCase();
  if (!n) return null;
  if (n === "schedule" || n.startsWith("schedule")) return SOURCE_KEYS.schedule;
  if (n.includes("league index") || n.includes("week / date")) return SOURCE_KEYS.index;
  if (n.includes("team rosters") || n === "rosters") return SOURCE_KEYS.rosters;
  if (n.includes("game log") || n.includes("gamelog")) return SOURCE_KEYS.gamelogs2026;
  if (n.includes("player / team stats") || n.includes("2026 player")) return SOURCE_KEYS.stats2026;
  if (n.includes("replacement")) return SOURCE_KEYS.replacements;
  if (n.includes("captain mapping") || n.includes("captain map")) return SOURCE_KEYS.captainMapping;
  return null;
}

/** Convert browser address-bar Google Sheet links to CSV fetch URLs. */
function browserUrlToCsvFetchUrl(input) {
  const url = safeText(input);
  if (!url) return "";
  if (/output=csv|format=csv/i.test(url)) return url;

  if (url.includes("/pubhtml")) {
    const gidMatch = url.match(/[?&]gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : "0";
    return `${url.split("/pubhtml")[0]}/pub?gid=${gid}&single=true&output=csv`;
  }

  const editMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)\/edit/);
  if (editMatch) {
    const id = editMatch[1];
    const gidMatch = url.match(/[#?&]gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : "0";
    return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
  }

  const pubMatch = url.match(/\/spreadsheets\/d\/(e\/[a-zA-Z0-9_-]+)/);
  if (pubMatch && !url.includes("/edit")) {
    const id = pubMatch[1];
    const gidMatch = url.match(/[?&]gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : "0";
    return `https://docs.google.com/spreadsheets/d/${id}/pub?gid=${gid}&single=true&output=csv`;
  }

  return url;
}

function parseRegistryCsv(csvText) {
  const rows = Papa.parse(csvText).data;
  const out = {};
  for (let i = 1; i < rows.length; i += 1) {
    const name = safeText(rows[i][0]);
    const rawUrl = safeText(rows[i][1]);
    if (!name || !rawUrl) continue;
    if (rawUrl.includes("console.firebase.google.com")) continue;
    const key = resolveSourceKey(name);
    if (!key) continue;
    out[key] = browserUrlToCsvFetchUrl(rawUrl);
  }
  return out;
}

const registryCache = createMemoryCache(
  Number(process.env.METRICS_SOURCES_CACHE_TTL_MS) || 5 * 60 * 1000,
  "metrics-sources"
);

async function loadMetricsSourcesRegistry(force = false) {
  if (force) registryCache.invalidate("registry");
  return registryCache.get("registry", async () => {
    const csvText = await fetchCsvText(metricsSourcesRegistryCsvUrl());
    const registry = parseRegistryCsv(csvText);
    for (const key of REQUIRED_KEYS) {
      if (!registry[key]) {
        throw new Error(`Metrics sources registry missing required row: ${key}`);
      }
    }
    return registry;
  });
}

function invalidateMetricsSourcesRegistry() {
  registryCache.invalidate("registry");
}

async function getMetricsSourceUrl(key) {
  const registry = await loadMetricsSourcesRegistry();
  const url = registry[key];
  if (!url) throw new Error(`Metrics sources registry missing URL for: ${key}`);
  return url;
}

module.exports = {
  SOURCE_KEYS,
  METRICS_SOURCES_SHEET_ID,
  metricsSourcesRegistryCsvUrl,
  browserUrlToCsvFetchUrl,
  loadMetricsSourcesRegistry,
  invalidateMetricsSourcesRegistry,
  getMetricsSourceUrl,
};
