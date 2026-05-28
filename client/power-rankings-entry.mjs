/**
 * Browser: power rankings from published Google Sheets (schedule, stats, rosters, etc.).
 */
import { buildPowerRankingsPageData } from "../lib/powerRankingsPageData.js";

export async function fetchPowerRankingsData() {
  return buildPowerRankingsPageData();
}

if (typeof window !== "undefined") {
  window.MmsPowerRankings = { fetchPowerRankingsData };
}
