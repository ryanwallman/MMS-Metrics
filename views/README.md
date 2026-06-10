# EJS page templates

Rendered by `server.js` via `renderPage(res, "view-name", locals)`. Template file: `views/<view-name>.ejs`.

**Active templates**

| Template | Route(s) |
|----------|----------|
| `historical.ejs` | `/` (League Leaders) |
| `power-rankings.ejs` | `/rankings/power` |
| `team-analytics.ejs` | `/team-analytics`, `/team-analytics/:teamId` |
| `dfs-lineup.ejs` | `/dfs` |
| `dfs-leaderboard.ejs` | `/dfs/leaderboard` |
| `dfs-leaderboard-lineup.ejs` | `/dfs/leaderboard/lineup` (server render) |
| `dfs-leaderboard-lineup-client.ejs` | lineup detail (static export) |
| `matchup-predictor.ejs` | `/matchup-predictor/**` |
| `confirm-names.ejs` | `/confirm-names` (dev/roster QA) |

**Partials:** `views/partials/` — site header, head, matchup fragments, loading overlay.

**Retired templates:** `views/_unused/` — not referenced by the server.
