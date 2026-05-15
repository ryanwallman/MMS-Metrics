/** Fetch raw CSV text (Google Sheets export, published CSV, etc.). */
async function fetchCsvText(url) {
  const safeUrl = (url || "").toString().trim();
  if (!safeUrl) throw new Error("CSV URL is empty.");
  const res = await fetch(safeUrl);
  if (!res.ok) {
    throw new Error(`Failed to load CSV (${res.status}) from ${safeUrl}`);
  }
  let text = await res.text();
  text = text.replace(/^\ufeff/, "");
  return text;
}

module.exports = { fetchCsvText };
