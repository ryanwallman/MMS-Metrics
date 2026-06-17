"use strict";

const fs = require("fs");
const path = require("path");

function parseOffensiveWordsText(text) {
  return [
    ...new Set(
      String(text || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
    ),
  ];
}

/**
 * Return the matched blocklist entry if text contains it (substring, case-insensitive).
 * Also checks a punctuation-stripped form so e.g. "penisbrain" matches "penis".
 */
function findOffensiveTermInList(text, words) {
  const raw = String(text || "").toLowerCase();
  const compact = raw.replace(/[^a-z0-9]/g, "");
  for (const word of words || []) {
    const w = String(word || "").toLowerCase();
    if (!w) continue;
    if (raw.includes(w)) return word;
    const wCompact = w.replace(/[^a-z0-9]/g, "");
    if (wCompact && compact.includes(wCompact)) return word;
  }
  return null;
}

let cachedWords = null;

function getOffensiveWords() {
  if (!cachedWords) {
    const filePath = path.join(__dirname, "..", "offensive_words.txt");
    cachedWords = parseOffensiveWordsText(fs.readFileSync(filePath, "utf8"));
  }
  return cachedWords;
}

function findOffensiveTerm(text) {
  return findOffensiveTermInList(text, getOffensiveWords());
}

function assertNotOffensive(text, label = "Display name") {
  if (findOffensiveTerm(text)) {
    throw new Error(`${label} is not allowed. Please choose a different name.`);
  }
}

module.exports = {
  parseOffensiveWordsText,
  findOffensiveTermInList,
  findOffensiveTerm,
  assertNotOffensive,
  getOffensiveWords,
};
