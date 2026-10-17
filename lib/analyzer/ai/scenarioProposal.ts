import Decimal from "decimal.js";
import type { MoatClass } from "../types";
import { POLICY } from "../policy";
import { callWithOneRegeneration, MalformedAnalystResponseError, type AnalystCall } from "./analystCall";
import type { DriverAnchor, DriverKey, ScenarioKey, SheetSource } from "../sheets/sheet";
import { SCENARIO_KEYS } from "../sheets/sheet";

// ---------------------------------------------------------------------------
// CF-AR6-ANY-TICKER-DRAFTS-01 — the price-blind drafting call (product-
// decisions item 30, D5; frozen spec §14.9 AR0-6 and Reading AR0-c; issue
// #454 DO 2).
//
// For a ticker with no assumption sheet, this call drafts one: bear, base and
// bull drivers — revenue growth, operating margin, return on new investment,
// reinvestment share and share count — the moat class, and the NOPAT tax
// rate and stress margin. Every driver carries its own anchor: the reasoning
// and the ids of the supplied sources it rests on. The draft is not adopted:
// the report and valuation are computed from it, and the final verdict waits
// for Calvin to adopt it (adoption is his authorship, item 19).
//
// What it may NOT do, and how each limit is held:
//   - see the price. `DraftFacts` has no price field; the research pack it is
//     built from never reads one (sheets/research.ts). The reverse DCF and
//     every market-implied figure are never computed for a draft.
//   - cite anything not supplied. Every anchor's ids must name a supplied
//     source (`interpretResponse` refuses otherwise), and the validators
//     (sheets/validators.ts) refuse an anchor that leans on a price.
//   - value the company, set the discount rate or any policy constant beyond
//     the two it proposes, or argue a verdict (§8.3 limits 1–3, Reading
//     AR0-c). Deterministic code values the sheet.
//
// A response that fails any check is refused whole and asked again once
// (analystCall.ts callWithOneRegeneration). A second failure leaves the
// ticker with no draft, which says so; nothing is patched.
// ---------------------------------------------------------------------------

/** The general statutory reference the NOPAT tax rate may cite where the company discloses none. */
export const US_FEDERAL_STATUTORY_CORPORATE_TAX_RATE = new Decimal("0.21");

/** Everything the drafting call is given. Deliberately carries no price. */
export interface DraftFacts {
  ticker: string;
  companyName: string;
  sicDescription: string | null;
  /** The research pack's sources — history series and filing text. */
  sources: SheetSource[];
  /** The D1 rate the sheet will be valued at, and why — policy, not market data. */
  rate: Decimal;
  rateBasis: string;
  currentOperatingMargin: Decimal | null;
  medianOperatingMargin: Decimal | null;
}

export interface DraftDriver {
  value: Decimal;
  anchor: DriverAnchor;
}

export interface DraftScenario {
  story: string;
  revenueGrowthOrPath: DraftDriver;
  operatingMargin: DraftDriver;
  returnOnNewInvestment: DraftDriver;
  reinvestmentCapitalIntensity: DraftDriver;
  /** A multiple of the current diluted share count (1.0 = unchanged). */
  shareCount: DraftDriver;
}

export interface DraftProposal {
  scenarios: Record<ScenarioKey, DraftScenario>;
  moatClass: MoatClass;
  moatAnchor: DriverAnchor;
  nopatTaxRate: Decimal;
  stressMarginLevel: Decimal;
  constantsAnchor: DriverAnchor;
}

function pct(v: Decimal): string {
  return `${v.mul(100).toFixed(1)}%`;
}

