/**
 * Site header: stale refresh + mobile nav toggle.
 */
(function () {
  const base =
    typeof window.__SITE_BASE_PATH__ !== "undefined" ? String(window.__SITE_BASE_PATH__ || "") : "";

  function sitePath(p) {
    const pathPart = p.startsWith("/") ? p : `/${p}`;
    return `${base}${pathPart}`;
  }

  function headerIsStale(header) {
    if (!header) return false;
    if (header.querySelector(".site-brand-tagline")) return true;
    if (!header.querySelector(".site-brand-logo")) return true;
    if (!header.querySelector('a[href*="team-analytics"]')) return true;
    if (!header.querySelector(".site-nav-toggle")) return true;
    return false;
  }

  function applyNavActive(headerEl) {
    let path = window.location.pathname || "/";
    if (base && path.startsWith(base)) path = path.slice(base.length) || "/";

    headerEl.querySelectorAll(".site-nav-link").forEach((a) => {
      a.classList.remove("is-active");
      a.removeAttribute("aria-current");
      const href = a.getAttribute("href") || "";
      let match = false;
      if (href === sitePath("/") || href === `${base}/`) {
        match = path === "/" || path === "";
      } else if (href.includes("/team-analytics")) {
        match = path.startsWith("/team-analytics");
      } else if (href.includes("/matchup-predictor")) {
        match = path.startsWith("/matchup-predictor");
      } else if (href.includes("/rankings/power")) {
        match = path.startsWith("/rankings/power");
      } else if (href.includes("/dfs")) {
        match = path.startsWith("/dfs");
      }
      if (match) {
        a.classList.add("is-active");
        a.setAttribute("aria-current", "page");
      }
    });
  }

  function closeSiteNav(header) {
    if (!header) return;
    header.classList.remove("is-nav-open");
    const btn = header.querySelector(".site-nav-toggle");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  function initSiteNavToggle(header) {
    if (!header) return;
    const btn = header.querySelector(".site-nav-toggle");
    const nav = header.querySelector(".site-nav");
    if (!btn || !nav) return;

    btn.addEventListener("click", () => {
      const open = header.classList.toggle("is-nav-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });

    nav.querySelectorAll(".site-nav-link").forEach((link) => {
      link.addEventListener("click", () => closeSiteNav(header));
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeSiteNav(document.querySelector(".site-header.is-nav-open"));
  });

  async function refreshSiteHeader() {
    const header = document.querySelector(".site-header");
    if (!header || !headerIsStale(header)) return header;

    const script = document.querySelector('script[src*="site-chrome.js"]');
    const vMatch = script && script.getAttribute("src")?.match(/[?&]v=([^&]+)/);
    const v = vMatch ? vMatch[1] : "5";

    try {
      const res = await fetch(`${sitePath("/site-header.html")}?v=${encodeURIComponent(v)}`, {
        cache: "no-store",
      });
      if (!res.ok) return header;
      const html = await res.text();
      const wrap = document.createElement("div");
      wrap.innerHTML = html.trim();
      const fresh = wrap.querySelector(".site-header");
      if (!fresh) return header;
      applyNavActive(fresh);
      header.replaceWith(fresh);
      return fresh;
    } catch {
      return header;
    }
  }

  async function initSiteChrome() {
    const header = (await refreshSiteHeader()) || document.querySelector(".site-header");
    if (header) {
      applyNavActive(header);
      initSiteNavToggle(header);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void initSiteChrome());
  } else {
    void initSiteChrome();
  }
})();
