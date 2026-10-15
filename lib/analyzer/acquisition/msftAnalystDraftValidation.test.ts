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
// CF-MSFT-STEP7-SOURCED-DRAFT-01 (issue #435) — DO item 5's mechanical
// verification, the same throwaway-ticker discipline
// nvdaAnalystDraftValidation.test.ts already established for the companion
// NVDA draft.
//
// This file does three things, none of which records the real MSFT ticker:
//
//   1. Proves the exact field values docs/analyst-drafts/msft-step7-draft.md
//      proposes behave exactly as recordedBundles.ts's own validation rules
//      say they should — written to a throwaway ticker in the test database,
//      deleted before and after every test.
//
//   2. Unlike the NVDA draft (whose scenario values were a named gap, left
//      blank), this draft DOES propose three scenario dollar values — an
//      isolated, non-persistent plausibility calculation under the current
//      approved scenario-DCF methodology (see the draft's own "Scenario
//      values" section) — so recordAnalystBundle is expected to ACCEPT the
//      throwaway write outright, not refuse it on a missing-value error.
//
//   3. Pins that nothing else in the runtime resolution path moved: MSFT
//      still resolves from its own committed fixture (BUNDLES.MSFT), not
//      from any recorded row, and the committed-ticker list is unchanged.
//      recordAnalystBundle is never called with "MSFT" anywhere in this file.
// ---------------------------------------------------------------------------

const DRAFT_TICKER = "ZZZMSFTDRAFT";

function msftDraftScenarios() {
  return {
    bear: {
      revenueGrowthOrPath: "0.08",
      operatingMargin: "0.4168",
      reinvestmentCapitalIntensity: "0.12",
      shareCount: "7425545491",
      writtenAnchor:
        "Trigger A has fired on this run's own real data: current margin (46.78%) sits exactly at the " +
        "ten-year window's own max, and the window range (16.73pt) exceeds the 15pt policy threshold " +
        "(policy.ts triggerAWindowRangePoints). Trigger B has not fired — the worst single-year decline " +
        "in the window is 0.28pt, nowhere near the 10pt policy threshold — so this is a margin-reversion " +
        "case, not a margin-collapse case: growth slows and margin reverts to its ten-year median, but " +
        "does not contemplate a sharp single-year deterioration, because none is in the real record to " +
        "anchor one to. The capex pullback mirrors this: a demand correction plausibly reduces " +
        "AI/datacenter capacity investment back toward the pre-buildout range.",
    },
    base: {
      revenueGrowthOrPath: "0.14",
      operatingMargin: "0.45",
      reinvestmentCapitalIntensity: "0.22",
      shareCount: "7425545491",
      writtenAnchor:
        "AI/datacenter demand continues but the growth rate normalizes materially off the FY2026 base; " +
        "the real, disclosed D&A step-up from the FY2024-FY2026 capex supercycle continues to compress " +
        "margin somewhat as those assets depreciate, while growth stays in the middle of the '10-30%' " +
        "band rather than reverting to bear-case levels. Capital intensity steps down from FY2026's peak " +
        "but stays well above the pre-FY2024 historical range, reflecting that at least some of the AI " +
        "buildout is durable, not purely cyclical.",
    },
    bull: {
      revenueGrowthOrPath: "0.20",
      operatingMargin: "0.4678",
      reinvestmentCapitalIntensity: "0.30",
      shareCount: "7425545491",
      writtenAnchor:
        "AI/cloud demand sustains and accelerates past the FY2026 realized rate; margin holds at its " +
        "current real ten-year high because revenue growth and favorable mix outrun the depreciation " +
        "step-up the base case concedes. Capital intensity stays near its FY2026 real peak rather than " +
        "reverting, reflecting continued large-scale, high-conviction capacity investment.",
    },
  };
}

