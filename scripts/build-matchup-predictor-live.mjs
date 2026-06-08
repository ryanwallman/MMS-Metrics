#!/usr/bin/env node
/**
 * Bundle live matchup chrome refresh for GitHub Pages (all matchup HTML pages).
 */
import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

await esbuild.build({
  entryPoints: [path.join(root, "client/matchup-predictor-live-entry.mjs")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2020"],
  outfile: path.join(root, "public/js/matchup-predictor-live.mjs"),
  logLevel: "info",
  banner: { js: "var process={env:{}};" },
  define: {
    "process.env.CSV_CACHE_TTL_MS": '"600000"',
    "process.env.STATIC_EXPORT": '"1"',
    "process.env.CSV_FETCH_TIMEOUT_MS": '"90000"',
    "process.env.MATCHUP_SCORE_POLL_MS": '"90000"',
    "process.env.SCHEDULE_CALENDAR_YEAR": '"2026"',
  },
});

console.log("Wrote public/js/matchup-predictor-live.mjs");
