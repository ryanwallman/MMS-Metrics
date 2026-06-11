/**
 * GitHub Pages: redirect to the current / next upcoming slate (live schedule).
 */
import { loadWeeklySchedule } from "../lib/dfsLeaderboardScoringContext.js";
import {
  referenceIsoForScheduleYear,
  pickMatchupPredictorDefaultViewForMode,
} from "../lib/dfs.js";
import { SCHEDULE_CALENDAR_YEAR } from "../lib/sheetUrls.js";
import {
  isStaticMatchupHost,
  resolveStaticMatchupNavigateUrl,
  matchupModeFromPathname,
  viewTokenFromPathname,
  getEffectiveMatchupMode,
  shouldSkipMatchupAutoRedirect,
} from "../lib/matchupPredictorStaticNav.js";

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

export function syncMatchupModeTabs(mode) {
  if (typeof document === "undefined") return;
  const normalized = normalizeMode(mode);
  document.querySelectorAll(".matchup-mode-tab").forEach((tab) => {
    const href = safeText(tab.getAttribute("href"));
    const isPast = /\/matchup-predictor\/past(?:\/|$)/i.test(href);
    const isFuture = /\/matchup-predictor\/future(?:\/|$)/i.test(href);
    const active = normalized === "past" ? isPast : isFuture;
    tab.classList.toggle("is-active", active);
    if (active) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  });
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

async function resolveNavigateTarget(mode, view) {
  const basePath =
    typeof window !== "undefined" && window.__SITE_BASE_PATH__ != null
      ? String(window.__SITE_BASE_PATH__ || "")
      : "";
  if (isStaticMatchupHost()) {
    return resolveStaticMatchupNavigateUrl({ mode, view, basePath });
  }
  return sitePath(`/matchup-predictor/${normalizeMode(mode)}/view/${encodeURIComponent(view)}`);
}

export async function ensureMatchupPredictorActiveView() {
  const pathname = window.location.pathname || "";
  if (redirectLegacyMatchupPaths(pathname)) return;

  const url = new URL(window.location.href);
  const effectiveMode = getEffectiveMatchupMode(pathname, url);
  syncMatchupModeTabs(effectiveMode);

  if (shouldSkipMatchupAutoRedirect(pathname, url)) {
    hideLoadingOverlay();
    return;
  }

  const currentView = viewTokenFromPathname(pathname);
  const isModeRoot = new RegExp(`/matchup-predictor/${effectiveMode}/?$`, "i").test(
    pathname.replace(/\/$/, "")
  );
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
    const active = await resolveDefaultViewToken(effectiveMode);
    if (!active) {
      hideLoadingOverlay();
      return;
    }

    const userPickedView = (() => {
      try {
        return sessionStorage.getItem(USER_PICKED_VIEW_KEY) === "1";
      } catch {
        return false;
      }
    })();

    if (isModeRoot) {
      const target = await resolveNavigateTarget(effectiveMode, active);
      if (window.location.href !== target && !window.location.href.startsWith(target.split("?")[0] + "?")) {
        window.location.replace(target);
        return;
      }
      hideLoadingOverlay();
      return;
    }

    if (!hasMatchup && !userPickedView && currentView && currentView !== active) {
      const target = await resolveNavigateTarget(effectiveMode, active);
      if (window.location.href !== target) {
        window.location.replace(target);
        return;
      }
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

export async function navigateMatchupPredictorView(mode, view, matchup = "") {
  const basePath =
    typeof window !== "undefined" && window.__SITE_BASE_PATH__ != null
      ? String(window.__SITE_BASE_PATH__ || "")
      : "";
  if (isStaticMatchupHost()) {
    return resolveStaticMatchupNavigateUrl({ mode, view, matchup, basePath });
  }
  let path = `/matchup-predictor/${normalizeMode(mode)}/view/${encodeURIComponent(view)}`;
  if (matchup) {
    const pipe = matchup.indexOf("|");
    const slug = pipe >= 0 ? `${matchup.slice(0, pipe)}-${matchup.slice(pipe + 1)}` : matchup;
    path += `/matchup/${slug}`;
  }
  return sitePath(path);
}

if (typeof window !== "undefined") {
  window.MmsMatchupPredictorNav = {
    ensureMatchupPredictorActiveView,
    markMatchupUserPickedView,
    navigateMatchupPredictorView,
    resolveStaticMatchupNavigateUrl,
    isStaticMatchupHost,
    syncMatchupModeTabs,
    getEffectiveMatchupMode,
  };

  ensureMatchupPredictorActiveView().catch((err) => {
    console.error("Matchup predictor schedule redirect failed", err);
  });
}
