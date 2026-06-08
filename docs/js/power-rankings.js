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

/** Standard 16-team bracket halves (high seeds). */
const BRACKET_LEFT_CLUSTERS = [
  [1, 8],
  [4, 5],
];
const BRACKET_RIGHT_CLUSTERS = [
  [2, 7],
  [3, 6],
];

function matchupByHighSeed(mainMatchups, highSeed) {
  return (mainMatchups || []).find((m) => m.highSeed === highSeed) || null;
}

function renderBracketSlotTeam(team, seed, { tbd = false, tbdLabel = null, pig = false } = {}) {
  if (tbd) {
    return `<div class="playoff-slot__team playoff-slot__team--tbd">
      <span class="playoff-slot__seed">#${seed}</span>
      <span class="playoff-slot__name">${esc(tbdLabel || "TBD")}</span>
    </div>`;
  }
  if (!team) {
    return `<div class="playoff-slot__team playoff-slot__team--empty">
      <span class="playoff-slot__name">—</span>
    </div>`;
  }
  const captain = team.captain ? `<span class="playoff-slot__meta">${esc(team.captain)}</span>` : "";
  const record = team.projectedRecord
    ? `<span class="playoff-slot__meta">${esc(team.projectedRecord)}</span>`
    : "";
  return `<div class="playoff-slot__team${pig ? " playoff-slot__team--pig" : ""}">
    <span class="playoff-slot__seed">#${seed}</span>
    <span class="playoff-slot__name">${esc(team.teamName)}</span>
    ${captain}
    ${record}
  </div>`;
}

function renderBracketMatchupSlot(matchup) {
  if (!matchup) return "";
  const lowTeam = matchup.lowTbd
    ? renderBracketSlotTeam(null, matchup.lowSeed, {
        tbd: true,
        tbdLabel: matchup.pigNote || "TBD",
      })
    : renderBracketSlotTeam(matchup.low, matchup.lowSeed);
  return `<div class="playoff-slot playoff-slot--bo3" title="#${matchup.highSeed} vs #${matchup.lowSeed}, best of 3">
    <div class="playoff-slot__header">#${matchup.highSeed} vs #${matchup.lowSeed} <span class="playoff-slot__format">Bo3</span></div>
    ${renderBracketSlotTeam(matchup.high, matchup.highSeed)}
    ${lowTeam}
  </div>`;
}

function renderPigSlot(game) {
  return `<div class="playoff-slot playoff-slot--pig" title="PIG #${game.highSeed} vs #${game.lowSeed}, single game">
    <div class="playoff-slot__pig-label">🐷 PIG <span class="playoff-slot__format">1 game</span></div>
    ${renderBracketSlotTeam(game.high, game.highSeed, { pig: true })}
    ${renderBracketSlotTeam(game.away, game.lowSeed, { pig: true })}
  </div>`;
}

function renderBracketHalf(seedOrder, mainMatchups) {
  return seedOrder
    .map((seed) => renderBracketMatchupSlot(matchupByHighSeed(mainMatchups, seed)))
    .join("");
}

function renderRound1MobileList(mainMatchups) {
  const order = [1, 8, 4, 5, 2, 7, 3, 6];
  return order
    .map((seed) => renderBracketMatchupSlot(matchupByHighSeed(mainMatchups, seed)))
    .join("");
}

function renderLaterRoundsPanel() {
  const rounds = [
    { label: "Round 2", detail: "4 best-of-3 series — pairings set by reseeding after Round 1" },
    { label: "Semifinals", detail: "2 best-of-3 series — pairings set by reseeding after Round 2" },
    { label: "Championship", detail: "1 best-of-3 series — top two seeds after reseeding" },
  ];
  const cards = rounds
    .map(
      (r) => `<div class="playoff-later-round">
      <span class="playoff-later-round__icon" aria-hidden="true">↻</span>
      <div class="playoff-later-round__body">
        <strong class="playoff-later-round__label">${esc(r.label)}</strong>
        <span class="playoff-later-round__detail">${esc(r.detail)}</span>
        <span class="playoff-later-round__tbd">Matchups TBD</span>
      </div>
    </div>`
    )
    .join("");
  return `<div class="playoff-later-rounds">
    <h3 class="playoff-later-rounds__title">Later rounds — reseeded every time</h3>
    <p class="playoff-later-rounds__note">Every playoff round except PIG is a <strong>best-of-3 series</strong>. Winners are reseeded before each round — opponents are <strong>not</strong> determined by bracket position.</p>
    <div class="playoff-later-rounds__grid">${cards}</div>
  </div>`;
}

function renderPlayoffBracket(bracket) {
  if (!bracket?.ok) {
    return "";
  }

  const main = bracket.mainMatchups || [];
  const leftSeeds = BRACKET_LEFT_CLUSTERS.flat();
  const rightSeeds = BRACKET_RIGHT_CLUSTERS.flat();
  const pigHtml = (bracket.pigGames || []).map((g) => renderPigSlot(g)).join("");

  return `<section class="power-rankings-section playoff-bracket-section">
      <h2>Projected playoff bracket (round 1 only)</h2>
      <div class="playoff-reseed-callout" role="note">
        <p class="playoff-reseed-callout__title"><span aria-hidden="true">↻</span> MMS playoffs reseed after <strong>every</strong> round</p>
        <p class="playoff-reseed-callout__body">
          Only <strong>Round 1</strong> pairings are shown below (from projected standings).
          After each round, survivors are reseeded and new matchups are drawn — later-round opponents are
          <strong>never</strong> fixed by bracket position. PIG winners are also reseeded into the #15 / #16 slots
          before Round 1, so seeds <strong>1 and 2</strong> do not know their opponent until play-in ends.
          Every matchup from Round 1 onward is a <strong>best-of-3 series</strong>; PIG is a <strong>single game</strong>.
        </p>
      </div>
      <p class="power-rankings-note">
        Seeds <strong>1–${bracket.directPlayoffSeeds}</strong> qualify directly.
        Seeds <strong>15–18</strong> play PIG as <strong>#15 vs #18</strong> and <strong>#16 vs #17</strong> (one game each).
      </p>
      <div class="playoff-tree-wrap">
        <div class="playoff-tree__pig-row">
          <h3 class="playoff-tree__pig-title">Play-in games (fixed pairings)</h3>
          <div class="playoff-tree__pig-slots">${pigHtml}</div>
        </div>
        <h3 class="playoff-round1-heading playoff-round1-heading--desktop">Round 1 — projected pairings (best of 3)</h3>
        <div class="playoff-tree playoff-tree--desktop" role="img" aria-label="Round 1 bracket positions only; later rounds reseed">
          <div class="playoff-tree__half playoff-tree__half--left">
            ${renderBracketHalf(leftSeeds, main)}
          </div>
          <div class="playoff-tree__reseed-spine" aria-hidden="true">
            <span class="playoff-tree__reseed-step">Reseed</span>
            <span class="playoff-tree__reseed-step">Reseed</span>
            <span class="playoff-tree__reseed-step">Reseed</span>
            <span class="playoff-tree__reseed-step playoff-tree__reseed-step--final">Final</span>
          </div>
          <div class="playoff-tree__half playoff-tree__half--right">
            ${renderBracketHalf(rightSeeds, main)}
          </div>
        </div>
        <h3 class="playoff-round1-heading playoff-round1-heading--mobile">Round 1 — projected pairings (best of 3)</h3>
        <div class="playoff-round1-mobile" aria-label="Round 1 matchups list">
          ${renderRound1MobileList(main)}
        </div>
        ${renderLaterRoundsPanel()}
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
