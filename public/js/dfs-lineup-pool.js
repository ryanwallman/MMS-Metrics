/**
 * Load DFS player pool from Google Sheets on GitHub Pages, then boot lineup UI.
 */
import { loadDfsLineupPool } from "./dfs-lineup-pool.mjs";
import {
  setupLineupLockCountdown,
  navigateToOpenDfsSlate,
  dfsLineupUrl,
} from "./dfs-lock-countdown.js";
import { hideMmsLoadingScreen } from "./mms-loading-screen.js";
import { publicErrorMessage } from "./mms-public-error.js";
import {
  applyLockedSlateResultsUi,
  hideLockedResultsChrome,
} from "./dfs-lineup-locked-ui.js";
import { syncSlateChrome } from "./dfs-slate-ui.js";

const page = window.__DFS_LINEUP_PAGE__;

function slateFromUrl() {
  const q = new URLSearchParams(window.location.search).get("slate");
  if (q) return String(q).trim().toUpperCase();
  const m = window.location.pathname.match(/\/dfs\/slate\/([^/]+)\/?$/i);
  if (m) return m[1].toUpperCase();
  return "";
}

/** True when the user picked a slate via ?slate= or /dfs/slate/ (not the bare DFS tab). */
function slateChosenInUrl() {
  return !!slateFromUrl();
}

if (page) {
  const urlSlate = slateFromUrl();
  if (urlSlate) page.slateToken = urlSlate;
}

function esc(text) {
  const el = document.createElement("span");
  el.textContent = text == null ? "" : String(text);
  return el.innerHTML;
}

function escAttr(text) {
  return esc(text).replace(/"/g, "&quot;");
}

function formatDataUpdatedLabel(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })} ET`;
  } catch {
    return iso;
  }
}

function updateSiteUpdated(iso) {
  const meta = document.querySelector(".site-header-meta");
  if (!meta) return;
  let wrap = meta.querySelector(".site-updated");
  if (!wrap) {
    wrap = document.createElement("p");
    wrap.className = "site-updated";
    meta.insertBefore(wrap, meta.firstChild);
  }
  wrap.innerHTML = `Data updated <time datetime="${esc(iso)}">${esc(formatDataUpdatedLabel(iso))}</time>`;
}

function renderPoolRows(data) {
  const tbody = document.querySelector("#playerPoolTable tbody");
  const empty = document.querySelector(".dfs-empty-pool");
  if (!tbody) return;

  const showStats = data.showSlateStats;
  const players = data.playerPool || [];

  if (!players.length) {
    tbody.innerHTML = "";
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  const lineupSet = new Set(data.lineupNorms || []);

  tbody.innerHTML = players
    .map((p) => {
      const inLineup = lineupSet.has(p.norm);
      const field = p.gameField != null ? p.gameField : "—";
      const pitcherTitle =
        p.pitcherBaa != null ? `BAA ${p.pitcherBaa}, Runs/G ${p.pitcherRunsG}` : "";
      const fieldAttr = escAttr(String(field).replace(/\n/g, " "));
      return `<tr
        class="dfs-player-row${inLineup ? " dfs-player-row--selected" : ""}"
        data-norm="${escAttr(p.norm)}"
        data-name="${escAttr(p.name)}"
        data-team="${escAttr(p.teamName)}"
        data-salary="${p.salary}"
        data-field="${fieldAttr}"
        data-points="${p.slatePoints != null ? p.slatePoints : 0}"
        data-games="${p.slateGames != null ? p.slateGames : 0}"
      >
        ${
          showStats
            ? ""
            : `<td><button type="button" class="dfs-add-btn${
                inLineup ? " dfs-add-btn--remove" : ""
              }" data-toggle="${escAttr(p.norm)}" aria-pressed="${
                inLineup ? "true" : "false"
              }">${inLineup ? "−" : "+"}</button></td>`
        }
        <td class="dfs-player-name">${esc(p.name)}${
          p.doubleHeader
            ? '<span class="dfs-doubleheader-tag" title="Two games this slate">2G</span>'
            : ""
        }</td>
        <td class="dfs-salary-cell">$${Number(p.salary).toLocaleString()}</td>
        <td>${esc(p.teamName)}</td>
        <td class="dfs-field-cell dfs-cell-preline" title="Diamond / short-field from schedule">${esc(field)}</td>
        ${
          showStats
            ? `<td class="dfs-points-cell"><strong>${esc(p.slatePoints)}</strong></td>
               <td class="dfs-games-cell">${esc(p.slateGames)}</td>`
            : ""
        }
        <td class="dfs-opp-cell dfs-cell-preline">${esc(p.opponentName)}</td>
        <td class="dfs-pitcher-cell dfs-cell-preline" title="${escAttr(pitcherTitle)}">${esc(
          p.opposingPitcher
        )}</td>
      </tr>`;
    })
    .join("");
}

function showPoolError(message) {
  const tbody = document.querySelector("#playerPoolTable tbody");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="8" class="dfs-leaderboard-empty">${esc(message)}</td></tr>`;
  }
  hideMmsLoadingScreen();
}

