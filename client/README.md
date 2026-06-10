# Browser bundle entry points

Each `*-entry.mjs` file is the **source** for a feature bundle. esbuild compiles these into `public/js/` (see `npm run build:*` in `package.json`).

| Entry | Build script | Output |
|-------|--------------|--------|
| `league-leaders-entry.mjs` | `build:league-leaders` | `public/js/league-leaders.mjs` |
| `power-rankings-entry.mjs` | `build:power-rankings` | `public/js/power-rankings.mjs` |
| `team-analytics-entry.mjs` | `build:team-analytics` | `public/js/team-analytics.js` |
| `matchup-predictor-entry.mjs` | `build:matchup-predictor` | `public/js/matchup-predictor-client.mjs` |
| `matchup-predictor-nav-entry.mjs` | `build:matchup-predictor-nav` | `public/js/matchup-predictor-nav.mjs` |
| `matchup-predictor-live-entry.mjs` | `build:matchup-predictor-live` | `public/js/matchup-predictor-live.mjs` |
| `dfs-lineup-pool-entry.mjs` | `build:dfs-lineup-pool` | `public/js/dfs-lineup-pool.mjs` |
| `dfs-landing-entry.mjs` | `build:dfs-landing` | `public/js/dfs-landing.mjs` |
| `leaderboard-scoring-entry.mjs` | `build:leaderboard-scoring` | `public/js/dfs-leaderboard-scoring.mjs` |
| `leaderboard-lineup-entry.mjs` | `build:leaderboard-lineup` | `public/js/dfs-leaderboard-lineup.mjs` |

Bundles import shared logic from `lib/`. Do not edit the generated files in `public/js/` by hand — change `client/` or `lib/` and rebuild.