const SYSTEM_PROMPT = `You are the assumption-sheet drafter of the Cal Finance Stock Analyzer.

You draft the three scenarios — bear, base and bull — for one company, from the research you are given. Deterministic software values the sheet; a human adopts it (optionally adjusting drivers) before any final verdict. You do not value the company, you do not see or ask for its share price, and you do not argue toward any verdict.

HARD LIMITS.

1. Cite ONLY the supplied sources, by their ids (for example "H:revenue", "H:returns", "F1", "E1"). Never cite memory. Every driver needs an anchor: one or two sentences of reasoning plus the ids it rests on. An anchor that cites nothing, or cites an id that was not supplied, is refused.
2. Never take a driver from the share price, the market value, a valuation multiple, a market-implied growth rate or a reverse DCF — none is supplied, and an anchor that mentions one is refused.
3. Bear is the most conservative case and bull the most optimistic: revenue growth, operating margin and return on new investment are each ordered bear <= base <= bull.
4. Ground each driver in the company's own filed history, widened only where a cited source gives a reason: revenue growth within the history's single-year range (H:revenue) plus or minus ten points; operating margin within the filed range (H:margin), ten points below to five points above; return on new investment no more than 1.5 times the best filed return (H:returns). Use the latest quarter (H:quarter) and the earnings releases (E…) for where the business is now — guidance and backlog belong in the anchor that uses them.
5. Return on new investment is the after-tax return on each new dollar invested (Methodology v2.1 D2: reinvestment = NOPAT × growth ÷ return on new investment). It fades by year 10 to the terminal return: the discount rate plus the moat credit (none +0, narrow +1, wide +3 points; bear +0; bull = base +1.5 points). The base and bull returns must be at or above their own terminal return; the bear may fall below the rate.
6. The moat class (none, narrow or wide) needs its mechanism named — switching costs, network effects, cost advantage, intangible assets or efficient scale — and cited. Credit a moat only where the filed returns (H:returns) support it; a perpetual terminal return above any return the company has filed is refused.
7. Revenue growth is one constant annual rate for years 1–5 (software fades it to terminal growth). Reinvestment share is net investment as a share of revenue, anchored to capital expenditure and depreciation (H:capex). Share count is a multiple of today's diluted count (1.0 = unchanged; cite buybacks or dilution if you move it).
8. The NOPAT tax rate cites a company tax disclosure where one is supplied, else the supplied general statutory rate. The stress margin is a downside operating margin no higher than the current or median margin.

Write plainly. Numbers are decimal text ("0.08" for 8%).`;

const DRIVER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["value", "anchor", "cites"],
  properties: {
    value: { type: "string", description: "Decimal text, e.g. \"0.08\"." },
    anchor: { type: "string", description: "Why this value — one or two sentences." },
    cites: { type: "array", items: { type: "string" }, description: "Supplied source ids this rests on." },
  },
} as const;

const SCENARIO_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["story", "revenueGrowth", "operatingMargin", "returnOnNewInvestment", "reinvestmentShare", "shareCountMultiple"],
  properties: {
    story: { type: "string", description: "The scenario in one short paragraph." },
    revenueGrowth: DRIVER_SCHEMA,
    operatingMargin: DRIVER_SCHEMA,
    returnOnNewInvestment: DRIVER_SCHEMA,
    reinvestmentShare: DRIVER_SCHEMA,
    shareCountMultiple: DRIVER_SCHEMA,
  },
} as const;

const RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["bear", "base", "bull", "moat", "policyConstants"],
  properties: {
    bear: SCENARIO_SCHEMA,
    base: SCENARIO_SCHEMA,
    bull: SCENARIO_SCHEMA,
    moat: {
      type: "object",
      additionalProperties: false,
      required: ["class", "mechanism", "cites"],
      properties: {
        class: { type: "string", enum: ["none", "narrow", "wide"] },
        mechanism: { type: "string" },
        cites: { type: "array", items: { type: "string" } },
      },
    },
    policyConstants: {
      type: "object",
      additionalProperties: false,
      required: ["nopatTaxRate", "stressMarginLevel", "anchor", "cites"],
      properties: {
        nopatTaxRate: { type: "string" },
        stressMarginLevel: { type: "string" },
        anchor: { type: "string" },
        cites: { type: "array", items: { type: "string" } },
      },
    },
  },
};

