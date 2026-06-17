#!/usr/bin/env node
/**
 * Bundle offensive_words.txt for browser DFS display-name validation.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseOffensiveWordsText } from "../lib/offensiveWords.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const src = path.join(root, "offensive_words.txt");
const text = await fs.readFile(src, "utf8");
const words = parseOffensiveWordsText(text);

const body =
  "// Generated from offensive_words.txt — run: npm run build:offensive-words\n" +
  `export const OFFENSIVE_WORDS = ${JSON.stringify(words)};\n`;

for (const dir of ["public/js", "docs/js"]) {
  await fs.writeFile(path.join(root, dir, "offensive-words-list.mjs"), body);
}

console.log(`[build-offensive-words] Wrote ${words.length} word(s) to public/js and docs/js`);
