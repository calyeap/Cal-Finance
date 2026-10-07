import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import {
  plainReason,
  notComputedLine,
  leverageUnavailableLine,
  fairValueRangeUnavailableLine,
  verdictUnavailableLine,
  missingInputsInPlainWords,
  overviewTextViolations,
  positionHiddenLine,
  CHANGE_TRIGGER_UNAVAILABLE_LINE,
  NO_UPCOMING_EVENTS_LINE,
  NO_INDUSTRY_CLASSIFICATION_LINE,
  OVERVIEW_CHALLENGER_NOTE,
} from "./overviewCopy";
import type { LeverageResult, SuppressingState } from "./types";

// CF-ANALYZER-V1-SETTLE-01 — the plain-English Overview copy (Calvin's 7 Oct
// 2026 decision on #399, Option 1) and the one forbidden-text list both the
// live proof and the page-one AI check read.

const ALL_STATES: SuppressingState[] = [
  "UNSUPPORTED PROFILE — ASSET-BASED ROW NOT VALIDATED IN v1",
  "UNSUPPORTED PROFILE — CLASSIFICATION UNAVAILABLE",
  "HISTORY INSUFFICIENT",
  "LEVERAGE UNSUPPORTED IN v1",
  "RONIC NOT MEANINGFUL",
  "NOT COMPUTABLE",
  "NO SOLUTION IN RANGE",
  "DEGENERATE — TERMINAL EXCEEDS TOTAL VALUE",
  "PRECONDITION FAILED",
  "NOT ACHIEVABLE AT ANY SCALE",
  "SEASONAL — RUN-RATE SUPPRESSED",
  "INCOMPLETE",
  "THIS SUCCESS IS WORTH LESS THAN FAILURE",
  "PRICE NOT JUSTIFIABLE BY THIS OUTCOME",
];

const NVDA_EV_CAUSE =
  "missing REQUIRED input(s): treasuryMethodDilution, financeLeaseLiabilities, nonOperatingEquityInvestmentsAtBook";

const MISSING_INPUTS_LEVERAGE: LeverageResult = {
  netDebtRatio: null,
  operatingLeaseInclusiveMemo: null,
  result: "LEVERAGE UNSUPPORTED IN v1",
  leveredResidualExceptionApplies: false,
};

const OVER_THRESHOLD_LEVERAGE: LeverageResult = {
  netDebtRatio: new Decimal("0.41"),
  operatingLeaseInclusiveMemo: null,
  result: "LEVERAGE UNSUPPORTED IN v1",
  leveredResidualExceptionApplies: false,
};

