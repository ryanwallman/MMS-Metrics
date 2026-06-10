# League data files (this folder)

- **2026 gamelogs** and **2026 team/player stats** URLs come from the live [metrics_sources registry sheet](https://docs.google.com/spreadsheets/d/1ZHYmP92Gr5mM8jH6N3q0js3zbdNjb9gnB_29o7fBRd4/edit) (see `lib/metricsSourcesRegistry.js`).
- **`career.csv`** — still read from disk here; replace when you refresh career export.
- **2025 stats** — live data from Google Sheets (`server.js`). Optional local backup: `archive/reference/stats2025.csv`.

Paths are listed in `lib/dataPaths.js`.
