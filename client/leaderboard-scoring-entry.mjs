/**
 * Browser bundle entry: score DFS leaderboard lineups using runtime sheet CSVs.
 */
import { configureCareerCsvForBrowser } from "../lib/sheetUrls.js";
import { buildWeeklyLeaderboardResponse } from "../lib/dfsLeaderboardResponse.js";

const careerCsvUrl =
  (typeof window !== "undefined" && window.__MMS_CAREER_CSV_URL__) ||
  "/data/csv/career.csv";
configureCareerCsvForBrowser(careerCsvUrl);

export async function scoreWeeklyLeaderboard(selectedWeek, lineups) {
  return buildWeeklyLeaderboardResponse(selectedWeek, lineups);
}

if (typeof window !== "undefined") {
  window.MmsLeaderboardScoring = { scoreWeeklyLeaderboard };
}
