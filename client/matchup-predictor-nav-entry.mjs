/**
 * GitHub Pages: redirect to the current / next upcoming slate (live schedule).
 */
import { loadWeeklySchedule } from "../lib/dfsLeaderboardScoringContext.js";
import { referenceIsoForScheduleYear, pickMatchupPredictorDefaultView } from "../lib/dfs.js";
import { SCHEDULE_CALENDAR_YEAR } from "../lib/sheetUrls.js";

const USER_PICKED_VIEW_KEY = "mms-matchup-user-picked-view";

function hideLoadingOverlay() {
  if (typeof window !== "undefined" && window.MmsLoadingScreen) {
    window.MmsLoadingScreen.hide();
  }
}

function sitePath(path) {
  const base =
    typeof window !== "undefined" && window.__SITE_BASE_PATH__ != null
      ? String(window.__SITE_BASE_PATH__)
      : "";
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function safeText(value) {
  return (value || "").toString().trim();
}

function hasViewQueryParams(url) {
  if (url.searchParams.get("view")) return true;
  if (url.searchParams.get("week")) return true;
  const wed = (url.searchParams.get("wed") || "").replace(/^D/i, "");
  return /^\d{8}$/.test(wed);
}

function viewTokenFromPath(pathname) {
  const m = pathname.match(/\/matchup-predictor\/view\/([^/]+)/i);
  return m ? decodeURIComponent(m[1]).toUpperCase() : "";
}

async function resolveDefaultViewToken() {
  try {
    const payload = await loadWeeklySchedule();
    const refIso = referenceIsoForScheduleYear(SCHEDULE_CALENDAR_YEAR);
    const view = safeText(pickMatchupPredictorDefaultView(payload, refIso)).toUpperCase();
    if (view) return view;
  } catch {
    /* fall through to baked fallback */
  }
  try {
    const res = await fetch(sitePath("/matchup-predictor/default-view.json"), {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      const view = safeText(data?.view).toUpperCase();
      if (view) return view;
    }
  } catch {
    /* no fallback */
  }
  return "";
}

export async function ensureMatchupPredictorActiveView() {
  const pathname = window.location.pathname || "";
  const url = new URL(window.location.href);
  if (hasViewQueryParams(url)) {
    hideLoadingOverlay();
    return;
  }

  const currentView = viewTokenFromPath(pathname);
  const isRoot = !currentView;
  const hasMatchup = /\/matchup\//.test(pathname);

  if (isRoot) {
    try {
      sessionStorage.removeItem(USER_PICKED_VIEW_KEY);
    } catch {
      /* private mode */
    }
  }

  try {
    const active = await resolveDefaultViewToken();
    if (!active) {
      hideLoadingOverlay();
      return;
    }

    const target = sitePath(`/matchup-predictor/view/${encodeURIComponent(active)}`);
    const userPickedView = (() => {
      try {
        return sessionStorage.getItem(USER_PICKED_VIEW_KEY) === "1";
      } catch {
        return false;
      }
    })();

    if (isRoot) {
      if (!pathname.includes(`/view/${encodeURIComponent(active)}`)) {
        window.location.replace(target);
        return;
      }
      hideLoadingOverlay();
      return;
    }

    if (!hasMatchup && !userPickedView && currentView && currentView !== active) {
      window.location.replace(target);
      return;
    }

    hideLoadingOverlay();
  } catch (err) {
    hideLoadingOverlay();
    throw err;
  }
}

export function markMatchupUserPickedView() {
  try {
    sessionStorage.setItem(USER_PICKED_VIEW_KEY, "1");
  } catch {
    /* private mode */
  }
}

if (typeof window !== "undefined") {
  ensureMatchupPredictorActiveView().catch((err) => {
    console.error("Matchup predictor schedule redirect failed", err);
  });
}
