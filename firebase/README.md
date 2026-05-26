# Firebase (local + CLI)

- **`firestore.rules`** — device-based lineup writes (no sign-in). Deploy from repo root:

  ```bash
  firebase deploy --only firestore
  ```

- **`service-account.json`** — optional for Firebase **Admin** SDK (**gitignored**). Not needed on GitHub Pages (browser reads/writes Firestore directly). For local server-rendered leaderboard reads, set `FIREBASE_SERVICE_ACCOUNT_JSON` in `.env`.
