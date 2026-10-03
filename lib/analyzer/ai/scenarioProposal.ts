import Decimal from "decimal.js";
import type { ScenarioDriverSet } from "../types";
import { callWithOneRegeneration, MalformedAnalystResponseError, type AnalystCall } from "./analystCall";

// ---------------------------------------------------------------------------
// CF-ANALYZER-V1-SETTLE-01's CALVIN RULING — REJECT CURRENT PRODUCT SURFACE;
// BUILD ONE SIMPLE COMPLETE RM-BRIEF PROOF (issue #399), "AI — MAXIMUM TWO
// PURPOSEFUL CALLS", item 1: "AI may propose initial Bear/Base/Bull scenario
// drivers from sourced facts/anchors; existing explicit overrides win."
//
// This is a genuinely new kind of call in this codebase. interpretation.ts
// and challenger.ts are forbidden from emitting a single numeral — every
// figure they write is a citation of a value deterministic code already
// computed (§10.7 rule 3). This call's whole purpose is the opposite: for a
// ticker with no analyst-authored bundle (analystInputs.ts's own resolver
// returns null), it is the ONLY source Step 7's three driver numbers can
// come from at all, so refusing to let it emit a decimal would make the
// ruling's own item 1 impossible to satisfy.
//
// What stays unchanged, because the ruling says so explicitly: this call
// proposes DRIVERS only (growth, margin, capital intensity, share count, a
// written anchor) — never a dollar scenario value, never the discount rate,
// never the NOPAT tax rate or any other §7.1 policy constant, and never a
// company whose own analyst-recorded bundle already exists (analystInputsFor
// is still the one resolver; this is consulted only where it returns null).
// computeScenarioEnterpriseValue (modules/scenarioOutputs.ts) remains the
// one, unmodified, deterministic model that turns a driver set into a value
// — this file never computes one.
//
// Bounded like every other fact-grounded call here: the model may cite ONLY
// the sourced facts it is given (never memory), and every driver it proposes
// is checked against a plausibility band and an internal bear <= base <= bull
// ordering before acceptance — not a finance judgment of its own, just the
// same "a defect is refused whole, not patched" discipline analystCall.ts's
// callWithOneRegeneration already applies to the other two calls.
//
// CF-ANALYZER-V1-SETTLE-01's CALVIN RULING — A (issue #399, 3 Oct 2026):
// answering the open gate this file's own header used to leave as "left as a
// named, closed question" (nopatTaxRate is one of §7.1's four UNDEFINED
// POLICY CONSTANTS, and §7.1 forbids a module defaulting one), this same call
// also proposes the run's nopatTaxRate and stressMarginLevel — grounded,
// never invented: nopatTaxRate cites the one tax reference actually supplied
// (the general, non-company-specific US federal statutory corporate rate —
// never this company's own effective rate, which no tag acquires), and
// stressMarginLevel cites this company's own already-supplied current/median
// operating margin. Both still an AI PROPOSAL, not a policy ruling: an
// explicit analyst-authored bundle (MSFT, NVDA) still overrides them
// entirely, exactly as it already overrides the three scenario driver sets.
// ---------------------------------------------------------------------------

// The one tax reference this call is allowed to cite for nopatTaxRate: a
// general statutory rate, not a claim about this specific company's own
// filing (no tag in tagMap.ts acquires a company's effective tax rate —
// adding one is a tag-mapping change, which is Command Center's to approve,
// not BUILD's to take unilaterally). Supplied as data in the prompt, exactly
// like every other citable fact below, rather than left for the model to
// recall from memory.
const US_FEDERAL_STATUTORY_CORPORATE_TAX_RATE = new Decimal("0.21");

export interface ScenarioProposalFacts {
  ticker: string;
  companyName: string;
  /** Item 1 narrative excerpt, or null where none was acquired. */
  businessNarrative: string | null;
  sicDescription: string | null;
  currentRevenue: Decimal | null;
  /** Achieved historical revenue CAGR, where computable. Never invented. */
  historicalRevenueCagr: Decimal | null;
  currentOperatingMargin: Decimal | null;
  medianOperatingMargin: Decimal | null;
}

export interface ScenarioProposalResult {
  bear: ScenarioDriverSet;
  base: ScenarioDriverSet;
  bull: ScenarioDriverSet;
  /** §7.1's NOPAT tax rate — AI-proposed, never an analyst ruling. */
  nopatTaxRate: Decimal;
  /** §7.1's stress margin level — AI-proposed, never an analyst ruling. */
  stressMarginLevel: Decimal;
  /** Required citation for both constants above. */
  policyConstantsAnchor: string;
}

