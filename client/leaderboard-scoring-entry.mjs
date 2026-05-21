/**
 * Browser bundle entry: score DFS leaderboard lineups using runtime sheet CSVs.
 */
import { configureCareerCsvForBrowser } from "../lib/sheetUrls.js";
import { buildWeeklyLeaderboardResponse } from "../lib/dfsLeaderboardResponse.js";

configureCareerCsvForBrowser("/data/csv/career.csv");

export async function scoreWeeklyLeaderboard(selectedWeek, lineups) {
  return buildWeeklyLeaderboardResponse(selectedWeek, lineups);
}

if (typeof window !== "undefined") {
  window.MmsLeaderboardScoring = { scoreWeeklyLeaderboard };
}
