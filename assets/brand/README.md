# Brand source images

| File | Used to produce |
|------|-----------------|
| `stats.png` | `public/mms-stats-logo.png` (160×160 source, displayed at 80×80 in header), favicons |

Generate with macOS `sips`, e.g.:

```bash
sips -z 160 160 assets/brand/stats.png --out public/mms-stats-logo.png
sips -z 32 32 assets/brand/stats.png --out public/favicon-32x32.png
sips -z 16 16 assets/brand/stats.png --out public/favicon-16x16.png
sips -z 180 180 assets/brand/stats.png --out public/apple-touch-icon.png
```
