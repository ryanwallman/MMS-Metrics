/**
 * Live player replacements from Google Sheets (Original → New).
 */
const Papa = require("papaparse");
const { fetchCsvText } = require("./fetchCsvText");
const { getReplacementsCsvUrl } = require("./sheetUrls");
const { createMemoryCache } = require("./memoryCache");
const { normalizePlayerName } = require("./dfs");

function safeText(value) {
  return (value || "").toString().trim();
}

function parseReplacementDateCell(cell) {
  let s = safeText(cell).replace(/^\ufeff/g, "");
  if (!s) return null;
  s = s.replace(/[\u00a0\u202f]/g, " ").trim().replace(/^["']+|["']+$/g, "");

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const slashMatch = /(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{2,4})/.exec(s);
  if (!slashMatch) return null;

  const month = String(slashMatch[1]).padStart(2, "0");
  const day = String(slashMatch[2]).padStart(2, "0");
  let year = Number(slashMatch[3]);
  if (!Number.isFinite(year)) return null;
  if (year < 100) year += 2000;
  return `${year}-${month}-${day}`;
}

function isReplacementActiveForDate(entry, gameIsoDate) {
  if (!entry) return false;
  if (!entry.replacementDateIso) return true;
  if (!gameIsoDate) return false;
  return safeText(gameIsoDate) >= entry.replacementDateIso;
}

/** Matchup predictor: only apply replacements on or after the sheet date. */
function filterReplacementsForDate(byOriginalNorm, gameIsoDate) {
  if (!byOriginalNorm?.size) return new Map();
  if (!gameIsoDate) return new Map();
  const filtered = new Map();
  for (const [norm, entry] of byOriginalNorm.entries()) {
    if (isReplacementActiveForDate(entry, gameIsoDate)) filtered.set(norm, entry);
  }
  return filtered;
}

function parseReplacementsRows(rows) {
  const list = [];
  const byOriginalNorm = new Map();
  const replacementNorms = new Set();

  for (let i = 0; i < (rows || []).length; i += 1) {
    const row = rows[i];
    if (!row || !row.length) continue;
    const original = safeText(row[0]);
    const replacement = safeText(row[1]);
    const replacementDateRaw = safeText(row[2]);
    if (!original || !replacement) continue;
    if (
      i === 0 &&
      /original/i.test(original) &&
      (/new/i.test(replacement) || /replacement/i.test(replacement))
    ) {
      continue;
    }

    const originalNorm = normalizePlayerName(original);
    const replacementNorm = normalizePlayerName(replacement);
    if (!originalNorm || !replacementNorm || originalNorm === replacementNorm) continue;

    const replacementDateIso = parseReplacementDateCell(replacementDateRaw);
    const entry = {
      original,
      replacement,
      originalNorm,
      replacementNorm,
      replacementDateIso,
      replacementDateRaw: replacementDateRaw || null,
    };
    list.push(entry);
    byOriginalNorm.set(originalNorm, entry);
    replacementNorms.add(replacementNorm);
  }

  return { list, byOriginalNorm, replacementNorms };
}

function emptyReplacementContext() {
  return { list: [], byOriginalNorm: new Map(), replacementNorms: new Set() };
}

function resolveEffectivePlayer(originalName, byOriginalNorm) {
  const norm = normalizePlayerName(originalName);
  const repl = byOriginalNorm?.get(norm);
  if (repl) {
    return {
      name: repl.replacement,
      norm: repl.replacementNorm,
      replacedName: repl.original,
      isReplacement: true,
    };
  }
  return {
    name: String(originalName || "").trim(),
    norm,
    replacedName: null,
    isReplacement: false,
  };
}

function applyReplacementsToPlayerNames(playerNames, byOriginalNorm) {
  return (playerNames || []).map(
    (name) => resolveEffectivePlayer(name, byOriginalNorm).name
  );
}

function remapLineupNorms(lineupNorms, byOriginalNorm) {
  return (lineupNorms || [])
    .map((n) => {
      const norm = normalizePlayerName(n);
      const repl = byOriginalNorm?.get(norm);
      return repl ? repl.replacementNorm : norm;
    })
    .filter(Boolean);
}

function positionFromMap(positionByNorm, norm) {
  if (!positionByNorm || norm == null) return null;
  if (positionByNorm instanceof Map) return positionByNorm.get(norm) || null;
  return positionByNorm[norm] || null;
}

function buildRosterEntriesWithReplacements(
  playerNames,
  normalizeName = normalizePlayerName,
  positionByNorm = null,
  byOriginalNorm = null
) {
  return (playerNames || []).map((name, idx) => {
    const eff = resolveEffectivePlayer(name, byOriginalNorm);
    return {
      round: idx + 1,
      norm: eff.norm,
      name: eff.name,
      replacedName: eff.replacedName,
      isReplacement: eff.isReplacement,
      position: positionFromMap(positionByNorm, eff.norm),
    };
  });
}

async function loadPlayerReplacements() {
  try {
    const text = await fetchCsvText(getReplacementsCsvUrl());
    const parsed = Papa.parse(text, { skipEmptyLines: true });
    return parseReplacementsRows(parsed.data || []);
  } catch (err) {
    console.error("Could not load player replacements sheet", err);
    return emptyReplacementContext();
  }
}

const replacementsCache = createMemoryCache(
  Number(process.env.REPLACEMENTS_CACHE_TTL_MS) || 5 * 60 * 1000,
  "replacements"
);

function getCachedPlayerReplacements() {
  return replacementsCache.get("player-replacements", loadPlayerReplacements);
}

function serializeReplacementsForClient(byOriginalNorm) {
  const out = {};
  if (!byOriginalNorm) return out;
  for (const [norm, entry] of byOriginalNorm.entries()) {
    out[norm] = {
      original: entry.original,
      replacement: entry.replacement,
      originalNorm: entry.originalNorm,
      replacementNorm: entry.replacementNorm,
      replacementDateIso: entry.replacementDateIso || null,
    };
  }
  return out;
}

module.exports = {
  parseReplacementDateCell,
  isReplacementActiveForDate,
  filterReplacementsForDate,
  parseReplacementsRows,
  resolveEffectivePlayer,
  applyReplacementsToPlayerNames,
  remapLineupNorms,
  buildRosterEntriesWithReplacements,
  loadPlayerReplacements,
  getCachedPlayerReplacements,
  emptyReplacementContext,
  serializeReplacementsForClient,
};
