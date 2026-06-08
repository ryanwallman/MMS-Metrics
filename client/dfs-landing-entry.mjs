/**
 * GitHub Pages: redirect bare /dfs (and stale locked ?slate= URLs) to the live open slate.
 */
import { loadWeeklySchedule } from "../lib/dfsLeaderboardScoringContext.js";
import {
  buildDfsSlateOptions,
  referenceIsoForScheduleYear,
  resolveActiveDfsSlateToken,
} from "../lib/dfs.js";
import { SCHEDULE_CALENDAR_YEAR } from "../lib/sheetUrls.js";

function hideLoadingOverlay() {
  if (typeof window !== "undefined" && window.MmsLoadingScreen) {
    window.MmsLoadingScreen.hide();
  }
}

function siteBasePath() {
  const b = typeof window !== "undefined" ? window.__SITE_BASE_PATH__ : "";
  return b == null ? "" : String(b);
}

function isStaticDfsSite() {
  return (
    typeof window !== "undefined" &&
    (window.__STATIC_SITE__ === true ||
      window.__STATIC_SITE__ === "1" ||
      window.__STATIC_SITE__ === 1)
  );
}

function dfsLineupUrl(slateToken) {
  const base = siteBasePath();
  const t = String(slateToken || "")
    .trim()
    .toUpperCase();
  if (!t) return `${base}/dfs`;
  return `${base}/dfs?slate=${encodeURIComponent(t)}`;
}

function isBareDfsLandingPath() {
  const path = (window.location.pathname || "").replace(/\/+$/, "") || "/";
  const base = siteBasePath().replace(/\/+$/, "");
  const dfsRoot = base ? `${base}/dfs` : "/dfs";
  return path === dfsRoot || path === "/dfs";
}

function slateFromQuery() {
  const q = new URLSearchParams(window.location.search).get("slate");
  return q ? String(q).trim().toUpperCase() : "";
}

function slateFromLegacyPath() {
  const m = window.location.pathname.match(/\/dfs\/slate\/([^/]+)\/?$/i);
  return m ? decodeURIComponent(m[1]).trim().toUpperCase() : "";
}

function isViewOnlySlateRequest() {
  return new URLSearchParams(window.location.search).get("view") === "1";
}

async function resolveScheduleContext() {
  const payload = await loadWeeklySchedule();
  const refIso = referenceIsoForScheduleYear(SCHEDULE_CALENDAR_YEAR);
  const nowMs = Date.now();
  const options = buildDfsSlateOptions(payload, refIso, nowMs);
  const active = String(resolveActiveDfsSlateToken(payload, refIso, nowMs) || "")
    .trim()
    .toUpperCase();
  return { options, active };
}

function shouldRedirectToOpenSlate(current, active, options) {
  if (!active) return false;
  if (!current) return true;
  if (current === active) return false;
  const opt = options.find((o) => String(o.value || "").trim().toUpperCase() === current);
  return !opt?.canEdit;
}

export async function ensureDfsOpenSlateLanding() {
  if (!isStaticDfsSite()) {
    hideLoadingOverlay();
    return;
  }

  const querySlate = slateFromQuery();
  const pathSlate = slateFromLegacyPath();

  if (pathSlate && !querySlate) {
    window.location.replace(`${dfsLineupUrl(pathSlate)}?t=${Date.now()}`);
    return;
  }

  if (isViewOnlySlateRequest()) {
    hideLoadingOverlay();
    return;
  }

  const onDfsLineup =
    isBareDfsLandingPath() || !!querySlate || !!pathSlate;
  if (!onDfsLineup) {
    hideLoadingOverlay();
    return;
  }

  try {
    const { options, active } = await resolveScheduleContext();
    if (!active) {
      hideLoadingOverlay();
      return;
    }

    const current = querySlate || pathSlate;
    if (shouldRedirectToOpenSlate(current, active, options)) {
      window.location.replace(`${dfsLineupUrl(active)}?t=${Date.now()}`);
      return;
    }

    hideLoadingOverlay();
  } catch (err) {
    console.error("DFS open slate redirect failed", err);
    hideLoadingOverlay();
  }
}

const dfsLandingReady = ensureDfsOpenSlateLanding();

if (typeof window !== "undefined") {
  window.__DFS_LANDING_READY__ = dfsLandingReady;
  dfsLandingReady.catch((err) => {
    console.error("DFS landing redirect failed", err);
    hideLoadingOverlay();
  });
}
