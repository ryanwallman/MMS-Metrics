/**
 * Sanitize errors before showing them in the UI (no sheet URLs or fetch internals).
 */
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

export function publicErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  const raw =
    err && typeof err === "object" && err.message
      ? String(err.message)
      : typeof err === "string"
        ? err
        : "";
  if (!raw || containsSensitiveDetail(raw)) return fallback;
  return raw;
}
