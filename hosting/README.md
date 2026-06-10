# Firebase Hosting — not in use

**Production is GitHub Pages** (`docs/` on `main`). This folder is a placeholder referenced by `firebase.json` only if you run `firebase deploy --only hosting`.

Firestore rules (used by DFS lineups) deploy separately:

```bash
firebase deploy --only firestore
```

Do not move this folder without updating `firebase.json`.
