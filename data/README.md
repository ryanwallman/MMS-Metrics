# League configuration & local data

| Path | Used at runtime? |
|------|------------------|
| **`csv/career.csv`** | Yes — career stats (also copied to `public/data/csv/` on static build) |
| **`customRosters2026.js`** | Yes — roster overrides |
| **`playerPositions2026.js`** | Yes — defensive positions |
| **`defensiveRatings2026.js`** | Yes — defensive ratings |
| **`pitcherStats2026.js`** | Yes — pitcher stats |
| **`careerIncludes2025Names.js`** | Yes — name mapping for career sheet |
| **`templates/`** | Optional XLSX import template (defaults used if file missing) |

2026 gamelogs and 2026 stats load from **Google Sheets** via the [metrics_sources registry](https://docs.google.com/spreadsheets/d/1ZHYmP92Gr5mM8jH6N3q0js3zbdNjb9gnB_29o7fBRd4/edit). Optional 2025 CSV backup: `archive/reference/stats2025.csv`.
