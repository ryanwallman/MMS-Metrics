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

function csvFetchTimeoutMs() {
  const fromEnv = Number(process.env.CSV_FETCH_TIMEOUT_MS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  if (process.env.STATIC_EXPORT === "1") return 90_000;
  return 0;
}

async function fetchUrlText(url) {
  const timeoutMs = csvFetchTimeoutMs();
  const opts = timeoutMs > 0 ? { signal: AbortSignal.timeout(timeoutMs) } : {};
  try {
    const res = await fetch(url, opts);
    if (!res.ok) {
      throw new Error(`Failed to load CSV (${res.status}) from ${url}`);
    }
    let text = await res.text();
    text = text.replace(/^\ufeff/, "");
    return text;
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      throw new Error(`Timed out loading CSV after ${timeoutMs / 1000}s: ${url}`);
    }
    throw err;
  }
}

/** Fetch raw CSV text (Google Sheets export, published CSV, etc.). */
async function fetchCsvText(url) {
  const safeUrl = (url || "").toString().trim();
  if (!safeUrl) throw new Error("CSV URL is empty.");
  if (fetchCsvTextOverride) {
    return fetchCsvTextOverride(safeUrl);
  }
  return csvTextCache.get(safeUrl, () => fetchUrlText(safeUrl));
}

module.exports = { fetchCsvText, csvTextCache, setFetchCsvTextOverride };
