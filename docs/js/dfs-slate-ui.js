/**
 * GitHub Pages: refresh slate picker + banner from live schedule (static HTML is stale after lock).
 */
import { dfsLineupUrl } from "./dfs-lock-countdown.js";

function esc(text) {
  const el = document.createElement("span");
  el.textContent = text == null ? "" : String(text);
  return el.innerHTML;
}

function teamCount(slate) {
  if (!slate?.teamIds) return 0;
  if (slate.teamIds instanceof Set) return slate.teamIds.size;
  if (Array.isArray(slate.teamIds)) return slate.teamIds.length;
  return 0;
}

export function updateSlatePicker(data) {
  const nav = document.querySelector(".dfs-slate-picker");
  if (!nav || !Array.isArray(data?.slateOptions)) return;

  const selected = String(data.selectedSlate || data.slate?.viewToken || "")
    .trim()
    .toUpperCase();

  nav.innerHTML = data.slateOptions
    .map((opt) => {
      const value = String(opt.value || "")
        .trim()
        .toUpperCase();
      const isSelected = value === selected;
      const classes = [
        "dfs-slate-chip",
        isSelected ? "is-selected" : "",
        opt.canEdit ? "dfs-slate-chip--open" : "dfs-slate-chip--locked",
        opt.isPast ? "dfs-slate-chip--past" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const suffix = opt.canEdit ? " · open" : " · locked";
      const href = dfsLineupUrl(value);
      return `<a href="${href}" class="${classes}" data-slate="${esc(value)}"${
        isSelected ? ' aria-current="page"' : ""
      }>${esc(opt.label)}${suffix}</a>`;
    })
    .join("");
}

export function updateSlateBanner(data) {
  const slate = data?.slate;
  if (!slate) return;

  const title = document.querySelector(".dfs-slate-banner .dfs-slate-title");
  if (title) title.textContent = slate.label || slate.viewToken || "";

  const status = document.querySelector(".dfs-slate-banner .dfs-slate-status");
  if (status) {
    const games = Array.isArray(slate.games) ? slate.games.length : 0;
    const teams = teamCount(slate);
    if (slate.canEdit) {
      status.className = "dfs-slate-status dfs-slate-status--open";
      const deadline = data.lockDeadlineLabel || "deadline";
      const when =
        slate.slateType === "wednesday"
          ? "(8:00 PM Eastern on game day)"
          : "(11:59 PM Eastern the night before games)";
      status.innerHTML = `Open for lineups through <strong>${esc(deadline)}</strong> ${when} · ${games} game${
        games === 1 ? "" : "s"
      } · ${teams} teams`;
    } else if (slate.isPast) {
      status.className = "dfs-slate-status dfs-slate-status--past";
      status.textContent =
        "View only — lineup deadline passed. Scores appear when results are available for this slate.";
    } else {
      status.className = "dfs-slate-status dfs-slate-status--locked";
      status.textContent = "This slate isn’t editable right now.";
    }
  }

  const list = document.querySelector(".dfs-slate-banner .dfs-game-list");
  if (list) {
    const games = Array.isArray(slate.games) ? slate.games : [];
    if (!games.length) {
      list.innerHTML = "";
      list.hidden = true;
    } else {
      list.hidden = false;
      list.innerHTML = games
        .map((g) => {
          const field =
            g.location && g.location !== "-"
              ? `<span class="dfs-game-field">${esc(g.location)}</span>`
              : "";
          return `<li><span class="matchup-side-tag">Away</span> ${esc(g.away)} <span class="dfs-at">@</span> <span class="matchup-side-tag">Home</span> ${esc(g.home)} ${field}</li>`;
        })
        .join("");
    }
  }
}

/** Picker, banner, and open/locked page chrome from live slate data. */
export function syncSlateChrome(data) {
  updateSlatePicker(data);
  updateSlateBanner(data);

  const canEdit = !!data?.slate?.canEdit;
  const page = document.querySelector(".dfs-page");
  if (canEdit) {
    page?.classList.remove("dfs-page--readonly");
    const viewNotice = document.getElementById("dfsSlateViewOnlyNotice");
    if (viewNotice) viewNotice.hidden = true;
    const pool = document.getElementById("dfsPoolSection");
    if (pool) pool.hidden = false;
    const countdown = document.getElementById("dfsLockCountdown");
    const closed = document.getElementById("dfsLockCountdownClosed");
    if (countdown && data.lockDeadlineMs != null) {
      countdown.hidden = false;
      countdown.setAttribute("data-deadline-ms", String(data.lockDeadlineMs));
      const whenEl = document.getElementById("dfsLockCountdownWhen");
      if (whenEl && data.lockDeadlineLabel) {
        whenEl.textContent = data.lockDeadlineLabel;
        whenEl.hidden = false;
      }
    }
    if (closed) closed.hidden = true;
  }
}
