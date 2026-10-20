import Decimal from "decimal.js";
import type { PolicyConstants, UndefinedPolicyConstants } from "./types";

// §7.1 — policy constants, identical for every company. Every deterministic
// module (M1–M16) reads its constants from here rather than embedding a
// literal, so a later configuration surface (the spec requires these be
// "explicit configuration... not buried as literals in code") has one place
// to change.

export const POLICY: PolicyConstants = {
  terminalGrowth: new Decimal("0.03"),
  // CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — Cal Finance Methodology v2.1 D1
  // (frozen spec §14.9 AR0-1), replacing the §7.1 discount bands and the
  // 8/10/12% rate grid. Stable businesses at the market's expected return;
  // cyclical industries (SEC SIC code, cyclicalSic.ts, or trigger B) and
  // pre-revenue companies at market + 2pp; growth alone never raises the
  // rate. Valid only inside the §6.5 net-debt gate. Reset yearly: each
  // reset is a new dated row, never an edit of an old one, so a stored
  // run's policy version still names the rate it used (discountRate.ts).
  discountRate: {
    table: [
      {
        effectiveFrom: "2026-10-17",
        stable: new Decimal("0.09"),
        cyclicalOrPreRevenue: new Decimal("0.11"),
        provenance: {
          approval:
            "Approved values, Calvin, 17 Oct 2026 (Methodology v2.1 D1; docs/product-decisions.md item 26).",
          evidence:
            "At approval: 10-yr Treasury 5.09% + Damodaran implied equity premium 3.7–4.2% — 9.0% either way.",
          measurementConvention:
            "Yearly reset measured as Damodaran's published implied expected return on the S&P 500 (8.99% in " +
            "his October 2026 update), rounded to the nearest 0.5% — an AI DEFAULT inside the D1 rule, " +
            "reconciled 17 Oct 2026; the annual methodology review may change it. Provenance, not a rule value.",
        },
      },
    ],
    // D1: "every verdict is also checked at ±0.5pp" — the check points AR5
    // reads; also the rate-band ends M14's sensitivity varies (AR0-2).
    verdictCheckOffset: new Decimal("0.005"),
  },
  // Methodology v3 D2′ (approved 20 Oct 2026; frozen spec §14.10 V3-1),
  // replacing v2.1 D2's permanent moat credit: the return on new capital
  // fades linearly from its year-5 value to THE RATE by this year for
  // Calvin's moat class (a JUDGEMENT input on the assumption sheet), and the
  // terminal value is taken from (that year − 0.5). Growth still reaches
  // terminal growth by year 10 for everyone. Bear uses the no-moat runway;
  // Bull uses the company's runway with the terminal return at the rate plus
  // `bullTerminalReturnUplift`.
  returnRunwayYears: { none: 10, narrow: 15, wide: 20 },
  bullTerminalReturnUplift: new Decimal("0.015"),
  // Methodology v3 D5 (Calvin, 20 Oct 2026, #499): the NOPAT tax rate is the
  // 3-year average effective rate from filings (Σ tax ÷ Σ pre-tax income); a
  // year with pre-tax income ≤ 0 or a rate outside this band is abnormal and
  // excluded (and shown); with fewer than `taxMinimumNormalYears` normal years
  // the statutory rate applies, labelled. Margin and growth ramp from TTM to
  // the drafted value over `driverRampYears` (Base only).
  taxAverageYears: 3,
  taxNormalRateBand: [new Decimal("0"), new Decimal("0.5")],
  taxMinimumNormalYears: 2,
  driverRampYears: 5,
  // Methodology v3 D5 coherence display: model reinvestment ÷ NOPAT in years
  // 1–5 against the filed trailing 3-year actual; a gap above this needs a
  // cited reason.
  reinvestmentCoherenceGapPoints: new Decimal("0.15"),
  // PROVISIONAL — first-order, worth $27/share on OKLO's 8 GW case (§7.1).
  preRevenueConstructionLeadYears: 2,
  // PROVISIONAL — capped cells labelled RATE CAPPED (I12).
  leveredCostOfEquityCap: new Decimal("0.3"),
  // < 10% PASS, >= 10% FAIL (§6.5).
  leverageThreshold: new Decimal("0.1"),
  // PROVISIONAL, no observations behind it (§6.1).
  gate0InterestIncomeOverRevenueThreshold: new Decimal("0.5"),
  gate1HistoryInsufficientYears: 5,
  gate1ShortHistoryYears: 9,
  // Trigger A: current margin at or within 2 points of the window max, AND
  // the window range exceeds 15 points (§6.4).
  triggerAMarginProximityPoints: new Decimal("0.02"),
  triggerAWindowRangePoints: new Decimal("0.15"),
  // Trigger B: a single-year margin decline of more than 10 points (§6.4).
  triggerBDeclinePoints: new Decimal("0.1"),
  // Gate 1's own substitute triad when HISTORY INSUFFICIENT: current margin,
  // and that margin reduced by these two relative fractions (§6.2). This is
  // distinct from the single "stress margin level" used in the standard
  // current/median/stress diagnostic set, which is one of the four
  // UNDEFINED_POLICY_CONSTANTS below.
  historyInsufficientStressMarginRelativeReductions: [new Decimal("0.25"), new Decimal("0.5")],
  // Symmetric trigger correcting the methodology's gains-only asymmetry
  // (I5).
  peBasisNonOperatingThresholdOfPretaxIncome: new Decimal("0.05"),
  // PROVISIONAL, calibrated on NVIDIA only (Appendix B) — sequential growth
  // above this triggers the base-year rule before the seasonality gate (M12).
  runRateSequentialGrowthTrigger: new Decimal("0.1"),
  // PROVISIONAL, no observations behind it (I4) — same-quarter sequential
  // growth threshold in each of the prior two years.
  seasonalityPriorYearThreshold: new Decimal("0.1"),
  // RONIC > 60% fires CAPITAL-LIGHT (§7.2 M5).
  capitalLightRonicFloor: new Decimal("0.6"),
  // Display guard, not a valuation — RONIC computed above this is shown
  // capped, labelled RONIC CAPPED AT 200% (§7.2 M5).
  ronicCap: new Decimal("2"),
  // ~15 points difference between guided/known growth and the implied
  // constant triggers SHAPE MISMATCH (§7.2 M13).
  shapeMismatchGapPoints: new Decimal("0.15"),
  // An input whose full plausible range moves value by less than this is
  // not displayed in the sensitivity table (§7.2 M14).
  sensitivityDisplayThreshold: new Decimal("0.1"),
  // M11 precondition: (capex + lease additions) ÷ D&A must fall in this
  // band, or the output is PRECONDITION FAILED (§7.2).
  fcfYieldGrowthPreconditionBand: [new Decimal("0.8"), new Decimal("1.5")],
  // "Verdict synthesis policy v1" — APPROVED 22 Sep 2026, live Cal Finance
  // Methodology (Notion page "Cal Finance — Methodology", §"Stock-level
  // verdict semantics"), re-confirmed current by `CALVIN RULING — NO` on
  // PR #430 (2026-10-14, comment 6167808992): "Do not retire the 22 Sep V1
  // bands yet. They are explicitly marked APPROVED in Methodology." These
  // are the exact approved numbers, transcribed verbatim — not PROVISIONAL,
  // no POLICY_THRESHOLD_PROVENANCE entry. Each bucket name (low/medium/high)
  // is the policy's own uncertainty-bucket label; BUY fires at or below its
  // threshold, SELL at or above its threshold.
  verdictSynthesisV1Buy: { low: new Decimal("0.90"), medium: new Decimal("0.80"), high: new Decimal("0.70") },
  verdictSynthesisV1Sell: { low: new Decimal("1.20"), medium: new Decimal("1.30"), high: new Decimal("1.45") },
};

