# League data files (this folder)

- **2026 gamelogs** and **2026 team/player stats** load from **Google Sheets** at runtime (URLs in `lib/dataPaths.js`, overridable via `GAMELOGS_2026_CSV_URL` and `STATS_2026_CSV_URL` in `.env`). Sheets must allow access for “anyone with the link” (or use a published CSV URL) so the server can `fetch()` them.
- **`career.csv`** — still read from disk here; replace when you refresh career export.
- **`stats2025.csv`** — optional local copy; the app may still pull 2025 from the configured Google Sheet URL in `server.js`.

Paths are listed in `lib/dataPaths.js`.
