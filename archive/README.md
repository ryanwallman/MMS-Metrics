# Archive — not used by the live site

Files here are kept for reference only. Nothing in `server.js`, the build scripts, or GitHub Pages (`docs/`) reads from this folder at runtime.

| Subfolder | Contents |
|-----------|----------|
| **`wordpress-exports/`** | Saved HTML from marlborosoftball.com (pre-MMS-metrics site). Replaced by live pages in `views/` + `docs/`. |
| **`reference/`** | Human reference: bylaws PDF, optional local `stats2025.csv` backup (production pulls 2025 stats from Google Sheets). |
| **`lib-unused/`** | JavaScript modules that are no longer imported anywhere. |

To restore something for development, copy it back to its active location — do not wire archive paths into production code.
