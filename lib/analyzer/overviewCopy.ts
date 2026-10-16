import type { FairValueRange, LeverageResult, SuppressingState } from "./types";

// ---------------------------------------------------------------------------
// CF-ANALYZER-V1-SETTLE-01 — plain-English copy for the normal Overview
// (hero, Overview body, Key Stats rail) where a figure is genuinely not
// computed for this company.
//
// AUTHORITY. CALVIN RULING — REJECT CURRENT PRODUCT SURFACE; BUILD ONE SIMPLE
// COMPLETE RM-BRIEF PROOF (PR #399, comment 5952716764): the normal Overview
// contains none of INCOMPLETE / Not yet available / SUPPRESSED / UNSUPPORTED /
// Gate 0-1 / M1-M14 / technical state codes / "see Evidence" placeholders.
// Calvin's 7 Oct 2026 decision on #399 (Option 1): anything the engine cannot
// compute yet for NVDA or COST shows a one-line plain-English reason instead.
//
// WHAT THIS IS NOT. It computes nothing and changes no state. Every line here
// translates a state the analysis already produced (a SuppressedValue's state
// and cause, the leverage result) into words a reader can act on. The raw
// state and cause still reach the Evidence tab unchanged.
//
// ONE SOURCE. The Overview components render these functions' output, and
// the live-proof evaluator (lib/analyzer/acceptance/briefAcceptance.ts)
// checks the rendered Overview for exactly these lines — so "explained" in
// the acceptance check means the reader was actually shown this sentence.
// ---------------------------------------------------------------------------

/** Plain words for the REQUIRED inputs a suppressed figure's cause names. */
const INPUT_WORDS: Record<string, string> = {
  price: "a current share price",
  sharesOutstanding: "the share count",
  treasuryMethodDilution: "share dilution from options and awards",
  totalDebt: "total debt",
  financeLeaseLiabilities: "finance-lease liabilities",
  operatingLeaseLiabilities: "operating-lease liabilities",
  cashAndMarketableDebtSecurities: "cash and marketable securities",
  nonOperatingEquityInvestmentsAtBook: "a decision on which of its investments are non-operating",
  fiftyTwoWeekLow: "a 52-week price history",
  fiftyTwoWeekHigh: "a 52-week price history",
  epsTrailing: "trailing earnings per share",
  epsForward: "forward earnings per share",
  targetEnterpriseValue: "the company's enterprise value",
  currentEnterpriseValue: "the company's enterprise value",
  baseYearRevenue: "base-year revenue",
  currentMargin: "the current operating margin",
  medianMargin: "the median operating margin",
};

function words(token: string): string {
  const clean = token.replace(/\([^)]*§[^)]*\)/g, "").replace(/§\S*/g, "").trim();
  const known = INPUT_WORDS[clean];
  if (known !== undefined) return known;
  // A bare camelCase identifier ("baseYearRevenue") reads as words.
  if (/^[a-z][A-Za-z0-9]*$/.test(clean) && /[A-Z]/.test(clean)) {
    return clean
      .split(/(?=[A-Z])/)
      .map((w) => w.toLowerCase())
      .join(" ");
  }
  return clean.replace(/\s+/g, " ");
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * The inputs a cause of the form "missing REQUIRED input(s): a, b" names, in
 * plain words, de-duplicated. Empty for any other cause shape.
 */
export function missingInputsInPlainWords(cause: string): string[] {
  const match = /missing REQUIRED inputs?(?:\(s\))?:\s*([^—]+)/.exec(cause);
  if (match === null) return [];
  const listed = match[1]
    .split(",")
    .map((t) => words(t))
    .filter((t) => t.length > 0);
  return [...new Set(listed)];
}

/**
 * Why a figure is not computed, as a clause a reader can act on — never the
 * raw state code or the raw cause. `leverage` sharpens the one state whose
 * cause alone cannot say whether inputs were missing or the ratio was too high.
 */
