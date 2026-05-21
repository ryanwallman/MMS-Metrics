# GitHub Pages (static export)

GitHub Pages serves **static files only** — no Node/Express. This repo can export pre-rendered HTML plus `public/` assets into `docs/` for hosting at:

**https://ryanwallman.github.io/MMS-Metrics/**

(Replace `MMS-Metrics` if the repository name changes.)

## Enable Pages

1. Push this branch to GitHub.
2. **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions** (recommended).
3. On the first push, open the **Actions** tab and confirm **Deploy GitHub Pages** succeeds.

### Alternative: deploy from branch `/docs`

1. Locally: `npm run build:static` (needs `.env` with `FIREBASE_*` keys).
2. Commit the generated `docs/` folder.
3. **Settings → Pages → Source:** **Deploy from a branch** → pick your branch → folder **`/docs`**.

## Required GitHub secrets (Actions)

Add under **Settings → Secrets and variables → Actions** (same values as local `.env`):

| Secret | Purpose |
|--------|---------|
| `FIREBASE_API_KEY` | DFS sign-in + Firestore in the browser |
| `FIREBASE_AUTH_DOMAIN` | |
| `FIREBASE_PROJECT_ID` | |
| `FIREBASE_STORAGE_BUCKET` | |
| `FIREBASE_MESSAGING_SENDER_ID` | |
| `FIREBASE_APP_ID` | |
| `FIREBASE_MEASUREMENT_ID` | Optional |

## Firebase Console

**Authentication → Settings → Authorized domains** — add:

- `ryanwallman.github.io` (covers `*.github.io` project URLs for this account’s Pages)

Publish Firestore rules if needed:

```bash
firebase deploy --only firestore
```

## Local build

```bash
cp .env.example .env   # fill FIREBASE_*
npm run build:static
# open docs/index.html via a static server, or:
npx serve docs -l 5000
```

Override base path (defaults to `/MMS-Metrics` from repo name):

```bash
SITE_BASE_PATH=/MMS-Metrics npm run build:static
```

## What works on Pages vs Render

| Feature | GitHub Pages | Render (Node) |
|---------|--------------|---------------|
| League leaders, matchup, power rankings | Pre-rendered HTML | Live |
| DFS lineup builder + Google sign-in | Yes (browser Firebase) | Yes |
| DFS leaderboard scoring | Client-side (sheets + Firestore) | Server or client |
| Leaderboard lineup detail (`/dfs/leaderboard/lineup?…`) | Not exported (needs Admin SDK) | Yes |

Full production app with all APIs: use **`deploy/DEPLOY.md`** (Render + custom domain).
