/**
 * Power Rankings — live data from Google Sheets (GitHub Pages + static export).
 */
import { fetchPowerRankingsData } from "./power-rankings.mjs";

function siteBasePath() {
  const b = typeof window !== "undefined" ? window.__SITE_BASE_PATH__ : "";
  return b == null ? "" : String(b);
}

function sitePath(path) {
  const base = siteBasePath();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function esc(text) {
  const el = document.createElement("span");
  el.textContent = text == null ? "" : String(text);
  return el.innerHTML;
}

function formatPowerRating(n) {
  if (!Number.isFinite(n)) return "—";
  return n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2);
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

function renderCurrentTable(rows) {
  const body = (rows || [])
    .map(
      (t) => `<tr>
      <td style="text-align: right">${t.rank}</td>
      <td>${esc(t.teamName)} (#${esc(t.teamId)})</td>
      <td>${esc(t.captain || "—")}</td>
      <td style="text-align: right"><strong>${esc(formatPowerRating(t.powerRating))}</strong></td>
      <td style="text-align: right">${t.wins}-${t.losses}</td>
      <td class="power-heat-cell" style="text-align: right;${t.winPctHeatStyle || ""}">
        ${t.winPct != null ? `${(t.winPct * 100).toFixed(1)}%` : "—"}
      </td>
      <td class="power-heat-cell" style="text-align: right;${t.sosHeatStyle || ""}">
        ${t.sosOppWinPct != null ? `${(t.sosOppWinPct * 100).toFixed(1)}%` : "—"}
      </td>
      <td style="text-align: right">${esc(formatPowerRating(t.rosterRating))}</td>
      <td style="text-align: right">${t.gamesPlayed}</td>
    </tr>`
    )
    .join("");
  return `<section class="power-rankings-section">
      <h2>Current power rankings</h2>
      <p class="power-rankings-note">
        Sorted by blended team power rating (higher = stronger right now).
        <span class="power-heat-legend">Win % and SOS are color-coded: green = higher win % or easier schedule; red = lower win % or tougher schedule.</span>
      </p>
      <div class="rankings-table-wrap">
        <table class="rankings-master-table page-table power-rankings-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Team</th>
              <th>Captain</th>
              <th>Power</th>
              <th>Record</th>
              <th>Win %</th>
              <th>SOS</th>
              <th>Roster</th>
              <th>GP</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </section>`;
}

function renderProjectionTable(rows, regularSeasonGames) {
  const body = (rows || [])
    .map(
      (t) => `<tr>
      <td style="text-align: right">${t.projectedRank}</td>
      <td>${esc(t.teamName)} (#${esc(t.teamId)})</td>
      <td>${esc(t.captain || "—")}</td>
      <td style="text-align: right">${t.currentWins}-${t.currentLosses}</td>
      <td style="text-align: right"><strong>${esc(t.projectedRecord)}</strong></td>
      <td style="text-align: right">
        ${t.projectedWinPct != null ? `${t.projectedWinPct.toFixed(1)}%` : "—"}
      </td>
      <td style="text-align: right" title="Rounded projected W-L minus current record">${esc(t.expRestRecord)}</td>
      <td style="text-align: right">${t.currentPowerRank != null ? t.currentPowerRank : "—"}</td>
    </tr>`
    )
    .join("");
  return `<section class="power-rankings-section">
      <h2>Projected final standings (${regularSeasonGames}-game season)</h2>
      <p class="power-rankings-note">
        Sorted by projected wins. “Proj. W-L” rounds expected totals; “Proj. win %” uses fractional wins.
      </p>
      <div class="rankings-table-wrap">
        <table class="rankings-master-table page-table power-rankings-table">
          <thead>
            <tr>
              <th>Proj. rank</th>
              <th>Team</th>
              <th>Captain</th>
              <th>Current</th>
              <th>Proj. W-L</th>
              <th>Proj. win %</th>
              <th>Exp. rest</th>
              <th>Power rank now</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </section>`;
}

function renderExplainer(data) {
  const w = data.teamOverallWeights || { player: 0.3, record: 0.5, sos: 0.2 };
  const simNote =
    data.remainingGamesTotal > 0
      ? `<p style="margin-bottom: 0;">
        <strong>${data.remainingGamesSimulated}</strong> of <strong>${data.remainingGamesTotal}</strong> unplayed
        schedule games were simulated (games missing roster data are skipped).
      </p>`
      : "";
  return `<section class="rankings-explainer power-rankings-explainer">
      <h2>How this works</h2>
      <p>
        <strong>Current power</strong> uses the same team blend as offensive rankings:
        <strong>${Math.round(w.player * 100)}%</strong> roster talent (2026 PA–weighted player ratings),
        <strong>${Math.round(w.record * 100)}%</strong> record (win % z-score),
        <strong>${Math.round(w.sos * 100)}%</strong> strength of schedule (avg. opponent win %).
      </p>
      <p>
        <strong>Season projections</strong> start from each team’s current W-L, then add
        <em>expected</em> wins and losses on every remaining game. That uses the same underlying matchup model as the
        <a href="${esc(sitePath("/matchup-predictor"))}">matchup predictor</a>, but with a <strong>sharper</strong> win curve (less pulled
        toward 50/50) so strong teams can project toward records like 18–4 and weak teams toward heavier losses.
        Projected win % keeps fractional expected wins; the W-L column rounds to whole numbers. Regular season length:
        <strong>${data.regularSeasonGames} games</strong>.
      </p>
      ${simNote}
    </section>`;
}

function renderPage(data) {
  const root = document.getElementById("powerRankingsRoot");
  if (!root) return;
  root.innerHTML = `${renderExplainer(data)}
    ${renderCurrentTable(data.currentRankings)}
    ${renderProjectionTable(data.projectionRows, data.regularSeasonGames)}`;
  root.removeAttribute("aria-busy");
}

function renderError(message) {
  const root = document.getElementById("powerRankingsRoot");
  if (!root) return;
  root.innerHTML = `<section class="dfs-leaderboard-alert dfs-leaderboard-alert--error" role="alert"><p>${esc(
    message
  )}</p><p><button type="button" class="dfs-btn" id="powerRankingsRetry">Try again</button></p></section>`;
  root.removeAttribute("aria-busy");
  document.getElementById("powerRankingsRetry")?.addEventListener("click", () => {
    root.setAttribute("aria-busy", "true");
    root.innerHTML =
      '<p class="league-leaders-loading">Loading...</p>';
    load();
  });
}

async function load() {
  try {
    const data = await fetchPowerRankingsData();
    renderPage(data);
    updateSiteUpdated(data.fetchedAt);
  } catch (err) {
    console.error(err);
    renderError(err.message || "Could not load power rankings.");
  }
}

load();
