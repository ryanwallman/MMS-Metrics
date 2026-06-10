# GitHub Pages production site (generated)

**Do not edit by hand.** This folder is the live site at https://mmsmetrics.com/, built from Express + EJS + `public/`.

```bash
npm run build:pages:branch   # fast: skips full matchup HTML regen
npm run build:pages          # full rebuild (30+ min; all matchup pages)
```

Then commit and push `docs/` to `main`. GitHub Pages serves `/docs` on the custom domain (`docs/CNAME` → `mmsmetrics.com`).

Structure mirrors URL paths: `docs/index.html` → `/`, `docs/team-analytics/5/index.html` → `/team-analytics/5`, etc.
