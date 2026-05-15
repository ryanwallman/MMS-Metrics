# Firebase (local + CLI)

- **`firestore.rules`** — security rules. Deploy with Firebase CLI: `firebase deploy --only firestore` (from repo root; `firebase.json` points here).

- **`service-account.json`** — optional local file for Firebase **Admin** SDK (**gitignored**). Download from Firebase Console → **Service accounts** → **Generate new private key**, save as `firebase/service-account.json`, or set `FIREBASE_SERVICE_ACCOUNT_PATH` / `FIREBASE_SERVICE_ACCOUNT_JSON` in `.env`.  
  For **Render**, use env **`FIREBASE_SERVICE_ACCOUNT_JSON`** (see **`deploy/DEPLOY.md`** Firebase checklist § B).
