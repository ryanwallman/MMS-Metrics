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

function logCsvFetchFailure(kind, url, detail) {
  const msg = `[MMS] CSV fetch ${kind}${detail ? `: ${detail}` : ""}`;
  if (typeof console !== "undefined" && console.error) {
    console.error(msg, url);
  }
}

function csvFetchUserError(kind) {
  if (kind === "timeout") {
    return new Error(
      "League data took too long to load. Check your connection and try again."
    );
  }
  if (kind === "http") {
    return new Error("Could not load league data right now. Please try again in a moment.");
  }
  if (kind === "empty") {
    return new Error("Could not load league data. Please try again.");
  }
  return new Error("Could not load league data. Please try again.");
}

async function fetchUrlText(url) {
  const timeoutMs = csvFetchTimeoutMs();
  const opts = timeoutMs > 0 ? { signal: AbortSignal.timeout(timeoutMs) } : {};
  try {
    const res = await fetch(url, opts);
    if (!res.ok) {
      logCsvFetchFailure("HTTP", url, String(res.status));
      throw csvFetchUserError("http");
    }
    let text = await res.text();
    text = text.replace(/^\ufeff/, "");
    return text;
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      logCsvFetchFailure("timeout", url, `${timeoutMs / 1000}s`);
      throw csvFetchUserError("timeout");
    }
    if (err.message && !/https?:\/\//i.test(err.message)) {
      throw err;
    }
    logCsvFetchFailure("error", url, err.message || err);
    throw csvFetchUserError("error");
  }
}

/** Fetch raw CSV text (Google Sheets export, published CSV, etc.). */
async function fetchCsvText(url) {
  const safeUrl = (url || "").toString().trim();
  if (!safeUrl) {
    logCsvFetchFailure("empty-url", safeUrl);
    throw csvFetchUserError("empty");
  }
  if (fetchCsvTextOverride) {
    return fetchCsvTextOverride(safeUrl);
  }
  return csvTextCache.get(safeUrl, () => fetchUrlText(safeUrl));
}

module.exports = { fetchCsvText, csvTextCache, setFetchCsvTextOverride };
