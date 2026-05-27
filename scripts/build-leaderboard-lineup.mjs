#!/usr/bin/env node
/**
 * Bundle client-side leaderboard lineup detail for GitHub Pages.
 * Run: npm run build:leaderboard-lineup
 */
import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const base = (process.env.SITE_BASE_PATH || "").replace(/\/+$/, "");
const careerPublic = base ? `${base}/data/csv/career.csv` : "/data/csv/career.csv";

await esbuild.build({
  entryPoints: [path.join(root, "client/leaderboard-lineup-entry.mjs")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2020"],
  outfile: path.join(root, "public/js/dfs-leaderboard-lineup.mjs"),
  logLevel: "info",
  banner: { js: "var process={env:{}};" },
  define: {
    "process.env.DFS_SCORING_CACHE_TTL_MS": '"600000"',
    "process.env.SCHEDULE_CALENDAR_YEAR": '"2026"',
    "process.env.GAMELOGS_2026_CSV_URL": '""',
    "process.env.STATS_2026_CSV_URL": '""',
    "process.env.CAREER_CSV_URL": `"${careerPublic}"`,
    "process.env.CAPTAIN_MAPPING_CSV_URL": '""',
    "process.env.CSV_CACHE_TTL_MS": '"600000"',
    "process.env.SLATE_POINTS_CACHE_TTL_MS": '"600000"',
    "process.env.STATIC_EXPORT": '"1"',
    "process.env.CSV_FETCH_TIMEOUT_MS": '"90000"',
  },
});

console.log("Wrote public/js/dfs-leaderboard-lineup.mjs");
