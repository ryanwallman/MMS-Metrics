/**
 * DFS lineup lock countdown — when time expires, advance to the next open slate.
 */
export function siteBasePath() {
  const b = typeof window !== "undefined" ? window.__SITE_BASE_PATH__ : "";
  return b == null ? "" : String(b);
}

/** GitHub Pages serves a single /dfs/index.html — use ?slate= so new slates do not 404. */
export function isStaticDfsSite() {
  return (
    typeof window !== "undefined" &&
    (window.__STATIC_SITE__ === true ||
      window.__STATIC_SITE__ === "1" ||
      window.__STATIC_SITE__ === 1)
  );
}

export function dfsLineupUrl(slateToken) {
  const base = siteBasePath();
  const t = String(slateToken || "")
    .trim()
    .toUpperCase();
  if (!t) return `${base}/dfs`;
  if (isStaticDfsSite()) {
    return `${base}/dfs?slate=${encodeURIComponent(t)}`;
  }
  return `${base}/dfs/slate/${encodeURIComponent(t)}`;
}

/** True when the user explicitly opened a locked slate to review results. */
export function isViewOnlySlateRequest() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("view") === "1";
}

export function dfsLineupViewUrl(slateToken) {
  const base = dfsLineupUrl(slateToken);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}view=1`;
}

/** Cache-busted navigation URL (must use & when slate= is already present). */
export function dfsLineupFreshUrl(slateToken) {
  const base = dfsLineupUrl(slateToken);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}t=${Date.now()}`;
}

export function normalizeSlateToken(raw) {
  return String(raw || "")
    .trim()
    .split(/[?&#]/)[0]
    .toUpperCase();
}

async function resolveOpenSlateToken(activeSlateToken) {
  let token = String(activeSlateToken || "")
    .trim()
    .toUpperCase();
  if (token) return token;
  const loader = typeof window !== "undefined" ? window.MmsDfsLineupPool?.loadDfsLineupPool : null;
  if (!loader) return "";
  try {
    const data = await loader("", []);
    return String(data.activeSlateToken || "")
      .trim()
      .toUpperCase();
  } catch (err) {
    console.error("Could not resolve open DFS slate", err);
    return "";
  }
}

/** Navigate to the open editable slate (live schedule when token omitted). */
export async function navigateToOpenDfsSlate(activeSlateToken) {
  const token = await resolveOpenSlateToken(activeSlateToken);
  window.location.replace(dfsLineupFreshUrl(token));
}

/**
 * @param {object} opts
 * @param {number|null} opts.deadlineMs
 * @param {() => void|Promise<void>} [opts.onLocked]
 */
export function setupLineupLockCountdown(opts) {
  const wrap = document.getElementById("dfsLockCountdown");
  const closed = document.getElementById("dfsLockCountdownClosed");
  const timerEl = document.getElementById("dfsLockCountdownTimer");
  if (!wrap || !timerEl) return () => {};

  const deadlineMs =
    opts?.deadlineMs != null && Number.isFinite(opts.deadlineMs)
      ? opts.deadlineMs
      : Number(wrap.getAttribute("data-deadline-ms"));

  if (!Number.isFinite(deadlineMs)) {
    wrap.hidden = true;
    if (closed) closed.hidden = false;
    return () => {};
  }
  if (closed) closed.hidden = true;
  wrap.hidden = false;
  wrap.setAttribute("data-deadline-ms", String(deadlineMs));

  let handled = false;

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatRemaining(ms) {
    if (ms <= 0) return null;
    const totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    parts.push(`${pad2(hours)}h`, `${pad2(minutes)}m`, `${pad2(seconds)}s`);
    return parts.join(" ");
  }

  function hidePlayerPoolAfterLock() {
    const poolSection = document.getElementById("dfsPoolSection");
    if (poolSection) poolSection.hidden = true;
  }

  async function handleLocked() {
    if (handled) return;
    handled = true;
    timerEl.textContent = "Locked";
    wrap.classList.add("dfs-lock-countdown--expired");
    hidePlayerPoolAfterLock();
    if (typeof opts?.onLocked === "function") {
      await opts.onLocked();
    }
  }

  function tick() {
    const left = deadlineMs - Date.now();
    const text = formatRemaining(left);
    if (!text) {
      void handleLocked();
      return;
    }
    timerEl.textContent = text;
  }

  tick();
  const id = window.setInterval(tick, 1000);
  return () => window.clearInterval(id);
}
