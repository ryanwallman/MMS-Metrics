/** URL-safe matchup segment for static hosting (awayId-homeId). */

function matchupKeyToSlug(key) {
  const k = String(key || "").trim();
  const pipe = k.indexOf("|");
  if (pipe < 0) return k;
  return `${k.slice(0, pipe)}-${k.slice(pipe + 1)}`;
}

function matchupSlugToKey(slug) {
  const raw = String(slug || "").trim();
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }
  const dash = decoded.match(/^(\d+)-(\d+)$/);
  if (dash) return `${dash[1]}|${dash[2]}`;
  const pipe = decoded.match(/^(\d+)\|(\d+)$/);
  if (pipe) return `${pipe[1]}|${pipe[2]}`;
  return decoded;
}

module.exports = { matchupKeyToSlug, matchupSlugToKey };
