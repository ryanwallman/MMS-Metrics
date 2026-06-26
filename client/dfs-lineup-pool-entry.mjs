/**
 * Browser: load DFS player pool + salaries from live Google Sheets.
 */
import { buildDfsLineupPageData } from "../lib/dfsLineupPageData.js";
import { refreshLivePlayerReplacements } from "../lib/playerReplacements.js";

export async function loadDfsLineupPool(slateToken, lineupNorms = []) {
  await refreshLivePlayerReplacements();
  return buildDfsLineupPageData({ slateToken, lineupNorms });
}

if (typeof window !== "undefined") {
  window.MmsDfsLineupPool = { loadDfsLineupPool };
}
