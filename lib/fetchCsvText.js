const { createMemoryCache } = require("./memoryCache");

/** Published CSV responses — cache so Render does not refetch every leaderboard request. */
const csvTextCache = createMemoryCache(
  Number(process.env.CSV_CACHE_TTL_MS) || 10 * 60 * 1000,
  "csv-text"
);

let fetchCsvTextOverride = null;

/** Browser bundle or tests can inject fetch (e.g. no Node cache). */
function setFetchCsvTextOverride(fn) {
  fetchCsvTextOverride = typeof fn === "function" ? fn : null;
}

/** Fetch raw CSV text (Google Sheets export, published CSV, etc.). */
async function fetchCsvText(url) {
  const safeUrl = (url || "").toString().trim();
  if (!safeUrl) throw new Error("CSV URL is empty.");
  if (fetchCsvTextOverride) {
    return fetchCsvTextOverride(safeUrl);
  }
  return csvTextCache.get(safeUrl, async () => {
    const res = await fetch(safeUrl);
    if (!res.ok) {
      throw new Error(`Failed to load CSV (${res.status}) from ${safeUrl}`);
    }
    let text = await res.text();
    text = text.replace(/^\ufeff/, "");
    return text;
  });
}

module.exports = { fetchCsvText, csvTextCache, setFetchCsvTextOverride };