function isBareDfsIndexPath() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const base = String(window.__SITE_BASE_PATH__ || "").replace(/\/+$/, "");
  const dfsRoot = `${base}/dfs`.replace(/\/+$/, "") || "/dfs";
  return path === dfsRoot || path === "/dfs";
}

async function main() {
  if (!page?.slateToken && !isBareDfsIndexPath()) {
    showPoolError("No slate selected.");
    return;
  }

  try {
    const requestedToken = String(page.slateToken || "")
      .trim()
      .toUpperCase();
    const data = await loadDfsLineupPool(page.slateToken || "", page.lineupNorms || []);

    // Bare /dfs tab only: follow live open slate (export may bake a stale token).
    if (isBareDfsIndexPath() && !slateChosenInUrl() && data.activeSlateToken) {
      const active = String(data.activeSlateToken).trim().toUpperCase();
      if (active && active !== requestedToken) {
        navigateToOpenDfsSlate(active);
        return;
      }
    }

    if (typeof window.setDfsCanEdit === "function") {
      window.setDfsCanEdit(!!data.slate?.canEdit);
    } else {
      window.__DFS_CAN_EDIT__ = !!data.slate?.canEdit;
    }

    const canEdit = !!data.slate?.canEdit;

    if (canEdit) {
      const countdownWrap = document.getElementById("dfsLockCountdown");
      if (countdownWrap && data.lockDeadlineMs != null) {
        countdownWrap.setAttribute("data-deadline-ms", String(data.lockDeadlineMs));
        const whenEl = document.getElementById("dfsLockCountdownWhen");
        if (whenEl && data.lockDeadlineLabel) {
          whenEl.textContent = data.lockDeadlineLabel;
          whenEl.hidden = false;
        }
      }

      setupLineupLockCountdown({
        deadlineMs: data.lockDeadlineMs,
        onLocked: async () => {
          const fresh = await loadDfsLineupPool("", page.lineupNorms || []);
          if (fresh.activeSlateToken) {
            await navigateToOpenDfsSlate(fresh.activeSlateToken);
            return;
          }
          window.location.replace(`${dfsLineupUrl(requestedToken)}?t=${Date.now()}`);
        },
      });
    } else {
      const countdownWrap = document.getElementById("dfsLockCountdown");
      const closed = document.getElementById("dfsLockCountdownClosed");
      if (countdownWrap) countdownWrap.hidden = true;
      if (closed) closed.hidden = false;
    }

    if (page) {
      page.slateToken = data.selectedSlate || requestedToken;
      page.showSlateStats = !!data.showSlateStats;
    }

    syncSlateChrome(data);

    if (data.showSlateStats) {
      applyLockedSlateResultsUi(data);
    } else {
      hideLockedResultsChrome();
    }

    renderPoolRows(data);
    updateSiteUpdated(data.fetchedAt);
    if (typeof window.initDfsLineupPage === "function") {
      await window.initDfsLineupPage();
    }
    if (data.showSlateStats && typeof window.refreshDfsLineupScores === "function") {
      const byNorm = {};
      for (const p of data.playerPool || []) {
        byNorm[p.norm] = {
          name: p.name,
          points: p.slatePoints ?? 0,
          games: p.slateGames ?? 0,
        };
      }
      window.refreshDfsLineupScores(byNorm);
    }
    hideMmsLoadingScreen();
  } catch (err) {
    console.error(err);
    showPoolError(publicErrorMessage(err, "Could not load player pool. Please try again."));
  }
}

main();
