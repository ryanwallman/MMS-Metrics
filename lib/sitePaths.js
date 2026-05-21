/**
 * GitHub Pages project sites are served under /{repo-name}/.
 * Set SITE_BASE_PATH=/MMS-Metrics (no trailing slash) when building or deploying.
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
  }));
}

module.exports = {
  normalizeSiteBasePath,
  sitePath,
  mapNavHrefs,
};
