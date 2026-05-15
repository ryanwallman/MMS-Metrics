# Deploy MMS with GitHub + Render + **mmsmetrics.com**

Repo layout is described in the root **`README.md`**. This file is the deploy guide.

**GitHub Pages cannot run this app** (it needs Node/Express). **Render** connects to GitHub: pushes to `main` can auto-deploy. You add **mmsmetrics.com** in Render and DNS.

---

## Launch order (do this in order)

1. **Push the repo to GitHub** (section below).
2. **Create the Render web service** from that repo (Docker / Blueprint).
3. **Set Render environment variables** — especially **all Firebase keys** (section below). Without them, DFS and the leaderboard show “Firebase is not configured.”
4. **Deploy on Render** and confirm the `onrender.com` URL loads.
5. **Firebase Console** — authorized domains + Google sign-in (checklist below).
6. **Custom domain** — add `www.mmsmetrics.com` (and optional apex) in Render + DNS.
7. **Firestore rules** — publish `firebase/firestore.rules` if you haven’t (`firebase deploy --only firestore` from repo root).

---

## Firebase checklist (production must match local behavior)

Your **local `.env`** values are what you copy into **Render → Environment**. Names must match **exactly** (same as `.env.example`).

### A) Web SDK (browser — DFS sign-in, client Firestore)

Set on Render:

| Variable | Notes |
|----------|--------|
| `FIREBASE_API_KEY` | From Firebase Console → Project settings → Your apps (Web) |
| `FIREBASE_AUTH_DOMAIN` | Usually `your-project-id.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | Same project |
| `FIREBASE_STORAGE_BUCKET` | As shown in Firebase config |
| `FIREBASE_MESSAGING_SENDER_ID` | As shown |
| `FIREBASE_APP_ID` | As shown |
| `FIREBASE_MEASUREMENT_ID` | Optional |

After the first deploy, open your site: if you see **“Firebase is not configured”**, one of the above is missing or typo’d on Render.

### B) Admin SDK (server — optional leaderboard aggregation if you use it)

| Variable | Notes |
|----------|--------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | One-line JSON from **Service accounts** → **Generate new private key**. On Mac: `jq -c . < firebase/service-account.json` |

Also set `FIREBASE_PROJECT_ID` (same as above) — Admin uses it too.

### C) Authorized domains (Google sign-in on your real URL)

**Firebase Console** → **Authentication** → **Settings** → **Authorized domains**. Add:

- `localhost` (already there — keeps local dev working)
- `mmsmetrics.com`
- `www.mmsmetrics.com`
- Your Render hostname while testing, e.g. `mms-xxxx.onrender.com` (exact subdomain from the Render dashboard)

Without these, **Sign in with Google** on `/dfs` can fail on production.

### D) Sign-in provider

**Authentication** → **Sign-in method** → **Google** → enable it (same as you use locally).

### E) Firestore rules

Rules live in **`firebase/firestore.rules`**. From the repo root:

```bash
firebase deploy --only firestore
```

The leaderboard needs **public read** on the `lineups` collection as defined in your rules; otherwise the table will error.

### F) Google Cloud API key (only if you restricted the key)

If the Web API key is restricted by **HTTP referrer**, add:

- `https://mmsmetrics.com/*`
- `https://www.mmsmetrics.com/*`
- `https://*.onrender.com/*` (if the Google Cloud console allows that pattern), or add your exact `https://your-service.onrender.com/*`

---

## What you need

- GitHub account + a **repo** with this project (no `.env` or **`firebase/service-account.json`** in git — they’re ignored).
- [Render](https://render.com) account (GitHub login is fine).
- Access to DNS for **mmsmetrics.com**.

## One-time: put the code on GitHub

1. Create a **new repository** on GitHub (private is OK).
2. On your Mac, in the MMS folder:

   ```bash
   cd /Users/ryanwallman/Desktop/MMS
   git init
   git remote add origin https://github.com/YOU/YOUR-REPO.git
   git add .
   git commit -m "Initial MMS site"
   git branch -M main
   git push -u origin main
   ```

   If the project was already a repo, use your real `remote` and `git push`.

3. Confirm **`deploy/Dockerfile`** exists (root **`render.yaml`** points at it).

---

## One-time: Create the web service on Render

1. Open [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint** (or **Web Service**).
2. **Connect your GitHub repo** and pick this repository.
3. If you use **Blueprint**, Render should pick up **`render.yaml`**.  
   Otherwise choose **Docker**, repo **root** as context, Dockerfile path **`deploy/Dockerfile`**.
4. Pick a service name (e.g. `mms`). **Free** plan is OK to try; the app may **sleep** when idle (first request can be slow).
5. **Environment** → add every variable from the **Firebase checklist (A + B)** above, plus optional sheet overrides. Copy values from your local **`.env`** (same names as `.env.example`).  
   **Optional:** `GAMELOGS_2026_CSV_URL` and `STATS_2026_CSV_URL` — only if you change sheets; defaults are in `lib/dataPaths.js`.

6. Save and **deploy**. When it’s green, open the **`onrender.com`** URL Render shows — then complete **Firebase checklist § C–E** so `/dfs` sign-in and the leaderboard work on that URL too.

## Custom domain (**mmsmetrics.com**)

Use your **Render web service** → **Settings** → **Custom Domains** → **Add**.

### Recommended: **www.mmsmetrics.com**

1. In Render, add custom hostname **`www.mmsmetrics.com`**.
2. Render will show a target like **`your-service.onrender.com`** — create a **CNAME** at your DNS host:
   - **Name / host:** `www`
   - **Target / value:** (exactly what Render shows, often `something.onrender.com`)
3. Wait for DNS (often 15–60 minutes). Render provisions **HTTPS** automatically.

### Optional: apex **mmsmetrics.com** (no `www`)

Apex domains can’t always use a plain CNAME. Render’s UI will tell you whether to use **A / ALIAS** records. If you use **Cloudflare**, an **CNAME flattening** / **proxied** setup is common — follow Render’s listed records.

You can add **both** `mmsmetrics.com` and `www.mmsmetrics.com` in Render, then redirect one to the other in Render if you want a single canonical URL.

After DNS works, confirm **Firebase authorized domains** include both hostnames (see **Firebase checklist § C** above).

---

## Every week (data updates)

- **2026 gamelogs** and **2026 stats** update automatically when you edit the linked Google Sheets (no deploy needed for those).
- If you still use **`data/csv/career.csv`** from git, replace it and push:

   ```bash
   git add data/csv/career.csv
   git commit -m "Update career export"
   git push
   ```

---

## If the live site says “Firebase is not configured”

Production has **no `.env` file**. Every **`FIREBASE_*`** web key in `.env` must exist under **Render → Environment**. Fix the values, save, and let Render redeploy.

---

## Optional: env checklist from your laptop

From the MMS folder (prints lines to copy into Render; **do not** paste this output into public chat):

```bash
sed $'s/\r$//' .env | grep -E '^FIREBASE_(API_KEY|AUTH_DOMAIN|PROJECT_ID|STORAGE_BUCKET|MESSAGING_SENDER_ID|APP_ID|MEASUREMENT_ID)='
```

---

## Files involved

| File | Role |
|------|------|
| `deploy/Dockerfile` | How Render builds the app |
| `render.yaml` (repo root) | Render Blueprint; `dockerfilePath` → `deploy/Dockerfile` |
| `deploy/DEPLOY.md` | This guide |

**Fly.io** setup was removed from this repo; use GitHub + Render above.
