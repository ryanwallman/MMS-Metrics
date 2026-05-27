/**
 * Browser: load league leaders from the published 2026 stats Google Sheet.
 */
import { load2026StatsByPlayer } from "../lib/stats2026Loader.js";
import { buildLeagueLeaders } from "../lib/leagueLeaders.js";

export async function fetchLeagueLeadersData() {
  const stats2026ByPlayer = await load2026StatsByPlayer();
  const players2026 = Array.from(stats2026ByPlayer.values());
  const fetchedAt = new Date().toISOString();
  return { ...buildLeagueLeaders(players2026), fetchedAt };
}

if (typeof window !== "undefined") {
  window.MmsLeagueLeaders = { fetchLeagueLeadersData };
}
