"use strict";

const { sitePath } = require("./sitePaths");
const { matchupKeyToSlug } = require("./matchupSlug");
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
  // GitHub Pages / static export: no server-rendered matchup client on mode roots.
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

/**
 * Resolve a navigable URL for a slate on static hosting.
 * Tries past/future view paths, then falls back to mode root + query params.
 */
async function resolveStaticMatchupNavigateUrl({
  mode,
  view,
  matchup = "",
  basePath = "",
  preferModes = null,
}) {
  const normalizedMode = safeText(mode).toLowerCase() === "past" ? "past" : "future";
  const viewToken = safeText(view).toUpperCase();
  const modes = preferModes || (normalizedMode === "past" ? ["past", "future"] : ["future", "past"]);

  if (viewToken) {
    for (const m of modes) {
      const route = matchupViewRoute(m, viewToken, matchup, basePath);
      if (await staticMatchupPageExists(route, basePath)) {
        return sitePath(route, basePath);
      }
    }
  }

  return matchupViewQueryUrl(normalizedMode, viewToken, matchup, basePath);
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

module.exports = {
  isStaticMatchupHost,
  staticMatchupPageExists,
  matchupViewRoute,
  matchupViewQueryUrl,
  resolveStaticMatchupNavigateUrl,
  matchupModeFromPathname,
  viewTokenFromPathname,
};
