import { describe, it, expect, afterEach } from "vitest";
import Decimal from "decimal.js";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildAcquiredRun } from "../acquiredRun";
import { computeEnterpriseValue } from "../modules/enterpriseValue";
import { assembleAnalysisResult } from "../assemble";
import { verdictUnavailableLine } from "../overviewCopy";
import { bundleFromSheet } from "../sheets/sheet";
import { acquireCompany, __resetAcquisitionCache } from "./provider";
import { dilutedSharesOf } from "./aiProposedBundle";

// ---------------------------------------------------------------------------
// CF-AR8-CORRECTIONS-01 (issue #504) — two bridge inputs AR8's live run found
// missing (docs/evidence/ar8-acceptance/README.md F1, F3), on the 20 Oct 2026
// capture set taken from live data.sec.gov (captures/ar8-2026-10-20).
//
//   F1  NVDA tags its balance-sheet marketable securities as
//       DebtSecuritiesCurrent ($34,143M at 26 Jul 2026), never
//       ShortTermInvestments, so bridge cash held cash alone ($22,443M).
//   F3  KO tags no us-gaap:Liabilities, so Methodology D7's upper bound for its
//       undisclosed finance leases could not form and EV stayed INCOMPLETE.
//       Calvin's ruling on #504: total liabilities and equity − total equity,
//       both filed for the same date, is that total ($104,217M − $35,734M).
// ---------------------------------------------------------------------------

const REPO = join(__dirname, "..", "..", "..");

// LLY's IncrementalCommonShares… rows as live data.sec.gov serves them (FY2008–
// FY2011). The capture trims rows older than twelve years, so they are put back
// here to reproduce what the live app reads (same rows as staleDilutionTag.test.ts).
const LLY_STALE_DILUTION_ROWS = [
  { start: "2008-01-01", end: "2008-12-31", val: 2458000, accn: "0001193125-11-041620", fy: 2010, fp: "FY", form: "10-K", filed: "2011-02-22", frame: "CY2008" },
  { start: "2009-01-01", end: "2009-12-31", val: 3744000, accn: "0001193125-12-078393", fy: 2011, fp: "FY", form: "10-K", filed: "2012-02-24", frame: "CY2009" },
  { start: "2010-01-01", end: "2010-12-31", val: 6503000, accn: "0001193125-12-078393", fy: 2011, fp: "FY", form: "10-K", filed: "2012-02-24", frame: "CY2010" },
  { start: "2011-01-01", end: "2011-12-31", val: 6855000, accn: "0001193125-12-078393", fy: 2011, fp: "FY", form: "10-K", filed: "2012-02-24", frame: "CY2011" },
];

function stage(withLiveLlyDilutionRows = false): string {
  const set = join(REPO, "lib", "analyzer", "acquisition", "captures", "ar8-2026-10-20");
  const dir = mkdtempSync(join(tmpdir(), "cf-ar8-corrections-"));
  const target = join(dir, "lib", "analyzer", "acquisition", "captures");
  mkdirSync(target, { recursive: true });
  for (const f of readdirSync(set)) {
    if (withLiveLlyDilutionRows && f === "lly-companyfacts.json") continue;
    symlinkSync(join(set, f), join(target, f));
  }
  if (withLiveLlyDilutionRows) {
    const doc = JSON.parse(readFileSync(join(set, "lly-companyfacts.json"), "utf8"));
    doc.facts["us-gaap"].IncrementalCommonSharesAttributableToShareBasedPaymentArrangements = {
      label: "Incremental Common Shares Attributable to Share-based Payment Arrangements",
      description: "",
      units: { shares: LLY_STALE_DILUTION_ROWS },
    };
    writeFileSync(join(target, "lly-companyfacts.json"), JSON.stringify(doc));
  }
  return dir;
}

const cwd = process.cwd();
afterEach(() => {
  process.chdir(cwd);
  __resetAcquisitionCache();
});

async function factsFor(ticker: string) {
  process.chdir(stage());
  __resetAcquisitionCache();
  const acquired = await acquireCompany(ticker, { price: null, source: "CAPTURE" });
  return new Map(acquired.acquisition.facts.map((f) => [f.id, f]));
}

describe("F1 — cash includes the marketable-securities line a filer tags instead of ShortTermInvestments", () => {
  it("NVDA: cash and equivalents $22,443M + DebtSecuritiesCurrent $34,143M at 26 Jul 2026", async () => {
    const cash = (await factsFor("NVDA")).get("cash-and-marketable-debt-securities");
    expect(cash?.asOfDate).toBe("2026-07-26");
    expect(String(cash?.value)).toBe("56586000000");
  });

  it("a filer that tags ShortTermInvestments resolves exactly as before (MSFT)", async () => {
    const cash = (await factsFor("MSFT")).get("cash-and-marketable-debt-securities");
    expect(String(cash?.value)).toBe("76843000000");
    expect(cash?.source).toContain("us-gaap:CashAndCashEquivalentsAtCarryingValue");
    expect(cash?.source).not.toContain("cf-derived");
  });
});

