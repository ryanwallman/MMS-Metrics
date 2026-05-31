/**
 * Leaderboard lineup detail (static GitHub Pages — no server route).
 */
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { loadLineupDetail } from "./dfs-leaderboard-lineup.mjs";
import { hideMmsLoadingScreen } from "./mms-loading-screen.js";

const config = window.__FIREBASE_CONFIG__;

function siteBase() {
  return String(window.__SITE_BASE_PATH__ || "").replace(/\/+$/, "");
}

function siteUrl(path) {
  const base = siteBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function esc(text) {
  const el = document.createElement("span");
  el.textContent = text == null ? "" : String(text);
  return el.innerHTML;
}

function paramsFromUrl() {
  const q = new URLSearchParams(window.location.search);
  const week = (q.get("week") || q.get("slate") || "").trim().toUpperCase();
  const user = (q.get("user") || q.get("userId") || "").trim();
  return { week, user };
}

function renderError(message) {
  const main = document.getElementById("lineupDetailMain");
  if (!main) return;
  main.classList.remove("mms-page-main--loading");
  main.innerHTML = `<section class="dfs-leaderboard-alert dfs-leaderboard-alert--error" role="alert"><p>${esc(
    message
  )}</p><p><a href="${siteUrl("/dfs/leaderboard")}" class="dfs-btn">← Leaderboard</a></p></section>`;
  hideMmsLoadingScreen();
}

function renderDetail(detail, week) {
  const main = document.getElementById("lineupDetailMain");
  if (!main) return;

  const players = detail.players || [];
  const rows = players.length
    ? players
        .map(
          (p, i) => `<tr>
          <td>${i + 1}</td>
          <td>${esc(p.name)}</td>
          <td class="dfs-leaderboard-pts"><strong>${esc(p.points)}</strong> <span class="dfs-score-games">${esc(
            p.games
          )} gm</span></td>
          <td>${p.salary != null ? `$${Number(p.salary).toLocaleString()}` : "—"}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="dfs-leaderboard-empty">No players in this saved lineup.</td></tr>`;

  const incomplete =
    detail.incomplete
      ? `<section class="dfs-leaderboard-alert" role="status"><p>This lineup was saved with fewer than 8 players and scores as 0.</p></section>`
      : "";

  const pts =
    detail.totalPoints != null
      ? `<strong>${esc(detail.totalPoints)} pts</strong>`
      : "—";
  const sal =
    detail.salaryUsed != null
      ? ` · $${Number(detail.salaryUsed).toLocaleString()} salary at save`
      : "";

  const slateLabel = esc(detail.slate?.label || week);
  const name = esc(detail.displayName || "Player");
  const backWeek = encodeURIComponent(week);

  main.innerHTML = `
    <div class="dfs-page-head">
      <h1 class="page-title">${name}</h1>
      <p class="dfs-page-head-actions">
        <a href="${siteUrl(`/dfs/leaderboard/week/${week}/`)}" class="dfs-btn">← Leaderboard</a>
        <a href="${siteUrl(`/dfs/slate/${week}/`)}" class="dfs-btn">Lineup builder</a>
      </p>
    </div>
    <section class="dfs-slate-banner" aria-label="Slate">
      <h2 class="dfs-slate-title">${slateLabel}</h2>
      <p class="dfs-slate-status dfs-slate-status--past">Saved lineup · ${pts}${sal}</p>
    </section>
    ${incomplete}
    <div class="dfs-leaderboard-table-wrap">
      <table class="dfs-leaderboard-table page-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Player</th>
            <th scope="col">Pts</th>
            <th scope="col">Salary at save</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  document.title = `${detail.displayName || "Lineup"} — ${detail.slate?.label || week} — DFS`;
  main.classList.remove("mms-page-main--loading");
  hideMmsLoadingScreen();
}

async function main() {
  const { week, user } = paramsFromUrl();
  if (!week || !user) {
    renderError("Missing week or player in the URL.");
    return;
  }
  if (!config?.projectId) {
    renderError("Firebase is not configured for this build.");
    return;
  }

  const app = getApps().length ? getApp() : initializeApp(config);
  const db = getFirestore(app);

  try {
    const detail = await loadLineupDetail(db, week, user);
    if (detail.error) {
      const msg =
        detail.locked === false
          ? "Lineups stay private until the slate locks."
          : detail.error;
      renderError(msg);
      return;
    }
    renderDetail(detail, week);
  } catch (err) {
    console.error(err);
    renderError(err.message || "Could not load lineup.");
  }
}

main();
