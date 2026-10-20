import { describe, it, expect, afterEach } from "vitest";
import Decimal from "decimal.js";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildAcquiredRun } from "../acquiredRun";
import { computeEnterpriseValue } from "../modules/enterpriseValue";
import { bundleFromSheet } from "../sheets/sheet";
import { __resetAcquisitionCache } from "./provider";

// ---------------------------------------------------------------------------
// CF-AR8-REAL-APP-ACCEPTANCE-01 (#457) — a defect found by AR8's live run.
//
// Live SEC companyfacts for LLY carries IncrementalCommonSharesAttributable-
// ToShareBasedPaymentArrangements only for FY2008–FY2011 (the rows below are
// copied verbatim from data.sec.gov, 20 Oct 2026). The committed v3 capture
// was trimmed and does not carry the tag, so #499 saw it "absent" and D8's
// diluted − basic fallback filled the bridge. The live run instead took the
// FY2011 figure as today's dilution; it is NOT CONFIRMED, and LLY's
// enterprise value went INCOMPLETE. Methodology v3 D8: where the incremental-
// shares tag is absent the latest 10-K's diluted − basic is used. A tag whose
// latest value predates that 10-K's share period is absent for this bridge
// (same-date bridge inputs, #308/#309); it is never zero.
// ---------------------------------------------------------------------------

const REPO = join(__dirname, "..", "..", "..");
const STALE_ROWS = [
  { start: "2008-01-01", end: "2008-12-31", val: 2458000, accn: "0001193125-11-041620", fy: 2010, fp: "FY", form: "10-K", filed: "2011-02-22", frame: "CY2008" },
  { start: "2009-01-01", end: "2009-12-31", val: 3744000, accn: "0001193125-12-078393", fy: 2011, fp: "FY", form: "10-K", filed: "2012-02-24", frame: "CY2009" },
  { start: "2009-01-01", end: "2009-12-31", val: 3744000, accn: "0001193125-11-041620", fy: 2010, fp: "FY", form: "10-K", filed: "2011-02-22" },
  { start: "2010-01-01", end: "2010-12-31", val: 6503000, accn: "0001193125-12-078393", fy: 2011, fp: "FY", form: "10-K", filed: "2012-02-24", frame: "CY2010" },
  { start: "2010-01-01", end: "2010-12-31", val: 6503000, accn: "0001193125-11-041620", fy: 2010, fp: "FY", form: "10-K", filed: "2011-02-22" },
  { start: "2011-01-01", end: "2011-12-31", val: 6855000, accn: "0001193125-12-078393", fy: 2011, fp: "FY", form: "10-K", filed: "2012-02-24", frame: "CY2011" },
];

/** The v3 capture set staged at <cwd>/lib/analyzer/acquisition/captures, LLY's file carrying the live stale rows. */
function stageWithStaleTag(): string {
  const set = join(REPO, "lib", "analyzer", "acquisition", "captures", "v3-2026-10-20");
  const dir = mkdtempSync(join(tmpdir(), "cf-ar8-stale-dilution-"));
  const target = join(dir, "lib", "analyzer", "acquisition", "captures");
  mkdirSync(target, { recursive: true });
  for (const f of readdirSync(set)) {
    if (f !== "lly-companyfacts.json") symlinkSync(join(set, f), join(target, f));
  }
  const doc = JSON.parse(readFileSync(join(set, "lly-companyfacts.json"), "utf8"));
  doc.facts["us-gaap"].IncrementalCommonSharesAttributableToShareBasedPaymentArrangements = {
    label: "Incremental Common Shares Attributable to Share-based Payment Arrangements",
    description: "",
    units: { shares: STALE_ROWS },
  };
  writeFileSync(join(target, "lly-companyfacts.json"), JSON.stringify(doc));
  return dir;
}

const cwd = process.cwd();
afterEach(() => {
  process.chdir(cwd);
  __resetAcquisitionCache();
});

describe("D8 — an incremental-shares tag last filed years before the latest 10-K is absent for the bridge (LLY, live)", () => {
  it("fills treasury-method dilution from the latest 10-K's diluted − basic, never the FY2011 figure, and the bridge computes", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const frozen: any = JSON.parse(readFileSync(join(REPO, "docs", "evidence", "methodology-v3-calibration", "lly-run.json"), "utf8"));
    process.chdir(stageWithStaleTag());
    __resetAcquisitionCache();

    const run = await buildAcquiredRun({
      ticker: "LLY",
      bundle: bundleFromSheet(frozen.sheet),
      price: { value: new Decimal(frozen.capture.price.value), timestamp: frozen.capture.price.timestamp, source: frozen.capture.price.source },
      nonOperatingInvestments: { tags: [], value: new Decimal(0), errorDirection: null },
      profileHumanConfirmed: true,
      source: "CAPTURE",
    });

    const dilution = run.fixture.enterpriseValue.treasuryMethodDilution;
    expect(dilution?.value.toString()).not.toBe("6855000");
    expect(run.fixture.v3Inputs?.dilutionFallback?.applied).toBe(true);
    expect(dilution?.value.toString()).toBe(run.fixture.v3Inputs?.dilutionFallback?.value?.toString());
    expect(computeEnterpriseValue(run.fixture.enterpriseValue).suppressed).toBe(false);
  });
});
