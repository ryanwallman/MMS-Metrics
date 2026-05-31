#!/usr/bin/env node
/**
 * Export pre-rendered HTML + public assets to docs/ for GitHub Pages.
 * Requires network (Google Sheets) and .env FIREBASE_* for DFS/leaderboard.
 */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { patchMatchupPredictorNavHtml } from "./patch-matchup-predictor-nav.mjs";

const require = createRequire(import.meta.url);
const { matchupKeyToSlug } = require("../lib/matchupSlug.js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "docs");
const repoName = (process.env.GITHUB_REPOSITORY || "").split("/")[1] || "MMS-Metrics";
const customDomain = String(process.env.CUSTOM_DOMAIN || "").trim();
const envBase = process.env.SITE_BASE_PATH;
const siteBase = (() => {
  if (envBase != null && String(envBase).trim() !== "") {
    return String(envBase).trim();
  }
  if (customDomain || envBase === "") return "";
  return repoName ? `/${repoName}` : "/MMS-Metrics";
})();

const STATIC_ROUTES = [
  "/",
  "/rankings/power",
  "/dfs",
  "/dfs/leaderboard",
  "/dfs/leaderboard/lineup/",
];

function routeToFile(routePath) {
  const u = new URL(routePath, "http://local");
  const pathname = u.pathname.replace(/\/+$/, "") || "/";
  if (pathname === "/") return "index.html";
  return path.join(pathname.slice(1), "index.html");
}

function waitForHealth(port, timeoutMs = 180_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/healthz`);
        if (res.ok) return resolve();
      } catch {
        /* retry */
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Server did not become ready on port ${port}`));
        return;
      }
      setTimeout(tick, 400);
    };
    tick();
  });
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const ent of entries) {
    const from = path.join(src, ent.name);
    const to = path.join(dest, ent.name);
    if (ent.isDirectory()) await copyDir(from, to);
    else await fs.copyFile(from, to);
  }
}

const FETCH_TIMEOUT_MS = Number(process.env.STATIC_FETCH_TIMEOUT_MS) || 180_000;
const BUILD_MAX_MS = Number(process.env.STATIC_BUILD_MAX_MS) || 18 * 60 * 1000;

