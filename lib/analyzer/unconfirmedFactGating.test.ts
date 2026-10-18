import { describe, it, expect } from "vitest";
import { assembleAnalysisResult, PRICE_NOT_CONFIRMED_CAUSE, type CompanyFixture } from "./assemble";
import { MSFT_FIXTURE } from "./fixtures/msft";
import { OKLO_FIXTURE } from "./fixtures/oklo";
import { withStatedD2Inputs } from "./fixtures/statedD2Inputs";
import { NOT_CONFIRMED_INPUT_CAUSE } from "./figures";
import { boundState, NOT_COMPUTED_BINDING } from "./notComputed";
import type { SourcedValue } from "./types";
import type Decimal from "decimal.js";

// CF-AR3-REPRODUCIBLE-RUNS-01 — R7 gating: a contradicted (NOT CONFIRMED)
// fact blocks every output that depends on it, and only those. The single
// module-level RED is knownReds.test.ts's; this proves the cascade through
// assembly. MSFT_FIXTURE states its own enterprise value in three places an
// acquired run leaves null for assembly to fill from M1 — they are nulled
// here so the fixture behaves as an acquired run does.

function unconfirmed(v: SourcedValue<Decimal> | null): SourcedValue<Decimal> | null {
  return v === null ? null : { ...v, provenance: { ...v.provenance, verificationState: "NOT CONFIRMED" } };
}

// CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — with STATED D2 test inputs, so the
// clean run's reverse DCF and base DCF actually compute and a block below is
// the unconfirmed fact's doing, not a sheet pending adoption.
const ACQUIRED_SHAPE: CompanyFixture = {
  ...withStatedD2Inputs(MSFT_FIXTURE),
  multiplesInput: { ...MSFT_FIXTURE.multiplesInput, enterpriseValue: null },
  reverseDcf: { ...MSFT_FIXTURE.reverseDcf, targetEnterpriseValue: null },
  leverage: { ...MSFT_FIXTURE.leverage, enterpriseValue: null },
};

describe("a NOT CONFIRMED total-debt fact", () => {
  const clean = assembleAnalysisResult(ACQUIRED_SHAPE);
  const gated = assembleAnalysisResult({
    ...ACQUIRED_SHAPE,
    enterpriseValue: { ...ACQUIRED_SHAPE.enterpriseValue, totalDebt: unconfirmed(ACQUIRED_SHAPE.enterpriseValue.totalDebt) },
  });

  it("is a real precondition: the same fixture with every fact confirmed issues enterprise value", () => {
    expect(clean.diagnostics.enterpriseValue.suppressed).toBe(false);
  });

  it("blocks enterprise value itself, INCOMPLETE with the unconfirmed-input cause", () => {
    const ev = gated.diagnostics.enterpriseValue;
    expect(ev.suppressed).toBe(true);
    if (!ev.suppressed) return;
    expect(ev.state).toBe("INCOMPLETE");
    expect(ev.cause).toBe(NOT_CONFIRMED_INPUT_CAUSE);
  });

  it("blocks every EV-based output: EV multiples, steady-state EV and PVGO, the reverse DCF", () => {
    expect(gated.diagnostics.multiples.evToEbit.suppressed).toBe(true);
    expect(gated.diagnostics.multiples.evToEbitda.suppressed).toBe(true);
    expect(gated.diagnostics.multiples.evToRevenue.value.suppressed).toBe(true);
    expect(gated.priceImplied.steadyStateEv.suppressed).toBe(true);
    expect(gated.priceImplied.pvgo.suppressed).toBe(true);
    expect(clean.priceImplied.reverseDcf.fiveYearGrowth.suppressed).toBe(false);
    expect(gated.priceImplied.reverseDcf.fiveYearGrowth.suppressed).toBe(true);
  });

  it("does not block outputs that never read it: P/E, cash FCF, margin history", () => {
    expect(gated.diagnostics.multiples.peTrailing.suppressed).toBe(clean.diagnostics.multiples.peTrailing.suppressed);
    expect(gated.diagnostics.fcf.cashFcf.suppressed).toBe(false);
    expect(gated.diagnostics.marginHistory.suppressed).toBe(clean.diagnostics.marginHistory.suppressed);
  });
});

describe("a NOT CONFIRMED base revenue", () => {
  const gated = assembleAnalysisResult({
    ...ACQUIRED_SHAPE,
    reverseDcf: { ...ACQUIRED_SHAPE.reverseDcf, baseYearRevenue: unconfirmed(ACQUIRED_SHAPE.reverseDcf.baseYearRevenue) },
  });

  it("blocks the reverse DCF", () => {
    expect(gated.priceImplied.reverseDcf.fiveYearGrowth.suppressed).toBe(true);
  });

  it("blocks the steady-state EV it would size NOPAT from", () => {
    expect(gated.priceImplied.steadyStateEv.suppressed).toBe(true);
  });

  it("blocks the terminal share of the base scenario DCF, with its cause bound — never a zero", () => {
    expect(gated.diagnostics.terminal.terminalShareOfValue.isNaN()).toBe(true);
    expect(boundState(gated.states, NOT_COMPUTED_BINDING.terminalShareOfValue)?.state).toBe("INCOMPLETE");
  });
});

