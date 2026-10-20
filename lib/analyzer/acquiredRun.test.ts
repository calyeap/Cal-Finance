import { describe, it, expect, beforeEach } from "vitest";
import Decimal from "decimal.js";
import { buildAcquiredRun, AnalystInputsUnavailableError } from "./acquiredRun";
import { computeEnterpriseValue } from "./modules/enterpriseValue";
import { __resetAcquisitionCache } from "./acquisition/provider";
import { assembleAnalysisResult } from "./assemble";
import {
  queuedFacts,
  exemptFacts,
  derivedExemptFacts,
  isSpotCheckComplete,
  applyDecisions,
} from "./spotCheck";
import { constrainedAndPassedFactIds } from "./crosschecks/run";
import { evaluateCompleteness } from "./requiredInputs";
import { boundState, NOT_COMPUTED_BINDING } from "./notComputed";
import { combineProvenance } from "./provenance";

// ---------------------------------------------------------------------------
// DONE-WHEN 1 and 2, end to end: a real run acquires its own fact set from SEC
// filings, through the M7 gate, to an assembled Analysis Result.
//
// Uses the committed captures — real filing data, taken from EDGAR by
// scripts/analyzer/capture-companyfacts.ts — so the suite does not spend the
// rate budget or depend on the SEC being up.
// ---------------------------------------------------------------------------

const PRICE = {
  value: new Decimal("510.12"),
  timestamp: "2026-09-04T21:00:00-04:00",
  source: "Yahoo Finance latest close",
};

beforeEach(() => __resetAcquisitionCache());

async function msftRun(nonOp: Parameters<typeof buildAcquiredRun>[0]["nonOperatingInvestments"] = null) {
  return buildAcquiredRun({
    ticker: "MSFT",
    price: PRICE,
    source: "CAPTURE",
    acquiredAt: "2026-09-08T10:00:00.000Z",
    nonOperatingInvestments: nonOp,
    fiftyTwoWeek: { low: new Decimal("344.79"), high: new Decimal("555.45") },
  });
}

