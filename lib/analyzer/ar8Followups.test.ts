import { describe, it, expect, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, readdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireCompany, __resetAcquisitionCache } from "./acquisition/provider";
import { draftAssumptionSheet } from "./acquisition/aiProposedBundle";
import type { AnalystCall } from "./ai/analystCall";
import { leverageUnavailableLine } from "./overviewCopy";
import type { LeverageResult } from "./types";

// ---------------------------------------------------------------------------
// AR8 follow-ups (#458, Calvin's "1 — Follow-ups PR"). The #505 review noted
// that the leverage metric rows still blamed "balance-sheet inputs" when the
// ratio is missing only because enterprise value waits on the §4.4
// non-operating decision; #505 fixed the bottom line, not these rows.
// ---------------------------------------------------------------------------

const RATIO_MISSING: LeverageResult = {
  result: "LEVERAGE UNSUPPORTED IN v1",
  netDebtRatio: null,
  operatingLeaseInclusiveMemo: null,
  leveredResidualExceptionApplies: false,
};

describe("leverage metric rows name what enterprise value is waiting for", () => {
  it("names the §4.4 decision when that is all enterprise value is missing", () => {
    const line = leverageUnavailableLine(RATIO_MISSING, {
      suppressed: true,
      cause: "missing REQUIRED input(s): nonOperatingEquityInvestmentsAtBook",
    });
    expect(line).toContain("a decision on which of its investments are non-operating");
    expect(line).not.toContain("balance-sheet inputs");
  });

  it("keeps the general line when enterprise value is computed or its cause names no input", () => {
    expect(leverageUnavailableLine(RATIO_MISSING)).toContain("are not all available");
    expect(leverageUnavailableLine(RATIO_MISSING, { suppressed: true, cause: "a REQUIRED input is NOT CONFIRMED" })).toContain(
      "are not all available"
    );
  });
});

// F5 — AR8's live run paid for three price-blind drafts of JPM ($1.15 with its
// AI layer) before Gate 0 refused the bank. JPM from captures/ar8-2026-10-20.
const REPO = join(__dirname, "..", "..");
const cwd = process.cwd();
afterEach(() => {
  process.chdir(cwd);
  __resetAcquisitionCache();
});

function stage(): string {
  const set = join(REPO, "lib", "analyzer", "acquisition", "captures", "ar8-2026-10-20");
  const dir = mkdtempSync(join(tmpdir(), "cf-ar8-followups-"));
  const target = join(dir, "lib", "analyzer", "acquisition", "captures");
  mkdirSync(target, { recursive: true });
  for (const f of readdirSync(set)) symlinkSync(join(set, f), join(target, f));
  return dir;
}

describe("F5 — no paid draft for a company Gate 0 refuses as asset-based", () => {
  it("JPM: settled as CANNOT CONCLUDE with zero model calls", async () => {
    process.chdir(stage());
    __resetAcquisitionCache();
    const acquired = await acquireCompany("JPM", { price: null, source: "CAPTURE" });
    let calls = 0;
    const call: AnalystCall = async () => {
      calls += 1;
      throw new Error("no model call expected for a bank");
    };
    const outcome = await draftAssumptionSheet("JPM", acquired, call, null);
    expect(calls).toBe(0);
    expect(outcome.kind).toBe("CANNOT CONCLUDE");
    if (outcome.kind === "CANNOT CONCLUDE") expect(outcome.content.cannotConclude).toContain("banks and insurers");
  });
});
