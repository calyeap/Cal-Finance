import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { getPool } from "../../db";
import {
  recordAnalystBundle,
  hasRecordedAnalystBundle,
  getRecordedAnalystBundleInput,
  recordedAnalystInputBundle,
  type RecordedAnalystBundleInput,
} from "./recordedBundles";
import { analystInputsFor, TICKERS_WITH_ANALYST_INPUTS } from "./analystInputs";
import { isSupportedTicker } from "../gate";

// ---------------------------------------------------------------------------
// CF-ANALYST-DRAFT-NVDA-01 / CF-ANALYST-DRAFT-NVDA-SCENARIO-02 — SCOPE
// item 5 / item 6.
//
// This file does two things, neither of which records NVDA:
//
//   1. Proves the exact field values docs/analyst-drafts/nvda-step7-draft.md
//      proposes for NVDA behave exactly as the store's own validation rules
//      say they should, by writing them to a throwaway ticker in the test
//      database. The ticker is deliberately NOT "NVDA" — this file must
//      never create, even transiently, a row that would make the real
//      ticker resolvable — and the row is deleted before and after every
//      test, the same discipline recordedBundles.test.ts already uses for
//      its own throwaway ticker.
//
//      CF-ANALYST-DRAFT-NVDA-SCENARIO-02 re-derived the three scenario
//      dollar values under CALVIN RULING — C and found the current
//      approved methodology cannot support a defensible one from already-
//      authorised inputs alone (see the draft's "Scenario values" section
//      for the full reconciliation) — a named evidence gap, not a hand
//      estimate. The drafted `scenarioValues` are therefore blank, exactly
//      like an unauthored scenario driver, and `recordAnalystBundle`'s own
//      rule that a scenario value is REQUIRED (unlike a driver) means the
//      store refuses to record this bundle until Calvin closes the gap —
//      which is the point being pinned below, not a defect in the store.
//
//   2. Pins that nothing in the runtime resolution path moved: MSFT and
//      OKLO still resolve from their committed bundles, the committed-
//      ticker list is unchanged, and NVDA itself — the real ticker, never
//      written here — still has no recorded bundle and still fails closed
//      at gate.ts.
// ---------------------------------------------------------------------------

const DRAFT_TICKER = "ZZZNVDADRAFT";

function nvdaDraftScenarios() {
  return {
    bear: {
      revenueGrowthOrPath: "0.05",
      operatingMargin: "0.30",
      reinvestmentCapitalIntensity: "0.02",
      shareCount: "24.1",
      writtenAnchor:
        "AI/datacenter capex cycle corrects and operating margin reverts toward its ten-year median, " +
        "echoing the FY2023 correction (margin fell to 15.7% that year on inventory and export-control " +
        "effects); growth slows sharply but stays positive, not a revenue contraction.",
    },
    base: {
      revenueGrowthOrPath: "0.20",
      operatingMargin: "0.50",
      reinvestmentCapitalIntensity: "0.04",
      shareCount: "24.1",
      writtenAnchor:
        "AI-driven datacenter demand continues but decelerates materially off the FY2026 base as the " +
        "hyperscaler capex cycle normalizes; margin gives back some of its recent expansion but stays " +
        "well above the historical median.",
    },
    bull: {
      revenueGrowthOrPath: "0.35",
      operatingMargin: "0.60",
      reinvestmentCapitalIntensity: "0.05",
      shareCount: "24.1",
      writtenAnchor:
        "AI/accelerated-computing demand sustains at a high level, operating margin holds near its " +
        "current elevated level, and NVIDIA continues investing aggressively in capacity.",
    },
  };
}

/** The drafted field set exactly as `nvda-step7-draft.md` states it, scenario
 * values included: blank, per CF-ANALYST-DRAFT-NVDA-SCENARIO-02's named
 * evidence gap, never a hand-estimated number. */
function nvdaDraftInput(): RecordedAnalystBundleInput {
  return {
    profile: "HIGH_GROWTH_PROFITABLE_UNCERTAIN_DURABILITY",
    classificationInputs: {
      revenueScale: "large",
      fcfCharacter: "positive_volatile",
      revenueGrowthBand: ">30%",
      capitalIntensity: "0.028",
      cyclicality: { tenYearMarginRange: "0.4751", worstSingleYearChange: "0.2165" },
      balanceSheetNature: "asset-light",
    },
    scenarios: nvdaDraftScenarios(),
    scenarioValues: { bear: "", base: "", bull: "" },
    configuredConstants: {
      nopatTaxRate: "0.21",
      stressMarginLevel: "0.15",
      preRevenueUnleveredRate: null,
      projectDebtCost: null,
    },
  };
}