const SYSTEM_PROMPT = `You are the scenario-drivers layer of the Calboard Stock Analyzer, for a company with no analyst-authored scenario bundle yet.

Deterministic software will take the three driver sets you propose and run them, unchanged, through its own existing forward-valuation model. You do not value the company and you do not decide anything else about it — you propose one bear, one base and one bull set of five drivers each, grounded in the facts you are given.

HARD LIMITS.

1. You may cite facts ONLY from the data supplied below, never from memory. If you want to justify a driver with a comparison the supplied data does not contain, do not make that comparison.
2. You do not compute a valuation, a fair value, a price target or any dollar figure. You propose drivers; deterministic code does every calculation.
3. Bear must be the most conservative case and bull the most optimistic: bear's growth and margin must each be less than or equal to base's, and base's less than or equal to bull's. This is an ordering requirement, not a finance judgment — express whatever view of the company you hold through where within that order each case sits.
4. Every driver must be plausible for a mainstream operating company: revenue growth between -50% and 100% per year, operating margin between -100% and 90%, reinvestment capital intensity between -50% and 100% of revenue, share count between 0.5x and 3x the current share count (1.0x means no change — use 1.0 unless you have a specific, cited reason to expect dilution or buybacks).
5. The written anchor for each scenario is required, free text, and must cite which supplied fact(s) it rests on. "Reflects base-rate deceleration from the company's own achieved revenue growth" is a citation; "reflects typical industry dynamics" is not, because nothing supplied said what is typical for the industry.

You propose a constant annual rate for revenueGrowthOrPath — never a year-by-year path.

ONE MORE THING YOU PROPOSE: this run's NOPAT tax rate and stress margin level — two policy inputs the deterministic model needs and no analyst has set for this company.

6. nopatTaxRate must be between 0% and 50%. Cite the supplied general US federal statutory corporate tax rate where you have no company-specific tax disclosure to cite instead — that reference is supplied below for exactly this reason, and citing it is not citing memory.
7. stressMarginLevel is a downside operating margin, not one of the three scenario margins above. Cite the supplied current and/or median operating margin; it must not exceed either one (it is the stress case, not the current or typical case).
8. One written anchor, required, covers both of these two constants together — it is not one of the three scenario anchors above.`;

const DRIVER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["revenueGrowthOrPath", "operatingMargin", "reinvestmentCapitalIntensity", "shareCount", "writtenAnchor"],
  properties: {
    // Decimals travel as strings end to end in this call, exactly like the
    // migration seeds in migrations/008_nvda_recorded_bundle_seed.sql do —
    // never a JSON number, which cannot carry an exact decimal.
    revenueGrowthOrPath: { type: "string", description: "Constant annual growth rate, e.g. \"0.08\" for 8%." },
    operatingMargin: { type: "string", description: "Operating margin as a decimal fraction, e.g. \"0.25\"." },
    reinvestmentCapitalIntensity: { type: "string", description: "Reinvestment as a fraction of revenue." },
    shareCount: { type: "string", description: "Multiple of the current share count, e.g. \"1.0\"." },
    writtenAnchor: { type: "string", description: "Required citation of the supplied facts this rests on." },
  },
} as const;

const POLICY_CONSTANTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["nopatTaxRate", "stressMarginLevel", "writtenAnchor"],
  properties: {
    nopatTaxRate: { type: "string", description: "NOPAT tax rate as a decimal fraction, e.g. \"0.21\"." },
    stressMarginLevel: { type: "string", description: "Downside stress operating margin as a decimal fraction." },
    writtenAnchor: { type: "string", description: "Required citation covering both constants above." },
  },
} as const;

const RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["bear", "base", "bull", "policyConstants"],
  properties: {
    bear: DRIVER_SCHEMA,
    base: DRIVER_SCHEMA,
    bull: DRIVER_SCHEMA,
    policyConstants: POLICY_CONSTANTS_SCHEMA,
  },
};

function fmt(label: string, value: Decimal | null, pct = true): string {
  if (value === null) return `  ${label}: not available — do not cite this`;
  return `  ${label}: ${pct ? `${value.mul(100).toFixed(1)}%` : value.toFixed(2)}`;
}

