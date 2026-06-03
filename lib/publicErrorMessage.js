"use strict";

const SENSITIVE_PATTERNS = [
  /https?:\/\//i,
  /docs\.google\.com/i,
  /spreadsheets/i,
  /Failed to load CSV/i,
  /Timed out loading CSV/i,
  /CSV URL is empty/i,
  /2PACX-/i,
  /\/export\?format=csv/i,
];

function containsSensitiveDetail(text) {
  const s = String(text || "");
  return SENSITIVE_PATTERNS.some((re) => re.test(s));
}

/** User-safe message — never exposes sheet URLs or internal fetch details. */
function publicErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  const raw =
    err && typeof err === "object" && err.message
      ? String(err.message)
      : typeof err === "string"
        ? err
        : "";
  if (!raw || containsSensitiveDetail(raw)) return fallback;
  return raw;
}

module.exports = {
  publicErrorMessage,
  containsSensitiveDetail,
};
