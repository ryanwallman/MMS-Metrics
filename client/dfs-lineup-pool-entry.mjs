/**
 * Browser: load DFS player pool + salaries from live Google Sheets.
 */
import { configureCareerCsvForBrowser } from "../lib/sheetUrls.js";
import { buildDfsLineupPageData } from "../lib/dfsLineupPageData.js";
import { refreshLivePlayerReplacements } from "../lib/playerReplacements.js";

const careerCsvUrl =
  (typeof window !== "undefined" && window.__MMS_CAREER_CSV_URL__) ||
  "/data/csv/career.csv";
configureCareerCsvForBrowser(careerCsvUrl);

export async function loadDfsLineupPool(slateToken, lineupNorms = []) {
  await refreshLivePlayerReplacements();
  return buildDfsLineupPageData({ slateToken, lineupNorms });
}

if (typeof window !== "undefined") {
  window.MmsDfsLineupPool = { loadDfsLineupPool };
}