function buildUserMessage(facts: ScenarioProposalFacts): string {
  return `COMPANY
  ${facts.companyName} (${facts.ticker})
  Industry (SIC description): ${facts.sicDescription ?? "not available — do not cite this"}

BUSINESS DESCRIPTION (from the company's own most recent annual filing, or absent)
  ${facts.businessNarrative ?? "not available — do not cite this"}

SOURCED FACTS — the complete set you may cite. Nothing else exists for the purposes of a citation.
${fmt("Current revenue", facts.currentRevenue, false)}
${fmt("Historical achieved revenue CAGR", facts.historicalRevenueCagr)}
${fmt("Current operating margin", facts.currentOperatingMargin)}
${fmt("Median operating margin (historical window)", facts.medianOperatingMargin)}
  US federal statutory corporate income tax rate: ${US_FEDERAL_STATUTORY_CORPORATE_TAX_RATE.mul(100).toFixed(1)}% — a general reference rate, not a disclosure from this company's own filing; cite it only for nopatTaxRate, and only where you have no company-specific tax disclosure to cite instead (none is supplied above).

Propose bear, base and bull driver sets, and the policy constants, now.`;
}

interface RawDriver {
  revenueGrowthOrPath: string;
  operatingMargin: string;
  reinvestmentCapitalIntensity: string;
  shareCount: string;
  writtenAnchor: string;
}

interface RawPolicyConstants {
  nopatTaxRate: string;
  stressMarginLevel: string;
  writtenAnchor: string;
}

interface RawResponse {
  bear: RawDriver;
  base: RawDriver;
  bull: RawDriver;
  policyConstants: RawPolicyConstants;
}

function readResponse(raw: unknown): RawResponse {
  const value = raw as Partial<RawResponse> | null;
  for (const key of ["bear", "base", "bull"] as const) {
    const driver = value?.[key] as Partial<RawDriver> | undefined;
    if (
      driver === undefined ||
      typeof driver !== "object" ||
      typeof driver.revenueGrowthOrPath !== "string" ||
      typeof driver.operatingMargin !== "string" ||
      typeof driver.reinvestmentCapitalIntensity !== "string" ||
      typeof driver.shareCount !== "string" ||
      typeof driver.writtenAnchor !== "string"
    ) {
      throw new MalformedAnalystResponseError("scenarioProposal", `"${key}" is missing one of its five drivers`);
    }
  }

  const policyConstants = value?.policyConstants as Partial<RawPolicyConstants> | undefined;
  if (
    policyConstants === undefined ||
    typeof policyConstants !== "object" ||
    typeof policyConstants.nopatTaxRate !== "string" ||
    typeof policyConstants.stressMarginLevel !== "string" ||
    typeof policyConstants.writtenAnchor !== "string"
  ) {
    throw new MalformedAnalystResponseError("scenarioProposal", `"policyConstants" is missing one of its three fields`);
  }

  return value as RawResponse;
}

function decimalOf(label: string, raw: string): Decimal {
  let value: Decimal;
  try {
    value = new Decimal(raw);
  } catch {
    throw new MalformedAnalystResponseError("scenarioProposal", `${label} is not a finite decimal: "${raw}"`);
  }
  if (!value.isFinite()) {
    throw new MalformedAnalystResponseError("scenarioProposal", `${label} is not a finite decimal: "${raw}"`);
  }
  return value;
}

const GROWTH_BAND = { lo: new Decimal("-0.5"), hi: new Decimal("1.0") };
const MARGIN_BAND = { lo: new Decimal("-1.0"), hi: new Decimal("0.9") };
const INTENSITY_BAND = { lo: new Decimal("-0.5"), hi: new Decimal("1.0") };
const SHARE_COUNT_BAND = { lo: new Decimal("0.5"), hi: new Decimal("3.0") };
const TAX_RATE_BAND = { lo: new Decimal("0"), hi: new Decimal("0.5") };

function requireInBand(label: string, value: Decimal, band: { lo: Decimal; hi: Decimal }): void {
  if (value.lessThan(band.lo) || value.greaterThan(band.hi)) {
    throw new MalformedAnalystResponseError(
      "scenarioProposal",
      `${label} = ${value.toFixed(4)} is outside the plausible band [${band.lo}, ${band.hi}]`
    );
  }
}

interface Driver {
  revenueGrowthOrPath: Decimal;
  operatingMargin: Decimal;
  reinvestmentCapitalIntensity: Decimal;
  shareCount: Decimal;
  writtenAnchor: string;
}

