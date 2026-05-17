/**
 * DFS Leaderboard: prefer one server API (Firestore Admin + cached scoring);
 * fall back to browser Firestore + POST score when admin is not configured.
 */
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const config = window.__FIREBASE_CONFIG__;
const page = window.__LEADERBOARD_PAGE__;

const FETCH_TIMEOUT_MS = 120_000;

function esc(text) {
  const el = document.createElement("span");
  el.textContent = text == null ? "" : String(text);
  return el.innerHTML;
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    const text = await res.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          "The server returned an unexpected response. Check Render logs or try again in a minute."
        );
      }
    }
    return { res, data };
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(
        "This is taking longer than expected. On Render’s free tier the first load after deploy can take 1–2 minutes while league data is fetched. Please wait and refresh once — later loads are much faster."
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function lineupFromDoc(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    userId: data.userId || "",
    displayName: data.displayName || "Player",
    slateId: (data.slateId || "").toUpperCase(),
    playerNorms: Array.isArray(data.playerNorms) ? data.playerNorms : [],
    playerSalaries: Array.isArray(data.playerSalaries)
      ? data.playerSalaries.map((n) => Number(n) || 0)
      : null,
    salaryUsed: Number(data.salaryUsed) || 0,
  };
}

async function fetchLineupsFromClient(db, tab, selectedWeek) {
  if (tab === "weekly" && selectedWeek) {
    const slateId = selectedWeek.toUpperCase();
    const q = query(collection(db, "lineups"), where("slateId", "==", slateId));
    const snap = await getDocs(q);
    return snap.docs.map(lineupFromDoc);
  }

  const snap = await getDocs(collection(db, "lineups"));
  return snap.docs.map(lineupFromDoc).filter((row) => /^W\d+|D\d{8}$/.test(row.slateId));
}