describe("F3 — D7's total liabilities from the balance-sheet identity where none is tagged (Calvin, #504)", () => {
  it("KO: total liabilities $104,217M − $35,734M = $68,483M at 3 Apr 2026, labelled derived", async () => {
    const liabilities = (await factsFor("KO")).get("total-liabilities");
    expect(liabilities?.asOfDate).toBe("2026-04-03");
    expect(String(liabilities?.value)).toBe("68483000000");
    expect(liabilities?.source).toContain("cf-derived:LiabilitiesFromLiabilitiesAndEquityLessEquity");
  });

  it("KO's bridge computes at the D7 upper bound once §4.4 is answered", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const frozen: any = JSON.parse(readFileSync(join(REPO, "docs", "evidence", "methodology-v3-calibration", "ko-run.json"), "utf8"));
    process.chdir(stage());
    __resetAcquisitionCache();
    const run = await buildAcquiredRun({
      ticker: "KO",
      bundle: bundleFromSheet(frozen.sheet),
      price: { value: new Decimal(frozen.capture.price.value), timestamp: frozen.capture.price.timestamp, source: frozen.capture.price.source },
      nonOperatingInvestments: { tags: [], value: new Decimal(0), errorDirection: null },
      profileHumanConfirmed: true,
      source: "CAPTURE",
    });
    // $68,483M − bridge debt $43,808M, both at 2026-04-03.
    expect(run.fixture.enterpriseValue.financeLeaseLiabilitiesUpperBound?.value.value.toString()).toBe("24675000000");
    const ev = computeEnterpriseValue(run.fixture.enterpriseValue);
    expect(ev.suppressed).toBe(false);
  });
});

describe("F4 — the bottom line names the §4.4 decision when that is all enterprise value is waiting for", () => {
  it("NVDA with no non-operating decision: the verdict line asks for it, not for 'balance-sheet inputs'", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const frozen: any = JSON.parse(readFileSync(join(REPO, "docs", "evidence", "methodology-v3-calibration", "nvda-run.json"), "utf8"));
    process.chdir(stage());
    __resetAcquisitionCache();
    const run = await buildAcquiredRun({
      ticker: "NVDA",
      bundle: bundleFromSheet(frozen.sheet),
      price: { value: new Decimal(frozen.capture.price.value), timestamp: frozen.capture.price.timestamp, source: frozen.capture.price.source },
      nonOperatingInvestments: null,
      profileHumanConfirmed: true,
      source: "CAPTURE",
    });
    const result = assembleAnalysisResult(run.fixture);
    expect(result.fairValueRange.kind).toBe("suppressed");
    if (result.fairValueRange.kind !== "suppressed") return;
    const line = verdictUnavailableLine(result.fairValueRange, result.gates.leverage);
    expect(line).toContain("a decision on which of its investments are non-operating");
    expect(line).not.toContain("balance-sheet inputs");
  });
});

describe("Drafter — a stale incremental-shares tag adds nothing to a fresh draft's diluted shares (LLY)", () => {
  it("LLY's FY2011 dilution (6,855,000) is not added to today's share count", async () => {
    process.chdir(stage(true));
    __resetAcquisitionCache();
    const acquired = await acquireCompany("LLY", { price: null, source: "CAPTURE" });
    expect(String(acquired.acquisition.facts.find((f) => f.id === "treasury-method-dilution")?.value)).toBe("6855000");
    const outstanding = acquired.acquisition.facts.find((f) => f.id === "shares-outstanding");
    expect(dilutedSharesOf(acquired)?.toString()).toBe(String(outstanding?.value));
  });

  it("a current tag is still added (MSFT)", async () => {
    process.chdir(stage());
    __resetAcquisitionCache();
    const acquired = await acquireCompany("MSFT", { price: null, source: "CAPTURE" });
    const facts = new Map(acquired.acquisition.facts.map((f) => [f.id, f]));
    const expected = new Decimal(String(facts.get("shares-outstanding")?.value)).plus(String(facts.get("treasury-method-dilution")?.value));
    expect(dilutedSharesOf(acquired)?.toString()).toBe(expected.toString());
  });
});

describe("D8 stale-tag rule compares period ENDS (regression in PR #502's fix)", () => {
  it("MSFT's current FY2026 incremental-shares tag is used as filed — no D8 fallback", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const frozen: any = JSON.parse(readFileSync(join(REPO, "docs", "evidence", "ar7-prototype", "msft-run.json"), "utf8"));
    process.chdir(stage());
    __resetAcquisitionCache();
    const run = await buildAcquiredRun({
      ticker: "MSFT",
      bundle: bundleFromSheet(frozen.sheet),
      price: { value: new Decimal(frozen.capture.price.value), timestamp: frozen.capture.price.timestamp, source: frozen.capture.price.source },
      nonOperatingInvestments: { tags: [], value: new Decimal(0), errorDirection: null },
      profileHumanConfirmed: true,
      source: "CAPTURE",
    });
    expect(run.fixture.v3Inputs?.dilutionFallback ?? null).toBeNull();
    expect(run.fixture.enterpriseValue.treasuryMethodDilution?.value.toString()).toBe("24000000");
  });
});
