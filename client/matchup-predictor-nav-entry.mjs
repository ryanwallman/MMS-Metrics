/**
 * GitHub Pages: redirect to the current / next upcoming slate (live schedule).
 */
import { loadWeeklySchedule } from "../lib/dfsLeaderboardScoringContext.js";
import {
  referenceIsoForScheduleYear,
  pickMatchupPredictorDefaultViewForMode,
} from "../lib/dfs.js";
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

function normalizeMode(raw) {
  return safeText(raw).toLowerCase() === "past" ? "past" : "future";
}

function matchupModeFromPath(pathname) {
  const p = safeText(pathname);
  if (/\/matchup-predictor\/past(?:\/|$)/i.test(p)) return "past";
  return "future";
}

function redirectLegacyMatchupPaths(pathname) {
  const p = safeText(pathname);
  if (p.replace(/\/$/, "") === sitePath("/matchup-predictor")) {
    window.location.replace(sitePath("/matchup-predictor/future"));
    return true;
  }
  if (/\/matchup-predictor\/view\//i.test(p) && !/\/matchup-predictor\/(?:past|future)\//i.test(p)) {
    window.location.replace(
      p.replace("/matchup-predictor/view/", "/matchup-predictor/future/view/")
    );
    return true;
  }
  return false;
}

function hasViewQueryParams(url) {
  if (url.searchParams.get("view")) return true;
  if (url.searchParams.get("week")) return true;
  const wed = (url.searchParams.get("wed") || "").replace(/^D/i, "");
  return /^\d{8}$/.test(wed);
}

function viewTokenFromPath(pathname) {
  const m =
    pathname.match(/\/matchup-predictor\/(?:past|future)\/view\/([^/]+)/i) ||
    pathname.match(/\/matchup-predictor\/view\/([^/]+)/i);
  return m ? decodeURIComponent(m[1]).toUpperCase() : "";
}

async function resolveDefaultViewToken(mode) {
  const normalized = normalizeMode(mode);
  try {
    const payload = await loadWeeklySchedule();
    const refIso = referenceIsoForScheduleYear(SCHEDULE_CALENDAR_YEAR);
    const view = safeText(
      pickMatchupPredictorDefaultViewForMode(payload, refIso, Date.now(), normalized)
    ).toUpperCase();
    if (view) return view;
  } catch {
    /* fall through to baked fallback */
  }
  try {
    const res = await fetch(sitePath(`/matchup-predictor/${normalized}/default-view.json`), {
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
  if (redirectLegacyMatchupPaths(pathname)) return;

  const url = new URL(window.location.href);
  if (hasViewQueryParams(url)) {
    hideLoadingOverlay();
    return;
  }

  const mode = matchupModeFromPath(pathname);
  const currentView = viewTokenFromPath(pathname);
  const isModeRoot = new RegExp(`/matchup-predictor/${mode}/?$`, "i").test(pathname.replace(/\/$/, ""));
  const hasMatchup = /\/matchup\//.test(pathname);

  if (hasMatchup) {
    hideLoadingOverlay();
    return;
  }

  if (isModeRoot) {
    try {
      sessionStorage.removeItem(USER_PICKED_VIEW_KEY);
    } catch {
      /* private mode */
    }
  }

  try {
    const active = await resolveDefaultViewToken(mode);
    if (!active) {
      hideLoadingOverlay();
      return;
    }

    const target = sitePath(`/matchup-predictor/${mode}/view/${encodeURIComponent(active)}`);
    const userPickedView = (() => {
      try {
        return sessionStorage.getItem(USER_PICKED_VIEW_KEY) === "1";
      } catch {
        return false;
      }
    })();

    if (isModeRoot) {
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
