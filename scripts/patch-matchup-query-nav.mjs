#!/usr/bin/env node
/**
 * Fix static matchup HTML: use live navigateMatchupPredictorView and stop
 * auto-redirecting past?view= slates to missing past/view/ routes.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const AUTO_SUBMIT_BLOCK =
  /          if \(queryView \|\| queryMatchup\) \{\s*\n\s*submitOrNavigate\(\);\s*\n\s*return;\s*\n\s*\}/g;

const AUTO_SUBMIT_REPLACEMENT = `          if (queryMatchup) {
            submitOrNavigate();
            return;
          }`;

const OLD_SUBMIT_FN =
  /        function submitOrNavigate\(\) \{\s*\n          if \(!isStaticSite\) \{\s*\n            form\.requestSubmit\(\);\s*\n            return;\s*\n          \}\s*\n          const view = \(viewSelect\.value \|\| ""\)\.trim\(\);\s*\n          const matchup = \(matchupSelect\.value \|\| ""\)\.trim\(\);\s*\n          let path = "(\/matchup-predictor\/(?:past|future))";\s*\n          if \(view\) \{\s*\n            path \+= "\/view\/" \+ encodeURIComponent\(view\);\s*\n            if \(matchup\) path \+= "\/matchup\/" \+ matchupKeyToSlug\(matchup\);\s*\n          \}\s*\n          const params = new URLSearchParams\(\);\s*\n          if \(awayInput\.value\) params\.set\("awayMissing", awayInput\.value\);\s*\n          if \(homeInput\.value\) params\.set\("homeMissing", homeInput\.value\);\s*\n          const qs = params\.toString\(\);\s*\n          window\.location\.assign\(qs \? path \+ "\?" \+ qs : path\);\s*\n        \}/g;

function newSubmitFn(mpBase) {
  return `        function matchupModeFromPath() {
          if (window.MmsMatchupPredictorNav?.getEffectiveMatchupMode) {
            return window.MmsMatchupPredictorNav.getEffectiveMatchupMode(
              window.location.pathname || "",
              new URL(window.location.href)
            );
          }
          const url = new URL(window.location.href);
          const q = (url.searchParams.get("mode") || "").toLowerCase();
          if (q === "past" || q === "future") return q;
          const p = window.location.pathname || "";
          return /\\/matchup-predictor\\/past(?:\\/|$)/i.test(p) ? "past" : "future";
        }

        async function submitOrNavigate() {
          if (!isStaticSite) {
            form.requestSubmit();
            return;
          }
          const view = (viewSelect.value || "").trim();
          const matchup = (matchupSelect.value || "").trim();

          let path = "${mpBase}";
          if (window.MmsMatchupPredictorNav?.navigateMatchupPredictorView) {
            path = await window.MmsMatchupPredictorNav.navigateMatchupPredictorView(
              matchupModeFromPath(),
              view,
              matchup
            );
          } else if (view) {
            path += "/view/" + encodeURIComponent(view);
            if (matchup) path += "/matchup/" + matchupKeyToSlug(matchup);
          }
          const dest = new URL(path, window.location.origin);
          if (awayInput.value) dest.searchParams.set("awayMissing", awayInput.value);
          if (homeInput.value) dest.searchParams.set("homeMissing", homeInput.value);
          window.location.assign(dest.pathname + dest.search);
        }`;
}

async function patchFile(filePath) {
  let html = await fs.readFile(filePath, "utf8");
  if (!html.includes("function submitOrNavigate()")) return false;
  if (html.includes("navigateMatchupPredictorView")) return false;

  let changed = false;

  if (AUTO_SUBMIT_BLOCK.test(html)) {
    html = html.replace(AUTO_SUBMIT_BLOCK, AUTO_SUBMIT_REPLACEMENT);
    changed = true;
  }
  AUTO_SUBMIT_BLOCK.lastIndex = 0;

  const m = OLD_SUBMIT_FN.exec(html);
  if (m) {
    html = html.replace(OLD_SUBMIT_FN, newSubmitFn(m[1]));
    changed = true;
  }
  OLD_SUBMIT_FN.lastIndex = 0;

  if (changed) await fs.writeFile(filePath, html);
  return changed;
}

async function walk(dir) {
  let patched = 0;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return patched;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      patched += await walk(full);
    } else if (ent.name.endsWith(".html") && (await patchFile(full))) {
      patched += 1;
    }
  }
  return patched;
}

async function main() {
  const matchupDir = path.join(root, "docs", "matchup-predictor");
  try {
    await fs.access(matchupDir);
  } catch {
    console.warn("[patch-matchup-query-nav] No docs/matchup-predictor");
    return;
  }
  const patched = await walk(matchupDir);
  console.log(`[patch-matchup-query-nav] Patched ${patched} HTML file(s)`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error("[patch-matchup-query-nav]", err.message || err);
    process.exit(1);
  });
}

export { patchFile, walk };
