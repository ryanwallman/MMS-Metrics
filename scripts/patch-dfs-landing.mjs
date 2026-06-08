#!/usr/bin/env node
/**
 * Inject dfs-landing.mjs into static DFS HTML so bare /dfs redirects to the open slate.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const repoName = (process.env.GITHUB_REPOSITORY || "").split("/")[1] || "MMS-Metrics";
const customDomain = String(process.env.CUSTOM_DOMAIN || "").trim();
const envBase = process.env.SITE_BASE_PATH;

const LIVE_MARKER = "dfs-landing.mjs";

async function resolveSiteBase() {
  if (envBase != null && String(envBase).trim() !== "") return String(envBase).trim();
  if (customDomain) return "";
  try {
    await fs.access(path.join(root, "docs", "CNAME"));
    return "";
  } catch {
    /* no custom domain */
  }
  if (envBase === "") return "";
  return repoName ? `/${repoName}` : "/MMS-Metrics";
}

export function dfsLandingScriptTag(siteBasePath = "", assetVersion = "3") {
  const base = String(siteBasePath || "").replace(/\/$/, "");
  return `    <script type="module" src="${base}/js/${LIVE_MARKER}?v=${assetVersion}"></script>\n`;
}

export async function patchDfsLandingHtml(dfsDir, siteBasePath = "", assetVersion = "3") {
  const scriptTag = dfsLandingScriptTag(siteBasePath, assetVersion);
  let patched = 0;
  let skipped = 0;

  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
      } else if (ent.name === "index.html") {
        let html = await fs.readFile(full, "utf8");
        if (!html.includes("dfs-lineup-pool.js")) continue;
        const correctSrc = `${String(siteBasePath || "").replace(/\/$/, "")}/js/${LIVE_MARKER}?v=${assetVersion}`;
        const correctTag = `<script type="module" src="${correctSrc}"></script>`;
        if (html.includes(LIVE_MARKER)) {
          if (html.includes(correctTag)) {
            skipped++;
            continue;
          }
          html = html.replace(
            /<script type="module" src="[^"]*dfs-landing\.mjs[^"]*"><\/script>\n?/,
            scriptTag.trimEnd() + "\n"
          );
          await fs.writeFile(full, html);
          patched++;
          continue;
        }
        const needle = '<script type="module" src="';
        const poolIdx = html.indexOf("dfs-lineup-pool.js");
        if (poolIdx < 0) continue;
        const lineStart = html.lastIndexOf(needle, poolIdx);
        if (lineStart < 0) continue;
        html = html.slice(0, lineStart) + scriptTag + html.slice(lineStart);
        await fs.writeFile(full, html);
        patched++;
      }
    }
  }

  await walk(dfsDir);
  return { patched, skipped };
}

async function main() {
  const dfsDir = path.join(root, "docs", "dfs");
  try {
    await fs.access(dfsDir);
  } catch {
    console.warn("[patch-dfs-landing] No docs/dfs — nothing to patch");
    return;
  }
  const siteBase = await resolveSiteBase();
  const assetVersion = String(process.env.ASSET_VERSION || "3");
  const { patched, skipped } = await patchDfsLandingHtml(dfsDir, siteBase, assetVersion);
  console.log(
    `[patch-dfs-landing] Patched ${patched} HTML file(s), ${skipped} already had landing script`
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error("[patch-dfs-landing]", err.message || err);
    process.exit(1);
  });
}
