/**
 * GitHub Pages: send /matchup-predictor to the DFS-open slate (live schedule).
 */
import { loadWeeklySchedule } from "../lib/dfsLeaderboardScoringContext.js";
import { referenceIsoForScheduleYear, pickMatchupPredictorDefaultView } from "../lib/dfs.js";
import { SCHEDULE_CALENDAR_YEAR } from "../lib/sheetUrls.js";

function sitePath(path) {
  const base =
    typeof window !== "undefined" && window.__SITE_BASE_PATH__ != null
      ? String(window.__SITE_BASE_PATH__)
      : "";
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function hasViewQueryParams(url) {
  if (url.searchParams.get("view")) return true;
  if (url.searchParams.get("week")) return true;
  const wed = (url.searchParams.get("wed") || "").replace(/^D/i, "");
  return /^\d{8}$/.test(wed);
}

export async function ensureMatchupPredictorActiveView() {
  const path = window.location.pathname || "";
  if (path.includes("/view/")) return;

  const url = new URL(window.location.href);
  if (hasViewQueryParams(url)) return;

  const payload = await loadWeeklySchedule();
  const refIso = referenceIsoForScheduleYear(SCHEDULE_CALENDAR_YEAR);
  const active = pickMatchupPredictorDefaultView(payload, refIso);
  if (!active) return;

  const target = sitePath(`/matchup-predictor/view/${encodeURIComponent(active)}`);
  if (path.endsWith(target) || path.includes(`/view/${encodeURIComponent(active)}`)) return;

  window.location.replace(target);
}

if (typeof window !== "undefined") {
  ensureMatchupPredictorActiveView().catch((err) => {
    console.error("Matchup predictor schedule redirect failed", err);
  });
}
