# Unused EJS templates

These views are **not** rendered by `server.js`. Routes that used similar pages now redirect or were replaced.

| Template | Status |
|----------|--------|
| `index.ejs` | Old home link hub → `/` uses `historical.ejs` (League Leaders) |
| `team.ejs` | Old team stats → `/stats/team/:id` redirects to `/`; use `team-analytics.ejs` |
| `schedule.ejs` | Schedule page removed from nav |
| `offensive-rankings.ejs` | `/offensive-rankings` redirects to `/` |
| `defense-rankings-placeholder.ejs` | `/defense-rankings` redirects to `/` |

Active templates live in `views/` (parent folder).