describe("a real MSFT run, from filings to an Analysis Result", () => {
  it("acquires its fact set from SEC filings, not from a fixture", async () => {
    const run = await msftRun();
    const ids = run.fixture.facts.map((f) => f.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        "shares-outstanding",
        "treasury-method-dilution",
        "total-debt",
        "finance-lease-liabilities",
        "cash-and-marketable-debt-securities",
        "current-revenue",
        "capex",
        "finance-lease-rou-additions",
        "price",
      ])
    );

    // Every filing fact names the accession it came from.
    for (const fact of run.fixture.facts) {
      if (fact.tagMappingVersion === null) continue;
      expect(fact.source).toMatch(/accession/);
    }
  });

  it("runs the §3.8.2 cross-checks over every input", async () => {
    const run = await msftRun();
    expect(run.acquired.crossChecks.inputFactIds.length).toBeGreaterThan(10);
    expect(run.acquired.crossChecks.results.length).toBeGreaterThan(30);
  });

  it("assembles a real Analysis Result through the M7 gate", async () => {
    const run = await msftRun();
    const decided = new Map(
      queuedFacts(run.fixture.facts, run.acquired.crossCheckFailedFactIds).map((f) => [
        f.id,
        { decision: "CONFIRMED" as const, origin: "HUMAN" as const, reasonCode: null },
      ])
    );
    const facts = applyDecisions(run.fixture.facts, decided, run.acquired.crossCheckFailedFactIds);

    expect(isSpotCheckComplete(facts, new Set(decided.keys()), run.acquired.crossCheckFailedFactIds)).toBe(
      true
    );

    const result = assembleAnalysisResult({ ...run.fixture, facts });
    expect(result.ticker).toBe("MSFT");
    expect(result.facts.length).toBeGreaterThan(10);
    // The margin history is real: eleven filed years off the tagged elements.
    expect(result.diagnostics.marginHistory.suppressed).toBe(false);
  });

  it("returns INCOMPLETE for enterprise value until the §4.4 judgment is made", async () => {
    const run = await msftRun();
    const result = assembleAnalysisResult(run.fixture);

    expect(result.diagnostics.enterpriseValue.suppressed).toBe(true);
    if (result.diagnostics.enterpriseValue.suppressed) {
      expect(result.diagnostics.enterpriseValue.state).toBe("INCOMPLETE");
      expect(result.diagnostics.enterpriseValue.cause).toContain(
        "nonOperatingEquityInvestmentsAtBook"
      );
    }
  });

  it("computes enterprise value once the analyst classifies the investments", async () => {
    // The judgment §4.4 requires, made explicitly: Microsoft's two tagged
    // equity-investment line items, carried at book.
    const run = await msftRun({
      tags: [
        "us-gaap:EquityMethodInvestments",
        "us-gaap:EquitySecuritiesWithoutReadilyDeterminableFairValueAmount",
      ],
      value: new Decimal("24400000000"),
      errorDirection: "understates",
    });

    const result = assembleAnalysisResult(run.fixture);
    expect(result.diagnostics.enterpriseValue.suppressed).toBe(false);

    if (!result.diagnostics.enterpriseValue.suppressed) {
      const bridge = result.diagnostics.enterpriseValue.value;
      // Every component is a real filing figure.
      expect(bridge.totalDebt.toString()).toBe("40294000000");
      expect(bridge.financeLeaseLiabilities.toString()).toBe("66594000000");
      expect(bridge.cashAndMarketableDebtSecurities.toString()).toBe("76843000000");
      // Market cap uses cover-page shares PLUS treasury-method dilution, never
      // the weighted-average diluted count (§3.5).
      const expectedShares = new Decimal("7425545491").plus("24000000");
      expect(bridge.marketCap.toString()).toBe(expectedShares.mul(PRICE.value).toString());
    }
  });

  // CALVIN RULING — A, REQUIRE SAME-DATE EV BRIDGE INPUTS (issue #308,
  // ruled 25 Sep 2026 03:46:48Z; implemented under issue #309).
  it("carries the real acquired as-of date through to the bridge, coherent today — the correction is latent-only for MSFT", async () => {
    const run = await msftRun({
      tags: [
        "us-gaap:EquityMethodInvestments",
        "us-gaap:EquitySecuritiesWithoutReadilyDeterminableFairValueAmount",
      ],
      value: new Decimal("24400000000"),
      errorDirection: "understates",
    });

    const ev = run.fixture.enterpriseValue;
    expect(ev.totalDebtAsOfDate).toBe("2026-06-30");
    expect(ev.financeLeaseLiabilitiesAsOfDate).toBe("2026-06-30");
    expect(ev.cashAndMarketableDebtSecuritiesAsOfDate).toBe("2026-06-30");

    // Same-date today, so the bridge still computes — no regression.
    const result = computeEnterpriseValue(ev);
    expect(result.suppressed).toBe(false);
  });

  it("returns INCOMPLETE naming the mismatched dates when the bridge's three balance-sheet inputs disagree, on the real acquired MSFT figures", async () => {
    const run = await msftRun({
      tags: [
        "us-gaap:EquityMethodInvestments",
        "us-gaap:EquitySecuritiesWithoutReadilyDeterminableFairValueAmount",
      ],
      value: new Decimal("24400000000"),
      errorDirection: "understates",
    });

    // Force two of the three real, capture-derived bridge inputs to
    // different as-of dates — the real values are untouched, only the
    // dates are perturbed, to reproduce the ruling's own refusal case.
    const mismatched = {
      ...run.fixture.enterpriseValue,
      financeLeaseLiabilitiesAsOfDate: "2026-03-31",
    };

    const result = computeEnterpriseValue(mismatched);
    expect(result.suppressed).toBe(true);
    if (result.suppressed) {
      expect(result.state).toBe("INCOMPLETE");
      expect(result.cause).toContain("total-debt=2026-06-30");
      expect(result.cause).toContain("finance-lease-liabilities=2026-03-31");
      expect(result.cause).toContain("cash-and-marketable-debt-securities=2026-06-30");
    }
  });

  it("queues price and current-operating-margin, and nothing else", async () => {
    // The 8 September ruling, on the real fact set. price is guard 1 — a feed
    // with no tag mapping. current-operating-margin is named in §3.8. Both are
    // spec requirements and the derived-fact exemption must not touch either,
    // even though the margin satisfies both its conditions.
    const run = await msftRun();
    const evidence = {
      crossCheckConstrainedFactIds: constrainedAndPassedFactIds(run.acquired.crossChecks),
    };
    const queued = queuedFacts(
      run.fixture.facts,
      run.acquired.crossCheckFailedFactIds,
      evidence
    ).map((f) => f.id);

    expect(queued.sort()).toEqual(["current-operating-margin", "price"]);
  });

  it("exempts net-debt and cash-fcf, shown but not queued", async () => {
    const run = await msftRun();
    const evidence = {
      crossCheckConstrainedFactIds: constrainedAndPassedFactIds(run.acquired.crossChecks),
    };
    const shown = derivedExemptFacts(
      run.fixture.facts,
      run.acquired.crossCheckFailedFactIds,
      evidence
    ).map((f) => f.id);

    expect(shown.sort()).toEqual(["cash-fcf", "net-debt"]);
    // Still carried, not hidden (§3.8.1 guard 2's principle).
    for (const id of shown) {
      expect(run.fixture.facts.some((f) => f.id === id)).toBe(true);
    }
  });

  it("discloses what on the run was not acquired", async () => {
    const run = await msftRun();
    const joined = run.disclosures.join(" ");

    // The substance, in the analyst's vocabulary.
    expect(joined).toContain("scenarios");
    expect(joined).toContain("NOT acquired");
    expect(joined).toMatch(/non-operating/i);
    expect(joined).toMatch(/SEC filings/);
  });

  // CF-VERDICT-NONPOLICY-GAPS-01 SCOPE 2 — Step 7's achieved-history
  // comparator, computed from the real acquired filings rather than the M5
  // fixture (which carries no multi-year series at all, see fixtures/msft.ts).
  it("computes a real ten-year achieved-revenue CAGR from the acquired filings, matching the mock's own disclosed 13.7% ten-year figure", async () => {
    const run = await msftRun();
    const achieved = run.fixture.achievedRevenueCagr;
    expect(achieved.value).not.toBeNull();
    if (achieved.value === null) return;
    expect(achieved.blockedBy).toEqual([]);
    expect(achieved.value.horizonYears).toBe(10);
    expect(achieved.value.window.yearsStale).toBe(0);
    expect(achieved.value.cagr.toDecimalPlaces(3).toNumber()).toBeCloseTo(0.138, 2);

    const result = assembleAnalysisResult(run.fixture);
    expect(result.achievedRevenueCagr).toEqual(achieved);
  });

  it("puts no section reference in front of the analyst", async () => {
    // Gate-2's fix, undone by M8-a's new copy and restored here. Section
    // numbers address the contract, not the reader — the report layer already
    // strips them from its own prose, and Screen 2 must not reintroduce them.
    const run = await msftRun();
    for (const line of run.disclosures) {
      expect(line).not.toMatch(/§/);
    }
  });
});

