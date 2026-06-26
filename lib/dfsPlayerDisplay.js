"use strict";

function escapeHtml(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dfsPlayerNameTagsHtml(p) {
  const tags = [];
  if (p?.isReplacement) {
    tags.push(
      '<span class="matchup-replacement-tag" title="Mid-season replacement">Replacement</span>'
    );
  }
  if (p?.isRookie) {
    tags.push('<span class="dfs-rookie-tag" title="First-year player">Rookie</span>');
  }
  return tags.join("");
}

function formatDfsPlayerNameHtml(p) {
  if (!p) return "";
  if (p.isReplacement && p.replacedName) {
    return (
      `<span class="dfs-roster-replaced-name">${escapeHtml(p.replacedName)}</span> ` +
      `${escapeHtml(p.name)}${dfsPlayerNameTagsHtml(p)}`
    );
  }
  const name = escapeHtml(p.name);
  const tags = dfsPlayerNameTagsHtml(p);
  if (p.isReplacement && !p.replacedName) {
    return `${name}${tags}`;
  }
  return tags ? `${name}${tags}` : name;
}

function formatDfsOpposingPitcherHtml(text) {
  const raw = String(text == null ? "" : text).trim();
  if (!raw || raw === "—") return "—";
  return escapeHtml(raw).replace(/\n/g, "<br>");
}

module.exports = {
  escapeHtml,
  formatDfsPlayerNameHtml,
  formatDfsOpposingPitcherHtml,
};
