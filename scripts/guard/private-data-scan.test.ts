import { describe, expect, it } from "vitest";
import { scanFileName, scanText } from "./private-data-scan.mjs";

// Fixtures are assembled at runtime so no real-looking account number or
// statement signature ever appears literally in this repo (the guard scans
// itself in CI).
const acct = ["U", "1234", "5678"].join("");
const paperAcct = ["DU", "765", "4321"].join("");
const brokerHeader = ["Statement", "Data", "BrokerName", "Interactive Brokers"].join(",");
const positionsHeader = ["Open Positions", "Header", "DataDiscriminator"].join(",");

describe("private-data-scan: content", () => {
  it("flags an IBKR live account number and reports its line", () => {
    const text = `first line\naccount is ${acct} here\n`;
    expect(scanText("notes.md", text)).toEqual([
      { file: "notes.md", line: 2, rule: "ibkr-account-number" },
    ]);
  });

  it("flags an IBKR paper account number", () => {
    expect(scanText("a.ts", `const id = "${paperAcct}";`)).toHaveLength(1);
  });

  it("flags Activity Statement section rows", () => {
    const text = `${brokerHeader}\nfoo\n${positionsHeader},Asset Category\n`;
    const rules = scanText("dump.txt", text).map((f) => f.rule);
    expect(rules).toEqual(["ibkr-statement-content", "ibkr-statement-content"]);
  });

  it("does not flag ordinary code, hashes or tickers", () => {
    const text = [
      'const symbol = "NVDA";',
      "sha512-AbcU1234567890xyz==",
      "U+00E9 is é",
      "  // Open Positions are shown in the holdings table",
      "UNVESTED_12345678",
    ].join("\n");
    expect(scanText("ok.ts", text)).toEqual([]);
  });

  it("skips binary content", () => {
    expect(scanText("img.png", `\u0000${acct}`)).toEqual([]);
  });
});

describe("private-data-scan: file names", () => {
  it("flags the default IBKR statement file name", () => {
    expect(scanFileName(`exports/${acct}_20261020.csv`)).toEqual([
      { file: `exports/${acct}_20261020.csv`, line: 0, rule: "ibkr-statement-filename" },
    ]);
  });

  it("flags a date-range statement as PDF", () => {
    expect(scanFileName(`${acct}_20260101_20261020.pdf`)).toHaveLength(1);
  });

  it("does not flag ordinary file names", () => {
    expect(scanFileName("scripts/evidence/msft-phase-b/output/formula_ledger.csv")).toEqual([]);
  });
});
