#!/usr/bin/env node
"use strict";

require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");
const { computeMatchupPredictorRecord } = require("../lib/matchupPredictorRecord");
const { gatherMatchupSeasonRecordDeps } = require("../lib/matchupLiveSeasonRecord");

async function main() {
  const deps = await gatherMatchupSeasonRecordDeps();
  const record = computeMatchupPredictorRecord(deps);
  const out = path.join(__dirname, "..", "docs", "matchup-predictor", "season-record.json");
  await fs.writeFile(out, `${JSON.stringify(record)}\n`);
  console.log("[write-season-record-json]", record);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