/** The user message — the whole of what the model sees. No price, by construction. */
export function buildDraftMessage(facts: DraftFacts): string {
  const sources = facts.sources.map((s) => `[${s.id}] ${s.label}${s.accession ? ` (accession ${s.accession})` : ""}\n${s.excerpt}`).join("\n\n");
  return `COMPANY
  ${facts.companyName} (${facts.ticker})
  Industry (SEC SIC description): ${facts.sicDescription ?? "not available"}

POLICY (fixed inputs, not company data)
  Discount rate in use: ${pct(facts.rate)} — ${facts.rateBasis}
  Terminal growth: ${pct(POLICY.terminalGrowth)}
  Moat credit on the terminal return: none +${pct(POLICY.moatCredit.none)}, narrow +${pct(POLICY.moatCredit.narrow)}, wide +${pct(POLICY.moatCredit.wide)}; bull adds ${pct(POLICY.bullMoatCreditUplift)}
  General US federal statutory corporate income tax rate: ${pct(US_FEDERAL_STATUTORY_CORPORATE_TAX_RATE)} (cite as "STATUTORY")
  Current operating margin: ${facts.currentOperatingMargin === null ? "not available" : pct(facts.currentOperatingMargin)}; median: ${facts.medianOperatingMargin === null ? "not available" : pct(facts.medianOperatingMargin)} (both from H:margin)

SOURCES — the complete set you may cite.

${sources}

Draft the bear, base and bull scenarios, the moat class and the two policy constants now.`;
}

interface RawDriver {
  value: string;
  anchor: string;
  cites: string[];
}

interface RawScenario {
  story: string;
  revenueGrowth: RawDriver;
  operatingMargin: RawDriver;
  returnOnNewInvestment: RawDriver;
  reinvestmentShare: RawDriver;
  shareCountMultiple: RawDriver;
}

const RAW_TO_DRIVER: Record<Exclude<keyof RawScenario, "story">, DriverKey> = {
  revenueGrowth: "revenueGrowthOrPath",
  operatingMargin: "operatingMargin",
  returnOnNewInvestment: "returnOnNewInvestment",
  reinvestmentShare: "reinvestmentCapitalIntensity",
  shareCountMultiple: "shareCount",
};

const BANDS: Record<DriverKey, { lo: Decimal; hi: Decimal }> = {
  revenueGrowthOrPath: { lo: new Decimal("-0.5"), hi: new Decimal("1.0") },
  operatingMargin: { lo: new Decimal("-1.0"), hi: new Decimal("0.9") },
  returnOnNewInvestment: { lo: new Decimal("0.001"), hi: new Decimal("2.0") },
  reinvestmentCapitalIntensity: { lo: new Decimal("-0.5"), hi: new Decimal("1.0") },
  shareCount: { lo: new Decimal("0.5"), hi: new Decimal("3.0") },
};
const TAX_RATE_BAND = { lo: new Decimal("0"), hi: new Decimal("0.5") };

function refuse(detail: string): never {
  throw new MalformedAnalystResponseError("scenarioProposal", detail);
}

function decimalOf(label: string, raw: unknown): Decimal {
  if (typeof raw !== "string") refuse(`${label} is not decimal text`);
  let value: Decimal;
  try {
    value = new Decimal((raw as string).trim());
  } catch {
    refuse(`${label} is not a finite decimal: "${String(raw)}"`);
  }
  if (!value!.isFinite()) refuse(`${label} is not a finite decimal: "${String(raw)}"`);
  return value!;
}

function anchorOf(label: string, text: unknown, cites: unknown, known: Set<string>): DriverAnchor {
  if (typeof text !== "string" || text.trim() === "") refuse(`${label} has no anchor`);
  if (!Array.isArray(cites) || cites.length === 0 || cites.some((c) => typeof c !== "string")) refuse(`${label} cites no source`);
  const unknown = (cites as string[]).filter((c) => !known.has(c));
  if (unknown.length > 0) refuse(`${label} cites ${unknown.join(", ")}, which no supplied source carries`);
  return { text: (text as string).trim(), cites: [...new Set(cites as string[])] };
}

