#!/usr/bin/env node
/**
 * Inject matchup-predictor-live.mjs into static matchup HTML so week index pages
 * refresh dropdown labels and season record without a full re-export.
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

const LIVE_MARKER = "matchup-predictor-live.mjs";

export function matchupLiveScriptTag(siteBasePath = "", assetVersion = "1") {
  const base = String(siteBasePath || "").replace(/\/$/, "");
  return `    <script type="module" src="${base}/js/${LIVE_MARKER}?v=${assetVersion}"></script>\n`;
}

export async function patchMatchupPredictorLiveHtml(
  matchupDir,
  siteBasePath = "",
  assetVersion = "1"
) {
  const scriptTag = matchupLiveScriptTag(siteBasePath, assetVersion);
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
        if (html.includes(LIVE_MARKER)) {
          skipped++;
          continue;
        }
        if (!html.includes('id="matchupForm"')) {
          continue;
        }
        const navIdx = html.indexOf("matchup-predictor-nav.mjs");
        if (navIdx >= 0) {
          const lineEnd = html.indexOf("\n", navIdx);
          if (lineEnd >= 0) {
            html = html.slice(0, lineEnd + 1) + scriptTag + html.slice(lineEnd + 1);
            await fs.writeFile(full, html);
            patched++;
            continue;
          }
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
    console.warn("[patch-matchup-live] No docs/matchup-predictor — nothing to patch");
    return;
  }
  const assetVersion = String(process.env.ASSET_VERSION || "2");
  const { patched, skipped } = await patchMatchupPredictorLiveHtml(matchupDir, siteBase, assetVersion);
  console.log(
    `[patch-matchup-live] Patched ${patched} HTML file(s), ${skipped} already had live script`
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error("[patch-matchup-live]", err.message || err);
    process.exit(1);
  });
}
