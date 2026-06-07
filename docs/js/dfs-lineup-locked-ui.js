/**
 * GitHub Pages: enable locked-slate results UI when ?slate= loads a past W# or D######## week.
 * Static export only bakes the open slate; this mirrors server-rendered results layout client-side.
 */

function esc(text) {
  const el = document.createElement("span");
  el.textContent = text == null ? "" : String(text);
  return el.innerHTML;
}

function updateSlateBanner(data) {
  const slate = data.slate;
  if (!slate) return;
  const title = document.querySelector(".dfs-slate-banner .dfs-slate-title");
  if (title) title.textContent = slate.label || slate.viewToken || "";
  const status = document.querySelector(".dfs-slate-banner .dfs-slate-status");
  if (status) {
    status.className = "dfs-slate-status dfs-slate-status--past";
    status.textContent =
      "View only — lineup deadline passed. Scores appear when results are available for this slate.";
  }
  const list = document.querySelector(".dfs-slate-banner .dfs-game-list");
  if (list && Array.isArray(slate.games) && slate.games.length) {
    list.innerHTML = slate.games
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

function ensureViewOnlyNotice(data) {
  let notice = document.getElementById("dfsSlateViewOnlyNotice");
  if (!notice) {
    notice = document.createElement("p");
    notice.id = "dfsSlateViewOnlyNotice";
    notice.className = "dfs-slate-lock-notice dfs-slate-lock-notice--view";
    notice.setAttribute("role", "status");
    const form = document.getElementById("dfsSlateForm");
    if (form) form.parentNode.insertBefore(notice, form.nextSibling);
  }
  const open = data.activeSlateToken;
  const base = String(window.__SITE_BASE_PATH__ || "");
  const openLink = open
    ? ` <a href="${base}/dfs?slate=${encodeURIComponent(open)}" class="dfs-slate-lock-link">Go to open slate</a>`
    : "";
  notice.innerHTML = `<strong>View only.</strong> The lineup deadline for this slate has passed — review picks and scores below.${openLink}`;
  notice.hidden = false;
}

function ensureLineupHeadingScore() {
  const heading = document.querySelector(".dfs-lineup-heading");
  if (!heading || document.getElementById("lineupHeadingScore")) return;
  const span = document.createElement("span");
  span.className = "dfs-lineup-heading-points";
  span.id = "lineupHeadingScore";
  span.innerHTML = 'Points: <strong data-points-value>—</strong>';
  heading.appendChild(span);
}

function ensureScoreCard(data, byNorm) {
  let card = document.getElementById("slateScoreCard");
  if (!card) {
    card = document.createElement("section");
    card.className = "dfs-score-card";
    card.id = "slateScoreCard";
    const topRow = document.querySelector(".dfs-top-row");
    const lineupCard = document.querySelector(".dfs-lineup-card");
    if (topRow && lineupCard) {
      topRow.insertBefore(card, lineupCard.nextSibling);
    } else {
      const layout = document.querySelector(".dfs-layout");
      if (layout) layout.appendChild(card);
    }
  }
  card.hidden = false;

  const hasStats = data.slateStats?.hasStats;
  const noBox =
    data.hasGamelogData && data.slateHasBoxScores === false;
  let note = "";
  if (!hasStats) {
    note = noBox
      ? '<p class="dfs-rules-note">Game results aren’t available for this slate’s scheduled dates yet — fantasy points will show here once they are.</p>'
      : '<p class="dfs-rules-note">No scoring results for this slate yet.</p>';
  }

  card.innerHTML =
    "<h2 class=\"section-heading\">Your lineup score</h2>" +
    note +
    '<p class="dfs-score-total"><span id="slateScoreTotal">—</span><span class="dfs-score-pts">pts</span></p>' +
    '<ul class="dfs-score-breakdown" id="slateScoreBreakdown"></ul>';

  const norms = data.lineupNorms || [];
  if (norms.length && hasStats) {
    let total = 0;
    const list = document.getElementById("slateScoreBreakdown");
    const totalEl = document.getElementById("slateScoreTotal");
    for (const norm of norms) {
      const row = byNorm[norm] || { points: 0, games: 0 };
      total += row.points;
      if (list) {
        const li = document.createElement("li");
        const name = row.name || norm;
        li.innerHTML = `<span>${esc(name)}</span><strong>${row.points}</strong><span class="dfs-score-games">${row.games} gm${row.games > 1 ? " avg" : ""}</span>`;
        list.appendChild(li);
      }
    }
    const rounded = Math.round(total);
    if (totalEl) totalEl.textContent = String(rounded);
    const headingVal = document.querySelector("#lineupHeadingScore [data-points-value]");
    if (headingVal) headingVal.textContent = String(rounded);
  }
}

function ensurePoolTableStatsHeaders() {
  const statCols = document.querySelectorAll(".dfs-pool-stat-col");
  if (statCols.length) {
    statCols.forEach((th) => {
      th.hidden = false;
    });
    return;
  }
  const row = document.querySelector("#playerPoolTable thead tr");
  if (!row) return;
  const headers = [...row.children].map((th) => th.textContent.trim());
  if (headers.includes("Pts")) return;
  const addTh = row.querySelector("th:empty") || row.firstElementChild;
  if (addTh && addTh.textContent.trim() === "" && addTh !== row.children[1]) {
    addTh.remove();
  }
  const fieldTh = [...row.children].find((th) => th.textContent.trim() === "Field");
  const ptsTh = document.createElement("th");
  ptsTh.textContent = "Pts";
  const gmTh = document.createElement("th");
  gmTh.textContent = "Gm";
  if (fieldTh) {
    fieldTh.after(gmTh);
    fieldTh.after(ptsTh);
  }
}

function ensurePointsSortButton() {
  const group = document.querySelector(".dfs-sort-group");
  if (!group) return;
  const ptsBtn = document.getElementById("dfsPointsSortBtn");
  if (ptsBtn) {
    ptsBtn.hidden = false;
    ptsBtn.classList.add("is-active");
    group.querySelector('[data-sort="salary"]')?.classList.remove("is-active");
    return;
  }
  if (group.querySelector('[data-sort="points"]')) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "dfs-sort-btn is-active";
  btn.setAttribute("data-sort", "points");
  btn.textContent = "Points";
  group.querySelector('[data-sort="salary"]')?.classList.remove("is-active");
  group.appendChild(btn);
}

function ensurePoolHiddenNotice() {
  let notice = document.getElementById("dfsPoolHiddenNotice");
  if (!notice) {
    notice = document.createElement("p");
    notice.id = "dfsPoolHiddenNotice";
    notice.className = "dfs-pool-hidden-notice";
    notice.setAttribute("role", "status");
    notice.textContent =
      "The player pool is hidden after the lineup deadline. Your saved lineup and locked salaries are shown above; the leaderboard uses those same prices.";
    const pool = document.getElementById("dfsPoolSection");
    if (pool) pool.parentNode.insertBefore(notice, pool);
  }
  notice.hidden = false;
}

export function applyLockedSlateResultsUi(data) {
  if (!data?.showSlateStats) return;

  window.__DFS_SHOW_SLATE_STATS__ = true;
  if (window.__DFS_LINEUP_PAGE__) {
    window.__DFS_LINEUP_PAGE__.slateToken = data.selectedSlate;
    window.__DFS_LINEUP_PAGE__.showSlateStats = true;
  }

  const byNorm = {};
  for (const p of data.playerPool || []) {
    byNorm[p.norm] = {
      name: p.name,
      points: p.slatePoints ?? 0,
      games: p.slateGames ?? 0,
    };
  }

  let ptsEl = document.getElementById("slatePointsData");
  if (!ptsEl) {
    ptsEl = document.createElement("script");
    ptsEl.type = "application/json";
    ptsEl.id = "slatePointsData";
    document.body.appendChild(ptsEl);
  }
  ptsEl.textContent = JSON.stringify(byNorm);

  document.querySelector(".dfs-page")?.classList.add("dfs-page--readonly");
  ensureViewOnlyNotice(data);
  ensureLineupHeadingScore();
  ensureScoreCard(data, byNorm);
  ensurePoolTableStatsHeaders();
  ensurePointsSortButton();
  ensurePoolHiddenNotice();

  if (typeof window.refreshDfsLineupScores === "function") {
    window.refreshDfsLineupScores(byNorm);
  }
}

export function hideLockedResultsChrome() {
  window.__DFS_SHOW_SLATE_STATS__ = false;
  const card = document.getElementById("slateScoreCard");
  if (card) card.hidden = true;
  const notice = document.getElementById("dfsSlateViewOnlyNotice");
  if (notice) notice.hidden = true;
  const poolNotice = document.getElementById("dfsPoolHiddenNotice");
  if (poolNotice) poolNotice.hidden = true;
}
