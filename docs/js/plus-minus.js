/**
 * Plus / minus ratings page — live from Google Sheets.
 */
import { fetchPlusMinusData } from "./plus-minus.mjs";
import { hideMmsLoadingScreen, showMmsLoadingScreen } from "./mms-loading-screen.js";
import { publicErrorMessage } from "./mms-public-error.js";

function esc(text) {
  const el = document.createElement("span");
  el.textContent = text == null ? "" : String(text);
  return el.innerHTML;
}

function formatRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 100) / 100;
  return rounded >= 0 ? `+${rounded.toFixed(2)}` : rounded.toFixed(2);
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

function replacementNote(row) {
  if (row.replacementRole === "replaced" && row.relatedPlayer) {
    return `<span class="plus-minus-replacement-note">Replaced by ${esc(row.relatedPlayer)}${
      row.replacementDateIso ? ` (${esc(row.replacementDateIso)})` : ""
    }</span>`;
  }
  if (row.replacementRole === "replacement" && row.relatedPlayer) {
    return `<span class="matchup-replacement-tag" title="Mid-season replacement">Replacement</span>
    <span class="plus-minus-replacement-note">For ${esc(row.relatedPlayer)}${
      row.replacementDateIso ? ` (${esc(row.replacementDateIso)})` : ""
    }</span>`;
  }
  return "";
}

function rowClass(row) {
  if (row.replacementRole === "replaced") return "plus-minus-row--replaced";
  if (row.replacementRole === "replacement") return "plus-minus-row--replacement";
  return "";
}

function renderTable(rows) {
  const body = (rows || [])
    .map(
      (row) =>
        `<tr class="${rowClass(row)}">
          <td class="plus-minus-rank">${row.leagueRank}</td>
          <td class="plus-minus-player">
            <span class="plus-minus-player-name">${esc(row.playerName)}</span>
            ${replacementNote(row)}
          </td>
          <td>${esc(row.teamName)}</td>
          <td class="plus-minus-rating">${formatRating(row.rating)}</td>
          <td class="plus-minus-num">${row.composite2026 != null ? Number(row.composite2026).toFixed(2) : "—"}</td>
          <td class="plus-minus-num">${
            row.compositeHist != null ? Number(row.compositeHist).toFixed(2) : "—"
          }</td>
          <td class="plus-minus-num">${row.pa2026 != null ? row.pa2026 : "—"}</td>
        </tr>`
    )
    .join("");

  return `<div class="plus-minus-table-wrap">
    <table class="rankings-master-table page-table plus-minus-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Player</th>
          <th>Team</th>
          <th>+/-</th>
          <th title="2026 composite z-score">2026 comp.</th>
          <th title="Career/2025 composite z-score">Hist comp.</th>
          <th>2026 PA</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

function renderExplainer(data) {
  const w = data.ratingWeights || { historical: 0.7, current2026: 0.3 };
  return `<section class="rankings-explainer plus-minus-explainer">
    <h2>How +/- is calculated</h2>
    <p>
      Each player&apos;s <strong>+/-</strong> is the offensive rating used across MMS (matchup predictor, DFS salaries, power rankings roster talent).
      It blends career/2025 and 2026 stats into a single z-score vs league baselines
      (<strong>${Math.round((w.historical ?? 0.7) * 100)}%</strong> historical,
      <strong>${Math.round((w.current2026 ?? 0.3) * 100)}%</strong> 2026 when both exist).
      Roughly <strong>0</strong> = league average; positive = above average.
    </p>
    <p>
      <strong>Mid-season replacements</strong> appear on their own row with their own +/- from their personal stats.
      The replaced player also keeps a separate row with their original +/-.
      Highlighted rows mark those pairs.
    </p>
    <p class="plus-minus-count">${esc(data.playerCount)} players · ${esc(
    data.replacementPairCount
  )} replacement pair(s)</p>
  </section>`;
}

function renderLegend() {
  return `<div class="plus-minus-legend" aria-label="Replacement legend">
    <span class="plus-minus-legend-item plus-minus-legend-item--replaced">Replaced player (original roster slot)</span>
    <span class="plus-minus-legend-item plus-minus-legend-item--replacement">Replacement player (own stats)</span>
  </div>`;
}

function renderPage(data) {
  const root = document.getElementById("plusMinusRoot");
  if (!root) return;
  root.innerHTML =
    renderExplainer(data) +
    renderLegend() +
    renderTable(data.rows);
  root.removeAttribute("aria-busy");
  hideMmsLoadingScreen();
}

function renderError(message) {
  const root = document.getElementById("plusMinusRoot");
  if (!root) return;
  root.innerHTML = `<section class="dfs-leaderboard-alert dfs-leaderboard-alert--error" role="alert"><p>${esc(
    message
  )}</p><p><button type="button" class="dfs-btn" id="plusMinusRetry">Try again</button></p></section>`;
  root.removeAttribute("aria-busy");
  hideMmsLoadingScreen();
  document.getElementById("plusMinusRetry")?.addEventListener("click", () => {
    root.setAttribute("aria-busy", "true");
    root.innerHTML = "";
    showMmsLoadingScreen();
    load();
  });
}

async function load() {
  try {
    const data = await fetchPlusMinusData();
    renderPage(data);
    updateSiteUpdated(data.fetchedAt);
  } catch (err) {
    console.error(err);
    renderError(publicErrorMessage(err, "Could not load plus/minus ratings. Please try again."));
  }
}

load();
