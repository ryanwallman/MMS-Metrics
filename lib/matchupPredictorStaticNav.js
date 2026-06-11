"use strict";

const { sitePath } = require("./sitePaths");
const { matchupPredictorBasePath, matchupPredictorViewPath } = require("./matchupPredictorMode");

function safeText(value) {
  return (value || "").toString().trim();
}

function isStaticMatchupHost() {
  if (typeof window === "undefined") return false;
  if (
    window.__STATIC_SITE__ === true ||
    window.__STATIC_SITE__ === "1" ||
    window.__STATIC_SITE__ === 1
  ) {
    return true;
  }
  const path = safeText(window.location?.pathname);
  return /\/matchup-predictor\//i.test(path);
}

/** Best-effort check that a static HTML route exists (GitHub Pages). */
async function staticMatchupPageExists(routePath, basePath = "") {
  const url = sitePath(routePath, basePath);
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    if (!res.ok) return false;
    const ct = safeText(res.headers.get("content-type")).toLowerCase();
    return ct.includes("text/html");
  } catch {
    return false;
  }
}

function matchupViewRoute(mode, view, matchup = "", basePath = "") {
  return matchupPredictorViewPath(mode, view, matchup, basePath);
}

function matchupViewQueryUrl(mode, view, matchup = "", basePath = "", extraParams = null) {
  const base = matchupPredictorBasePath(mode, basePath);
  const params = new URLSearchParams();
  if (view) params.set("view", safeText(view).toUpperCase());
  if (matchup) params.set("matchup", matchup);
  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) {
      if (v != null && safeText(v) !== "") params.set(k, String(v));
    }
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function matchupModeFromPathname(pathname) {
  const p = safeText(pathname);
  if (/\/matchup-predictor\/past(?:\/|$)/i.test(p)) return "past";
  return "future";
}

function viewTokenFromPathname(pathname) {
  const m =
    pathname.match(/\/matchup-predictor\/(?:past|future)\/view\/([^/]+)/i) ||
    pathname.match(/\/matchup-predictor\/view\/([^/]+)/i);
  return m ? decodeURIComponent(m[1]).toUpperCase() : "";
}

/** Pathname + ?mode=past (shared future export pages). */
function getEffectiveMatchupMode(pathname, url) {
  const qMode = safeText(url?.searchParams?.get("mode")).toLowerCase();
  if (qMode === "past" || qMode === "future") return qMode;
  return matchupModeFromPathname(pathname);
}

/** Skip auto-redirect to the mode default slate (live nav). */
function shouldSkipMatchupAutoRedirect(pathname, url) {
  if (!url) return false;
  if (url.searchParams.get("view")) return true;
  if (url.searchParams.get("week")) return true;
  const wed = (url.searchParams.get("wed") || "").replace(/^D/i, "");
  if (/^\d{8}$/.test(wed)) return true;
  if (safeText(url.searchParams.get("mode")).toLowerCase() === "past" && viewTokenFromPathname(pathname)) {
    return true;
  }
  return false;
}

/**
 * Resolve a navigable URL for a slate on static hosting.
 * Past never uses bare future/view (that triggers future auto-redirect).
 */
async function resolveStaticMatchupNavigateUrl({
  mode,
  view,
  matchup = "",
  basePath = "",
}) {
  const normalizedMode = safeText(mode).toLowerCase() === "past" ? "past" : "future";
  const viewToken = safeText(view).toUpperCase();
  const hasMatchup = !!safeText(matchup);

  if (!viewToken) {
    return matchupViewQueryUrl(normalizedMode, "", "", basePath);
  }

  if (normalizedMode === "past") {
    const pastRoute = matchupViewRoute("past", viewToken, matchup, basePath);
    if (await staticMatchupPageExists(pastRoute, basePath)) {
      return sitePath(pastRoute, basePath);
    }
    if (hasMatchup) {
      const futureRoute = matchupViewRoute("future", viewToken, matchup, basePath);
      if (await staticMatchupPageExists(futureRoute, basePath)) {
        return `${sitePath(futureRoute, basePath)}?mode=past`;
      }
    }
    return matchupViewQueryUrl("past", viewToken, matchup, basePath);
  }

  for (const m of ["future", "past"]) {
    const route = matchupViewRoute(m, viewToken, matchup, basePath);
    if (await staticMatchupPageExists(route, basePath)) {
      return sitePath(route, basePath);
    }
  }

  return matchupViewQueryUrl("future", viewToken, matchup, basePath);
}

module.exports = {
  isStaticMatchupHost,
  staticMatchupPageExists,
  matchupViewRoute,
  matchupViewQueryUrl,
  resolveStaticMatchupNavigateUrl,
  matchupModeFromPathname,
  viewTokenFromPathname,
  getEffectiveMatchupMode,
  shouldSkipMatchupAutoRedirect,
};