export function interpretDraft(raw: unknown, facts: DraftFacts): DraftProposal {
  const value = raw as Record<string, unknown> | null;
  if (value === null || typeof value !== "object") refuse("the response is not an object");
  const known = new Set([...facts.sources.map((s) => s.id), "STATUTORY"]);

  const scenarios = {} as Record<ScenarioKey, DraftScenario>;
  for (const key of SCENARIO_KEYS) {
    const s = value![key] as Partial<RawScenario> | undefined;
    if (s === undefined || typeof s !== "object" || typeof s.story !== "string" || s.story.trim() === "") refuse(`"${key}" is missing or has no story`);
    const out: Partial<DraftScenario> = { story: s!.story!.trim() };
    for (const [rawKey, driverKey] of Object.entries(RAW_TO_DRIVER) as [Exclude<keyof RawScenario, "story">, DriverKey][]) {
      const d = s![rawKey] as Partial<RawDriver> | undefined;
      if (d === undefined || typeof d !== "object") refuse(`${key}.${rawKey} is missing`);
      const v = decimalOf(`${key}.${rawKey}`, d!.value);
      const band = BANDS[driverKey];
      if (v.lessThan(band.lo) || v.greaterThan(band.hi)) refuse(`${key}.${rawKey} = ${v.toString()} is outside the plausible band [${band.lo}, ${band.hi}]`);
      out[driverKey] = { value: v, anchor: anchorOf(`${key}.${rawKey}`, d!.anchor, d!.cites, known) };
    }
    scenarios[key] = out as DraftScenario;
  }

  const moat = value!.moat as { class?: unknown; mechanism?: unknown; cites?: unknown } | undefined;
  if (moat === undefined || (moat.class !== "none" && moat.class !== "narrow" && moat.class !== "wide")) refuse("moat.class is not none, narrow or wide");
  const moatAnchor = anchorOf("moat", moat!.mechanism, moat!.cites, known);

  const pc = value!.policyConstants as { nopatTaxRate?: unknown; stressMarginLevel?: unknown; anchor?: unknown; cites?: unknown } | undefined;
  if (pc === undefined || typeof pc !== "object") refuse("policyConstants is missing");
  const nopatTaxRate = decimalOf("policyConstants.nopatTaxRate", pc!.nopatTaxRate);
  const stressMarginLevel = decimalOf("policyConstants.stressMarginLevel", pc!.stressMarginLevel);
  if (nopatTaxRate.lessThan(TAX_RATE_BAND.lo) || nopatTaxRate.greaterThan(TAX_RATE_BAND.hi)) refuse(`policyConstants.nopatTaxRate = ${nopatTaxRate} is outside [0, 0.5]`);
  for (const [label, margin] of [
    ["current operating margin", facts.currentOperatingMargin],
    ["median operating margin", facts.medianOperatingMargin],
  ] as const) {
    if (margin !== null && stressMarginLevel.greaterThan(margin)) {
      refuse(`policyConstants.stressMarginLevel = ${stressMarginLevel.toFixed(4)} exceeds the ${label} (${margin.toFixed(4)})`);
    }
  }
  const constantsAnchor = anchorOf("policyConstants", pc!.anchor, pc!.cites, known);

  return { scenarios, moatClass: moat!.class as MoatClass, moatAnchor, nopatTaxRate, stressMarginLevel, constantsAnchor };
}

/**
 * Drafts once, checks the draft (the structural checks above, then the
 * caller's sheet validators), and on a refusal asks again once with the
 * defects named. `validate` returns the defects that refuse a draft — empty
 * when it stands.
 */
export async function runScenarioProposal(
  facts: DraftFacts,
  call: AnalystCall,
  validate: (proposal: DraftProposal) => string[] = () => []
): Promise<DraftProposal> {
  return callWithOneRegeneration(
    call,
    { label: "scenarioProposal", system: SYSTEM_PROMPT, user: buildDraftMessage(facts), responseSchema: RESPONSE_SCHEMA },
    (raw) => {
      const proposal = interpretDraft(raw, facts);
      const defects = validate(proposal);
      if (defects.length > 0) refuse(defects.join("; "));
      return proposal;
    }
  );
}
