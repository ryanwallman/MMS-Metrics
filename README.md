# Marlboro Men's Softball — MMS site

Node/Express app for league stats, DFS, matchup predictor, and team analytics. Production: **https://mmsmetrics.com** (static `docs/` on GitHub Pages).

## Where things go

```
MMS/
├── server.js              # Express app entry
├── package.json           # npm scripts (build, start)
│
├── views/                 # EJS templates → see views/README.md
├── public/                # Web root (CSS, JS bundles, favicons) → public/README.md
├── lib/                   # Shared logic (server + bundles) → lib/README.md
├── client/                # esbuild entry points → client/README.md
├── data/                  # career.csv + league config modules → data/README.md
│
├── scripts/               # Build & verify → scripts/README.md
├── docs/                  # GENERATED — GitHub Pages deploy output → docs/README.md
├── deploy/                # Docker, Render, Pages, domain docs
├── firebase/              # Firestore rules (+ local service account, gitignored)
│
├── assets/                # Design sources (NOT served) → assets/README.md
├── archive/               # Legacy / unused (NOT served) → archive/README.md
└── hosting/               # Firebase Hosting placeholder (NOT used for prod)
```

| I want to… | Go to |
|------------|--------|
| Change a page layout | `views/` |
| Change site styles or favicon | `public/` (logo source: `assets/brand/`) |
| Change stats/DFS/matchup logic | `lib/` |
| Add a browser bundle | `client/` + new `scripts/build-*.mjs` |
| Deploy to mmsmetrics.com | `npm run build:pages:branch`, commit `docs/`, push `main` |
| Find old WordPress HTML | `archive/wordpress-exports/` |

## Local dev

```bash
npm install
cp .env.example .env
# Fill .env; place Firebase service account at firebase/service-account.json
npm start
```

## Deploy

Full checklist: **[deploy/DEPLOY.md](deploy/DEPLOY.md)** (GitHub Pages + optional Render + Firebase).

Quick Pages deploy:

```bash
npm run build:pages:branch
git add docs/ public/
git commit -m "Rebuild static site for GitHub Pages"
git push
```
