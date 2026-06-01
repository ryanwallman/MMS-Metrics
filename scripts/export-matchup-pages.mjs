#!/usr/bin/env node
/**
 * Re-export docs/matchup-predictor only (no full docs/ wipe).
 * Use after code changes to matchup predictor without a full static build.
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
const port = Number(process.env.STATIC_EXPORT_PORT) || 3847;

function routeToFile(routePath) {
  const u = new URL(routePath, "http://local");
  const pathname = u.pathname.replace(/\/+$/, "") || "/";
  if (pathname === "/") return "index.html";
  return path.join(pathname.slice(1), "index.html");
}

function waitForHealth(timeoutMs = 180_000) {
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

async function fetchHtml(route) {
  const url = `http://127.0.0.1:${port}${route}`;
  console.log(`[matchup-export] GET ${route} …`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${route} → ${res.status}`);
  const html = await res.text();
  console.log(`[matchup-export] GET ${route} ok`);
  return html;
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

function matchupPath(view, matchup = "") {
  const base = `/matchup-predictor/view/${encodeURIComponent(view)}`;
  if (!matchup) return base;
  return `${base}/matchup/${matchupKeyToSlug(matchup)}`;
}

async function mapConcurrent(items, limit, fn) {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const idx = next++;
      await fn(items[idx], idx);
    }
  }
  const workers = Math.min(limit, items.length || 1);
  await Promise.all(Array.from({ length: workers }, () => worker()));
}

async function runNpm(script) {
  await new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", script], { cwd: root, stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${script} failed`))));
  });
}

async function copyPublicAssets() {
  const pairs = [
    ["public/styles.css", "docs/styles.css"],
    ["public/js/matchup-predictor-client.mjs", "docs/js/matchup-predictor-client.mjs"],
    ["public/js/matchup-predictor-nav.mjs", "docs/js/matchup-predictor-nav.mjs"],
    ["public/js/matchup-predictor-ui.js", "docs/js/matchup-predictor-ui.js"],
    ["public/js/dfs-lineup-pool.mjs", "docs/js/dfs-lineup-pool.mjs"],
  ];
  for (const [src, dest] of pairs) {
    await fs.copyFile(path.join(root, src), path.join(root, dest));
    console.log(`[matchup-export] copied ${src} → ${dest}`);
  }
}

async function killPort(p) {
  try {
    const { execSync } = await import("node:child_process");
    execSync(`lsof -ti :${p} | xargs kill -9 2>/dev/null || true`, { stdio: "ignore" });
  } catch {
    /* none */
  }
}

async function main() {
  await killPort(port);
  await runNpm("build:matchup-predictor");
  await runNpm("build:matchup-predictor-nav");

  const { loadWeeklySchedule } = require("../lib/dfsLeaderboardScoringContext.js");
  const { pickMatchupPredictorDefaultView, referenceIsoForScheduleYear } = require("../lib/dfs.js");
  const { SCHEDULE_CALENDAR_YEAR } = require("../lib/sheetUrls.js");
  const schedulePayload = await loadWeeklySchedule();
  const viewValues = (schedulePayload.scheduleOptions || [])
    .map((o) => String(o.value || "").trim().toUpperCase())
    .filter((v) => /^(W\d+|D\d{8})$/.test(v));
  const refIso = referenceIsoForScheduleYear(SCHEDULE_CALENDAR_YEAR);
  const defaultView =
    pickMatchupPredictorDefaultView(schedulePayload, refIso) ||
    viewValues[viewValues.length - 1] ||
    "W1";

  const serverEnv = {
    ...process.env,
    STATIC_EXPORT: "1",
    SITE_BASE_PATH: process.env.SITE_BASE_PATH ?? "",
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
    await waitForHealth();
    // Warm schedule + replacement caches before exporting HTML.
    await fetchHtml("/healthz");
    const defaultRoute = matchupPath(defaultView);
    console.log(`[matchup-export] Default slate: ${defaultView} (${defaultRoute})`);
    await fetchHtml(defaultRoute);

    const rootHtml = await fetchHtml(defaultRoute);
    await writeRoute(rootHtml, "/matchup-predictor");

    console.log(`[matchup-export] Exporting ${viewValues.length} schedule views…`);

    const matchupRoutes = [];
    await mapConcurrent(viewValues, 6, async (view) => {
      const viewRoute = matchupPath(view);
      const viewHtml = await fetchHtml(viewRoute);
      await writeRoute(viewHtml, viewRoute);
      for (const matchup of extractSelectOptionValues(viewHtml, "matchup")) {
        if (matchup.includes("|")) matchupRoutes.push(matchupPath(view, matchup));
      }
    });

    console.log(`[matchup-export] Exporting ${matchupRoutes.length} matchups…`);
    await mapConcurrent(matchupRoutes, 12, async (route) => {
      const html = await fetchHtml(route);
      await writeRoute(html, route);
    });

    await copyPublicAssets();
    const matchupDir = path.join(outDir, "matchup-predictor");
    const { patched, skipped } = await patchMatchupPredictorNavHtml(matchupDir);
    console.log(`[matchup-export] Nav patch: ${patched} patched, ${skipped} skipped`);
    console.log("[matchup-export] Done.");
  } finally {
    server.kill("SIGKILL");
    await killPort(port);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
