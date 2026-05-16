/**
 * DFS Leaderboard: load lineups from Firestore (web SDK), score via server API.
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

function esc(text) {
  const el = document.createElement("span");
  el.textContent = text == null ? "" : String(text);
  return el.innerHTML;
}

function lineupFromDoc(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    userId: data.userId || "",
    displayName: data.displayName || "Player",
    slateId: (data.slateId || "").toUpperCase(),
    playerNorms: Array.isArray(data.playerNorms) ? data.playerNorms : [],
    salaryUsed: Number(data.salaryUsed) || 0,
  };
}

async function fetchLineups(db, tab, selectedWeek) {
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
          <td>${row.rank}</td>
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
          <td>${row.rank}</td>
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

async function loadLeaderboard() {
  if (!config?.projectId || !page) {
    setStatus(
      "Firebase is not configured. Use <code>.env</code> locally; in production set <code>FIREBASE_*</code> in your host (e.g. Render → Environment) and redeploy.",
      true
    );
    return;
  }

  setStatus("Loading standings…", false);

  try {
    const app = getApps().length ? getApp() : initializeApp(config);
    const db = getFirestore(app);
    const lineups = await fetchLineups(db, page.tab, page.selectedWeek);

    const res = await fetch("/api/dfs/leaderboard/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tab: page.tab,
        selectedWeek: page.selectedWeek,
        lineups,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Could not score leaderboard.");
    }

    setStatus("", false);

    if (page.tab === "weekly") {
      renderWeeklyTable(data.weekly?.rows || [], data);
      updateWeeklyBanner(data, page.slate);
    } else {
      renderCumulativeTable(data.cumulative?.rows || [], page);
    }
  } catch (err) {
    console.error(err);
    const msg = (err.message || "").includes("permission")
      ? "Could not read lineups. In Firebase Console → Firestore → Rules, publish rules that allow public read on <code>lineups</code> (see <code>firebase/firestore.rules</code> in this project)."
      : esc(err.message || "Failed to load leaderboard.");
    setStatus(msg, true);
  }
}

loadLeaderboard();
