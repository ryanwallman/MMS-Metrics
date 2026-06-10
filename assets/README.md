# Design assets (source files)

**Not served to browsers.** Production copies live in `public/` and are copied to `docs/` on deploy.

| Subfolder | Purpose |
|-----------|---------|
| **`brand/`** | Logo masters used to generate favicons and header image |

After editing a source image, regenerate `public/favicon-*.png`, `public/apple-touch-icon.png`, and `public/mms-stats-logo.png`, then run `npm run build:pages:branch` and deploy `docs/`.
