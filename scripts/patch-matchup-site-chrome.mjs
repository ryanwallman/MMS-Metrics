#!/usr/bin/env node
/**
 * Refresh site header + favicons on pre-rendered matchup predictor HTML.
 * Needed because STATIC_SKIP_MATCHUP=1 keeps old view pages between deploys.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { sitePath } = require("../lib/sitePaths.js");
const {
  renderSiteHeaderPartial,
  renderFaviconHeadTags,
  getAssetVersion,
} = require("../lib/renderSiteChrome.js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function resolveSiteBase() {
  const customDomain = String(process.env.CUSTOM_DOMAIN || "").trim();
  const envBase = process.env.SITE_BASE_PATH;
  if (envBase != null && String(envBase).trim() !== "") return String(envBase).trim();
  if (customDomain || envBase === "") return "";
  const repoName = (process.env.GITHUB_REPOSITORY || "").split("/")[1] || "MMS-Metrics";
  return repoName ? `/${repoName}` : "/MMS-Metrics";
}

const SITE_CHROME_MARKER = "site-chrome.js";

export function siteChromeScriptTag(siteBasePath = "", assetVersion = "5") {
  const base = String(siteBasePath || "").replace(/\/$/, "");
  return `    <script defer src="${base}/js/site-chrome.js?v=${assetVersion}"></script>\n`;
}

function patchMatchupHtml(html, { headerHtml, faviconTags, assetVersion, siteBase, chromeScriptTag }) {
  let next = html;

  next = next.replace(/<header class="site-header">[\s\S]*?<\/header>/, headerHtml.trim());
  next = next.replace(/<span class="site-brand-tagline">[\s\S]*?<\/span>\s*/g, "");

  if (!next.includes('rel="icon"')) {
    next = next.replace(/(<title>[^<]*<\/title>)/i, `$1\n${faviconTags}`);
  } else {
    next = next.replace(
      /<link rel="icon"[\s\S]*?<link rel="apple-touch-icon"[^>]+>/,
      faviconTags.trim()
    );
  }

  const cssHref = `${sitePath("/styles.css", siteBase)}?v=${assetVersion}`;
  next = next.replace(/href="[^"]*\/styles\.css\?v=[^"]+"/g, `href="${cssHref}"`);

  const logoSrc = `${sitePath("/mms-stats-logo.png", siteBase)}?v=${assetVersion}`;
  next = next.replace(/src="[^"]*\/mms-stats-logo\.png\?v=[^"]+"/g, `src="${logoSrc}"`);

  if (chromeScriptTag && !next.includes(SITE_CHROME_MARKER)) {
    const idx = next.lastIndexOf("</body>");
    if (idx >= 0) {
      next = next.slice(0, idx) + chromeScriptTag + next.slice(idx);
    }
  }

  return next;
}

function headerNeedsRefresh(html) {
  return (
    html.includes("site-brand-tagline") ||
    !html.includes("mms-stats-logo") ||
    !html.includes('href="/team-analytics"') ||
    !html.includes('width="80"') ||
    !html.includes("site-nav-toggle")
  );
}

export async function patchMatchupSiteChromeHtml(matchupDir, siteBasePath = "") {
  const siteBase = siteBasePath;
  const assetVersion = getAssetVersion();
  const headerHtml = await renderSiteHeaderPartial({ navActive: "matchup", siteBasePath: siteBase });
  const faviconTags = renderFaviconHeadTags({ siteBasePath: siteBase });
  const chromeScriptTag = siteChromeScriptTag(siteBase, assetVersion);

  let patched = 0;
  let unchanged = 0;

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
        const before = await fs.readFile(full, "utf8");
        const after = patchMatchupHtml(before, {
          headerHtml,
          faviconTags,
          assetVersion,
          siteBase,
          chromeScriptTag,
        });
        if (after === before && !headerNeedsRefresh(before)) {
          unchanged += 1;
          continue;
        }
        await fs.writeFile(full, after);
        patched += 1;
      }
    }
  }

  await walk(matchupDir);
  return { patched, unchanged, assetVersion };
}

export async function writeSiteHeaderFragment(outDir, siteBasePath = "") {
  const headerHtml = await renderSiteHeaderPartial({ navActive: null, siteBasePath });
  await fs.writeFile(path.join(outDir, "site-header.html"), headerHtml.trim() + "\n");
}

async function main() {
  const matchupDir = path.join(root, "docs", "matchup-predictor");
  try {
    await fs.access(matchupDir);
  } catch {
    console.warn("[patch-matchup-chrome] No docs/matchup-predictor — nothing to patch");
    return;
  }
  const siteBase = resolveSiteBase();
  const { patched, unchanged, assetVersion } = await patchMatchupSiteChromeHtml(matchupDir, siteBase);
  console.log(
    `[patch-matchup-chrome] Patched ${patched} HTML file(s), ${unchanged} unchanged (asset v=${assetVersion})`
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error("[patch-matchup-chrome]", err.message || err);
    process.exit(1);
  });
}
