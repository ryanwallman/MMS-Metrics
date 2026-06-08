#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs");
let patched = 0;

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else if (ent.name === "index.html") {
      const html = fs.readFileSync(full, "utf8");
      const next = html.replace(
        /href="\/matchup-predictor"(\s*\n\s*class="site-nav-link)/g,
        'href="/matchup-predictor/future"$1'
      );
      if (next !== html) {
        fs.writeFileSync(full, next);
        patched += 1;
      }
    }
  }
}

walk(root);
console.log(`[patch-nav] Updated ${patched} index.html file(s)`);