/** The drafted field set exactly as `msft-step7-draft.md` states it, scenario
 * values included: the draft's own isolated, non-persistent plausibility
 * calculation (Bear $193.71, Base $246.97, Bull $370.49, recomputed at the
 * corrected `nopatTaxRate` = 0.19 per CALVIN RULING — CHANGES NEEDED item 3),
 * not a hand guess. */
function msftDraftInput(): RecordedAnalystBundleInput {
  return {
    profile: "MATURE_PROFITABLE_STABLE_FCF",
    classificationInputs: {
      revenueScale: "large",
      fcfCharacter: "positive_stable",
      revenueGrowthBand: "10-30%",
      capitalIntensity: "0.4236",
      cyclicality: { tenYearMarginRange: "0.1673", worstSingleYearChange: "0.0028" },
      balanceSheetNature: "asset-heavy",
    },
    scenarios: msftDraftScenarios(),
    scenarioValues: { bear: "193.71", base: "246.97", bull: "370.49" },
    configuredConstants: {
      nopatTaxRate: "0.19",
      stressMarginLevel: "0.3006",
      preRevenueUnleveredRate: null,
      projectDebtCost: null,
    },
  };
}

describe("CF-MSFT-STEP7-SOURCED-DRAFT-01 — the drafted MSFT bundle behaves as the store's own rules say it should", () => {
  beforeEach(async () => {
    await getPool().query("DELETE FROM analyzer_recorded_analyst_bundles WHERE ticker = $1", [DRAFT_TICKER]);
  });

  afterAll(async () => {
    await getPool().query("DELETE FROM analyzer_recorded_analyst_bundles WHERE ticker = $1", [DRAFT_TICKER]);
  });

  it("every drafted field — profile, classification, scenario drivers, scenario values and §7.1 constants — validates and round-trips through the store", async () => {
    const input = msftDraftInput();
    await expect(recordAnalystBundle(DRAFT_TICKER, input)).resolves.not.toThrow();

    const stored = await getRecordedAnalystBundleInput(DRAFT_TICKER);
    expect(stored).not.toBeNull();
    expect(stored?.input.profile).toBe("MATURE_PROFITABLE_STABLE_FCF");
    expect(stored?.input.classificationInputs).toEqual(input.classificationInputs);
    expect(stored?.input.scenarios).toEqual(msftDraftScenarios());
    expect(stored?.input.scenarioValues).toEqual({ bear: "193.71", base: "246.97", bull: "370.49" });
    expect(stored?.input.configuredConstants.nopatTaxRate).toBe("0.19");
    expect(stored?.input.configuredConstants.stressMarginLevel).toBe("0.3006");
    expect(stored?.input.configuredConstants.preRevenueUnleveredRate).toBeNull();
    expect(stored?.input.configuredConstants.projectDebtCost).toBeNull();

    const bundle = await recordedAnalystInputBundle(DRAFT_TICKER);
    expect(bundle).not.toBeNull();
    expect(bundle?.inputs.scenarios.bear.writtenAnchor).toContain("Trigger A has fired");
    // Every driver is authored on this draft (growth, margin, reinvestment all
    // non-null for all three scenarios), so the computed-from-drivers flag
    // should read true — the draft's own values are not a typed pass-through.
    expect(bundle?.inputs.recordedScenarioValuesComputeFromDrivers).toBe(true);
    // Never synthesised for a recorded bundle, regardless of profile.
    expect(bundle?.inputs.revalueBaseCaseAtRate).toBeNull();
    expect(bundle?.inputs.preRevenue).toBeNull();
  });

  it("the drafted share count (the real, absolute FY2026 cover-page count) is the same literal value across all three scenarios, not a billions-scale shorthand", () => {
    const scenarios = msftDraftScenarios();
    for (const key of ["bear", "base", "bull"] as const) {
      expect(scenarios[key].shareCount).toBe("7425545491");
      // The #434 fail-closed contract (assemble.ts RECORDED_SHARE_COUNT_SANITY_BAND,
      // 0.8x-1.2x of a run's own diluted-share estimate) is a plumbing check
      // against a run's own M1 marketCap/price figure, not reproducible from
      // this store-level test alone — but an absolute raw count this close to
      // 7.4 billion is nowhere near a thousand- or billion-scale unit mistake
      // (e.g. "7.4" meaning billions, or "7425545491" meant as millions),
      // which is what that band exists to catch.
      expect(Number(scenarios[key].shareCount)).toBeGreaterThan(1_000_000_000);
      expect(Number(scenarios[key].shareCount)).toBeLessThan(10_000_000_000);
    }
  });

  it("the drafted scenario values are in bear < base < bull order, the same internal-consistency check DO item 5 asks for", () => {
    const input = msftDraftInput();
    const bear = Number(input.scenarioValues.bear);
    const base = Number(input.scenarioValues.base);
    const bull = Number(input.scenarioValues.bull);
    expect(bear).toBeLessThan(base);
    expect(base).toBeLessThan(bull);
  });

  it("the throwaway row is never presented as the real MSFT ticker's bundle", async () => {
    await recordAnalystBundle(DRAFT_TICKER, msftDraftInput());

    const msft = await recordedAnalystInputBundle("MSFT");
    // MSFT has no recorded row (this outcome's HARD BOUNDS: recordAnalystBundle
    // is never called with "MSFT" anywhere in this file or in production code),
    // so the resolver's first source returns null for the real ticker.
    expect(msft).toBeNull();
  });
});

