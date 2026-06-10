# Shared application logic

Node modules used by `server.js`, `scripts/`, and esbuild bundles in `client/`.

| Area | Key modules |
|------|-------------|
| **Data paths & sheets** | `dataPaths.js`, `sheetUrls.js`, `fetchCsvText.js` |
| **DFS** | `dfs.js`, `dfsLineupPageData.js`, `dfsLeaderboardScoringContext.js` |
| **Matchup predictor** | `matchupPredict.js`, `matchupMissingPlayers.js`, `matchupPredictorMode.js`, … |
| **Rankings & analytics** | `powerRankingsPageData.js`, `teamAnalytics.js`, `teamAnalyticsPageData.js` |
| **Firebase** | `firebaseAdmin.js`, `firebaseClientConfig.js` |
| **Rosters & stats** | `teamRosters.js`, `stats2026Loader.js`, `playerReplacements.js` |

Unused code lives in `archive/lib-unused/` — not imported from here.