export function plainReason(state: SuppressingState, cause: string, leverage?: LeverageResult): string {
  switch (state) {
    case "LEVERAGE UNSUPPORTED IN v1": {
      const inputsMissing =
        leverage !== undefined ? leverage.netDebtRatio === null : /inputs missing/.test(cause);
      if (inputsMissing) {
        return "the balance-sheet inputs needed to measure its debt load are not all available, and the valuation depends on that measure";
      }
      if (leverage !== undefined || /threshold/.test(cause)) {
        return "its debt load is above the level this version of the model can value";
      }
      return "the valuation depends on a debt-load measure that could not be completed for this company";
    }
    case "UNSUPPORTED PROFILE — ASSET-BASED ROW NOT VALIDATED IN v1":
      return "this version of the model does not value asset-based businesses such as banks and insurers";
    case "UNSUPPORTED PROFILE — CLASSIFICATION UNAVAILABLE":
      return "the company's industry classification could not be confirmed";
    case "HISTORY INSUFFICIENT":
      return "the company does not yet have enough years of filed history";
    case "RONIC NOT MEANINGFUL":
      return "returns on new capital are not meaningful for this company's recent history";
    case "NOT COMPUTABLE":
    case "NO SOLUTION IN RANGE":
    case "DEGENERATE — TERMINAL EXCEEDS TOTAL VALUE":
      return "the model has no meaningful answer for this company at these inputs";
    case "PRECONDITION FAILED":
      return "the conditions this measure needs do not hold for this company";
    case "NOT ACHIEVABLE AT ANY SCALE":
      return "the unit economics do not break even at any scale";
    case "SEASONAL — RUN-RATE SUPPRESSED":
      return "the business is too seasonal for a run-rate figure";
    case "THIS SUCCESS IS WORTH LESS THAN FAILURE":
    case "PRICE NOT JUSTIFIABLE BY THIS OUTCOME":
      return "the success scenario does not justify today's price";
    case "INCOMPLETE": {
      if (/enterprise value is INCOMPLETE/.test(cause)) {
        return "it depends on the company's enterprise value, which is not computed yet";
      }
      if (/leverage precondition/.test(cause)) {
        return "the valuation depends on a debt-load measure that could not be completed for this company";
      }
      const missing = missingInputsInPlainWords(cause);
      if (missing.length > 0) {
        return `it needs ${joinList(missing)}, which ${missing.length === 1 ? "is" : "are"} not available for this company`;
      }
      return "an input it needs is not available for this company";
    }
  }
}

/** "Not computed for this company yet — <reason>." — one line, for a slot or a Key Stats cell. */
export function notComputedLine(state: SuppressingState, cause: string, leverage?: LeverageResult): string {
  return `Not computed for this company yet — ${plainReason(state, cause, leverage)}.`;
}

/** The leverage metric's own line when it is not PASS with a ratio. */
export function leverageUnavailableLine(leverage: LeverageResult): string {
  return notComputedLine("LEVERAGE UNSUPPORTED IN v1", "", leverage);
}

type SuppressedRange = Extract<FairValueRange, { kind: "suppressed" }>;

/** The hero's scenario strip, where no fair-value range exists. */
export function fairValueRangeUnavailableLine(range: SuppressedRange, leverage?: LeverageResult): string {
  return `No fair-value range for this company yet — ${plainReason(range.state, range.cause, leverage)}.`;
}

/** The hero's bottom line, where no fair-value range (and so no verdict) exists. */
export function verdictUnavailableLine(range: SuppressedRange, leverage?: LeverageResult): string {
  return `No valuation verdict for this company yet — ${plainReason(range.state, range.cause, leverage)}.`;
}

/**
 * Where a range exists but §10.6.3 keeps the price's position in it hidden —
 * the same two conditions the hero already gates on, said in words.
 */
export function positionHiddenLine({
  trustUnusable,
  profileNotConfirmed,
}: {
  trustUnusable: boolean;
  profileNotConfirmed: boolean;
}): string | null {
  if (trustUnusable) {
    return "Where today's price sits in this range is not shown — this run's data is not reliable enough to place it.";
  }
  if (profileNotConfirmed) {
    return "Where today's price sits in this range is not shown until the company's financial profile is confirmed.";
  }
  return null;
}

