#!/usr/bin/env node
/**
 * Inject matchup-predictor-nav.mjs into static matchup HTML so GitHub Pages
 * redirects /matchup-predictor to the live DFS-open slate (same as localhost).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const repoName = (process.env.GITHUB_REPOSITORY || "").split("/")[1] || "MMS-Metrics";
const customDomain = String(process.env.CUSTOM_DOMAIN || "").trim();
const envBase = process.env.SITE_BASE_PATH;
const siteBase = (() => {
  if (envBase != null && String(envBase).trim() !== "") return String(envBase).trim();
  if (customDomain || envBase === "") return "";
  return repoName ? `/${repoName}` : "/MMS-Metrics";
})();

const NAV_MARKER = "matchup-predictor-nav.mjs";

export function matchupNavScriptTag(siteBasePath = "", assetVersion = "1") {
  const base = String(siteBasePath || "").replace(/\/$/, "");
  return `    <script type="module" src="${base}/js/${NAV_MARKER}?v=${assetVersion}"></script>\n`;
}

export async function patchMatchupPredictorNavHtml(
  matchupDir,
  siteBasePath = "",
  assetVersion = "1"
) {
  const scriptTag = matchupNavScriptTag(siteBasePath, assetVersion);
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
      } else if (ent.name.endsWith(".html")) {
        let html = await fs.readFile(full, "utf8");
        if (html.includes(NAV_MARKER)) {
          skipped++;
          continue;
        }
        const idx = html.lastIndexOf("</body>");
        if (idx < 0) continue;
        html = html.slice(0, idx) + scriptTag + html.slice(idx);
        await fs.writeFile(full, html);
        patched++;
      }
    }
  }

  await walk(matchupDir);
  return { patched, skipped };
}

async function main() {
  const outDir = path.join(root, "docs");
  const matchupDir = path.join(outDir, "matchup-predictor");
  try {
    await fs.access(matchupDir);
  } catch {
    console.warn("[patch-matchup-nav] No docs/matchup-predictor — nothing to patch");
    return;
  }
  const { patched, skipped } = await patchMatchupPredictorNavHtml(matchupDir, siteBase);
  console.log(
    `[patch-matchup-nav] Patched ${patched} HTML file(s), ${skipped} already had nav script`
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error("[patch-matchup-nav]", err.message || err);
    process.exit(1);
  });
}