describe("a real OKLO run — pre-revenue, thinner filings", () => {
  async function oklo() {
    return buildAcquiredRun({
      ticker: "OKLO",
      price: { value: new Decimal("92.44"), timestamp: "2026-09-04T21:00:00-04:00", source: "Yahoo Finance latest close" },
      source: "CAPTURE",
      acquiredAt: "2026-09-08T10:00:00.000Z",
    });
  }

  it("acquires the pre-revenue limb and assembles a result", async () => {
    const run = await oklo();
    const ids = run.fixture.facts.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(["cash-balance", "quarterly-burn", "shares-outstanding"]));

    const result = assembleAnalysisResult(run.fixture);
    expect(result.ticker).toBe("OKLO");
  });

  // CALVIN RULING — A, REQUIRE SAME-DATE EV BRIDGE INPUTS (issue #308,
  // ruled 25 Sep 2026 03:46:48Z; implemented under issue #309). OKLO's
  // three named bridge inputs are coherent today (all @2026-06-30) — the
  // correction is latent-only here too. OKLO's EV bridge stays INCOMPLETE
  // even with the §4.4 judgment supplied, but for the SAME pre-existing
  // reason as before this outcome (treasuryMethodDilution is not acquired
  // for OKLO — unrelated to this ruling, and untouched by it): the
  // same-date test must not introduce a second, different suppression
  // reason on top of it.
  // Methodology v3 D8 (CF-METHODOLOGY-V3-IMPLEMENT-01, #499) closed the
  // pre-existing gap: treasuryMethodDilution is now the same 10-K's diluted −
  // basic weighted-average shares (zero for OKLO's loss year, no convertibles
  // filed), so the bridge computes — still never a date-mismatch cause.
  it("computes once D8 fills treasuryMethodDilution, never a date-mismatch cause — no regression for OKLO", async () => {
    const run = await buildAcquiredRun({
      ticker: "OKLO",
      price: { value: new Decimal("92.44"), timestamp: "2026-09-04T21:00:00-04:00", source: "Yahoo Finance latest close" },
      source: "CAPTURE",
      acquiredAt: "2026-09-08T10:00:00.000Z",
      nonOperatingInvestments: { tags: [], value: new Decimal(0), errorDirection: null },
    });

    const ev = run.fixture.enterpriseValue;
    expect(ev.totalDebtAsOfDate).toBe("2026-06-30");
    expect(ev.financeLeaseLiabilitiesAsOfDate).toBe("2026-06-30");
    expect(ev.cashAndMarketableDebtSecuritiesAsOfDate).toBe("2026-06-30");

    expect(ev.treasuryMethodDilution?.value.toString()).toBe("0");
    expect(run.fixture.v3Inputs?.dilutionFallback?.applied).toBe(true);
    const result = computeEnterpriseValue(ev);
    expect(result.suppressed).toBe(false);
  });

  // CB-H3-IMPLEMENT-01's two OKLO tests (cash per share and runway from the
  // real acquired facts; the success weight suppressed for want of a
  // per-definition V_success date) asserted on the pre-revenue block built
  // around OKLO_FIXTURE's synthetic unit economics, funding stack and success
  // values. CF-AR6-ANY-TICKER-DRAFTS-01 — reviewed evaluator change: that
  // fixture no longer reaches a real run (issue #454 DO 6), and no honest
  // pre-revenue block exists without it, so OKLO's real run carries none and
  // its sheet records that the valuation cannot be concluded from filed
  // history. What still holds, pinned here: the acquired cash, share and burn
  // facts stay in the fact set, and no fixture figure reaches the run.
  it("carries no fixture-built pre-revenue block; its acquired cash, share and burn facts stay in the fact set", async () => {
    const run = await oklo();
    expect(run.fixture.preRevenue).toBeNull();
    expect(run.fixture.sheet?.origin).toBe("CANNOT CONCLUDE");
    const result = assembleAnalysisResult(run.fixture);
    expect(result.preRevenue).toBeNull();
    for (const id of ["cash-balance", "shares-outstanding", "quarterly-burn"]) {
      const fact = run.fixture.facts.find((f) => f.id === id);
      expect(fact?.value).not.toBeNull();
    }
    expect(result.fairValueRange.kind).toBe("suppressed");
  });

  // CB-AUDIT-FIX-01B / CB-AUDIT-01 H4c and H2. The validation set has no
  // growth, margin or reinvestment drivers for OKLO (it carries 0 as a
  // placeholder for all nine) and no revaluation of the base case at other
  // rates (it carries a constant $31). A live run carries neither.
  it("carries no placeholder scenario drivers and no placeholder revaluation — both report INCOMPLETE", async () => {
    const run = await oklo();
    for (const s of ["bear", "base", "bull"] as const) {
      const d = run.fixture.scenarios[s];
      expect(d.revenueGrowthOrPath).toBeNull();
      expect(d.operatingMargin).toBeNull();
      expect(d.reinvestmentCapitalIntensity).toBeNull();
      expect(d.writtenAnchor.length).toBeGreaterThan(0);
    }
    expect(run.fixture.revalueBaseCaseAtRate).toBeNull();

    const result = assembleAnalysisResult(run.fixture);
    expect(boundState(result.states, NOT_COMPUTED_BINDING.scenarioDrivers("base"))?.state).toBe("INCOMPLETE");
    expect(boundState(result.states, NOT_COMPUTED_BINDING.rateAtWhichBaseEqualsPrice)?.state).toBe("INCOMPLETE");
    expect(run.disclosures.join(" ")).toMatch(/OKLO/);
  });

  // CF-VERDICT-NONPOLICY-GAPS-01 SCOPE 2 — the honest blocked direction on a
  // real run: OKLO's filings carry no tagged revenue series at all (a
  // pre-revenue company), so the comparator reports blocked with cause,
  // never a fabricated figure and never a silent gap.
  it("reports achievedRevenueCagr blocked, with an honest cause, rather than a fabricated figure — no tagged revenue series on this pre-revenue filer", async () => {
    const run = await oklo();
    const achieved = run.fixture.achievedRevenueCagr;
    expect(achieved.value).toBeNull();
    expect(achieved.blockedBy.length).toBeGreaterThan(0);
    expect(achieved.blockedBy.join(" ")).toMatch(/revenue series/);

    const result = assembleAnalysisResult(run.fixture);
    expect(result.achievedRevenueCagr).toEqual(achieved);
  });

  it("reports more absent inputs than Microsoft, and names each", async () => {
    const oklo_ = await oklo();
    __resetAcquisitionCache();
    const msft = await msftRun();
    expect(oklo_.absentInputs.length).toBeGreaterThan(msft.absentInputs.length);
    for (const name of oklo_.absentInputs) expect(name.length).toBeGreaterThan(2);
  });

  it("returns INCOMPLETE across the FCF definitions rather than defaulting a lease field to zero", async () => {
    // §5.4's cascade, on the company that actually triggers it. Oklo tags no
    // finance-lease ROU additions, so unlevered FCF and FCF after
    // lease-funded capacity lose a REQUIRED input.
    const run = await oklo();
    const completeness = evaluateCompleteness({
      availableFactIds: new Set(run.fixture.facts.map((f) => f.id)),
    });
    const fcf = completeness.find((o) => o.outputId === "fcf-definitions");
    expect(fcf?.state).toBe("INCOMPLETE");
    expect(fcf?.blockedBy.map((b) => b.factId)).toContain("finance-lease-rou-additions");
  });

  it("keeps every tag-mapped fact exempt and every derived one queued", async () => {
    const run = await oklo();
    const exempt = exemptFacts(run.fixture.facts, run.acquired.crossCheckFailedFactIds);
    for (const fact of exempt) expect(fact.tagMappingVersion).not.toBeNull();

    const queued = queuedFacts(run.fixture.facts, run.acquired.crossCheckFailedFactIds);
    for (const fact of queued) {
      // A queued fact is queued because it has no mapping version, or because
      // a cross-check failed on it. Never for any other reason.
      const forced = run.acquired.crossCheckFailedFactIds.has(fact.id);
      expect(fact.tagMappingVersion === null || forced).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// CF-MULTIPLES-NOPRICE-RECON-01 (issue #304) — the one remaining named,
// not-fixed member of the zero-price flattening class
// (docs/noprice-honesty-reconciliation.md §4): multiplesInput.price. Probed
// directly on real acquired runs with no price, for both companies.
// ---------------------------------------------------------------------------

describe("a real acquired run with no price — multiplesInput.price (CF-MULTIPLES-NOPRICE-RECON-01)", () => {
  it("MSFT — carries the missing price through to multiplesInput.price as null, never a flattened $0", async () => {
    const run = await buildAcquiredRun({
      ticker: "MSFT",
      price: null,
      source: "CAPTURE",
      acquiredAt: "2026-09-08T10:00:00.000Z",
    });
    expect(run.fixture.multiplesInput.price).toBeNull();
    expect(run.absentInputs).toContain("price");

    // Latent today, exactly like enterpriseValue.price was on NVDA before
    // CF-NOPRICE-HONESTY-RECON-01 fixed it: this call passes no epsTrailing/
    // epsForward option (and bookValue still has no source at all), so P/E
    // and P/B were already INCOMPLETE via their other operand. This proves
    // the fix regardless — "computes against $0" and "computes against
    // null, still INCOMPLETE for another stated reason" are different bugs,
    // and only the read itself (asserted above) proves which one this is.
    const result = assembleAnalysisResult(run.fixture);
    for (const m of [result.diagnostics.multiples.peTrailing, result.diagnostics.multiples.peForward, result.diagnostics.multiples.priceToBook]) {
      expect(m.suppressed).toBe(true);
    }
  });

  it("OKLO — carries the missing price through to multiplesInput.price as null, never a flattened $0", async () => {
    const run = await buildAcquiredRun({
      ticker: "OKLO",
      price: null,
      source: "CAPTURE",
      acquiredAt: "2026-09-08T10:00:00.000Z",
    });
    expect(run.fixture.multiplesInput.price).toBeNull();
    expect(run.absentInputs).toContain("price");

    const result = assembleAnalysisResult(run.fixture);
    for (const m of [result.diagnostics.multiples.peTrailing, result.diagnostics.multiples.peForward, result.diagnostics.multiples.priceToBook]) {
      expect(m.suppressed).toBe(true);
    }
  });

  it("REGRESSION — a run WITH a price is unaffected: multiplesInput.price still carries the real value, for both companies", async () => {
    const msft = await msftRun();
    expect(msft.fixture.multiplesInput.price).toEqual({ value: PRICE.value, provenance: expect.anything() });
    expect(msft.absentInputs).not.toContain("price");

    __resetAcquisitionCache();
    const withPrice = await buildAcquiredRun({
      ticker: "OKLO",
      price: { value: new Decimal("92.44"), timestamp: "2026-09-04T21:00:00-04:00", source: "Yahoo Finance latest close" },
      source: "CAPTURE",
      acquiredAt: "2026-09-08T10:00:00.000Z",
    });
    expect(withPrice.fixture.multiplesInput.price).not.toBeNull();
    expect(withPrice.absentInputs).not.toContain("price");
  });
});

describe("CF-ANALYZER-LEAN-MSFT-PROOF-01 — EPS and market cap off the market-data feed", () => {
  const EPS_TRAILING = new Decimal("13.11");
  const EPS_FORWARD = new Decimal("15.42");

  it("REGRESSION — with no EPS supplied, P/E stays INCOMPLETE exactly as before this outcome", async () => {
    const run = await msftRun();
    expect(run.fixture.multiplesInput.epsTrailing).toBeNull();
    expect(run.fixture.multiplesInput.epsForward).toBeNull();
    expect(run.absentInputs).toEqual(expect.arrayContaining(["epsTrailing", "epsForward"]));

    const result = assembleAnalysisResult(run.fixture);
    expect(result.diagnostics.multiples.peTrailing.suppressed).toBe(true);
    expect(result.diagnostics.multiples.peForward.suppressed).toBe(true);
  });

  it("populates P/E trailing and forward once the market-data feed supplies EPS", async () => {
    const run = await buildAcquiredRun({
      ticker: "MSFT",
      price: PRICE,
      source: "CAPTURE",
      acquiredAt: "2026-09-08T10:00:00.000Z",
      fiftyTwoWeek: { low: new Decimal("344.79"), high: new Decimal("555.45") },
      epsTrailing: EPS_TRAILING,
      epsForward: EPS_FORWARD,
    });

    expect(run.absentInputs).not.toContain("epsTrailing");
    expect(run.absentInputs).not.toContain("epsForward");

    const result = assembleAnalysisResult(run.fixture);
    expect(result.diagnostics.multiples.peTrailing.suppressed).toBe(false);
    expect(result.diagnostics.multiples.peForward.suppressed).toBe(false);
    if (!result.diagnostics.multiples.peTrailing.suppressed) {
      expect(result.diagnostics.multiples.peTrailing.value.toString()).toBe(
        PRICE.value.dividedBy(EPS_TRAILING).toString()
      );
    }
    if (!result.diagnostics.multiples.peForward.suppressed) {
      expect(result.diagnostics.multiples.peForward.value.toString()).toBe(
        PRICE.value.dividedBy(EPS_FORWARD).toString()
      );
    }
  });

  it("computes market cap as price x shares outstanding, and FCF yield on market cap follows it — never a third acquisition", async () => {
    const run = await msftRun();

    expect(run.fixture.multiplesInput.marketCap).not.toBeNull();
    const expectedMarketCap = PRICE.value.mul("7425545491"); // the raw acquired shares-outstanding fact
    expect(run.fixture.multiplesInput.marketCap?.value.toString()).toBe(expectedMarketCap.toString());
    expect(run.absentInputs).not.toContain("marketCap");

    const result = assembleAnalysisResult(run.fixture);
    expect(result.diagnostics.multiples.fcfYieldOnMarketCap.suppressed).toBe(false);
    if (!result.diagnostics.multiples.fcfYieldOnMarketCap.suppressed && run.fixture.multiplesInput.cashFcf) {
      expect(result.diagnostics.multiples.fcfYieldOnMarketCap.value.toString()).toBe(
        run.fixture.multiplesInput.cashFcf.value.dividedBy(expectedMarketCap).toString()
      );
    }
  });

  it("DEGRADE LOCALLY — a missing forward EPS suppresses only P/E forward, never P/E trailing, market cap or FCF yield", async () => {
    const run = await buildAcquiredRun({
      ticker: "MSFT",
      price: PRICE,
      source: "CAPTURE",
      acquiredAt: "2026-09-08T10:00:00.000Z",
      fiftyTwoWeek: { low: new Decimal("344.79"), high: new Decimal("555.45") },
      epsTrailing: EPS_TRAILING,
      epsForward: null,
    });

    const result = assembleAnalysisResult(run.fixture);
    expect(result.diagnostics.multiples.peForward.suppressed).toBe(true);
    expect(result.diagnostics.multiples.peTrailing.suppressed).toBe(false);
    expect(result.diagnostics.multiples.fcfYieldOnMarketCap.suppressed).toBe(false);
  });

  it("carries real provenance on the fetched EPS — market-data-feed tokens, never CONFIRMED (nothing will ever spot-check it) and never SECONDARY/AI-EXTRACTED", async () => {
    const run = await buildAcquiredRun({
      ticker: "MSFT",
      price: PRICE,
      source: "CAPTURE",
      acquiredAt: "2026-09-08T10:00:00.000Z",
      fiftyTwoWeek: { low: new Decimal("344.79"), high: new Decimal("555.45") },
      epsTrailing: EPS_TRAILING,
      epsForward: EPS_FORWARD,
    });

    const eps = run.fixture.multiplesInput.epsTrailing;
    expect(eps).not.toBeNull();
    expect(eps?.provenance.sourceClass).toBe("PRIMARY");
    expect(eps?.provenance.extractionType).toBe("DETERMINISTIC/STRUCTURED");
    expect(eps?.provenance.verificationState).toBe("SPOT-CHECK NOT REQUIRED");
  });
});

describe("a company with no analyst input bundle", () => {
  // CF-ANALYZER-V1-SETTLE-01 (issue #392) — NVDA now durably resolves
  // (migration 008), so it is no longer this codebase's "capture exists,
  // no bundle" example; a synthetic ticker with no committed capture and no
  // recorded/committed bundle proves the same refusal without depending on
  // NVDA's own support status. analystInputsFor is checked before any
  // capture is ever read (acquiredRun.ts:118-119), so no real capture file
  // is needed for this ticker to exercise this exact refusal.
  it("refuses rather than inventing scenarios", async () => {
    await expect(
      buildAcquiredRun({ ticker: "ZZZNOBUNDLE", price: PRICE, source: "CAPTURE" })
    ).rejects.toBeInstanceOf(AnalystInputsUnavailableError);
  });
});
