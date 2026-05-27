#!/usr/bin/env node
/**
 * Fast GitHub Pages patch: rebuild DFS JS bundles and re-export DFS/leaderboard HTML only.
 * Does not touch matchup-predictor static pages (full build: npm run build:pages).
 */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "docs");
const repoName = (process.env.GITHUB_REPOSITORY || "").split("/")[1] || "MMS-Metrics";
const siteBase =
  process.env.SITE_BASE_PATH ||
  (repoName ? `/${repoName}` : "/MMS-Metrics");
const port = Number(process.env.STATIC_EXPORT_PORT) || 3847;

function routeToFile(routePath) {
  const u = new URL(routePath, "http://local");
  const pathname = u.pathname.replace(/\/+$/, "") || "/";
  if (pathname === "/") return "index.html";
  return path.join(pathname.slice(1), "index.html");
}

async function writeRoute(html, routePath) {
  const rel = routeToFile(routePath);
  const dest = path.join(outDir, rel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, html);
  console.log(`[patch-dfs] Wrote ${rel}`);
}

function waitForHealth(timeoutMs = 120_000) {
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
        reject(new Error(`Server not ready on port ${port}`));
        return;
      }
      setTimeout(tick, 400);
    };
    tick();
  });
}

async function fetchHtml(route) {
  const url = `http://127.0.0.1:${port}${route}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${route} → ${res.status}`);
  return res.text();
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

function extractAllMatches(html, re) {
  const out = [];
  let m;
  const g = new RegExp(re.source, re.flags);
  while ((m = g.exec(html)) !== null) out.push(m[1]);
  return out;
}

async function runNpm(script) {
  await new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", script], {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, SITE_BASE_PATH: siteBase },
    });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${script} failed`))
    );
  });
}

async function killPortListeners(p) {
  await new Promise((resolve) => {
    const killer = spawn("sh", ["-c", `lsof -ti :${p} | xargs kill -9 2>/dev/null || true`], {
      stdio: "ignore",
    });
    killer.on("exit", () => resolve());
  });
  await new Promise((r) => setTimeout(r, 300));
}

async function main() {
  console.log(`[patch-dfs] SITE_BASE_PATH=${siteBase}`);
  await killPortListeners(port);
  await runNpm("build:leaderboard-scoring");
  await runNpm("build:matchup-predictor");

  const careerSrc = path.join(root, "data/csv/career.csv");
  const careerDest = path.join(root, "public/data/csv/career.csv");
  await fs.mkdir(path.dirname(careerDest), { recursive: true });
  await fs.copyFile(careerSrc, careerDest);

  const server = spawn("node", ["server.js"], {
    cwd: root,
    env: {
      ...process.env,
      STATIC_EXPORT: "1",
      SITE_BASE_PATH: siteBase,
      ASSET_VERSION: process.env.ASSET_VERSION || "3",
      PORT: String(port),
      HOST: "127.0.0.1",
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForHealth();

    const homeHtml = await fetchHtml("/");
    await writeRoute(homeHtml, "/");

    const dfsHtml = await fetchHtml("/dfs");
    await writeRoute(dfsHtml, "/dfs");

    const slateTokens = [
      ...extractAllMatches(dfsHtml, /\/dfs\/slate\/([A-Za-z0-9%]+)/g),
      ...extractAllMatches(dfsHtml, /\/dfs\?slate=([A-Za-z0-9%]+)/g),
    ].map((t) => decodeURIComponent(t));

    for (const token of [...new Set(slateTokens)]) {
      const html = await fetchHtml(`/dfs?slate=${encodeURIComponent(token)}`);
      await writeRoute(html, `/dfs/slate/${encodeURIComponent(token)}`);
    }

    const lbHtml = await fetchHtml("/dfs/leaderboard");
    await writeRoute(lbHtml, "/dfs/leaderboard");

    const powerHtml = await fetchHtml("/rankings/power");
    await writeRoute(powerHtml, "/rankings/power");

    const weekTokens = [
      ...extractAllMatches(lbHtml, /\/dfs\/leaderboard\/week\/([A-Za-z0-9%]+)/g),
      ...extractAllMatches(lbHtml, /\/dfs\/leaderboard\?week=([A-Za-z0-9%]+)/g),
    ].map((t) => decodeURIComponent(t));

    for (const week of [...new Set(weekTokens)]) {
      const html = await fetchHtml(
        `/dfs/leaderboard?week=${encodeURIComponent(week)}`
      );
      await writeRoute(html, `/dfs/leaderboard/week/${encodeURIComponent(week)}`);
    }
  } finally {
    if (!server.killed) server.kill("SIGKILL");
  }

  // Copy JS/CSS only — do not overwrite freshly rendered HTML under docs/dfs/.
  const publicJs = path.join(root, "public", "js");
  const docsJs = path.join(outDir, "js");
  await fs.mkdir(docsJs, { recursive: true });
  await copyDir(publicJs, docsJs);
  const publicData = path.join(root, "public", "data");
  const docsData = path.join(outDir, "data");
  try {
    await fs.access(publicData);
    await fs.mkdir(docsData, { recursive: true });
    await copyDir(publicData, docsData);
  } catch {
    /* optional */
  }
  for (const name of ["styles.css"]) {
    try {
      await fs.copyFile(path.join(root, "public", name), path.join(outDir, name));
    } catch {
      /* optional */
    }
  }
  await fs.writeFile(path.join(outDir, ".nojekyll"), "\n");
  console.log("[patch-dfs] Copied public assets → docs/");
  console.log("[patch-dfs] Done.");
}

main().catch((err) => {
  console.error("[patch-dfs]", err.message || err);
  process.exit(1);
});
