# Marlboro Men’s Softball — MMS site

Node/Express app: schedules, stats, DFS lineup, leaderboard.

## Repo layout

| Path | Purpose |
|------|--------|
| **`server.js`** | Express app entry |
| **`views/`**, **`public/`** | Templates & static assets |
| **`lib/`** | Shared logic (DFS, Firebase helpers, data paths) |
| **`data/csv/`** | `career.csv`, `stats2025.csv` (2026 gamelogs + 2026 stats pull from **Google Sheets** — see `lib/dataPaths.js`) |
| **`data/`** | Other data modules (`customRosters2026.js`, etc.) |
| **`data/templates/`** | Optional XLSX template for defensive ratings import |
| **`firebase/`** | `firestore.rules`; local **`service-account.json`** (gitignored) for Admin SDK |
| **`firebase.json`** | Firebase CLI: rules path |
| **`deploy/`** | `Dockerfile`, **`DEPLOY.md`** (GitHub + Render + custom domain) |
| **`render.yaml`** | Render Blueprint (repo root) |

## Local dev

```bash
npm install
cp .env.example .env
# Fill .env; place Firebase service account at firebase/service-account.json (see firebase/README.md)
npm start
```

## Deploy

Production: **https://mmsmetrics.com** (GitHub → Render). Full steps and **Firebase checklist** in **[deploy/DEPLOY.md](deploy/DEPLOY.md)** — copy the same `FIREBASE_*` values from your local `.env` into Render; add **authorized domains** for `mmsmetrics.com`, `www`, and your `onrender.com` host.
