import { OFFENSIVE_WORDS } from "./offensive-words-list.mjs";

/**
 * Return the matched blocklist entry if text contains it (substring, case-insensitive).
 */
export function findOffensiveTerm(text) {
  const raw = String(text || "").toLowerCase();
  const compact = raw.replace(/[^a-z0-9]/g, "");
  for (const word of OFFENSIVE_WORDS) {
    const w = String(word || "").toLowerCase();
    if (!w) continue;
    if (raw.includes(w)) return word;
    const wCompact = w.replace(/[^a-z0-9]/g, "");
    if (wCompact && compact.includes(wCompact)) return word;
  }
  return null;
}

export function assertNotOffensive(text, label = "Display name") {
  if (findOffensiveTerm(text)) {
    throw new Error(`${label} is not allowed. Please choose a different name.`);
  }
}
