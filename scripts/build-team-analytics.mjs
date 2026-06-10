#!/usr/bin/env node
/**
 * Bundle client-side team analytics for GitHub Pages.
 * Run: npm run build:team-analytics
 */
import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

await esbuild.build({
  entryPoints: [path.join(root, "client/team-analytics-entry.mjs")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2020"],
  outfile: path.join(root, "public/js/team-analytics.js"),
  logLevel: "info",
  banner: { js: "var process={env:{}};" },
  define: {
    "process.env.CSV_CACHE_TTL_MS": '"600000"',
    "process.env.STATIC_EXPORT": '"1"',
    "process.env.CSV_FETCH_TIMEOUT_MS": '"90000"',
  },
});

console.log("Wrote public/js/team-analytics.js");
