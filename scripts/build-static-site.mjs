#!/usr/bin/env node
/**
 * Export pre-rendered HTML + public assets to docs/ for GitHub Pages.
 * Requires network (Google Sheets) and .env FIREBASE_* for DFS/leaderboard.
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

const STATIC_ROUTES = [
  "/",
  "/matchup-predictor",
  "/rankings/power",
  "/dfs",
  "/dfs/leaderboard",
];

function routeToFile(routePath) {
  const u = new URL(routePath, "http://local");
  const pathname = u.pathname.replace(/\/+$/, "") || "/";
  if (pathname === "/") return "index.html";
  return path.join(pathname.slice(1), "index.html");
}

function parseHtmlOptionValues(html, selectId) {
  const re = new RegExp(
    `<select[^>]*id=["']${selectId}["'][^>]*>([\\s\\S]*?)</select>`,
    "i"
  );
  const block = html.match(re)?.[1] || "";
  const values = [];
  for (const m of block.matchAll(/<option[^>]*value=["']([^"']+)["']/gi)) {
    values.push(m[1]);
  }
  return [...new Set(values.filter(Boolean))];
}

function parseDfsSlateTokens(html) {
  const tokens = [];
  for (const m of html.matchAll(/[?&]slate=([A-Za-z0-9]+)/gi)) {
    tokens.push(m[1].toUpperCase());
  }
  return [...new Set(tokens.filter(Boolean))];
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

async function fetchHtml(port, route) {
  const url = `http://127.0.0.1:${port}${route}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${route} → ${res.status}`);
  }
  return res.text();
}

async function writeRoute(html, routePath) {
  const rel = routeToFile(routePath);
  const dest = path.join(outDir, rel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, html, "utf8");
  console.log(`  wrote ${rel}`);
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

  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  if (preserved) {
    await fs.mkdir(preserveDir, { recursive: true });
    await fs.writeFile(path.join(preserveDir, "MIGRATION.md"), preserved);
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

  try {
    await waitForHealth(port);

    for (const route of STATIC_ROUTES) {
      const html = await fetchHtml(port, route);
      await writeRoute(html, route);
    }

    const dfsHtml = await fetchHtml(port, "/dfs");
    const slates = parseDfsSlateTokens(dfsHtml);
    for (const slate of slates) {
      const q = `/dfs?slate=${encodeURIComponent(slate)}`;
      const html = await fetchHtml(port, q);
      const fileRoute = `/dfs/slate/${slate.toLowerCase()}/`;
      await writeRoute(html, fileRoute);
    }

    const lbHtml = await fetchHtml(port, "/dfs/leaderboard");
    const weeks = parseHtmlOptionValues(lbHtml, "week");
    for (const week of weeks) {
      const q = `/dfs/leaderboard?week=${encodeURIComponent(week)}`;
      const html = await fetchHtml(port, q);
      await writeRoute(html, `/dfs/leaderboard/week/${week.toLowerCase()}/`);
    }

    console.log("[static] Copying public/ …");
    await copyDir(path.join(root, "public"), outDir);
    await fs.writeFile(path.join(outDir, ".nojekyll"), "\n");

    console.log(`[static] Done → ${outDir}`);
  } finally {
    server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error("[static]", err.message || err);
  process.exit(1);
});