/**
 * The general US federal statutory corporate income tax rate — a reference
 * rate, not a company disclosure. Methodology v3 D5 uses it only where a
 * company's filings cannot support an effective rate, and labels it.
 */
export const US_FEDERAL_STATUTORY_TAX_RATE = new Decimal("0.21");

// The four constants the register records as LATER (§7.1). Left null rather
// than guessed so every consumer is forced to handle "unset" explicitly —
// an engineer defaulting one of these to a plausible-looking number would be
// reintroducing exactly the silently-invented behaviour the frozen contract
// forbids.
export const UNDEFINED_POLICY_CONSTANTS: UndefinedPolicyConstants = {
  nopatTaxRate: null,
  stressMarginLevel: null,
  preRevenueUnleveredRate: null,
  projectDebtCost: null,
};

// Fixed path shape (§7.1) — recorded as a labelled constant since it isn't a
// number a PolicyConstants field could hold, but a module still needs to
// name it (e.g. in section J's provisional register).
export const PATH_SHAPE_DESCRIPTION =
  "constant growth years 1–5, linear fade to terminal by year 10, terminal thereafter";

// ---------------------------------------------------------------------------
// PROVISIONAL threshold provenance (§10.0.1: "every PROVISIONAL threshold
// with what it was calibrated on"; §10.6 / section J: same requirement for
// the rendered report).
//
// A threshold marked PROVISIONAL in a code comment is exactly the failure
// this section exists to prevent — the calibration note lives here, next to
// the value, as data any consumer (AnalysisResult assembly, the report's
// section J) can read mechanically, rather than as prose an implementer has
// to remember to transcribe correctly. Only the constants the frozen spec
// itself labels PROVISIONAL, or explicitly says have "no observations
// behind" them, appear here — verified against every such occurrence in the
// spec (§6.1, §6.2, §7.1, §7.2 M12). Every other PolicyConstants field is
// "fixed by policy" and carries no entry.
// ---------------------------------------------------------------------------

