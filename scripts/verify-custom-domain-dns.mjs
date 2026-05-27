#!/usr/bin/env node
/**
 * Checks DNS for mmsmetrics.com GitHub Pages custom domain.
 * Run: node scripts/verify-custom-domain-dns.mjs
 */
import { execSync } from "node:child_process";

const GITHUB_A = ["185.199.108.153", "185.199.109.153", "185.199.110.153", "185.199.111.153"];
const GITHUB_AAAA = [
  "2606:50c0:8000::153",
  "2606:50c0:8001::153",
  "2606:50c0:8002::153",
  "2606:50c0:8003::153",
];
const APEX = "mmsmetrics.com";
const WWW = "www.mmsmetrics.com";
const GITHUB_PAGES_HOST = "ryanwallman.github.io";

function dig(args) {
  try {
    return execSync(`dig ${args}`, { encoding: "utf8" })
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function digShort(name, type) {
  try {
    return execSync(`dig +short ${name} ${type}`, { encoding: "utf8" })
      .trim()
      .split("\n")
      .map((s) => s.trim().replace(/\.$/, ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

let failed = 0;

function ok(msg) {
  console.log(`  OK  ${msg}`);
}
function fail(msg) {
  console.error(`  FAIL ${msg}`);
  failed += 1;
}

console.log(`=== DNS check for GitHub Pages (${APEX}) ===\n`);

const apexA = digShort(APEX, "A");
const missingA = GITHUB_A.filter((ip) => !apexA.includes(ip));
if (apexA.length === 0) fail(`No A records for ${APEX}`);
else if (missingA.length) fail(`${APEX} missing A: ${missingA.join(", ")} (have: ${apexA.join(", ")})`);
else ok(`${APEX} has all four GitHub A records`);

const apexAAAA = digShort(APEX, "AAAA");
if (!apexAAAA.length) {
  console.log(`  WARN No AAAA for ${APEX} — add four GitHub AAAA records (helps GitHub HTTPS check)`);
} else {
  const missing6 = GITHUB_AAAA.filter((ip) => !apexAAAA.includes(ip));
  if (missing6.length) fail(`${APEX} missing AAAA: ${missing6.join(", ")}`);
  else ok(`${APEX} has GitHub AAAA records`);
}

const apexCname = digShort(APEX, "CNAME");
if (apexCname.length) {
  fail(
    `${APEX} has CNAME → ${apexCname.join(", ")}. Apex must use A/AAAA only, not CNAME (causes NotServedByPagesError).`
  );
} else ok(`${APEX} has no apex CNAME (correct)`);

const wwwCname = digShort(WWW, "CNAME");
if (!wwwCname.length) {
  fail(`${WWW} has no CNAME — add CNAME www → ${GITHUB_PAGES_HOST}`);
} else if (!wwwCname.some((c) => c === GITHUB_PAGES_HOST)) {
  fail(`${WWW} CNAME is ${wwwCname.join(", ")} — must be ${GITHUB_PAGES_HOST} (no /MMS-Metrics path)`);
} else ok(`${WWW} CNAME → ${GITHUB_PAGES_HOST}`);

console.log("\n=== Repo / GitHub Pages ===\n");
console.log("  • docs/CNAME should contain: mmsmetrics.com");
console.log("  • Settings → Pages → branch main, folder /docs");
console.log("  • Custom domain: mmsmetrics.com only (www is auto alternate)");
console.log("  • If error persists: Remove domain → wait 10 min → Save again → Enforce HTTPS");

console.log("\n=== Live probe ===\n");
try {
  const code = execSync(`curl -s -o /dev/null -w "%{http_code}" https://${APEX}/`, { encoding: "utf8" }).trim();
  if (code === "200") ok(`https://${APEX}/ returns ${code}`);
  else fail(`https://${APEX}/ returned HTTP ${code}`);
} catch (e) {
  fail(`Could not reach https://${APEX}/ (${e.message})`);
}

console.log(failed ? `\n${failed} check(s) failed.\n` : "\nAll critical checks passed.\n");
process.exit(failed ? 1 : 0);
