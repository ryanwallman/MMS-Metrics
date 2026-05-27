#!/usr/bin/env node
/**
 * Bundle client-side matchup prediction for GitHub Pages.
 * Run: npm run build:matchup-predictor
 */
import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

await esbuild.build({
  entryPoints: [path.join(root, "client/matchup-predictor-entry.mjs")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2020"],
  outfile: path.join(root, "public/js/matchup-predictor-client.mjs"),
  logLevel: "info",
  banner: { js: "var process={env:{}};" },
});

console.log("Wrote public/js/matchup-predictor-client.mjs");
