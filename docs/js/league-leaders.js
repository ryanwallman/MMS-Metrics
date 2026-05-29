/**
 * League Leaders home page — live stats from Google Sheets (GitHub Pages).
 */
import { fetchLeagueLeadersData } from "./league-leaders.mjs";

function esc(text) {
  const el = document.createElement("span");
  el.textContent = text == null ? "" : String(text);
  return el.innerHTML;
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

function renderCategoryTable(category) {
  const rows = (category.players || [])
    .map(
      (player, idx) => `<tr>
        <td>${idx + 1}</td>
        <td>${esc(player.Player)}</td>
        <td>${esc(player.Team)}</td>
        <td>${esc(player[category.field])}</td>
      </tr>`
    )
    .join("");

  return `<section class="leader-card">
    <h3 class="leader-card-title">Top 5 — ${esc(category.title)}</h3>
    <div class="leader-table-wrap">
      <table class="leader-table page-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Team</th>
            <th>${esc(category.title)}</th>
          </tr>
        </thead>
        <tbody>${rows || ""}</tbody>
      </table>
    </div>
  </section>`;
}

function renderRookiesTable(topRookies) {
  const rows = (topRookies || [])
    .map(
      (player, idx) => `<tr>
        <td>${idx + 1}</td>
        <td>${esc(player.Player)}</td>
        <td>${esc(player.Team)}</td>
        <td>${esc(player.AVG)}</td>
      </tr>`
    )
    .join("");

  return `<section class="leader-card leader-card-rookies">
    <h3 class="leader-card-title">Top 5 Rookies (by AVG)</h3>
    <div class="leader-table-wrap">
      <table class="leader-table page-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Team</th>
            <th>AVG</th>
          </tr>
        </thead>
        <tbody>${rows || ""}</tbody>
      </table>
    </div>
  </section>`;
}

function renderLeaders({ leaders, topRookies }) {
  const root = document.getElementById("leagueLeadersRoot");
  if (!root) return;

  const cards = (leaders || []).map(renderCategoryTable).join("");
  root.innerHTML = `
    <section class="leaders-section">
      <h2 class="section-heading">Top performers</h2>
      <div class="leaders-grid">
        ${cards}
        ${renderRookiesTable(topRookies)}
      </div>
    </section>`;
  root.removeAttribute("aria-busy");
}

function renderError(message) {
  const root = document.getElementById("leagueLeadersRoot");
  if (!root) return;
  root.innerHTML = `<section class="dfs-leaderboard-alert dfs-leaderboard-alert--error" role="alert"><p>${esc(
    message
  )}</p><p><button type="button" class="dfs-btn" id="leagueLeadersRetry">Try again</button></p></section>`;
  root.removeAttribute("aria-busy");
  document.getElementById("leagueLeadersRetry")?.addEventListener("click", () => {
    root.setAttribute("aria-busy", "true");
    root.innerHTML =
      '<p class="league-leaders-loading">Loading...</p>';
    load();
  });
}

async function load() {
  try {
    const data = await fetchLeagueLeadersData();
    renderLeaders(data);
    updateSiteUpdated(data.fetchedAt);
  } catch (err) {
    console.error(err);
    renderError(err.message || "Could not load league leaders.");
  }
}

load();
