"use strict";

/** localStorage key prefix for per-matchup bench (missing) player norms. */
const STORAGE_PREFIX = "mms-matchup-lineup:";
const STORAGE_VERSION = 1;

function normalizeBenchList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => String(x || "").trim()).filter(Boolean);
}

/**
 * Load benched (missing) player norms for a matchup.
 * Supports legacy shape `{ away, home }` and current `{ awayBench, homeBench }`.
 */
function loadBenchForMatchup(matchupKey) {
  if (!matchupKey) return { awayBench: [], homeBench: [] };
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + matchupKey);
    if (!raw) return { awayBench: [], homeBench: [] };
    const data = JSON.parse(raw);
    return {
      awayBench: normalizeBenchList(data.awayBench ?? data.away),
      homeBench: normalizeBenchList(data.homeBench ?? data.home),
    };
  } catch {
    return { awayBench: [], homeBench: [] };
  }
}

function saveBenchForMatchup(matchupKey, awayBench, homeBench) {
  if (!matchupKey) return;
  localStorage.setItem(
    STORAGE_PREFIX + matchupKey,
    JSON.stringify({
      version: STORAGE_VERSION,
      awayBench: normalizeBenchList(awayBench),
      homeBench: normalizeBenchList(homeBench),
      updatedAt: new Date().toISOString(),
    })
  );
}

function benchSortedKey(arr) {
  return [...normalizeBenchList(arr)].sort().join(",");
}

module.exports = {
  STORAGE_PREFIX,
  STORAGE_VERSION,
  loadBenchForMatchup,
  saveBenchForMatchup,
  benchSortedKey,
  normalizeBenchList,
};
