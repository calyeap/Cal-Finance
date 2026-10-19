import { describe, it, expect } from "vitest";
import { trustStatusLine, trustConsequenceLine, evidenceStatusLabel, rateInUseLine } from "./trustCopy";
import { selectDiscountRate } from "./discountRate";
import Decimal from "decimal.js";
import type { LeverageResult, ValuationBasis } from "./types";

// ---------------------------------------------------------------------------
// The page-one trust line, derived rather than written.
//
// report/page.tsx printed "Profile not confirmed · trust status PARTIAL" as a
// literal. After Fix 1 that string is reachable on a run whose range was
// suppressed, which §9.6 rule 1 makes UNUSABLE — so the page would assert
// PARTIAL about a run the Analysis Result calls UNUSABLE. §10.0.2 rule 3 is
// the general form: the renderer adds formatting and prose, not content.
// ---------------------------------------------------------------------------

describe("§9.6 — the trust line states the computed status", () => {
  it("says UNUSABLE where the status is UNUSABLE", () => {
    expect(trustStatusLine("UNUSABLE", false)).toContain("UNUSABLE");
  });

  it("says PARTIAL where the status is PARTIAL", () => {
    expect(trustStatusLine("PARTIAL", false)).toContain("PARTIAL");
  });

  it("never says PARTIAL where the status is UNUSABLE", () => {
    // The exact defect: a literal that was right for one run and wrong for
    // the next.
    expect(trustStatusLine("UNUSABLE", true)).not.toContain("PARTIAL");
  });

  it("still names the unconfirmed profile beside the status it produced", () => {
    expect(trustStatusLine("PARTIAL", true)).toContain("Profile not confirmed");
  });
});

describe("§9.6 — the consequence sentence follows the status, not the copy", () => {
  it("says the range still renders under PARTIAL", () => {
    // §6.3: "Trust status falls to PARTIAL on the §9.4 flag and the fair-value
    // range still renders."
    expect(trustConsequenceLine("PARTIAL")).toMatch(/range below still renders/i);
  });

  it("says the page refuses the range under UNUSABLE", () => {
    // §9.6: "Under UNUSABLE the page refuses to render the range — which is
    // the instruction, enforced rather than requested."
    const line = trustConsequenceLine("UNUSABLE");
    expect(line).toMatch(/no fair-value range/i);
    expect(line).not.toMatch(/still renders/i);
  });

  it("never says or implies the company is bad (§9.6)", () => {
    // "It says this run cannot tell you what the company is worth. It does not
    // say the company is bad, and no copy may let it be read that way."
    for (const status of ["CLEAN", "PARTIAL", "UNUSABLE"] as const) {
      expect(trustConsequenceLine(status)).not.toMatch(/\b(bad|avoid|overvalued|risky|poor)\b/i);
    }
  });
});

// M9-CONFIDENCE-LABEL-01 (issue #201, Calvin's ruling on #196, 21 Sep 2026
// 11:01:20Z) — the Overview slot-2 evidence-status label. Its copy bounds are
// the ruling's stated risk for Option B: wording that reads like a
// statistical confidence claim, or that lets UNUSABLE be read as a judgement
// on the company rather than on the analysis.
describe("evidenceStatusLabel — the slot-2 label, bounded by Calvin's ruling on #196", () => {
  it.each(["CLEAN", "PARTIAL", "UNUSABLE"] as const)("returns a non-empty label for %s", (status) => {
    expect(evidenceStatusLabel(status).length).toBeGreaterThan(0);
  });

  it("never uses confidence/probability/certainty/score language, for any status", () => {
    for (const status of ["CLEAN", "PARTIAL", "UNUSABLE"] as const) {
      expect(evidenceStatusLabel(status)).not.toMatch(/\b(confidence|probability|probabilities|certainty|certain|score)\b/i);
    }
  });

  it("never renders a percentage, for any status", () => {
    for (const status of ["CLEAN", "PARTIAL", "UNUSABLE"] as const) {
      expect(evidenceStatusLabel(status)).not.toMatch(/\d+(\.\d+)?\s*%/);
    }
  });

  it("states plainly that the label describes evidence, not certainty", () => {
    for (const status of ["CLEAN", "PARTIAL", "UNUSABLE"] as const) {
      expect(evidenceStatusLabel(status)).toMatch(/evidence/i);
    }
  });

  it("never lets UNUSABLE read as a judgement about the company (§9.6)", () => {
    const label = evidenceStatusLabel("UNUSABLE");
    expect(label).not.toMatch(/\b(bad|avoid|overvalued|risky|poor)\b/i);
    expect(label).toMatch(/this run/i);
  });
});

// CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — product-decisions item 26: the
// product shows the dated rate in use, read from the run's own basis.
describe("rateInUseLine", () => {
  // CF-LEG2-RATE-DOMAIN-COPY-01: the rate reads the §6.5 leverage result
  // itself (PASS by default), not a PASS boolean.
  const PASS: Pick<LeverageResult, "result" | "netDebtRatio"> = { result: "PASS", netDebtRatio: new Decimal("0.02") };
  const basisFor = (
    sic: string | null,
    triggerBFired = false,
    leverage: Pick<LeverageResult, "result" | "netDebtRatio"> = PASS
  ): ValuationBasis => ({
    discountRate: selectDiscountRate({ sic, triggerBFired, profile: "MATURE_PROFITABLE_STABLE_FCF", leverage, priceDate: "2026-10-16" }),
    d2: { status: "PENDING ADOPTION", missing: ["moat class"], moatClass: null, terminalReturnOnNewCapital: null, statement: "Pending adoption" },
  });

  it("names the stable rate and its date", () => {
    expect(rateInUseLine(basisFor("7372"))).toBe(
      "Valued at 9.0% — the market's expected return, for a stable business (rate dated 2026-10-17)."
    );
  });

  it("names the cyclical band's +2pp", () => {
    expect(rateInUseLine(basisFor("3674"))).toBe(
      "Valued at 11.0% — the market's expected return plus 2pp, for a cyclical business (rate dated 2026-10-17)."
    );
  });

  it("says when the rate is outside its validated domain (net-debt gate)", () => {
    const measuredAbove = { result: "LEVERAGE UNSUPPORTED IN v1" as const, netDebtRatio: new Decimal("0.25") };
    expect(rateInUseLine(basisFor("7372", false, measuredAbove))).toMatch(/Outside its validated domain/);
  });

  it("says the domain is unknown — not outside — when net debt was never measured", () => {
    const notMeasured = { result: "LEVERAGE UNSUPPORTED IN v1" as const, netDebtRatio: null };
    const line = rateInUseLine(basisFor("7372", false, notMeasured));
    expect(line).toBe(
      "Valued at 9.0% — the market's expected return, for a stable business (rate dated 2026-10-17). " +
        "Net debt could not be measured, so whether this rate is within its validated domain (net debt below 10% of enterprise value) is unknown."
    );
    expect(line).not.toMatch(/Outside its validated domain/);
  });

  it("returns nothing for a snapshot stored before AR4 (no basis)", () => {
    expect(rateInUseLine(undefined)).toBeNull();
  });
});
