#!/usr/bin/env node
// Private data guard: blocks personal brokerage data from entering this repo.
//
// Cal Finance holds Calvin's real portfolio in his local Postgres only. Broker
// exports (IBKR Activity Statements, Flex Query CSVs) must never be committed,
// even though the repo is private. This scanner fails if any tracked or staged
// file looks like one.
//
//   node scripts/guard/private-data-scan.mjs           scan every tracked file (CI)
//   node scripts/guard/private-data-scan.mjs --staged  scan staged files (pre-commit)
//
// Plain Node with no dependencies, so the pre-commit hook works without
// node_modules. Matched text is never printed: a CI log must not become the leak.

import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** @typedef {"ibkr-account-number" | "ibkr-statement-content" | "ibkr-statement-filename"} RuleId */
/** @typedef {{ file: string, line: number, rule: RuleId }} Finding */

/** @type {Record<RuleId, string>} */
export const RULE_TEXT = {
  "ibkr-account-number": "IBKR account number (U or DU followed by 7 to 8 digits)",
  "ibkr-statement-content": "IBKR Activity Statement row",
  "ibkr-statement-filename": "IBKR statement file name",
};

// Live (U) and paper (DU) account ids, as standalone tokens only.
const ACCOUNT_NUMBER = /\bD?U\d{7,8}\b/;
// Section rows that every IBKR Activity Statement CSV starts with.
const STATEMENT_ROW = /^(?:Statement,Data,BrokerName,|Account Information,Data,Account,|Open Positions,Header,)/;
// IBKR's default download names: <account>_<date>[_<date>].<ext>
const STATEMENT_NAME = /^D?U\d{7,8}_\d{8}(?:_\d{8})?\.(?:csv|pdf|html?|xml|txt)$/i;

/**
 * @param {string} file
 * @param {string} text
 * @returns {Finding[]}
 */
export function scanText(file, text) {
  if (text.includes("\u0000")) return []; // binary: file-name rule still applies
  /** @type {Finding[]} */
  const findings = [];
  text.split(/\r?\n/).forEach((lineText, i) => {
    if (ACCOUNT_NUMBER.test(lineText)) {
      findings.push({ file, line: i + 1, rule: "ibkr-account-number" });
    } else if (STATEMENT_ROW.test(lineText)) {
      findings.push({ file, line: i + 1, rule: "ibkr-statement-content" });
    }
  });
  return findings;
}

/**
 * @param {string} file
 * @returns {Finding[]}
 */
export function scanFileName(file) {
  return STATEMENT_NAME.test(path.basename(file))
    ? [{ file, line: 0, rule: "ibkr-statement-filename" }]
    : [];
}

/** @param {string[]} args */
function git(args) {
  return execFileSync("git", args, { maxBuffer: 256 * 1024 * 1024 });
}

/** @param {boolean} staged */
function listFiles(staged) {
  const out = staged
    ? git(["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"])
    : git(["ls-files", "-z"]);
  return out.toString("utf8").split("\0").filter(Boolean);
}

function main() {
  const staged = process.argv.includes("--staged");
  /** @type {Finding[]} */
  const findings = [];
  for (const file of listFiles(staged)) {
    findings.push(...scanFileName(file));
    let text;
    try {
      // Read from the index, so what is checked is exactly what would be committed.
      text = git(["cat-file", "blob", `:${file}`]).toString("utf8");
    } catch {
      continue; // e.g. submodule or unreadable entry
    }
    findings.push(...scanText(file, text));
  }

  if (findings.length === 0) {
    console.log(`private-data-scan: clean (${staged ? "staged files" : "all tracked files"})`);
    return 0;
  }

  console.error("private-data-scan: BLOCKED. Personal brokerage data must never be committed.");
  for (const f of findings) {
    console.error(`  ${f.file}${f.line ? `:${f.line}` : ""}  ${RULE_TEXT[f.rule]}`);
  }
  console.error(
    "Keep broker statements outside this repo. If this is a false positive, reword the line rather than weakening the guard.",
  );
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exit(main());
}