// CF-LEG2-DECIDED-FACT-GATING-01 — the reads that take the price's bare
// value (assemble.ts's currentPrice) and the NOPAT gap's bare figures. On
// an acquired run a NOT CONFIRMED price already blocks these through
// enterprise value (decidedFactGatingOnRealRun.test.ts); here the fixture
// states its own enterprise value and typed scenario values, so the range
// renders and only the price's own decision can block what reads it.
describe("a NOT CONFIRMED price where the range renders without it", () => {
  const unconfirmedPrice = (fixture: CompanyFixture): CompanyFixture => ({
    ...fixture,
    enterpriseValue: { ...fixture.enterpriseValue, price: unconfirmed(fixture.enterpriseValue.price) },
    multiplesInput: { ...fixture.multiplesInput, price: unconfirmed(fixture.multiplesInput.price) },
  });
  const clean = assembleAnalysisResult(MSFT_FIXTURE);
  const gated = assembleAnalysisResult(unconfirmedPrice(MSFT_FIXTURE));

  it("is a real precondition: with the price confirmed, the range renders and the price is located within it", () => {
    expect(clean.fairValueRange.kind).toBe("range");
    expect(gated.fairValueRange.kind).toBe("range");
    expect(clean.scenarioOutputs.priceLocationWithinRange).not.toBeNull();
  });

  it("does not locate the contradicted price within the range, and says why", () => {
    expect(gated.scenarioOutputs.priceLocationWithinRange).toBeNull();
    expect(boundState(gated.states, NOT_COMPUTED_BINDING.priceLocationWithinRange)?.state).toBe("INCOMPLETE");
    expect(boundState(gated.states, NOT_COMPUTED_BINDING.priceLocationWithinRange)?.cause).toBe(PRICE_NOT_CONFIRMED_CAUSE);
  });

  it("does not present the contradicted price as the current price", () => {
    expect(boundState(clean.states, NOT_COMPUTED_BINDING.price)).toBeNull();
    expect(boundState(gated.states, NOT_COMPUTED_BINDING.price)?.state).toBe("INCOMPLETE");
    expect(boundState(gated.states, NOT_COMPUTED_BINDING.price)?.cause).toBe(PRICE_NOT_CONFIRMED_CAUSE);
  });

  it("keeps the valuation date at the price date — timing is not a use of the price's value", () => {
    expect(gated.runIdentity?.valuationTiming).toEqual(clean.runIdentity?.valuationTiming);
    expect(gated.scenarioOutputs.values.base.equals(clean.scenarioOutputs.values.base)).toBe(true);
  });

  it("a pre-revenue run's 'success as the price requires' — a REQUIRED part of its range — is not computed from it", () => {
    const okloClean = assembleAnalysisResult(OKLO_FIXTURE);
    const okloGated = assembleAnalysisResult(unconfirmedPrice(OKLO_FIXTURE));
    expect(boundState(okloClean.states, NOT_COMPUTED_BINDING.successAsPriceRequires)).toBeNull();
    expect(boundState(okloGated.states, NOT_COMPUTED_BINDING.successAsPriceRequires)?.state).toBe("INCOMPLETE");
    expect(boundState(okloGated.states, NOT_COMPUTED_BINDING.successAsPriceRequires)?.cause).toBe(PRICE_NOT_CONFIRMED_CAUSE);
  });
});

describe("a NOT CONFIRMED current operating margin", () => {
  const clean = assembleAnalysisResult(ACQUIRED_SHAPE);
  const gated = assembleAnalysisResult({
    ...ACQUIRED_SHAPE,
    reverseDcf: { ...ACQUIRED_SHAPE.reverseDcf, currentMargin: unconfirmed(ACQUIRED_SHAPE.reverseDcf.currentMargin) },
  });

  it("is a real precondition: a margin trigger has fired, so the current-vs-median NOPAT gap is shown", () => {
    expect(clean.priceImplied.nopatGap).not.toBeNull();
  });

  it("does not show the NOPAT gap built from it", () => {
    expect(gated.priceImplied.nopatGap).toBeNull();
  });

  it("leaves steady-state EV and PVGO, which read the median margin, computed", () => {
    expect(gated.priceImplied.steadyStateEv).toEqual(clean.priceImplied.steadyStateEv);
    expect(gated.priceImplied.pvgo).toEqual(clean.priceImplied.pvgo);
  });
});