describe("plainReason — every suppressing state, in words a reader can act on", () => {
  it.each(ALL_STATES)("never repeats the raw state, a cause token or any forbidden Overview vocabulary — %s", (state) => {
    const line = notComputedLine(state, "missing REQUIRED input(s): fooBar (§7.1)", MISSING_INPUTS_LEVERAGE);
    expect(line).not.toContain(state);
    expect(overviewTextViolations(line)).toEqual([]);
    expect(line).toMatch(/^Not computed for this company yet — .+\.$/);
  });

  it("names NVDA's actual missing inputs in plain words (the live EV cause)", () => {
    expect(notComputedLine("INCOMPLETE", NVDA_EV_CAUSE)).toBe(
      "Not computed for this company yet — it needs share dilution from options and awards, finance-lease liabilities " +
        "and a decision on which of its investments are non-operating, which are not available for this company."
    );
  });

  it("de-duplicates inputs that share one plain name (the 52-week low and high)", () => {
    expect(missingInputsInPlainWords("missing REQUIRED input(s): fiftyTwoWeekLow, fiftyTwoWeekHigh")).toEqual([
      "a 52-week price history",
    ]);
  });

  it("reads a camelCase input it has no plain name for as words, and leaves prose inputs as prose", () => {
    expect(missingInputsInPlainWords("missing REQUIRED input(s): someNewInput")).toEqual(["some new input"]);
    expect(
      missingInputsInPlainWords("missing REQUIRED input: a price for this run — a price is never estimated")
    ).toEqual(["a price for this run"]);
  });

  it("tells missing leverage inputs apart from a ratio above the threshold", () => {
    expect(leverageUnavailableLine(MISSING_INPUTS_LEVERAGE)).toContain("are not all available");
    expect(leverageUnavailableLine(OVER_THRESHOLD_LEVERAGE)).toContain("above the level this version of the model can value");
    expect(plainReason("LEVERAGE UNSUPPORTED IN v1", "inputs missing — the ratio could not be computed, so the precondition fails closed")).toContain(
      "are not all available"
    );
  });

  it("states the range and the verdict in the same plain terms", () => {
    const range = {
      kind: "suppressed" as const,
      state: "LEVERAGE UNSUPPORTED IN v1" as const,
      cause: "inputs missing — the ratio could not be computed, so the precondition fails closed",
    };
    expect(fairValueRangeUnavailableLine(range, MISSING_INPUTS_LEVERAGE)).toMatch(/^No fair-value range for this company yet — /);
    expect(verdictUnavailableLine(range, MISSING_INPUTS_LEVERAGE)).toMatch(/^No valuation verdict for this company yet — /);
  });
});

describe("the fixed Overview lines carry no forbidden vocabulary", () => {
  it.each([
    CHANGE_TRIGGER_UNAVAILABLE_LINE,
    NO_UPCOMING_EVENTS_LINE,
    NO_INDUSTRY_CLASSIFICATION_LINE,
    OVERVIEW_CHALLENGER_NOTE,
    positionHiddenLine({ trustUnusable: true, profileNotConfirmed: false })!,
    positionHiddenLine({ trustUnusable: false, profileNotConfirmed: true })!,
  ])("%s", (line) => {
    expect(overviewTextViolations(line)).toEqual([]);
  });

  it("no position note where nothing hides the position", () => {
    expect(positionHiddenLine({ trustUnusable: false, profileNotConfirmed: false })).toBeNull();
  });
});

describe("overviewTextViolations — the ruling's forbidden list", () => {
  it.each([
    ["the check that would size that effect is INCOMPLETE", "INCOMPLETE"],
    ["Not yet available — no upcoming-events data source exists", "Not yet available"],
    ["the range reads LEVERAGE UNSUPPORTED IN v1", "UNSUPPORTED"],
    ["SEASONAL — RUN-RATE SUPPRESSED", "SUPPRESSED"],
    ["Gate 0 passed", "Gate 0 / Gate 1"],
    ["the M14 tornado", "M1–M16 module id"],
    ["Unavailable — see Evidence", '"see Evidence" placeholder'],
    ["PROFILE NOT CONFIRMED", "PROFILE NOT CONFIRMED"],
    ["TRUST STATUS UNUSABLE", "TRUST STATUS"],
    ["DEGENERATE — TERMINAL EXCEEDS TOTAL VALUE", "technical state code"],
    ["missing REQUIRED input(s): price", "raw REQUIRED-input cause"],
    ["bound to the earliest report section (§17.7.1)", "spec citation (§)"],
    ["Base $NaN", "debug artefact (NaN / [object Object])"],
  ])("flags %j as %s", (text, label) => {
    expect(overviewTextViolations(text).map((v) => v.label)).toContain(label);
  });

  it("leaves ordinary report copy alone — money with M/B/T suffixes, lower-case words, analytic flags", () => {
    const ordinary =
      "Market cap $3.72T · revenue $245.1B · capex $102M. The margin is flagged MARGIN AT HISTORICAL HIGH; " +
      "the shares are not suppressed or incomplete in any plain sense, and the fair-value range is shown.";
    expect(overviewTextViolations(ordinary)).toEqual([]);
  });
});
