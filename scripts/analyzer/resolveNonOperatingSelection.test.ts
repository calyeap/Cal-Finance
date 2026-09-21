import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { resolveNonOperatingSelection } from "./resolveNonOperatingSelection";

const CANDIDATES = [
  { tag: "us-gaap:LongTermInvestments", value: new Decimal("36348000000"), asOfDate: "2026-06-30", form: "10-K" },
  { tag: "us-gaap:EquityMethodInvestments", value: new Decimal("12000000000"), asOfDate: "2026-06-30", form: "10-K" },
  {
    tag: "us-gaap:EquitySecuritiesWithoutReadilyDeterminableFairValueAmount",
    value: new Decimal("12400000000"),
    asOfDate: "2026-06-30",
    form: "10-K",
  },
];

describe("resolveNonOperatingSelection — ai-run.ts's --nonoperating= flag", () => {
  it("records a single candidate tag alone — the fix, replacing the old all-candidates join", () => {
    expect(resolveNonOperatingSelection("us-gaap:LongTermInvestments", CANDIDATES)).toBe(
      "us-gaap:LongTermInvestments"
    );
  });

  it("does not join every candidate when only one tag is requested (the defect this replaces)", () => {
    const selection = resolveNonOperatingSelection("us-gaap:LongTermInvestments", CANDIDATES);
    expect(selection).not.toBe(CANDIDATES.map((c) => c.tag).join(" + "));
  });

  it("records an explicit multi-tag selection, ' + '-joined", () => {
    expect(
      resolveNonOperatingSelection(
        "us-gaap:LongTermInvestments + us-gaap:EquityMethodInvestments",
        CANDIDATES
      )
    ).toBe("us-gaap:LongTermInvestments + us-gaap:EquityMethodInvestments");
  });

  it("records NONE for the none flag", () => {
    expect(resolveNonOperatingSelection("none", CANDIDATES)).toBe("None of these are non-operating");
  });

  it("fails loudly on an unrecognised tag rather than falling back to joining everything", () => {
    expect(() => resolveNonOperatingSelection("us-gaap:NotACandidate", CANDIDATES)).toThrow(
      /unrecognised tag/
    );
  });

  it("fails loudly when only one tag in a joined selection is unrecognised", () => {
    expect(() =>
      resolveNonOperatingSelection("us-gaap:LongTermInvestments + us-gaap:NotACandidate", CANDIDATES)
    ).toThrow(/us-gaap:NotACandidate/);
  });
});