async function fetchHtml(port, route) {
  const url = `http://127.0.0.1:${port}${route}`;
  const started = Date.now();
  console.log(`[static] GET ${route} …`);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      throw new Error(`GET ${route} → ${res.status}`);
    }
    const html = await res.text();
    console.log(`[static] GET ${route} ok (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    return html;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`GET ${route} timed out after ${FETCH_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function writeRoute(html, routePath) {
  const rel = routeToFile(routePath);
  const dest = path.join(outDir, rel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, html, "utf8");
  console.log(`  wrote ${rel}`);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSelectOptionValues(html, selectId) {
  const selectPattern = new RegExp(
    `<select[^>]*id="${escapeRegex(selectId)}"[^>]*>([\\s\\S]*?)</select>`,
    "i"
  );
  const selectMatch = html.match(selectPattern);
  if (!selectMatch) return [];
  const body = selectMatch[1];
  const values = [];
  const optionRe = /<option[^>]*value="([^"]*)"[^>]*>/gi;
  let m;
  while ((m = optionRe.exec(body))) {
    const value = String(m[1] || "").trim();
    if (value) values.push(value);
  }
  return values;
}

function extractAllMatches(html, regex) {
  const out = [];
  let m;
  while ((m = regex.exec(html))) {
    out.push(m[1]);
  }
  return out;
}

function matchupPath(view, matchup = "") {
  const base = `/matchup-predictor/view/${encodeURIComponent(view)}`;
  if (!matchup) return base;
  return `${base}/matchup/${matchupKeyToSlug(matchup)}`;
}

async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  const workers = Math.min(limit, items.length || 1);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

async function main() {
  const port = Number(process.env.STATIC_EXPORT_PORT) || 3847;

  console.log("[static] Building leaderboard scoring bundle…");
  await new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "build:leaderboard-scoring"], {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, SITE_BASE_PATH: siteBase },
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("build:leaderboard-scoring failed"))));
  });

  console.log("[static] Building matchup predictor client bundle…");
  await new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "build:matchup-predictor"], {
      cwd: root,
      stdio: "inherit",
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("build:matchup-predictor failed"))));
  });

  console.log("[static] Building matchup predictor nav bundle…");
  await new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "build:matchup-predictor-nav"], {
      cwd: root,
      stdio: "inherit",
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("build:matchup-predictor-nav failed"))));
  });

  console.log("[static] Building leaderboard lineup client bundle…");
  await new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "build:leaderboard-lineup"], {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, SITE_BASE_PATH: siteBase },
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("build:leaderboard-lineup failed"))));
  });

  console.log("[static] Building league leaders client bundle…");
  await new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "build:league-leaders"], {
      cwd: root,
      stdio: "inherit",
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("build:league-leaders failed"))));
  });

  console.log("[static] Building power rankings client bundle…");
  await new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "build:power-rankings"], {
      cwd: root,
      stdio: "inherit",
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("build:power-rankings failed"))));
  });

  console.log("[static] Building DFS lineup pool client bundle…");
  await new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "build:dfs-lineup-pool"], {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, SITE_BASE_PATH: siteBase },
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("build:dfs-lineup-pool failed"))));
  });

  const careerSrc = path.join(root, "data/csv/career.csv");
  const careerDest = path.join(root, "public/data/csv/career.csv");
  await fs.mkdir(path.dirname(careerDest), { recursive: true });
  await fs.copyFile(careerSrc, careerDest);

  const preserveDir = path.join(outDir, "static-firebase");
  let preserved = null;
  try {
    preserved = await fs.readFile(path.join(preserveDir, "MIGRATION.md"), "utf8");
  } catch {
    /* none */
  }

  const skipMatchup = !!process.env.STATIC_SKIP_MATCHUP;
  const matchupBackup = path.join(root, ".static-matchup-backup");
  if (skipMatchup) {
    try {
      await fs.rm(matchupBackup, { recursive: true, force: true });
      await fs.cp(path.join(outDir, "matchup-predictor"), matchupBackup, { recursive: true });
      console.log("[static] Backed up existing docs/matchup-predictor for fast branch build");
    } catch {
      console.warn("[static] No existing matchup-predictor to preserve (full matchup export will be needed once)");
    }
  }

  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  if (preserved) {
    await fs.mkdir(preserveDir, { recursive: true });
    await fs.writeFile(path.join(preserveDir, "MIGRATION.md"), preserved);
  }
  if (skipMatchup) {
    try {
      await fs.cp(matchupBackup, path.join(outDir, "matchup-predictor"), { recursive: true });
      console.log("[static] Restored docs/matchup-predictor from backup");
    } catch {
      /* no backup */
    }
  }

  console.log(`[static] SITE_BASE_PATH=${siteBase}`);
  console.log(`[static] Starting server on port ${port}…`);

  const serverEnv = {
    ...process.env,
    STATIC_EXPORT: "1",
    SITE_BASE_PATH: siteBase,
    PORT: String(port),
    HOST: "127.0.0.1",
    NODE_ENV: "production",
  };

  const server = spawn("node", ["server.js"], {
    cwd: root,
    env: serverEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (d) => process.stdout.write(d));
  server.stderr?.on("data", (d) => process.stderr.write(d));

  const stopServer = () => {
    if (server.killed) return;
    server.kill("SIGKILL");
  };

  try {
    await waitForHealth(port);

    if (!process.env.STATIC_SKIP_MATCHUP) {
      const rootMatchupHtml = await fetchHtml(port, "/matchup-predictor");
      await writeRoute(rootMatchupHtml, "/matchup-predictor");
      const viewValues = extractSelectOptionValues(rootMatchupHtml, "view");
      const matchupRoutes = [];
      console.log(`[static] Exporting ${viewValues.length} schedule views…`);
      await mapConcurrent(viewValues, 8, async (view) => {
        const viewRoute = matchupPath(view);
        const viewHtml = await fetchHtml(port, viewRoute);
        await writeRoute(viewHtml, viewRoute);
        const matchupValues = extractSelectOptionValues(viewHtml, "matchup");
        for (const matchup of matchupValues) {
          matchupRoutes.push(matchupPath(view, matchup));
        }
      });
      console.log(`[static] Exporting ${matchupRoutes.length} matchups (parallel)…`);
      await mapConcurrent(matchupRoutes, 24, async (route) => {
        const html = await fetchHtml(port, route);
        await writeRoute(html, route);
      });
    } else {
      console.log(
        "[static] STATIC_SKIP_MATCHUP=1 — refreshing /matchup-predictor index, keeping view pages"
      );
      const rootMatchupHtml = await fetchHtml(port, "/matchup-predictor");
      await writeRoute(rootMatchupHtml, "/matchup-predictor");
    }

    // Export pretty DFS links for static navigation.
    const dfsHtml = await fetchHtml(port, "/dfs");
    const slateTokens = [
      ...extractAllMatches(dfsHtml, /\/dfs\/slate\/([A-Za-z0-9%]+)/g),
      ...extractAllMatches(dfsHtml, /\/dfs\?slate=([A-Za-z0-9%]+)/g),
    ].map((t) => decodeURIComponent(t));
    await mapConcurrent(Array.from(new Set(slateTokens)), 6, async (token) => {
      const html = await fetchHtml(port, `/dfs?slate=${encodeURIComponent(token)}`);
      await writeRoute(html, `/dfs/slate/${encodeURIComponent(token)}`);
    });

    const lbHtml = await fetchHtml(port, "/dfs/leaderboard");
    const weekTokens = [
      ...extractAllMatches(lbHtml, /\/dfs\/leaderboard\/week\/([A-Za-z0-9%]+)/g),
      ...extractAllMatches(lbHtml, /\/dfs\/leaderboard\?week=([A-Za-z0-9%]+)/g),
    ].map((t) => decodeURIComponent(t));
    await mapConcurrent(Array.from(new Set(weekTokens)), 4, async (week) => {
      const html = await fetchHtml(port, `/dfs/leaderboard?week=${encodeURIComponent(week)}`);
      await writeRoute(html, `/dfs/leaderboard/week/${encodeURIComponent(week)}`);
    });

    for (const route of STATIC_ROUTES) {
      const html = await fetchHtml(port, route);
      await writeRoute(html, route);
    }

    console.log("[static] Copying public/ …");
    await copyDir(path.join(root, "public"), outDir);
    await fs.writeFile(path.join(outDir, ".nojekyll"), "\n");

    const matchupDir = path.join(outDir, "matchup-predictor");
    try {
      await fs.access(matchupDir);
      const { patched, skipped } = await patchMatchupPredictorNavHtml(matchupDir, siteBase);
      console.log(
        `[static] Matchup nav script: patched ${patched} page(s), ${skipped} already had it`
      );
    } catch {
      /* no matchup export */
    }

    if (customDomain) {
      await fs.writeFile(path.join(outDir, "CNAME"), `${customDomain}\n`);
      console.log(`[static] Wrote docs/CNAME → ${customDomain}`);
    }

    console.log(`[static] Done → ${outDir}`);
    if (customDomain) {
      console.log(`[static] Custom domain build: https://${customDomain}/`);
    }
  } finally {
    stopServer();
  }
}

function withBuildDeadline(promise) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`Static build exceeded ${BUILD_MAX_MS / 60000} minute limit`)),
        BUILD_MAX_MS
      );
    }),
  ]);
}

withBuildDeadline(main()).catch((err) => {
  console.error("[static]", err.message || err);
  process.exit(1);
});
