# GitHub Pages (deploy from branch)

GitHub Pages serves **static files only** — no Node/Express. This repo builds pre-rendered HTML plus assets into **`docs/`**, which you commit and push.

**Production URL:** https://mmsmetrics.com/ (see [CUSTOM_DOMAIN.md](./CUSTOM_DOMAIN.md) for DNS + GitHub setup)

**Legacy project URL:** https://ryanwallman.github.io/MMS-Metrics/ (only if you build with `npm run build:pages:github`)

## One-time GitHub setup

1. **Settings → Pages → Build and deployment**
2. **Source:** Deploy from a branch
3. **Branch:** `main` (or your production branch)
4. **Folder:** `/docs`
5. **Custom domain:** `mmsmetrics.com` (details in [CUSTOM_DOMAIN.md](./CUSTOM_DOMAIN.md))
6. Do **not** enable GitHub Actions as the Pages source if you use branch deploy (pick one).

## Deploy after code changes

From the repo root, with `.env` filled in (see `.env.example`, especially `FIREBASE_*`):

```bash
npm run build:pages:branch
```

This rebuilds home, power rankings, DFS, leaderboard (all weeks/slates), and JS bundles. It **reuses** existing `docs/matchup-predictor/` pages so the build finishes in a few minutes instead of hours.

Then commit and push:

```bash
git add docs/ public/js/ views/ lib/ server.js package.json scripts/ deploy/
git commit -m "Rebuild static site for GitHub Pages"
git push
```

Pages updates within 1–2 minutes. Hard-refresh the browser (Cmd+Shift+R) after deploy.

### Faster DFS-only rebuild

If you only changed DFS / leaderboard code:

```bash
npm run patch:pages-dfs
git add docs/ public/js/
git commit -m "Rebuild DFS pages for GitHub Pages"
git push
```

### Full rebuild (includes all matchup predictor pages)

Only needed when matchup predictor HTML changes or `docs/matchup-predictor/` is missing:

```bash
npm run build:pages
```

Expect **30+ minutes** (thousands of matchup pages).

## Firebase

**No Google sign-in** — lineups use a device ID + display name.

1. Put web app keys in `.env` before any `build:pages*` command (baked into HTML at build time).
2. Publish Firestore rules when they change:

```bash
firebase deploy --only firestore
```

## Local preview

```bash
npm run build:pages:branch
npx serve docs -l 5000
```

Open http://localhost:5000/ (custom domain builds use site root; use `build:pages:github` + `/MMS-Metrics/` for legacy preview)

## What works on GitHub Pages

| Feature | On Pages |
|---------|----------|
| Home / league leaders | Yes (pre-rendered) |
| Power rankings | Yes (pre-rendered; captains from captain_mapping sheet) |
| Matchup predictor | Yes (pre-rendered view/matchup URLs) |
| DFS lineup builder | Yes (Firestore in browser) |
| DFS leaderboard | Yes (Firestore + client scoring; first load can take 30–60s) |
| DFS leaderboard lineup detail (`?week=&user=`) | No server — use locked slate on builder |

## Optional: GitHub Actions

`.github/workflows/deploy-pages.yml` is **manual only** (`workflow_dispatch`). Branch deploy is the recommended path.
