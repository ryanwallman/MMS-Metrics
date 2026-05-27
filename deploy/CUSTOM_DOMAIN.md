# Custom domain: mmsmetrics.com

Production builds use the **site root** (`/`) so links work at `https://mmsmetrics.com/`, not under `/MMS-Metrics/`.

The file `docs/CNAME` tells GitHub Pages which hostname to use. DNS must point your domain at GitHub.

## What you do (one-time)

### 1. DNS at your registrar (where you bought mmsmetrics.com)

**Apex (`mmsmetrics.com`)** — add four **A** records:

| Type | Name / Host | Value |
|------|-------------|--------|
| A | `@` (or blank) | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

**WWW (optional but recommended)** — add one **CNAME** record:

| Type | Name / Host | Value |
|------|-------------|--------|
| CNAME | `www` | `ryanwallman.github.io` |

Some registrars want `ryanwallman.github.io.` with a trailing dot.

DNS can take from a few minutes up to 48 hours. Check with [dnschecker.org](https://dnschecker.org).

### 2. GitHub repository settings

Repo: **ryanwallman/MMS-Metrics** (or your fork).

1. **Settings → Pages**
2. **Build and deployment → Source:** Deploy from a branch  
   - Branch: `main`  
   - Folder: `/docs`
3. **Custom domain:** enter `mmsmetrics.com` → **Save**  
   - Wait until DNS check passes (green checkmark).  
   - Enable **Enforce HTTPS** when it appears.
4. If you use `www`, also add `www.mmsmetrics.com` in the custom domain field (GitHub supports apex + www on the same site).

Do **not** switch Pages source to “GitHub Actions” if you deploy by committing `docs/` (branch deploy).

### 3. Firebase (DFS lineup + leaderboard)

In [Firebase Console](https://console.firebase.google.com) → your project → **Authentication** → **Settings** → **Authorized domains**, add:

- `mmsmetrics.com`
- `www.mmsmetrics.com` (if you use www)

Rebuild the static site after any `.env` Firebase change so HTML includes the right config:

```bash
npm run build:pages:branch   # fast, keeps matchup HTML
# or
npm run build:pages          # full rebuild (~30+ min)
```

### 4. Deploy after DNS + GitHub are set

From the repo root (`.env` with `FIREBASE_*` filled in):

```bash
npm run build:pages:branch
git add docs/ public/js/
git commit -m "Rebuild site for mmsmetrics.com"
git push
```

First custom-domain deploy: prefer a **full** `npm run build:pages` if `docs/` was still built for `/MMS-Metrics/`.

## URLs

| URL | Notes |
|-----|--------|
| https://mmsmetrics.com/ | Primary (after DNS + deploy) |
| https://www.mmsmetrics.com/ | Works if www CNAME + GitHub custom domain |
| https://ryanwallman.github.io/MMS-Metrics/ | Old project URL; only works if you run `npm run build:pages:github` |

## Local preview (custom domain paths)

```bash
npm run build:pages:branch
npx serve docs -l 5000
```

Open http://localhost:5000/ (root, not `/MMS-Metrics/`).

## Troubleshooting

- **404 or broken CSS:** `docs/` was built with `SITE_BASE_PATH=/MMS-Metrics`. Rebuild with `npm run build:pages` or `build:pages:branch` (default scripts use root + `CNAME`).
- **“Domain not configured” in GitHub:** DNS A records not propagated yet, or wrong host (`@` vs `mmsmetrics.com`).
- **HTTPS certificate pending:** Normal for up to ~24h after DNS is correct; leave custom domain saved and Enforce HTTPS on.
- **Firebase permission errors in browser:** Add `mmsmetrics.com` to authorized domains and rebuild.