const REPO_ROOT = join(__dirname, "..", "..", "..");
const THIS_FILE = relative(REPO_ROOT, __filename).replace(/\.js$/, ".ts");
const SCAN_ROOTS = ["lib", "app", "scripts", "migrations", ".github"];
const DRAFT_REFERENCE = /msft-step7-draft/;
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next"]);
const ALLOWED_DRAFT_REFERENCES = new Set([THIS_FILE]);

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

describe("CF-MSFT-STEP7-SOURCED-DRAFT-01 — the draft artefact is not imported by any runtime module", () => {
  it("no file under lib/, app/, scripts/, migrations/ or .github/ (other than this test's own provenance citation) references the draft artefact", () => {
    const results: string[] = [];
    for (const root of SCAN_ROOTS) {
      findDraftReferences(join(REPO_ROOT, root), results);
    }
    expect(results.filter((path) => !ALLOWED_DRAFT_REFERENCES.has(path))).toEqual([]);
  });
});

describe("CF-MSFT-STEP7-SOURCED-DRAFT-01 — the runtime resolution path is unchanged", () => {
  it("TICKERS_WITH_ANALYST_INPUTS still names exactly the two committed bundles", () => {
    expect(TICKERS_WITH_ANALYST_INPUTS).toEqual(["MSFT", "OKLO"]);
  });

  it("analystInputsFor still resolves MSFT from its committed fixture, with the fixture's own (not this draft's) scenario values", async () => {
    const msft = await analystInputsFor("MSFT");
    expect(msft?.inputs.profile.confirmedOrOverridden).toBe("MATURE_PROFITABLE_STABLE_FCF");
    expect(msft?.inputs.scenarioValuesAreFixtureCarried).toBe(true);
    expect(msft?.inputs.scenarioValues?.bear.toString()).toBe("265");
    expect(msft?.inputs.scenarioValues?.base.toString()).toBe("510");
    expect(msft?.inputs.scenarioValues?.bull.toString()).toBe("650");
  });

  it("MSFT has no recorded bundle — this outcome records nothing persistent", async () => {
    expect(await hasRecordedAnalystBundle("MSFT")).toBe(false);
  });

  it("a run for MSFT remains supported, unaffected by this draft", async () => {
    expect(await isSupportedTicker("MSFT")).toBe(true);
  });

  afterAll(async () => {
    await getPool().end();
  });
});
