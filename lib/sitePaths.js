/**
 * Static site base path (no trailing slash).
 * Production (mmsmetrics.com): SITE_BASE_PATH empty → links at /dfs, /matchup-predictor, etc.
 * Legacy github.io project URL: SITE_BASE_PATH=/MMS-Metrics
 */

function normalizeSiteBasePath(raw) {
  const s = String(raw || "").trim();
  if (!s || s === "/") return "";
  const withLeading = s.startsWith("/") ? s : `/${s}`;
  return withLeading.replace(/\/+$/, "");
}

function sitePath(path, basePath = "") {
  const base = normalizeSiteBasePath(basePath);
  const p = String(path || "");
  if (!p || p === "/") return base ? `${base}/` : "/";
  const suffix = p.startsWith("/") ? p : `/${p}`;
  return `${base}${suffix}`;
}

function mapNavHrefs(navItems, basePath) {
  return (navItems || []).map((item) => ({
    ...item,
    href: sitePath(item.href, basePath),
    subnav: (item.subnav || []).map((sub) => ({
      ...sub,
      href: sitePath(sub.href, basePath),
    })),
  }));
}

module.exports = {
  normalizeSiteBasePath,
  sitePath,
  mapNavHrefs,
};
