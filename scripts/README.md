# Build, patch, and verify scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `build-static-site.mjs` | `npm run build:pages` / `build:pages:branch` | Full static export → `docs/` |
| `build-*.mjs` | `npm run build:<feature>` | esbuild one bundle per feature |
| `patch-dfs-for-pages.mjs` | `npm run patch:pages-dfs` | Fast DFS-only `docs/` refresh |
| `patch-matchup-predictor-*.mjs` | `npm run patch:matchup-*` | Inject nav/live scripts into matchup HTML |
| `export-matchup-pages.mjs` | `npm run export:matchup-pages` | Standalone matchup HTML export |
| `verify-*.mjs` | `node scripts/verify-*.js` | Bylaws, positions, salaries, DNS checks |
| `tune-matchup-predictor.js` | manual | Offline model tuning |

**Production deploy:** `npm run build:pages:branch` then commit and push `docs/` (see `deploy/GITHUB_PAGES.md`).
