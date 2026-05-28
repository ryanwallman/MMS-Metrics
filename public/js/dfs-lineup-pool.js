/**
 * Load DFS player pool from Google Sheets on GitHub Pages, then boot lineup UI.
 */
import { loadDfsLineupPool } from "./dfs-lineup-pool.mjs";
import {
  setupLineupLockCountdown,
  navigateToOpenDfsSlate,
  dfsLineupUrl,
} from "./dfs-lock-countdown.js";

const page = window.__DFS_LINEUP_PAGE__;

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
      return `<tr
        class="dfs-player-row${inLineup ? " dfs-player-row--selected" : ""}"
        data-norm="${escAttr(p.norm)}"
        data-name="${escAttr(p.name)}"
        data-team="${escAttr(p.teamName)}"
        data-salary="${p.salary}"
        data-field="${escAttr(field)}"
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
        <td class="dfs-player-name">${esc(p.name)}</td>
        <td>${esc(p.teamName)}</td>
        <td class="dfs-field-cell" title="Diamond / short-field from schedule">${esc(field)}</td>
        <td class="dfs-salary-cell">$${Number(p.salary).toLocaleString()}</td>
        ${
          showStats
            ? `<td class="dfs-points-cell"><strong>${esc(p.slatePoints)}</strong></td>
               <td class="dfs-games-cell">${esc(p.slateGames)}</td>`
            : ""
        }
        <td class="dfs-opp-cell">${esc(p.opponentName)}</td>
        <td class="dfs-pitcher-cell" title="${escAttr(pitcherTitle)}">${esc(
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
}

async function main() {
  if (!page?.slateToken) {
    showPoolError("No slate selected.");
    return;
  }

  try {
    const requestedToken = String(page.slateToken || "")
      .trim()
      .toUpperCase();
    const data = await loadDfsLineupPool(page.slateToken, page.lineupNorms || []);

    if (
      !data.slate?.canEdit &&
      data.activeSlateToken &&
      data.activeSlateToken !== requestedToken
    ) {
      navigateToOpenDfsSlate(data.activeSlateToken);
      return;
    }

    if (typeof window.setDfsCanEdit === "function") {
      window.setDfsCanEdit(!!data.slate?.canEdit);
    } else {
      window.__DFS_CAN_EDIT__ = !!data.slate?.canEdit;
    }

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
        if (fresh.activeSlateToken && fresh.activeSlateToken !== requestedToken) {
          navigateToOpenDfsSlate(fresh.activeSlateToken);
          return;
        }
        window.location.replace(`${dfsLineupUrl(requestedToken)}?t=${Date.now()}`);
      },
    });

    renderPoolRows(data);
    updateSiteUpdated(data.fetchedAt);
    if (typeof window.initDfsLineupPage === "function") {
      window.initDfsLineupPage();
    }
  } catch (err) {
    console.error(err);
    showPoolError(err.message || "Could not load player pool.");
  }
}

main();
