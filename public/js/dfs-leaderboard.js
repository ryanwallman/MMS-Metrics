/**
 * Weekly DFS leaderboard (client fallback when the page is not server-rendered).
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

const FETCH_TIMEOUT_MS = 90_000;

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
        "This is taking longer than expected. On Render’s free tier the first load after idle can take up to a minute while league data is fetched. Please wait and refresh once."
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

async function fetchLineupsForSlate(db, slateId) {
  const slate = (slateId || "").toUpperCase();
  const q = query(collection(db, "lineups"), where("slateId", "==", slate));
  const snap = await getDocs(q);
  return snap.docs.map(lineupFromDoc);
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
  } else if (gapEl && data.slateHasBoxScoresForWeek) {
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
        ? "This slate has not finished yet — points appear after Wednesday’s games."
        : "This week has not finished yet — points appear after Sunday’s games.";
    statusEl.hidden = false;
  }
}

function renderLeaderboardData(data) {
  setStatus("", false);
  renderWeeklyTable(data.weekly?.rows || [], data);
  updateWeeklyBanner(data, page.slate);
}

async function loadFromServerApi() {
  const week = page.selectedWeek;
  if (!week) {
    throw new Error("No slate selected.");
  }
  const qs = new URLSearchParams({ week });
  const { res, data } = await fetchJsonWithTimeout(`/api/dfs/leaderboard/data?${qs}`);
  if (res.status === 503 && data.needClientLineups) {
    return null;
  }
  if (!res.ok) {
    throw new Error(data.error || "Could not load leaderboard.");
  }
  return data;
}

async function loadViaBrowserFirestore() {
  if (!config?.projectId) {
    throw new Error(
      "Set FIREBASE_* keys on Render, or FIREBASE_SERVICE_ACCOUNT_JSON for server-side reads."
    );
  }
  const app = getApps().length ? getApp() : initializeApp(config);
  const db = getFirestore(app);
  const lineups = await fetchLineupsForSlate(db, page.selectedWeek);

  const { res, data } = await fetchJsonWithTimeout("/api/dfs/leaderboard/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
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
  if (!page || page.serverRendered) {
    return;
  }
  if (!page.selectedWeek) {
    setStatus("No slate selected.", true);
    return;
  }

  setStatus("Loading standings…", false);

  try {
    let data = null;
    if (page.leaderboardServerRead) {
      data = await loadFromServerApi();
    }
    if (!data) {
      if (page.leaderboardServerRead && config?.projectId) {
        setStatus("Server read unavailable — loading lineups in your browser…", false);
      }
      data = await loadViaBrowserFirestore();
    }
    renderLeaderboardData(data);
  } catch (err) {
    console.error(err);
    const msg = (err.message || "").includes("permission")
      ? "Could not read lineups. Publish Firestore rules with public read on <code>lineups</code> (see <code>firebase/firestore.rules</code>)."
      : esc(err.message || "Failed to load leaderboard.");
    setStatus(msg, true);
  }
}

loadLeaderboard();
