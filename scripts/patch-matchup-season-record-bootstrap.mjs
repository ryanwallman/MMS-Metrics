#!/usr/bin/env node
/**
 * Static matchup pages: skip stale season-record.json when live refresh is loaded.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const OLD_BOOT =
  /        hydratePredictorRecordFromJson\(\)\.then\(\(\) => \{\s*\n          applyMatchupPageChrome\(\);\s*\n          initMatchupClient\(\);\s*\n        \}\);/g;

const NEW_BOOT = `        Promise.resolve()
          .then(() => {
            const useLiveRecord =
              isStaticSite &&
              document.querySelector('script[src*="matchup-predictor-live"]');
            if (useLiveRecord) return;
            if (isStaticSite && window.MmsMatchupPredictorLive?.refreshSeasonRecord) {
              return window.MmsMatchupPredictorLive.refreshSeasonRecord({ force: true });
            }
            return hydratePredictorRecordFromJson();
          })
          .then(() => {
            applyMatchupPageChrome();
            return initMatchupClient();
          });`;

async function walk(dir) {
  let patched = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      patched += await walk(full);
    } else if (ent.name.endsWith(".html")) {
      let html = await fs.readFile(full, "utf8");
      if (!html.includes("hydratePredictorRecordFromJson().then")) continue;
      if (!html.includes("matchup-predictor-live")) continue;
      if (html.includes("useLiveRecord")) continue;
      const next = html.replace(OLD_BOOT, NEW_BOOT);
      if (next !== html) {
        await fs.writeFile(full, next);
        patched += 1;
      }
    }
  }
  return patched;
}

async function main() {
  const matchupDir = path.join(root, "docs", "matchup-predictor");
  const patched = await walk(matchupDir);
  console.log(`[patch-matchup-season-record-bootstrap] Patched ${patched} HTML file(s)`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error("[patch-matchup-season-record-bootstrap]", err.message || err);
    process.exit(1);
  });
}

export { walk };