/**
 * Overview slot 11's fallback where no analyst-supplied sensitivity range
 * exists — CALVIN RULING — A (PR #399, comment 5946448076) fixed this
 * sentence verbatim.
 */
export const CHANGE_TRIGGER_UNAVAILABLE_LINE = "No computed change trigger available yet.";

/** Key Stats rail — Upcoming Events. No upcoming-events source exists in this build. */
export const NO_UPCOMING_EVENTS_LINE = "No upcoming events are tracked for this company yet.";

/** Key Stats rail — Market Context, where the SEC classification lookup returned nothing. */
export const NO_INDUSTRY_CLASSIFICATION_LINE = "No SEC industry classification was found for this company.";

// ---------------------------------------------------------------------------
// What the normal Overview must never show — the ruling's own list (comment
// 5952716764: INCOMPLETE, Not yet available, SUPPRESSED, UNSUPPORTED,
// Gate 0 / Gate 1, M1–M14, technical state codes, "see Evidence"
// placeholders), plus a raw REQUIRED-input cause, a spec citation, and debug
// artefacts. One list, read by the live-proof evaluator (the rendered
// Overview) and by the interpretation call's page-one check (the four AI
// sentences the Overview quotes), so the two cannot disagree.
//
// Not listed, deliberately: provenance marks and §9.4 analytic flags
// ("MARGIN AT HISTORICAL HIGH"). The methodology requires a value's
// qualifications to travel with it on every surface (§3.3/§5.2); the ruling
// names neither.
// ---------------------------------------------------------------------------

export const OVERVIEW_FORBIDDEN_TEXT: readonly { label: string; pattern: RegExp }[] = [
  { label: "INCOMPLETE", pattern: /INCOMPLETE/ },
  { label: "Not yet available", pattern: /not yet available/i },
  { label: "SUPPRESSED", pattern: /SUPPRESSED/ },
  { label: "UNSUPPORTED", pattern: /UNSUPPORTED/ },
  { label: "Gate 0 / Gate 1", pattern: /\bGate [01]\b/i },
  { label: "M1–M16 module id", pattern: /\bM(?:1[0-6]|[1-9])\b/ },
  { label: "\"see Evidence\" placeholder", pattern: /see Evidence/i },
  { label: "PROFILE NOT CONFIRMED", pattern: /PROFILE NOT CONFIRMED/ },
  { label: "TRUST STATUS", pattern: /TRUST STATUS/ },
  {
    label: "technical state code",
    pattern:
      /PRECONDITION FAILED|NOT COMPUTABLE|NO SOLUTION IN RANGE|DEGENERATE|HISTORY INSUFFICIENT|RONIC NOT MEANINGFUL|NOT ACHIEVABLE AT ANY SCALE|THIS SUCCESS IS WORTH LESS THAN FAILURE|PRICE NOT JUSTIFIABLE BY THIS OUTCOME/,
  },
  { label: "raw REQUIRED-input cause", pattern: /REQUIRED input/ },
  { label: "spec citation (§)", pattern: /§/ },
  { label: "debug artefact (NaN / [object Object])", pattern: /\bNaN\b|\[object Object\]/ },
];

export interface OverviewTextViolation {
  label: string;
  /** The offending text with a little surrounding context. */
  context: string;
}

/** Every forbidden pattern present in `text` (one entry per pattern, first occurrence). */
export function overviewTextViolations(text: string): OverviewTextViolation[] {
  const violations: OverviewTextViolation[] = [];
  for (const { label, pattern } of OVERVIEW_FORBIDDEN_TEXT) {
    const match = pattern.exec(text);
    if (match === null) continue;
    const start = Math.max(0, match.index - 60);
    const end = Math.min(text.length, match.index + match[0].length + 60);
    violations.push({ label, context: text.slice(start, end).replace(/\s+/g, " ").trim() });
  }
  return violations;
}

/**
 * The Overview's own note beside a surfaced challenger point — the same
 * fixed selection rule Section I's note states (§17.7.1), in plain words.
 */
export const OVERVIEW_CHALLENGER_NOTE =
  "Shown by a fixed rule — the objection tied to the earliest part of the report, not the most severe. Cal Finance does not rank objections; all of them are on the Risks & Thesis tab.";