export interface PolicyThresholdProvenance {
  status: "PROVISIONAL";
  calibration: string;
}

export const POLICY_THRESHOLD_PROVENANCE: Partial<Record<keyof PolicyConstants, PolicyThresholdProvenance>> = {
  preRevenueConstructionLeadYears: {
    status: "PROVISIONAL",
    calibration: "First-order estimate; worth $27/share on OKLO's 8 GW case (§7.1).",
  },
  leveredCostOfEquityCap: {
    status: "PROVISIONAL",
    calibration:
      "No observations behind the 30% level itself; capped cells are labelled RATE CAPPED — VALUE IS AN UPPER BOUND (I12, §7.1).",
  },
  gate0InterestIncomeOverRevenueThreshold: {
    status: "PROVISIONAL",
    calibration:
      "No observations behind it (Appendix B); the other three Gate 0 tests are classification lookups, not thresholds (§6.1).",
  },
  gate1HistoryInsufficientYears: {
    status: "PROVISIONAL",
    calibration:
      "Red-team judgment with no observations (Appendix B). Direction of error is suppression, so a wrong threshold shows less rather than something false (§6.2).",
  },
  gate1ShortHistoryYears: {
    status: "PROVISIONAL",
    calibration: "Red-team judgment with no observations (Appendix B), same basis as the <5-year threshold (§6.2).",
  },
  historyInsufficientStressMarginRelativeReductions: {
    status: "PROVISIONAL",
    calibration:
      "No observations; substitutes for a median that does not exist under HISTORY INSUFFICIENT (§6.2).",
  },
  runRateSequentialGrowthTrigger: {
    status: "PROVISIONAL",
    calibration: "Calibrated on NVIDIA only (Appendix B) (§7.2 M12).",
  },
  seasonalityPriorYearThreshold: {
    status: "PROVISIONAL",
    calibration: "Comes from I4 and has no observations behind it (§7.2 M12).",
  },
};

// Derives the AnalysisResult.policy.provisionalLabels member (§10.0.1)
// mechanically from POLICY_THRESHOLD_PROVENANCE, so Step 9 assembly can
// never omit or hand-retype a calibration note — there is exactly one place
// that can drift from the frozen contract.
export function buildProvisionalLabels(): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const [key, provenance] of Object.entries(POLICY_THRESHOLD_PROVENANCE)) {
    if (provenance !== undefined) {
      labels[key] = provenance.calibration;
    }
  }
  return labels;
}