function renderWeeklyTable(rows, data) {
  const tbody = document.getElementById("leaderboardWeeklyBody");
  if (!tbody) return;

  if (!rows.length) {
    const slatePast = data?.slate?.isPast !== false;
    const noCsvOverlap =
      data?.hasGamelogData &&
      data?.slateHasBoxScoresForWeek === false &&
      slatePast;
    const parts = [];
    if (noCsvOverlap) {
      parts.push(
        "Game results don’t cover this slate’s scheduled dates yet — fantasy scores stay at zero until those games are reflected."
      );
    }
    parts.push(
      "No saved lineups for this slate yet — when players save a lineup for this slate, everyone will see them listed here."
    );
    tbody.innerHTML = `<tr><td colspan="4" class="dfs-leaderboard-empty">${parts.join("<br/><br/>")}</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map(
      (row) =>
        `<tr>
          <td>${esc(row.rankDisplay != null ? row.rankDisplay : row.rank)}</td>
          <td>${esc(row.displayName)}</td>
          <td class="dfs-leaderboard-pts">${
            row.points == null ? "—" : `<strong>${row.points}</strong>`
          }</td>
          <td>$${(row.salaryUsed || 0).toLocaleString()}</td>
        </tr>`
    )
    .join("");
}

function renderCumulativeTable(rows, pageCtx) {
  const tbody = document.getElementById("leaderboardCumulativeBody");
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="dfs-leaderboard-empty">No saved lineups in the database yet — sign in on the <a href="/dfs">lineup builder</a> and save once to appear here.</td></tr>';
    return;
  }

  const hasOpen = !!(pageCtx?.activeSlateToken && String(pageCtx.activeSlateToken).trim());

  tbody.innerHTML = rows
    .map((row) => {
      const pts = row.points == null || row.points === "" ? 0 : Number(row.points);
      const ptsDisplay = Number.isFinite(pts) ? pts : 0;
      let openCell = "—";
      if (hasOpen) {
        openCell = row.hasOpenSlateLineup
          ? '<span class="dfs-lineup-yes">Yes</span>'
          : '<span class="dfs-lineup-no">No</span>';
      }
      return `<tr>
          <td>${esc(row.rankDisplay != null ? row.rankDisplay : row.rank)}</td>
          <td>${esc(row.displayName)}</td>
          <td>${row.weeksPlayed}</td>
          <td class="dfs-leaderboard-pts"><strong>${ptsDisplay}</strong></td>
          <td>${openCell}</td>
        </tr>`;
    })
    .join("");
}

function setStatus(message, isError) {
  const el = document.getElementById("leaderboardStatus");
  if (!el) return;
  el.hidden = !message;
  el.className = "dfs-leaderboard-alert" + (isError ? " dfs-leaderboard-alert--error" : "");
  el.innerHTML = message ? `<p>${message}</p>` : "";
}

function updateWeeklyBanner(data, pageSlate) {
  const countEl = document.getElementById("weeklyEntryCount");
  const statusEl = document.getElementById("weeklySlateStatus");
  const gapEl = document.getElementById("weeklyGamelogGap");
  const slate = data.slate || pageSlate;

  if (
    gapEl &&
    slate?.isPast &&
    data.hasGamelogData &&
    data.slateHasBoxScoresForWeek === false
  ) {
    gapEl.textContent =
      "Game results don’t cover this slate’s scheduled dates yet — scores stay at zero until those games are reflected.";
    gapEl.hidden = false;
  } else if (gapEl) {
    gapEl.hidden = true;
  }

  if (countEl && data.weekly) {
    const n = data.weekly.entryCount || 0;
    countEl.textContent = `${n} saved lineup${n === 1 ? "" : "s"}`;
    countEl.hidden = false;
  }

  if (statusEl && slate && !slate.isPast) {
    statusEl.textContent =
      slate.slateType === "wednesday"
        ? "This slate has not finished yet — standings update once Wednesday’s games are complete."
        : "This week has not finished yet — standings update once Sunday’s games are complete.";
    statusEl.hidden = false;
  }
}

function renderLeaderboardData(data) {
  setStatus("", false);
  if (page.tab === "weekly") {
    renderWeeklyTable(data.weekly?.rows || [], data);
    updateWeeklyBanner(data, page.slate);
  } else {
    renderCumulativeTable(data.cumulative?.rows || [], page);
  }
}

async function loadLeaderboardFromServerApi() {
  const qs = new URLSearchParams({ tab: page.tab });
  if (page.tab === "weekly" && page.selectedWeek) {
    qs.set("week", page.selectedWeek);
  }
  const { res, data } = await fetchJsonWithTimeout(`/api/dfs/leaderboard/data?${qs}`);
  if (res.status === 503 && data.needClientLineups) {
    return null;
  }
  if (!res.ok) {
    throw new Error(data.error || "Could not load leaderboard.");
  }
  return data;
}

async function loadLeaderboardViaClientFirestore() {
  if (!config?.projectId) {
    throw new Error(
      "Browser lineup reads need FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, and FIREBASE_APP_ID on Render — or set FIREBASE_SERVICE_ACCOUNT_JSON for faster server-side reads."
    );
  }
  const app = getApps().length ? getApp() : initializeApp(config);
  const db = getFirestore(app);
  const lineups = await fetchLineupsFromClient(db, page.tab, page.selectedWeek);

  const { res, data } = await fetchJsonWithTimeout("/api/dfs/leaderboard/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tab: page.tab,
      selectedWeek: page.selectedWeek,
      lineups,
    }),
  });

  if (!res.ok) {
    throw new Error(data.error || "Could not score leaderboard.");
  }
  return data;
}

async function loadLeaderboard() {
  if (!page) {
    setStatus("Leaderboard page configuration is missing.", true);
    return;
  }

  setStatus("Loading standings…", false);

  try {
    let data = null;
    if (page.leaderboardServerRead) {
      data = await loadLeaderboardFromServerApi();
    } else {
      data = await loadLeaderboardViaClientFirestore();
    }

    if (!data && page.leaderboardServerRead) {
      if (config?.projectId) {
        setStatus("Server read unavailable — loading via browser instead…", false);
        data = await loadLeaderboardViaClientFirestore();
      } else {
        throw new Error(
          "Set FIREBASE_SERVICE_ACCOUNT_JSON on Render (recommended), or the web FIREBASE_* keys for browser reads."
        );
      }
    } else if (!data) {
      data = await loadLeaderboardViaClientFirestore();
    }

    renderLeaderboardData(data);
  } catch (err) {
    console.error(err);
    const msg = (err.message || "").includes("permission")
      ? "Could not read lineups. In Firebase Console → Firestore → Rules, publish rules that allow public read on <code>lineups</code> (see <code>firebase/firestore.rules</code> in this project)."
      : esc(err.message || "Failed to load leaderboard.");
    setStatus(msg, true);
  }
}

loadLeaderboard();
