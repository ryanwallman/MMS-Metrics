/**
 * Browser: team analytics from live 2026 game logs (Google Sheets).
 */
import { buildTeamAnalyticsPageData } from "../lib/teamAnalyticsPageData.js";

export async function fetchTeamAnalyticsData(teamId = null) {
  return buildTeamAnalyticsPageData(teamId);
}

if (typeof window !== "undefined") {
  window.MmsTeamAnalytics = { fetchTeamAnalyticsData };
}
