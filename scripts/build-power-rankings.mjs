#!/usr/bin/env node
/**
 * Bundle client-side power rankings for GitHub Pages.
 * Run: npm run build:power-rankings
 */
import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

await esbuild.build({
  entryPoints: [path.join(root, "client/power-rankings-entry.mjs")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2020"],
  outfile: path.join(root, "public/js/power-rankings.mjs"),
  logLevel: "info",
  banner: { js: "var process={env:{}};" },
  define: {
    "process.env.CSV_CACHE_TTL_MS": '"600000"',
    "process.env.STATIC_EXPORT": '"1"',
    "process.env.CSV_FETCH_TIMEOUT_MS": '"90000"',
  },
});

console.log("Wrote public/js/power-rankings.mjs");
