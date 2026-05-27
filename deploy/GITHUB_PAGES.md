# GitHub Pages (static export)

GitHub Pages serves **static files only** — no Node/Express. This repo builds pre-rendered HTML plus `public/` assets into **`docs/`**, which you commit and deploy.

**https://ryanwallman.github.io/MMS-Metrics/**

(Replace `MMS-Metrics` if the repository name changes.)

## Deploy from branch (recommended)

1. **One-time:** GitHub → **Settings → Pages → Build and deployment → Source** → **Deploy from a branch**.
2. Choose the branch you push to (usually **`main`**) and folder **`/docs`**.
3. After code changes, rebuild and push:

```bash
cp .env.example .env   # once — fill FIREBASE_* from Firebase Console
npm run build:pages    # builds docs/ with Firebase + Google Sheets data
git add docs/
git commit -m "Rebuild static site for Pages"
git push
```

Pages updates within a minute or two after the push. No GitHub Actions secrets required — Firebase keys come from your local `.env` at build time (same as `npm start` locally).

### Workflow with feature branches

1. Develop on a feature branch (`git checkout -b my-feature`).
2. When ready for production: merge into the **Pages branch** (e.g. `main`).
3. On that branch, run `npm run build:pages`, commit `docs/`, and push.

Only the branch selected in **Settings → Pages** is live. Pushes to other branches do not update the site until merged and rebuilt.

## Firebase

**No Google sign-in** — lineups use a device ID + display name.

1. Put web app keys in `.env` (see `.env.example`) before `npm run build:pages`.
2. Publish Firestore rules after rule changes:

```bash
firebase deploy --only firestore
```

If DFS shows “Firebase is not configured” on Pages, rebuild with a complete `.env` and push `docs/` again.

## Local preview

```bash
npm run build:pages
npx serve docs -l 5000
```

Open http://localhost:5000/MMS-Metrics/ (base path matches GitHub Pages).

Override base path:

```bash
SITE_BASE_PATH=/MMS-Metrics npm run build:static
```

## Optional: GitHub Actions

`/.github/workflows/deploy-pages.yml` can still build and deploy on push (manual **workflow_dispatch** only). Use it if you prefer CI over committing `docs/`. Branch deploy and Actions both produce the same static output — pick one Pages source in Settings, not both.

## Build time

`npm run build:pages` pre-renders **5 routes** and fetches Google Sheets CSVs. Expect **3–15 minutes** on a typical connection.

## What works on Pages

| Feature | GitHub Pages |
|---------|--------------|
| League leaders, power rankings | Pre-rendered HTML |
| Matchup predictor | Default view only (form changes need client-side work or Node host) |
| DFS lineup builder | Yes — save with display name (one per device per slate) |
| DFS leaderboard | Client-side (Firestore + Google Sheets scoring) |
| Leaderboard lineup detail (`/dfs/leaderboard/lineup?…`) | Not exported (no server Admin SDK) |

For full server-rendered pages and APIs, run `npm start` locally or use a Node host.
