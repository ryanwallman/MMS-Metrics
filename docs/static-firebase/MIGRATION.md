# Static hosting + Firebase (branch `feat/static-firebase-hosting`)

Goal: host the site without a Node server (e.g. Firebase Hosting free tier), keep **runtime** Google Sheet CSV loads, and keep the DFS leaderboard **dynamic** via Firestore + client-side scoring.

## What works on this branch

### Phase 1 — Leaderboard without Render scoring API

- **`lib/dfsLeaderboardScoringContext.js`** — league data loaders (sheets + career CSV) shared by server and browser.
- **`lib/dfsLeaderboardResponse.js`** — `buildWeeklyLeaderboardResponse(selectedWeek, lineups)`.
- **`public/js/dfs-leaderboard-scoring.mjs`** — browser bundle (build with `npm run build:leaderboard-scoring`).
- **`/dfs/leaderboard`** — when not server-rendered, loads lineups from Firestore and scores in the browser using the same logic as the old `POST /api/dfs/leaderboard/score` path.
- **`public/data/csv/career.csv`** — copy of `data/csv/career.csv` for static hosting (career is not a published Google Sheet).

Express still serves all pages for local dev and optional Render deploy. The leaderboard no longer *requires* Admin SDK or the score API when the client bundle is loaded.

### Phase 2 — Not done yet

These routes still need **Node + EJS** (or a future client-side port):

- `/`, rankings, `/dfs` lineup builder, matchup predictor, schedule, team pages, etc.

Firebase Hosting `hosting/` is a placeholder until static shells exist for those routes.

## Commands

```bash
# Build browser scoring bundle (commit public/js/dfs-leaderboard-scoring.mjs after changes)
npm run build:leaderboard-scoring

# Local Express (unchanged)
npm start

# Firebase Hosting preview (static folder only for now)
npx firebase-tools serve --only hosting
```

## Firebase Hosting deploy (when ready)

1. Build scoring bundle: `npm run build:leaderboard-scoring`
2. Copy or generate static HTML into `hosting/` (full site migration).
3. `firebase deploy --only hosting`
4. Add Hosting domain to Firebase Auth **Authorized domains**.
5. Firestore rules: public read on `lineups` (already in `firebase/firestore.rules`).

## CORS

Published Google Sheet CSV URLs are fetched from the user’s browser. If a sheet stops working in production, check the browser network tab for CORS errors and consider a tiny Cloudflare Worker proxy (still runtime, still free tier).

## Career CSV

On the server, career loads from `data/csv/career.csv` via `setCareerCsvFilePath`. On static hosting, the bundle uses `/data/csv/career.csv`. Refresh the public copy when career stats change:

```bash
cp data/csv/career.csv public/data/csv/career.csv
```
