/**
 * Power Rankings — live data from Google Sheets (GitHub Pages + static export).
 */
import { fetchPowerRankingsData } from "./power-rankings.mjs";
import { mountPowerRankingsViz, renderVizTabShell } from "./power-rankings-viz.mjs";
import { hideMmsLoadingScreen, showMmsLoadingScreen } from "./mms-loading-screen.js";
import { publicErrorMessage } from "./mms-public-error.js";

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

function renderTabs() {
  return `<nav class="power-rankings-tabs" role="tablist" aria-label="Power rankings views">
    <button type="button" class="power-rankings-tab power-rankings-tab--active" role="tab" id="prTabRankings" aria-selected="true" aria-controls="powerRankingsPanelRankings" data-tab="rankings">Rankings</button>
    <button type="button" class="power-rankings-tab" role="tab" id="prTabViz" aria-selected="false" aria-controls="powerRankingsPanelViz" data-tab="viz">Data Visualization</button>
  </nav>`;
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

function renderBracketTeam(team, seed) {
  if (!team) {
    return `<span class="playoff-bracket-team playoff-bracket-team--empty">—</span>`;
  }
  const seedLabel = seed != null ? `<span class="playoff-bracket-seed">#${seed}</span>` : "";
  const captain = team.captain ? `<span class="playoff-bracket-captain">${esc(team.captain)}</span>` : "";
  const record = team.projectedRecord
    ? `<span class="playoff-bracket-record">${esc(team.projectedRecord)}</span>`
    : "";
  return `<div class="playoff-bracket-team">
    ${seedLabel}
    <span class="playoff-bracket-name">${esc(team.teamName)}</span>
    ${captain}
    ${record}
  </div>`;
}

function renderPlayoffBracket(bracket) {
  if (!bracket?.ok) {
    return "";
  }

  const pigHtml = (bracket.pigGames || [])
    .map(
      (g) => `<div class="playoff-bracket-matchup playoff-bracket-matchup--pig">
      <p class="playoff-bracket-matchup-label">🐷 PIG · #${g.highSeed} vs #${g.lowSeed}</p>
      <div class="playoff-bracket-pair">
        ${renderBracketTeam(g.high, g.highSeed)}
        <span class="playoff-bracket-vs">vs</span>
        ${renderBracketTeam(g.away, g.lowSeed)}
      </div>
    </div>`
    )
    .join("");

  const mainHtml = (bracket.mainMatchups || [])
    .map((m) => {
      const lowSide = m.lowTbd
        ? `<div class="playoff-bracket-team playoff-bracket-team--tbd">
            <span class="playoff-bracket-seed">#${m.lowSeed}</span>
            <span class="playoff-bracket-name">${esc(m.pigNote || "TBD")}</span>
          </div>`
        : renderBracketTeam(m.low, m.lowSeed);
      return `<div class="playoff-bracket-matchup">
        <p class="playoff-bracket-matchup-label">#${m.highSeed} vs #${m.lowSeed}</p>
        <div class="playoff-bracket-pair">
          ${renderBracketTeam(m.high, m.highSeed)}
          <span class="playoff-bracket-vs">vs</span>
          ${lowSide}
        </div>
      </div>`;
    })
    .join("");

  return `<section class="power-rankings-section playoff-bracket-section">
      <h2>Projected playoff bracket (round 1)</h2>
      <p class="power-rankings-note">
        Based on projected final standings. Seeds <strong>1–${bracket.directPlayoffSeeds}</strong> qualify directly.
        Seeds <strong>15–18</strong> play in the <strong>play-in game (PIG 🐷)</strong>; the two winners join the top
        ${bracket.directPlayoffSeeds} for a 16-team bracket (<strong>1 vs 16, 2 vs 15, … 8 vs 9</strong>).
        Later rounds reseed, so only first-round matchups are shown.
      </p>
      <div class="playoff-bracket-block">
        <h3 class="playoff-bracket-subhead">Play-in games</h3>
        <div class="playoff-bracket-grid playoff-bracket-grid--pig">${pigHtml}</div>
      </div>
      <div class="playoff-bracket-block">
        <h3 class="playoff-bracket-subhead">First round</h3>
        <div class="playoff-bracket-grid playoff-bracket-grid--main">${mainHtml}</div>
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
      <h2 class="power-rankings-projection-title">Projected final standings (${regularSeasonGames}-game season)</h2>
      <p class="power-rankings-note">
        Sorted by projected wins. “Proj. W-L” rounds expected totals; “Proj. win %” uses fractional wins.
        Remaining games use the same stats-based matchup model as the predictor page.
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
  const w = data.teamOverallWeights || { player: 0.5, record: 0.4, sos: 0.1 };
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
        <em>expected</em> wins and losses on every remaining game using the
        <a href="${esc(sitePath("/matchup-predictor"))}">matchup predictor</a> model
        (roster offense, schedule runs for/against, active vs benched players).
        Projected win % keeps fractional expected wins; the W-L column rounds to whole numbers. Regular season length:
        <strong>${data.regularSeasonGames} games</strong>.
      </p>
      ${simNote}
    </section>`;
}

function renderRankingsPanel(data) {
  return `${renderExplainer(data)}
    ${renderCurrentTable(data.currentRankings)}
    ${renderProjectionTable(data.projectionRows, data.regularSeasonGames)}
    ${renderPlayoffBracket(data.playoffBracket)}`;
}

function wireTabs(root) {
  const tabs = root.querySelectorAll(".power-rankings-tab");
  const panelRankings = root.querySelector("#powerRankingsPanelRankings");
  const panelViz = root.querySelector("#powerRankingsPanelViz");

  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      const isViz = tab.dataset.tab === "viz";
      for (const t of tabs) {
        const active = t === tab;
        t.classList.toggle("power-rankings-tab--active", active);
        t.setAttribute("aria-selected", active ? "true" : "false");
      }
      panelRankings.hidden = isViz;
      panelViz.hidden = !isViz;
    });
  }
}

let cachedVizData = null;

function renderPage(data) {
  const root = document.getElementById("powerRankingsRoot");
  if (!root) return;

  cachedVizData = data.vizData || null;

  root.innerHTML = `${renderTabs()}
    <div id="powerRankingsPanelRankings" role="tabpanel" aria-labelledby="prTabRankings">
      ${renderRankingsPanel(data)}
    </div>
    <div id="powerRankingsPanelViz" role="tabpanel" aria-labelledby="prTabViz" hidden>
      ${renderVizTabShell()}
    </div>`;

  wireTabs(root);
  mountPowerRankingsViz(document.getElementById("powerRankingsVizRoot"), cachedVizData, esc);
  root.removeAttribute("aria-busy");
  hideMmsLoadingScreen();
}

function renderError(message) {
  const root = document.getElementById("powerRankingsRoot");
  if (!root) return;
  root.innerHTML = `<section class="dfs-leaderboard-alert dfs-leaderboard-alert--error" role="alert"><p>${esc(
    message
  )}</p><p><button type="button" class="dfs-btn" id="powerRankingsRetry">Try again</button></p></section>`;
  root.removeAttribute("aria-busy");
  hideMmsLoadingScreen();
  document.getElementById("powerRankingsRetry")?.addEventListener("click", () => {
    root.setAttribute("aria-busy", "true");
    root.innerHTML = "";
    showMmsLoadingScreen();
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
    renderError(publicErrorMessage(err, "Could not load power rankings. Please try again."));
  }
}

load();
