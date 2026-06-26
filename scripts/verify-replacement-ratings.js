#!/usr/bin/env node
/**
 * Verifies replacement players get career/2026 blended DFS salary ratings.
 * Run: node scripts/verify-replacement-ratings.js
 */
require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");
const { normalizePlayerName, DFS_OFFENSE_RATING_WEIGHT_HISTORICAL, DFS_OFFENSE_RATING_WEIGHT_2026 } = require("../lib/dfs");
const { CSV_CAREER: CAREER_CSV_PATH } = require("../lib/dataPaths");
const { setCareerCsvFilePath } = require("../lib/sheetUrls");
const { getCachedPlayerReplacements } = require("../lib/playerReplacements");
const {
  setNodeCareerReader,
  loadDfsLeaderboardScoringContext,
  loadCareerByPlayer,
  collectDfsSalaryLeagueBundles,
  buildDfsSalaryRatingForNorm,
  weightedMomentsPerMetric,
} = require("../lib/dfsLeaderboardScoringContext");

const DFS_SCORING_BLEND = Object.freeze({
  historical: DFS_OFFENSE_RATING_WEIGHT_HISTORICAL,
  y2026: DFS_OFFENSE_RATING_WEIGHT_2026,
});

setNodeCareerReader((filePath) => fs.readFile(filePath, "utf8"));
setCareerCsvFilePath(path.resolve(CAREER_CSV_PATH));

async function main() {
  const [replacements, scoring, careerByPlayer] = await Promise.all([
    getCachedPlayerReplacements(),
    loadDfsLeaderboardScoringContext(),
    loadCareerByPlayer(),
  ]);

  const { byOriginalNorm } = replacements;
  const { offenseRatingByNorm, stats2026ByPlayer } = scoring.scoringDeps;
  const bundles = collectDfsSalaryLeagueBundles(careerByPlayer, stats2026ByPlayer);
  const { moments } = weightedMomentsPerMetric(bundles);

  console.log(`Loaded ${byOriginalNorm.size} replacement(s) from sheet.\n`);

  let failed = 0;

  for (const entry of byOriginalNorm.values()) {
    const { original, replacement, replacementNorm, replacementDateIso } = entry;
    const rating = offenseRatingByNorm.get(replacementNorm);
    const hasRating = offenseRatingByNorm.has(replacementNorm);
    const stats2026 = stats2026ByPlayer.get(replacementNorm);
    const pa2026 = stats2026 ? Number(stats2026.PA) || 0 : 0;
    const expected = buildDfsSalaryRatingForNorm(
      replacementNorm,
      careerByPlayer,
      stats2026ByPlayer,
      moments,
      DFS_SCORING_BLEND
    );

    console.log(
      `--- ${original} → ${replacement} (effective ${replacementDateIso || "?"}) ---`
    );
    console.log(`  replacementNorm: ${replacementNorm}`);
    console.log(`  offenseRatingByNorm: ${hasRating ? rating : "(missing)"}`);
    console.log(`  expected rating: ${expected}`);
    console.log(`  2026 PA: ${pa2026}`);
    console.log(`  sources: career=${careerByPlayer.has(replacementNorm)}`);

    if (!hasRating) {
      console.log("  FAIL: no rating entry for replacement norm");
      failed += 1;
      continue;
    }

    if (Math.abs(rating - expected) > 0.001) {
      console.log(`  FAIL: map rating ${rating} != expected ${expected}`);
      failed += 1;
      continue;
    }

    const origNorm = normalizePlayerName(original);
    const origRating = offenseRatingByNorm.get(origNorm);
    if (origRating != null && Math.abs(rating - origRating) < 0.001) {
      console.log(
        `  WARN: replacement rating (${rating}) equals original (${origRating}) — unlikely same player`
      );
    }

    console.log("  OK: replacement rating matches career/2026 blend");
    console.log("");
  }

  if (byOriginalNorm.size === 0) {
    console.log("No replacements configured — nothing to verify.");
    process.exit(0);
  }

  if (failed > 0) {
    console.error(`${failed} check(s) failed.`);
    process.exit(1);
  }

  console.log("All replacement rating checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
