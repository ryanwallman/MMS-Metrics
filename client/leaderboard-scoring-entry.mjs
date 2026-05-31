/**
 * Browser bundle entry: score DFS leaderboard lineups using runtime sheet CSVs.
 */
import { configureCareerCsvForBrowser } from "../lib/sheetUrls.js";
import { buildWeeklyLeaderboardResponse } from "../lib/dfsLeaderboardResponse.js";
import { loadWeeklySchedule } from "../lib/dfsLeaderboardScoringContext.js";
import {
  referenceIsoForScheduleYear,
  resolveActiveDfsSlateToken,
  resolveMostRecentlyLockedSlateToken,
} from "../lib/dfs.js";
import { SCHEDULE_CALENDAR_YEAR } from "../lib/sheetUrls.js";

const careerCsvUrl =
  (typeof window !== "undefined" && window.__MMS_CAREER_CSV_URL__) ||
  "/data/csv/career.csv";
configureCareerCsvForBrowser(careerCsvUrl);

export async function scoreWeeklyLeaderboard(selectedWeek, lineups) {
  return buildWeeklyLeaderboardResponse(selectedWeek, lineups);
}

export async function fetchLiveSlateDefaults() {
  const payload = await loadWeeklySchedule();
  const refIso = referenceIsoForScheduleYear(SCHEDULE_CALENDAR_YEAR);
  const nowMs = Date.now();
  return {
    activeSlateToken: resolveActiveDfsSlateToken(payload, refIso, nowMs),
    defaultLockedSlateToken: resolveMostRecentlyLockedSlateToken(payload, refIso, nowMs),
  };
}

if (typeof window !== "undefined") {
  window.MmsLeaderboardScoring = { scoreWeeklyLeaderboard, fetchLiveSlateDefaults };
}
