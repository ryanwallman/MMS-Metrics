/**
 * Browser: power rankings from published Google Sheets (schedule, stats, rosters, etc.).
 */
import { invalidateSourceCsvCache, SOURCE_KEYS } from "../lib/sheetUrls.js";
import { buildPowerRankingsPageData } from "../lib/powerRankingsPageData.js";

export async function fetchPowerRankingsData() {
  await invalidateSourceCsvCache(SOURCE_KEYS.schedule);
  return buildPowerRankingsPageData();
}

if (typeof window !== "undefined") {
  window.MmsPowerRankings = { fetchPowerRankingsData };
}