describe("CF-ANALYST-DRAFT-NVDA-SCENARIO-02 — the drafted scenario-value gap behaves as the store's own rules say it should", () => {
  beforeEach(async () => {
    await getPool().query("DELETE FROM analyzer_recorded_analyst_bundles WHERE ticker = $1", [DRAFT_TICKER]);
  });

  afterAll(async () => {
    await getPool().query("DELETE FROM analyzer_recorded_analyst_bundles WHERE ticker = $1", [DRAFT_TICKER]);
  });

  it("the drafted bundle, with its scenario values left as a named gap, is refused by recordAnalystBundle — a scenario value is REQUIRED, unlike a driver", async () => {
    await expect(recordAnalystBundle(DRAFT_TICKER, nvdaDraftInput())).rejects.toThrow(/scenario value/i);
    expect(await hasRecordedAnalystBundle(DRAFT_TICKER)).toBe(false);
  });

  it("every other drafted field — profile, classification, scenario drivers and written anchors, §7.1 constants — is unchanged from CF-ANALYST-DRAFT-NVDA-01 and validates on its own", async () => {
    // Recorded with placeholder scenario values solely to exercise the
    // store's validation of the fields CALVIN RULING — C left untouched;
    // these numbers are not proposed anywhere in the draft itself.
    const input = { ...nvdaDraftInput(), scenarioValues: { bear: "1", base: "1", bull: "1" } };
    await expect(recordAnalystBundle(DRAFT_TICKER, input)).resolves.not.toThrow();

    const stored = await getRecordedAnalystBundleInput(DRAFT_TICKER);
    expect(stored).not.toBeNull();
    expect(stored?.input.profile).toBe("HIGH_GROWTH_PROFITABLE_UNCERTAIN_DURABILITY");
    expect(stored?.input.classificationInputs).toEqual(nvdaDraftInput().classificationInputs);
    expect(stored?.input.scenarios).toEqual(nvdaDraftScenarios());
    expect(stored?.input.configuredConstants.nopatTaxRate).toBe("0.21");
    expect(stored?.input.configuredConstants.preRevenueUnleveredRate).toBeNull();
    expect(stored?.input.configuredConstants.projectDebtCost).toBeNull();

    const bundle = await recordedAnalystInputBundle(DRAFT_TICKER);
    expect(bundle).not.toBeNull();
    expect(bundle?.inputs.scenarios.bear.writtenAnchor).toContain("corrects and operating margin reverts");
    // Never synthesised for a recorded bundle, regardless of profile (SCOPE item 6 / migration 006's header).
    expect(bundle?.inputs.revalueBaseCaseAtRate).toBeNull();
    expect(bundle?.inputs.preRevenue).toBeNull();
  });

  it("the throwaway row is never presented as the real NVDA ticker's bundle", async () => {
    const input = { ...nvdaDraftInput(), scenarioValues: { bear: "1", base: "1", bull: "1" } };
    await recordAnalystBundle(DRAFT_TICKER, input);
    expect(await hasRecordedAnalystBundle("NVDA")).toBe(false);
    expect(await recordedAnalystInputBundle("NVDA")).toBeNull();
  });
});

const REPO_ROOT = join(__dirname, "..", "..", "..");
const THIS_FILE = relative(REPO_ROOT, __filename).replace(/\.js$/, ".ts");
const SCAN_ROOTS = ["lib", "app", "scripts", "migrations", ".github"];
const DRAFT_REFERENCE = /nvda-step7-draft|analyst-drafts/;
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next"]);

function findDraftReferences(dir: string, results: string[]): void {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (SKIP_DIRS.has(entry)) continue;
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      findDraftReferences(fullPath, results);
      continue;
    }
    let contents: string;
    try {
      contents = readFileSync(fullPath, "utf8");
    } catch {
      continue; // binary or unreadable file — cannot contain a source-level import
    }
    if (DRAFT_REFERENCE.test(contents)) {
      results.push(relative(REPO_ROOT, fullPath));
    }
  }
}

describe("CF-ANALYST-DRAFT-NVDA-01 — the draft artefact is not imported by any runtime module (SCOPE item 6)", () => {
  it("no file under lib/, app/, scripts/, migrations/ or .github/ (other than this test) references the draft artefact", () => {
    const results: string[] = [];
    for (const root of SCAN_ROOTS) {
      findDraftReferences(join(REPO_ROOT, root), results);
    }
    expect(results.filter((path) => path !== THIS_FILE)).toEqual([]);
  });
});

describe("CF-ANALYST-DRAFT-NVDA-01 — the runtime resolution path is unchanged (SCOPE item 6)", () => {
  it("TICKERS_WITH_ANALYST_INPUTS still names exactly the two committed bundles", () => {
    expect(TICKERS_WITH_ANALYST_INPUTS).toEqual(["MSFT", "OKLO"]);
  });

  it("analystInputsFor still resolves MSFT and OKLO from their committed bundles", async () => {
    const msft = await analystInputsFor("MSFT");
    const oklo = await analystInputsFor("OKLO");
    expect(msft?.inputs.profile.confirmedOrOverridden).toBe("MATURE_PROFITABLE_STABLE_FCF");
    expect(oklo?.inputs.profile.confirmedOrOverridden).toBe("PRE_REVENUE_UNPROFITABLE");
  });

  it("NVDA itself has no recorded bundle and analystInputsFor(\"NVDA\") is null", async () => {
    expect(await hasRecordedAnalystBundle("NVDA")).toBe(false);
    expect(await analystInputsFor("NVDA")).toBeNull();
  });

  it("a run for NVDA still fails closed: isSupportedTicker(\"NVDA\") is false", async () => {
    expect(await isSupportedTicker("NVDA")).toBe(false);
  });

  afterAll(async () => {
    await getPool().end();
  });
});
