# GitHub Pages (static export)

GitHub Pages serves **static files only** — no Node/Express. This repo exports pre-rendered HTML plus `public/` assets into `docs/` via **GitHub Actions** (`/.github/workflows/deploy-pages.yml`).

**https://ryanwallman.github.io/MMS-Metrics/**

(Replace `MMS-Metrics` if the repository name changes.)

## Enable Pages

1. Push to `main` (or a branch listed in `deploy-pages.yml`).
2. **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions**.
3. Open the **Actions** tab and confirm **Deploy GitHub Pages** succeeds.

### Alternative: deploy from branch `/docs`

1. Locally: `npm run build:static` (needs `.env` with `FIREBASE_*` keys).
2. Commit the generated `docs/` folder.
3. **Settings → Pages → Source:** **Deploy from a branch** → pick your branch → folder **`/docs`**.

## Required GitHub secrets (Actions)

Add under **Settings → Secrets and variables → Actions** — **Secrets** preferred; the workflow also falls back to **Repository variables** with the same names.

Use the same values as local `.env`:

| Secret | Purpose |
|--------|---------|
| `FIREBASE_API_KEY` | Firestore in the browser (lineup save + leaderboard) |
| `FIREBASE_AUTH_DOMAIN` | |
| `FIREBASE_PROJECT_ID` | |
| `FIREBASE_STORAGE_BUCKET` | |
| `FIREBASE_MESSAGING_SENDER_ID` | |
| `FIREBASE_APP_ID` | |
| `FIREBASE_MEASUREMENT_ID` | Optional |

These are baked into HTML at **build time**. If DFS shows “Firebase is not configured,” the secrets were missing or misnamed when the workflow ran — fix them and **re-run** the deploy workflow.

## Firebase Console

**No Google sign-in required** — lineups use a device ID + display name.

Publish Firestore rules after pulling this repo (device-based writes; update allowed until lock):

```bash
firebase deploy --only firestore
```

## Build time and failures

The **Build static site** step pre-renders **5 pages**. Each page loads Google Sheets CSVs; expect **3–15 minutes** total on Actions.

Watch the log for:

```
[static] GET /dfs …
[static] GET /dfs ok (45.2s)
```

| Limit | Value |
|-------|--------|
| Job | 25 min |
| Build step | 20 min |
| Each page fetch | 3 min |
| Each Google CSV | 90 sec |

## Local build

```bash
cp .env.example .env   # fill FIREBASE_*
npm run build:static
npx serve docs -l 5000
```

Override base path (defaults to `/MMS-Metrics` from repo name):

```bash
SITE_BASE_PATH=/MMS-Metrics npm run build:static
```

## What works on Pages

| Feature | GitHub Pages |
|---------|--------------|
| League leaders, power rankings | Pre-rendered HTML |
| Matchup predictor | Default view only (form changes need client-side work or Node host) |
| DFS lineup builder | Yes — save with display name (one per device per slate) |
| DFS leaderboard | Client-side (Firestore + Google Sheets scoring) |
| Leaderboard lineup detail (`/dfs/leaderboard/lineup?…`) | Not exported (no server Admin SDK) |

For full server-rendered pages and APIs, run `node server.js` locally or use a Node host.
