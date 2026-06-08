/**
 * GitHub Pages: redirect bare /dfs and stale locked ?slate= URLs to the live open slate.
 */
import { loadWeeklySchedule } from "../lib/dfsLeaderboardScoringContext.js";
import {
  buildDfsSlateOptions,
  referenceIsoForScheduleYear,
  resolveActiveDfsSlateToken,
} from "../lib/dfs.js";
import { SCHEDULE_CALENDAR_YEAR } from "../lib/sheetUrls.js";

function hideLoadingOverlay() {
  if (typeof document === "undefined") return;
  const screen = document.getElementById("mmsLoadingScreen");
  if (screen) {
    screen.hidden = true;
    screen.setAttribute("aria-busy", "false");
  }
  document.body?.classList.add("mms-page-ready");
  document.querySelector(".page-main")?.classList.remove("mms-page-main--loading");
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

function normalizeSlateToken(raw) {
  return String(raw || "")
    .trim()
    .split(/[?&#]/)[0]
    .toUpperCase();
}

function dfsLineupUrl(slateToken) {
  const base = siteBasePath();
  const t = normalizeSlateToken(slateToken);
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
  return q ? normalizeSlateToken(q) : "";
}

function slateFromLegacyPath() {
  const m = window.location.pathname.match(/\/dfs\/slate\/([^/]+)\/?$/i);
  return m ? normalizeSlateToken(decodeURIComponent(m[1])) : "";
}

function isViewOnlySlateRequest() {
  return new URLSearchParams(window.location.search).get("view") === "1";
}

function stripCacheBusterFromUrl() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("t")) return;
  params.delete("t");
  const qs = params.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash || ""}`;
  window.history.replaceState(null, "", next);
}

async function resolveScheduleContext() {
  const payload = await loadWeeklySchedule();
  const refIso = referenceIsoForScheduleYear(SCHEDULE_CALENDAR_YEAR);
  const nowMs = Date.now();
  const options = buildDfsSlateOptions(payload, refIso, nowMs);
  const active = normalizeSlateToken(
    resolveActiveDfsSlateToken(payload, refIso, nowMs) || ""
  );
  return { options, active };
}

function shouldRedirectToOpenSlate(current, active, options) {
  if (!active) return false;
  if (!current) return true;
  if (current === active) return false;
  const opt = options.find((o) => normalizeSlateToken(o.value) === current);
  return !opt?.canEdit;
}

export async function ensureDfsOpenSlateLanding() {
  if (!isStaticDfsSite()) {
    hideLoadingOverlay();
    return { redirected: false, active: "" };
  }

  const querySlate = slateFromQuery();
  const pathSlate = slateFromLegacyPath();

  if (pathSlate && !querySlate) {
    window.location.replace(dfsLineupUrl(pathSlate));
    return { redirected: true, active: pathSlate };
  }

  if (isViewOnlySlateRequest()) {
    stripCacheBusterFromUrl();
    hideLoadingOverlay();
    return { redirected: false, active: querySlate || pathSlate };
  }

  const onDfsLineup = isBareDfsLandingPath() || !!querySlate || !!pathSlate;
  if (!onDfsLineup) {
    hideLoadingOverlay();
    return { redirected: false, active: "" };
  }

  try {
    const { options, active } = await resolveScheduleContext();
    if (!active) {
      hideLoadingOverlay();
      return { redirected: false, active: "" };
    }

    const current = querySlate || pathSlate;
    if (shouldRedirectToOpenSlate(current, active, options)) {
      window.location.replace(dfsLineupUrl(active));
      return { redirected: true, active };
    }

    stripCacheBusterFromUrl();
    hideLoadingOverlay();
    return { redirected: false, active, current: current || active };
  } catch (err) {
    console.error("DFS open slate redirect failed", err);
    hideLoadingOverlay();
    return { redirected: false, active: "" };
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
