import { describe, it, expect } from "vitest";
import { assembleAnalysisResult, type CompanyFixture } from "./assemble";
import { MSFT_FIXTURE } from "./fixtures/msft";
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

const ACQUIRED_SHAPE: CompanyFixture = {
  ...MSFT_FIXTURE,
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

  it("blocks every EV-based output: EV multiples, steady-state EV and PVGO, every reverse-DCF cell", () => {
    expect(gated.diagnostics.multiples.evToEbit.suppressed).toBe(true);
    expect(gated.diagnostics.multiples.evToEbitda.suppressed).toBe(true);
    expect(gated.diagnostics.multiples.evToRevenue.value.suppressed).toBe(true);
    expect(gated.priceImplied.steadyStateEv.suppressed).toBe(true);
    expect(gated.priceImplied.pvgo.suppressed).toBe(true);
    expect(gated.priceImplied.reverseDcfGrid.every((c) => c.fiveYearGrowth.suppressed)).toBe(true);
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

  it("blocks every reverse-DCF cell", () => {
    expect(gated.priceImplied.reverseDcfGrid.every((c) => c.fiveYearGrowth.suppressed)).toBe(true);
  });

  it("blocks the steady-state EV it would size NOPAT from", () => {
    expect(gated.priceImplied.steadyStateEv.suppressed).toBe(true);
  });

  it("blocks the terminal share of the base scenario DCF, with its cause bound — never a zero", () => {
    expect(gated.diagnostics.terminal.terminalShareOfValue.isNaN()).toBe(true);
    expect(boundState(gated.states, NOT_COMPUTED_BINDING.terminalShareOfValue)?.state).toBe("INCOMPLETE");
  });
});
