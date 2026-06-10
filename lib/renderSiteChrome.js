"use strict";

const path = require("path");
const ejs = require("ejs");
const { sitePath, mapNavHrefs } = require("./sitePaths");

const SITE_NAV = Object.freeze([
  { id: "home", label: "League Leaders", href: "/" },
  { id: "matchup", label: "Matchup Predictor", href: "/matchup-predictor/future" },
  { id: "dfs", label: "DFS Lineup", href: "/dfs" },
  { id: "power", label: "Power Rankings", href: "/rankings/power" },
  { id: "team-analytics", label: "Team Analytics", href: "/team-analytics" },
]);

const SITE_DISCLAIMER =
  "This site uses current and career stats for calculations. The algorithm isn’t perfect and will often be wrong, so please don’t use it to seriously compare players or teams.";

function getAssetVersion() {
  return (
    process.env.RENDER_GIT_COMMIT?.slice(0, 12) ||
    process.env.ASSET_VERSION ||
    "3"
  );
}

function buildSiteRenderLocals({ navActive = null, siteBasePath = "" } = {}) {
  const sp = (p) => sitePath(p, siteBasePath);
  return {
    sitePath: sp,
    siteBasePath,
    siteNav: mapNavHrefs(SITE_NAV, siteBasePath),
    navActive,
    siteDisclaimer: SITE_DISCLAIMER,
    assetVersion: getAssetVersion(),
  };
}

async function renderSiteHeaderPartial(options = {}) {
  const viewsDir = path.join(__dirname, "..", "views", "partials");
  const locals = buildSiteRenderLocals(options);
  return ejs.renderFile(path.join(viewsDir, "site-header.ejs"), locals);
}

function renderFaviconHeadTags(options = {}) {
  const { sitePath: sp, assetVersion } = buildSiteRenderLocals(options);
  return `<link rel="icon" type="image/png" sizes="32x32" href="${sp("/favicon-32x32.png")}?v=${assetVersion}" />
<link rel="icon" type="image/png" sizes="16x16" href="${sp("/favicon-16x16.png")}?v=${assetVersion}" />
<link rel="apple-touch-icon" sizes="180x180" href="${sp("/apple-touch-icon.png")}?v=${assetVersion}" />`;
}

module.exports = {
  SITE_NAV,
  SITE_DISCLAIMER,
  getAssetVersion,
  buildSiteRenderLocals,
  renderSiteHeaderPartial,
  renderFaviconHeadTags,
};
