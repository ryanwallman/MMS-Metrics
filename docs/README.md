# Static assets (runtime web root)

Express serves this folder at the site root (`express.static("public")`). URLs like `/styles.css` and `/js/team-analytics.js` map to files here.

| Path | Purpose |
|------|---------|
| `styles.css` | Global site styles |
| `favicon*.png`, `apple-touch-icon.png`, `mms-stats-logo.png` | Icons (generated from `assets/brand/stats.png`) |
| `js/` | Page loaders (`.js`) and esbuild bundles (`.mjs`) — **rebuild via `npm run build:*`** |
| `data/csv/career.csv` | Copy of career data for browser fetch on static hosting |

On deploy, `scripts/build-static-site.mjs` copies all of `public/` into `docs/`. Do not put secrets here.
