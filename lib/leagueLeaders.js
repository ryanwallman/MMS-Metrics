function safeText(value) {
  return (value || "").toString().trim();
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isTruthyRookie(value) {
  const text = safeText(value).toLowerCase();
  return text === "y" || text === "yes" || text === "true" || text === "1";
}

function buildLeagueLeaders(players) {
  const topN = (items, field, n = 5, minAB = 0) =>
    items
      .filter((p) => toNumber(p.AB) >= minAB)
      .slice()
      .sort((a, b) => toNumber(b[field]) - toNumber(a[field]))
      .slice(0, n);

  const leaders = [
    { title: "OPS", field: "OPS", minAB: 0 },
    { title: "AVG", field: "AVG", minAB: 0 },
    { title: "OBP", field: "OBP", minAB: 0 },
    { title: "SLG", field: "SLG", minAB: 0 },
    { title: "Hits", field: "Hits", minAB: 0 },
    { title: "Runs", field: "Runs", minAB: 0 },
    { title: "RBI", field: "RBI", minAB: 0 },
    { title: "HR", field: "HR", minAB: 0 },
  ].map((category) => ({
    ...category,
    players: topN(players, category.field, 5, category.minAB),
  }));

  const topRookies = players
    .filter((p) => isTruthyRookie(p.IsRookie))
    .slice()
    .sort((a, b) => toNumber(b.AVG) - toNumber(a.AVG))
    .slice(0, 5);

  return { leaders, topRookies };
}

module.exports = { buildLeagueLeaders, isTruthyRookie };