function toDriver(scenario: "bear" | "base" | "bull", raw: RawDriver): Driver {
  const revenueGrowthOrPath = decimalOf(`${scenario}.revenueGrowthOrPath`, raw.revenueGrowthOrPath);
  const operatingMargin = decimalOf(`${scenario}.operatingMargin`, raw.operatingMargin);
  const reinvestmentCapitalIntensity = decimalOf(
    `${scenario}.reinvestmentCapitalIntensity`,
    raw.reinvestmentCapitalIntensity
  );
  const shareCount = decimalOf(`${scenario}.shareCount`, raw.shareCount);

  requireInBand(`${scenario}.revenueGrowthOrPath`, revenueGrowthOrPath, GROWTH_BAND);
  requireInBand(`${scenario}.operatingMargin`, operatingMargin, MARGIN_BAND);
  requireInBand(`${scenario}.reinvestmentCapitalIntensity`, reinvestmentCapitalIntensity, INTENSITY_BAND);
  requireInBand(`${scenario}.shareCount`, shareCount, SHARE_COUNT_BAND);

  if (raw.writtenAnchor.trim() === "") {
    throw new MalformedAnalystResponseError("scenarioProposal", `${scenario}.writtenAnchor is empty`);
  }

  return { revenueGrowthOrPath, operatingMargin, reinvestmentCapitalIntensity, shareCount, writtenAnchor: raw.writtenAnchor };
}

function requireOrdered(label: string, bear: Decimal, base: Decimal, bull: Decimal): void {
  if (bear.greaterThan(base) || base.greaterThan(bull)) {
    throw new MalformedAnalystResponseError(
      "scenarioProposal",
      `${label} is not ordered bear <= base <= bull (${bear}, ${base}, ${bull})`
    );
  }
}

interface PolicyConstants {
  nopatTaxRate: Decimal;
  stressMarginLevel: Decimal;
  writtenAnchor: string;
}

function toPolicyConstants(raw: RawPolicyConstants, facts: ScenarioProposalFacts): PolicyConstants {
  const nopatTaxRate = decimalOf("policyConstants.nopatTaxRate", raw.nopatTaxRate);
  const stressMarginLevel = decimalOf("policyConstants.stressMarginLevel", raw.stressMarginLevel);

  requireInBand("policyConstants.nopatTaxRate", nopatTaxRate, TAX_RATE_BAND);
  requireInBand("policyConstants.stressMarginLevel", stressMarginLevel, MARGIN_BAND);

  // The stress case must not exceed either already-supplied margin fact —
  // enforced here rather than trusted from the prompt, the same discipline
  // rule 3's ordering already gets for the three scenarios.
  for (const [label, margin] of [
    ["current operating margin", facts.currentOperatingMargin],
    ["median operating margin", facts.medianOperatingMargin],
  ] as const) {
    if (margin !== null && stressMarginLevel.greaterThan(margin)) {
      throw new MalformedAnalystResponseError(
        "scenarioProposal",
        `policyConstants.stressMarginLevel = ${stressMarginLevel.toFixed(4)} exceeds the supplied ${label} (${margin.toFixed(4)})`
      );
    }
  }

  if (raw.writtenAnchor.trim() === "") {
    throw new MalformedAnalystResponseError("scenarioProposal", "policyConstants.writtenAnchor is empty");
  }

  return { nopatTaxRate, stressMarginLevel, writtenAnchor: raw.writtenAnchor };
}

function interpretResponse(raw: unknown, facts: ScenarioProposalFacts): ScenarioProposalResult {
  const response = readResponse(raw);

  const bear = toDriver("bear", response.bear);
  const base = toDriver("base", response.base);
  const bull = toDriver("bull", response.bull);

  // Rule 3's ordering, enforced here rather than trusted from the prompt —
  // the schema cannot express a cross-field constraint, so this is the one
  // place it is actually checked.
  requireOrdered("growth", bear.revenueGrowthOrPath, base.revenueGrowthOrPath, bull.revenueGrowthOrPath);
  requireOrdered("operating margin", bear.operatingMargin, base.operatingMargin, bull.operatingMargin);

  const policyConstants = toPolicyConstants(response.policyConstants, facts);

  return {
    bear,
    base,
    bull,
    nopatTaxRate: policyConstants.nopatTaxRate,
    stressMarginLevel: policyConstants.stressMarginLevel,
    policyConstantsAnchor: policyConstants.writtenAnchor,
  };
}

export async function runScenarioProposal(
  facts: ScenarioProposalFacts,
  call: AnalystCall
): Promise<ScenarioProposalResult> {
  return callWithOneRegeneration(
    call,
    {
      label: "scenarioProposal",
      system: SYSTEM_PROMPT,
      user: buildUserMessage(facts),
      responseSchema: RESPONSE_SCHEMA,
    },
    (raw) => interpretResponse(raw, facts)
  );
}
