/**
 * Team Analytics page UI — live game-log breakdown by lineup size.
 */
import { fetchTeamAnalyticsData } from "./team-analytics.js";
import { hideMmsLoadingScreen, showMmsLoadingScreen } from "./mms-loading-screen.js";
import { publicErrorMessage } from "./mms-public-error.js";

function esc(text) {
  const el = document.createElement("span");
  el.textContent = text == null ? "" : String(text);
  return el.innerHTML;
}

function formatRate(n, digits = 3) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function formatNum(n, digits = 1) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function formatPct(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function formatMissingRound(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function lerpRgb(a, b, t) {
  const u = Math.max(0, Math.min(1, t));
  return {
    r: a.r + (b.r - a.r) * u,
    g: a.g + (b.g - a.g) * u,
    b: a.b + (b.b - a.b) * u,
  };
}

function rgbString(c) {
  return `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
}

/** Fixed scale: 1–4.99 red, 5–9.99 yellow/orange, 10+ green (higher miss round = greener). */
function missingRoundHeatRgb(value) {
  if (value == null || !Number.isFinite(value)) return null;

  const deepRed = { r: 220, g: 38, b: 38 };
  const lightRed = { r: 252, g: 165, b: 165 };
  const orange = { r: 249, g: 115, b: 22 };
  const yellow = { r: 253, g: 224, b: 71 };
  const lightGreen = { r: 134, g: 239, b: 172 };
  const deepGreen = { r: 22, g: 163, b: 74 };

  if (value < 5) {
    const t = (Math.max(value, 1) - 1) / 4;
    return rgbString(lerpRgb(deepRed, lightRed, t));
  }
  if (value < 10) {
    const t = (value - 5) / 5;
    return rgbString(lerpRgb(orange, yellow, t));
  }
  const t = Math.min(1, (value - 10) / 5);
  return rgbString(lerpRgb(lightGreen, deepGreen, t));
}

function missingRoundHeatBackground(value) {
  const rgb = missingRoundHeatRgb(value);
  return rgb ? `background-color: ${rgb}` : "";
}

function missingRoundHeatCell(value) {
  const style = missingRoundHeatBackground(value);
  const cls = ["ta-num", "ta-col-miss", style ? "team-analytics-heat-cell" : ""]
    .filter(Boolean)
    .join(" ");
  return `<td class="${cls}"${style ? ` style="${style}"` : ""}>${esc(formatMissingRound(value))}</td>`;
}

const TEAM_COLGROUP = `<colgroup>
  <col class="ta-col-lineup" />
  <col class="ta-col-games" />
  <col class="ta-col-wl" />
  <col class="ta-col-miss" />
  <col class="ta-col-winpct" />
  <col class="ta-col-runs" />
  <col class="ta-col-runs" />
  <col class="ta-col-windiff" />
  <col class="ta-col-rate" />
  <col class="ta-col-rate" />
  <col class="ta-col-rate" />
  <col class="ta-col-rate" />
</colgroup>`;

const LEAGUE_COLGROUP = `<colgroup>
  <col class="ta-col-rank" />
  <col class="ta-col-team" />
  <col class="ta-col-captain" />
  <col class="ta-col-wl" />
  <col class="ta-col-miss" />
  <col class="ta-col-winpct" />
  <col class="ta-col-windiff" />
</colgroup>`;

function tdNum(content, colClass = "") {
  const cls = ["ta-num", colClass].filter(Boolean).join(" ");
  return `<td class="${cls}">${content}</td>`;
}

function tdText(content, colClass = "", extraClass = "") {
  const cls = [colClass, extraClass].filter(Boolean).join(" ");
  return `<td class="${cls}">${content}</td>`;
}

function thNum(label, colClass = "") {
  const cls = ["ta-num", colClass].filter(Boolean).join(" ");
  return `<th class="${cls}">${label}</th>`;
}

function thText(label, colClass = "", extraClass = "") {
  const cls = [colClass, extraClass].filter(Boolean).join(" ");
  return `<th class="${cls}">${label}</th>`;
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

function teamStatCells(b) {
  return `${tdNum(esc(b.games), "ta-col-games")}
      ${tdNum(esc(b.record), "ta-col-wl")}
      ${missingRoundHeatCell(b.avgMissingRound)}
      ${tdNum(esc(formatPct(b.winPct)), "ta-col-winpct")}
      ${tdNum(esc(formatNum(b.runsPerGame)), "ta-col-runs")}
      ${tdNum(esc(formatNum(b.runsAllowedPerGame)), "ta-col-runs")}
      ${tdNum(esc(formatNum(b.runDiffPerGame, 1)), "ta-col-windiff")}
      ${tdNum(esc(formatRate(b.avg)), "ta-col-rate")}
      ${tdNum(esc(formatRate(b.obp)), "ta-col-rate")}
      ${tdNum(esc(formatRate(b.slg)), "ta-col-rate")}
      ${tdNum(esc(formatRate(b.ops)), "ta-col-rate")}`;
}

function leagueStatCells(b) {
  return `${tdText(esc(b.captain || "—"), "ta-col-captain")}
      ${tdNum(esc(b.record), "ta-col-wl")}
      ${missingRoundHeatCell(b.avgMissingRound)}
      ${tdNum(esc(formatPct(b.winPct)), "ta-col-winpct")}
      ${tdNum(esc(formatNum(b.runDiffPerGame, 1)), "ta-col-windiff")}`;
}

function renderTeamBucketTable(buckets, emptyMessage) {
  if (!buckets?.length) {
    return `<p class="page-note">${esc(emptyMessage || "No completed game logs found yet.")}</p>`;
  }

  const rows = buckets
    .map(
      (b) => `<tr>
      <td class="ta-col-lineup"><strong>${esc(b.lineupSize)}</strong> players</td>
      ${teamStatCells(b)}
    </tr>`
    )
    .join("");

  return `<div class="team-analytics-table-wrap team-analytics-table-wrap--team">
    <table class="page-table team-analytics-table team-analytics-table--team">
      ${TEAM_COLGROUP}
      <thead>
        <tr>
          <th class="ta-col-lineup">Lineup</th>
          ${thNum("Games", "ta-col-games")}
          ${thNum("W-L", "ta-col-wl")}
          ${thNum("Avg miss rnd", "ta-col-miss")}
          ${thNum("Win %", "ta-col-winpct")}
          ${thNum("Runs/G", "ta-col-runs")}
          ${thNum("RA/G", "ta-col-runs")}
          ${thNum("Diff/G", "ta-col-windiff")}
          ${thNum("AVG", "ta-col-rate")}
          ${thNum("OBP", "ta-col-rate")}
          ${thNum("SLG", "ta-col-rate")}
          ${thNum("OPS", "ta-col-rate")}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function renderLeagueBucketTable(rows, highlightTeamId = null) {
  if (!rows?.length) return "";

  const body = rows
    .map((b) => {
      const isHighlight = highlightTeamId && b.teamId === highlightTeamId;
      return `<tr class="${isHighlight ? "team-analytics-row--highlight" : ""}">
      ${tdNum(esc(b.rank), "ta-col-rank ta-sticky-rank")}
      ${tdText(esc(b.teamName), "ta-col-team ta-sticky-team")}
      ${leagueStatCells(b)}
    </tr>`;
    })
    .join("");

  return `<div class="team-analytics-table-wrap team-analytics-table-wrap--league">
    <table class="page-table team-analytics-table team-analytics-table--league">
      ${LEAGUE_COLGROUP}
      <thead>
        <tr>
          ${thNum("Rank", "ta-col-rank ta-sticky-rank")}
          ${thText("Team", "ta-col-team ta-sticky-team")}
          ${thText("Captain", "ta-col-captain")}
          ${thNum("W-L", "ta-col-wl")}
          ${thNum("Avg miss rnd", "ta-col-miss")}
          ${thNum("Win %", "ta-col-winpct")}
          ${thNum("Win Diff", "ta-col-windiff")}
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

function renderTeamAnalytics(root, payload, teamId) {
  const { analytics, error } = payload;
  if (error) {
    root.innerHTML = `<p class="page-note page-note--error">${esc(error)}</p>`;
    return;
  }

  root.innerHTML = `
    <section class="team-analytics-section">
      <h2 class="team-analytics-heading">This team by lineup size</h2>
      ${renderTeamBucketTable(analytics.buckets, "No completed game logs found for this team yet.")}
    </section>`;
}

function renderLeagueRankings(root, leagueRankings, highlightTeamId = null) {
  if (!leagueRankings?.length) {
    root.innerHTML = `<p class="page-note">No league game logs available yet.</p>`;
    return;
  }

  const sections = leagueRankings
    .map(
      (section) => `<section class="team-analytics-league-section">
      <h3 class="team-analytics-subheading">${esc(section.lineupSize)} players in lineup</h3>
      ${renderLeagueBucketTable(section.rows, highlightTeamId)}
    </section>`
    )
    .join("");

  root.innerHTML = `
    <section class="team-analytics-league">
      <h2 class="team-analytics-heading">League records by players present</h2>
      ${sections}
    </section>`;
}

function siteBasePath() {
  const b = typeof window !== "undefined" ? window.__SITE_BASE_PATH__ : "";
  return b == null ? "" : String(b);
}

function sitePath(path) {
  const base = siteBasePath();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function parseTeamIdFromPath(pathname) {
  let p = pathname || "";
  const base = siteBasePath();
  if (base && p.startsWith(base)) p = p.slice(base.length) || "/";
  const m = p.match(/^\/team-analytics\/(\d+)\/?$/);
  return m ? m[1] : null;
}

let navBound = false;
let currentTeamId = null;
let loadGeneration = 0;

function updatePageTitleForTeam(teamId) {
  const link = document.querySelector(`.team-nav-link[href*="/team-analytics/${teamId}"]`);
  const name = link?.querySelector(".team-nav-name")?.textContent?.trim() || `Team ${teamId}`;
  const titleEl = document.querySelector(".page-title");
  if (titleEl) titleEl.textContent = name;
  document.title = `${name} — Team Analytics`;
}

function updateTeamNavSelection(teamId) {
  document.querySelectorAll(".team-nav-link").forEach((a) => {
    const href = a.getAttribute("href") || "";
    const id = (href.match(/\/team-analytics\/(\d+)/) || [])[1];
    const selected = teamId && id === String(teamId);
    a.classList.toggle("is-selected", selected);
    if (selected) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

function ensureTeamRoot() {
  let root = document.getElementById("teamAnalyticsRoot");
  if (root) return root;

  const pickNote = document.querySelector(".team-analytics-pick-note");
  if (pickNote) pickNote.hidden = true;

  root = document.createElement("div");
  root.id = "teamAnalyticsRoot";
  root.setAttribute("aria-live", "polite");
  const nav = document.querySelector(".team-nav");
  if (nav?.parentNode) nav.parentNode.insertBefore(root, nav);
  return root;
}

function showPickNote() {
  const pickNote = document.querySelector(".team-analytics-pick-note");
  if (pickNote) pickNote.hidden = false;
  const teamRoot = document.getElementById("teamAnalyticsRoot");
  if (teamRoot) teamRoot.remove();
}

function bindTeamAnalyticsNav() {
  if (navBound) return;
  navBound = true;

  document.querySelector(".team-nav")?.addEventListener("click", (e) => {
    const link = e.target.closest(".team-nav-link");
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || link.target === "_blank") return;
    const href = link.getAttribute("href") || "";
    const teamId = (href.match(/\/team-analytics\/(\d+)/) || [])[1];
    if (!teamId || teamId === currentTeamId) return;
    e.preventDefault();
    void navigateToTeam(teamId);
  });

  window.addEventListener("popstate", () => {
    const teamId = parseTeamIdFromPath(window.location.pathname);
    if (teamId === currentTeamId) return;
    void navigateToTeam(teamId, { fromPopstate: true });
  });
}

async function navigateToTeam(teamId, { fromPopstate = false } = {}) {
  currentTeamId = teamId || null;

  if (teamId) {
    if (!fromPopstate) {
      history.pushState({ teamAnalyticsTeamId: teamId }, "", sitePath(`/team-analytics/${teamId}`));
    }
    updateTeamNavSelection(teamId);
    updatePageTitleForTeam(teamId);
    await loadAndRender(teamId, { teamSwitch: true });
    return;
  }

  if (!fromPopstate) {
    history.pushState({ teamAnalyticsTeamId: null }, "", sitePath("/team-analytics"));
  }
  updateTeamNavSelection(null);
  const titleEl = document.querySelector(".page-title");
  if (titleEl) titleEl.textContent = "Team Analytics";
  document.title = "Team Analytics";
  showPickNote();
  await loadAndRender(null);
}

async function loadAndRender(teamId, { fullScreenLoading = false, teamSwitch = false } = {}) {
  const gen = ++loadGeneration;
  const teamRoot = teamId ? ensureTeamRoot() : document.getElementById("teamAnalyticsRoot");
  const leagueRoot = document.getElementById("teamAnalyticsLeagueRoot");

  if (fullScreenLoading) showMmsLoadingScreen();
  if (teamId && teamRoot) {
    teamRoot.setAttribute("aria-busy", "true");
    if (teamSwitch) {
      teamRoot.innerHTML = '<p class="page-note">Loading team stats…</p>';
    }
  }
  leagueRoot?.setAttribute("aria-busy", "true");

  try {
    const payload = await fetchTeamAnalyticsData(teamId || null);
    if (gen !== loadGeneration) return;
    if (payload.generatedAt) updateSiteUpdated(payload.generatedAt);
    if (teamId && teamRoot) renderTeamAnalytics(teamRoot, payload, teamId);
    if (leagueRoot) renderLeagueRankings(leagueRoot, payload.leagueRankings, teamId || null);
  } catch (error) {
    if (gen !== loadGeneration) return;
    const message = esc(publicErrorMessage(error, "Failed to load team analytics."));
    if (teamId && teamRoot) {
      teamRoot.innerHTML = `<p class="page-note page-note--error">${message}</p>`;
    }
    if (leagueRoot) {
      leagueRoot.innerHTML = `<p class="page-note page-note--error">${message}</p>`;
    }
  } finally {
    if (gen !== loadGeneration) return;
    teamRoot?.removeAttribute("aria-busy");
    leagueRoot?.removeAttribute("aria-busy");
    if (fullScreenLoading) hideMmsLoadingScreen();
  }
}

export async function initTeamAnalyticsPage(teamId = null) {
  const leagueRoot = document.getElementById("teamAnalyticsLeagueRoot");
  if (!leagueRoot) return;

  currentTeamId = teamId || null;
  bindTeamAnalyticsNav();
  await loadAndRender(teamId, { fullScreenLoading: Boolean(teamId) });
}
