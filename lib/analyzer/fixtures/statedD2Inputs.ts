import Decimal from "decimal.js";
import type { CompanyFixture } from "../assemble";

// CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — TEST SUPPORT ONLY. Methodology v2.1
// D2 needs two inputs on the assumption sheet — a return on new investment
// per scenario and the moat class — that no committed fixture carries and no
// agent may author for a real sheet (product-decisions item 19). A sheet
// without them is pending adoption and computes no D2 value.
//
// Tests that need a D2 valuation take these STATED HARNESS INPUTS instead:
// MSFT's five-year incremental-return history (21.5% ex-Activision, the
// master plan's anchor) for the base case, a step either side for bear and
// bull, and a narrow moat. They are never written to a recorded sheet, never
// read by production code, and are not anyone's judgement about a company.
export const STATED_D2_TEST_INPUTS = {
  returnOnNewInvestment: { bear: new Decimal("0.15"), base: new Decimal("0.215"), bull: new Decimal("0.25") },
  moatClass: "narrow" as const,
};

export function withStatedD2Inputs(fixture: CompanyFixture): CompanyFixture {
  const r = STATED_D2_TEST_INPUTS.returnOnNewInvestment;
  return {
    ...fixture,
    scenarios: {
      bear: { ...fixture.scenarios.bear, returnOnNewInvestment: r.bear },
      base: { ...fixture.scenarios.base, returnOnNewInvestment: r.base },
      bull: { ...fixture.scenarios.bull, returnOnNewInvestment: r.bull },
    },
    moatClass: STATED_D2_TEST_INPUTS.moatClass,
  };
}
