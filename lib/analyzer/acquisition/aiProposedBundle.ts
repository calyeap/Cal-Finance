import Decimal from "decimal.js";
import { US_FEDERAL_STATUTORY_TAX_RATE } from "../policy";
import type { AcquiredCompany } from "./provider";
import type { SecClient } from "./secClient";
import { dilutionTagIsStale, latestAnnualDilutedSharesEnd } from "./v3Inputs";
import { writeAnalystLog, type AnalystCall } from "../ai/analystCall";
import {
  runScenarioProposal,
  US_FEDERAL_STATUTORY_CORPORATE_TAX_RATE,
  type DraftFacts,
  type DraftProposal,
} from "../ai/scenarioProposal";
import { researchFor, type HistoryMeasures, type ResearchPack } from "../sheets/research";
import { validateSheet, errorsIn } from "../sheets/validators";
import { selectDiscountRate } from "../discountRate";
import { POLICY } from "../policy";
import { windowRange, worstSingleYearDecline } from "../marginMath";
import type { MoatClass, Profile } from "../types";
import { SCENARIO_KEYS, type SheetClassificationInputs, type SheetContent, type SheetScenario, type SheetSource } from "../sheets/sheet";

// ---------------------------------------------------------------------------
// CF-AR6-ANY-TICKER-DRAFTS-01 — drafting an assumption sheet for any ticker
// (product-decisions item 30, D5; issue #454 DO 1–3).
//
//   research (sheets/research.ts: filed history + cited filing text)
//     → the price-blind drafting call (ai/scenarioProposal.ts)
//     → the sheet validators (sheets/validators.ts) — a draft carrying an
//       ERROR is refused whole and regenerated once
//     → a DRAFT sheet's content, which analystInputs.ts appends to the store.
//
// The acquisition handed in is made with no price, and nothing here asks for
// one: the draft never sees the price (issue #454 DO NOT).
//
// A company with no positive current revenue — pre-revenue, like OKLO — has
// no operating history to anchor a single driver to. No call is made: the
// sheet records that the valuation cannot be concluded from filed history,
// and the report says so (AI DEFAULT, recorded in the PR). Nothing is
// invented in its place.
//
// The profile and its classification inputs are the run's mechanical,
// recommended classification from the same filed data (§6.3: used, never
// recorded as human-confirmed) — unchanged from the AI-proposed bundle this
// file replaces.
// ---------------------------------------------------------------------------

export type DraftOutcome =
  | { kind: "DRAFTED"; content: SheetContent }
  | { kind: "CANNOT CONCLUDE"; content: SheetContent }
  | { kind: "REFUSED"; cause: string };

function factDecimal(acquired: AcquiredCompany, factId: string): Decimal | null {
  const fact = acquired.acquisition.facts.find((f) => f.id === factId);
  if (fact === undefined || fact.value === null) return null;
  return fact.value instanceof Decimal ? fact.value : new Decimal(String(fact.value));
}

function marginsOf(measures: HistoryMeasures): Decimal[] {
  return measures.years
    .filter((y) => y.revenue !== null && y.operatingIncome !== null && y.revenue.greaterThan(0))
    .map((y) => y.operatingIncome!.dividedBy(y.revenue!));
}

function median(values: Decimal[]): Decimal | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a.comparedTo(b));
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : sorted[mid - 1].plus(sorted[mid]).dividedBy(2);
}

function classificationFor(
  currentRevenue: Decimal | null,
  measures: HistoryMeasures,
  capitalIntensity: Decimal
): { profile: Profile; classificationInputs: SheetClassificationInputs } {
  const margins = marginsOf(measures);
  const cagr = measures.revenueCagr?.value ?? null;
  const revenueScale: SheetClassificationInputs["revenueScale"] =
    currentRevenue === null || !currentRevenue.greaterThan(0) ? "zero" : currentRevenue.greaterThanOrEqualTo(new Decimal("1000000000")) ? "large" : "small";
  const revenueGrowthBand: SheetClassificationInputs["revenueGrowthBand"] =
    cagr === null ? "<10%" : cagr.greaterThan("0.3") ? ">30%" : cagr.greaterThanOrEqualTo("0.1") ? "10-30%" : "<10%";
  const current = margins[margins.length - 1] ?? null;
  const fcfCharacter: SheetClassificationInputs["fcfCharacter"] = current === null || !current.greaterThan(0) ? "negative" : "positive_stable";
  const profile: Profile =
    revenueScale === "zero" ? "PRE_REVENUE_UNPROFITABLE" : revenueGrowthBand === ">30%" ? "HIGH_GROWTH_PROFITABLE_UNCERTAIN_DURABILITY" : "MATURE_PROFITABLE_STABLE_FCF";
  return {
    profile,
    classificationInputs: {
      revenueScale,
      fcfCharacter,
      revenueGrowthBand,
      capitalIntensity: capitalIntensity.toString(),
      cyclicality: {
        tenYearMarginRange: (margins.length === 0 ? new Decimal(0) : windowRange(margins)).toString(),
        worstSingleYearChange: (margins.length === 0 ? new Decimal(0) : worstSingleYearDecline(margins)).toString(),
      },
      balanceSheetNature: capitalIntensity.lessThan("0.1") ? "asset-light" : "asset-heavy",
    },
  };
}

/**
 * The D1 rate a draft will be valued at — policy, from the SIC code and filed margins; never market data.
 * A draft measures no §6.5 leverage (that needs the price it never sees), so its rate's domain reads
 * NOT MEASURED; only the rate and its basis are used, and neither reads leverage.
 */
export function draftRate(acquired: AcquiredCompany, measures: HistoryMeasures, profile: Profile, on: string) {
  const margins = marginsOf(measures);
  const triggerBFired = margins.length > 1 && worstSingleYearDecline(margins).greaterThan(POLICY.triggerBDeclinePoints);
  return selectDiscountRate({
    sic: acquired.sic,
    triggerBFired,
    profile,
    leverage: { result: "LEVERAGE UNSUPPORTED IN v1", netDebtRatio: null },
    priceDate: on,
  });
}

const STATUTORY_SOURCE: SheetSource = {
  id: "STATUTORY",
  kind: "REFERENCE",
  label: "General US federal statutory corporate income tax rate",
  form: null,
  accession: null,
  filed: null,
  url: null,
  excerpt: `${US_FEDERAL_STATUTORY_CORPORATE_TAX_RATE.mul(100).toFixed(1)}% — a general reference rate, not a disclosure from this company's filings.`,
};

/**
 * The draft's diluted share count. CF-AR8-CORRECTIONS-01 (#504): an
 * incremental-shares tag last filed before the latest 10-K's share period
 * (LLY's ends at FY2011) is absent, as it is for the bridge (PR #502, D8).
 */
export function dilutedSharesOf(acquired: AcquiredCompany): Decimal | null {
  const outstanding = factDecimal(acquired, "shares-outstanding");
  if (outstanding === null) return null;
  const tagged = acquired.acquisition.facts.find((f) => f.id === "treasury-method-dilution");
  const sharePeriodEnd = latestAnnualDilutedSharesEnd(acquired.companyFacts);
  const stale = dilutionTagIsStale(tagged?.asOfDate, sharePeriodEnd);
  return outstanding.plus((stale ? null : factDecimal(acquired, "treasury-method-dilution")) ?? new Decimal(0));
}

/** The proposal as sheet content — share-count multiples applied to the diluted count. */
export function contentFromProposal(
  proposal: DraftProposal,
  research: ResearchPack,
  currentRevenue: Decimal | null,
  dilutedShares: Decimal
): SheetContent {
  const scenarios = {} as SheetContent["scenarios"];
  for (const key of SCENARIO_KEYS) {
    const p = proposal.scenarios[key];
    const s: SheetScenario = {
      revenueGrowthOrPath: p.revenueGrowthOrPath.value.toString(),
      operatingMargin: p.operatingMargin.value.toString(),
      reinvestmentCapitalIntensity: p.reinvestmentCapitalIntensity.value.toString(),
      returnOnNewInvestment: p.returnOnNewInvestment.value.toString(),
      shareCount: dilutedShares.mul(p.shareCount.value).toDecimalPlaces(0).toString(),
      writtenAnchor: p.story,
      anchors: {
        revenueGrowthOrPath: p.revenueGrowthOrPath.anchor,
        operatingMargin: p.operatingMargin.anchor,
        reinvestmentCapitalIntensity: p.reinvestmentCapitalIntensity.anchor,
        returnOnNewInvestment: p.returnOnNewInvestment.anchor,
        shareCount: { ...p.shareCount.anchor, text: `${p.shareCount.anchor.text} (${p.shareCount.value.toString()}× today's diluted count)` },
      },
    };
    scenarios[key] = s;
  }
  const { profile, classificationInputs } = classificationFor(currentRevenue, research.measures, proposal.scenarios.base.reinvestmentCapitalIntensity.value);
  return {
    profile,
    classificationInputs,
    scenarios,
    moatClass: proposal.moatClass,
    moatAnchor: proposal.moatAnchor,
    configuredConstants: {
      nopatTaxRate: proposal.nopatTaxRate.toString(),
      stressMarginLevel: proposal.stressMarginLevel.toString(),
      preRevenueUnleveredRate: null,
      projectDebtCost: null,
    },
    constantsAnchor: proposal.constantsAnchor,
    sources: [...research.sources, STATUTORY_SOURCE],
    basis: { ...research.basis, dilutedShares: dilutedShares.toString() },
    cannotConclude: null,
  };
}

function cannotConcludeContent(reason: string, currentRevenue: Decimal | null, research: ResearchPack | null, dilutedShares: Decimal | null): SheetContent {
  const measures: HistoryMeasures = research?.measures ?? {
    years: [],
    revenueCagr: null,
    revenueGrowthRange: null,
    operatingMarginRange: null,
    roicRange: null,
    incrementalReturn: null,
    incrementalReturn3: null,
    tax: { rate: US_FEDERAL_STATUTORY_TAX_RATE, basis: "STATUTORY", years: [], label: "no filed history was read" },
    medianNetReinvestmentShare: null,
    latestQuarter: null,
  };
  const { profile, classificationInputs } = classificationFor(currentRevenue, measures, new Decimal(0));
  const empty = (): SheetScenario => ({
    revenueGrowthOrPath: null,
    operatingMargin: null,
    reinvestmentCapitalIntensity: null,
    returnOnNewInvestment: null,
    shareCount: (dilutedShares ?? new Decimal(1)).toString(),
    writtenAnchor: reason,
  });
  return {
    profile,
    classificationInputs,
    scenarios: { bear: empty(), base: empty(), bull: empty() },
    moatClass: null,
    configuredConstants: { nopatTaxRate: null, stressMarginLevel: null, preRevenueUnleveredRate: null, projectDebtCost: null },
    sources: research?.sources ?? [],
    basis: research === null ? null : { ...research.basis, dilutedShares: dilutedShares?.toString() ?? null },
    cannotConclude: reason,
  };
}

// ---------------------------------------------------------------------------
// CALVIN RULING — A on #454 (19 Oct 2026, comment 6270467028): draft
// stability. One price-blind draft varied too much between runs (LLY's three
// drafts valued 25.3% apart), so a sheet is drawn from DRAFTS_PER_SHEET
// independent drafts: each driver is the median of their values and keeps the
// anchor and citations of the draft that supplied it, so every driver stays
// cited. It is still one sheet, adopted per D5.
// ---------------------------------------------------------------------------

export const DRAFTS_PER_SHEET = 3;

const DRAFT_DRIVER_KEYS = ["revenueGrowthOrPath", "operatingMargin", "returnOnNewInvestment", "reinvestmentCapitalIntensity", "shareCount"] as const;
const MOAT_ORDER: readonly MoatClass[] = ["none", "narrow", "wide"];

/**
 * The middle entry of the candidates sorted by value; for an even count the
 * lower of the two middle entries (the conservative one). Ties keep draft
 * order, so the result is deterministic.
 */
function middle<T>(candidates: { value: Decimal; draft: number; item: T }[]) {
  const sorted = [...candidates].sort((a, b) => a.value.comparedTo(b.value) || a.draft - b.draft);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

/**
 * One proposal from several independent ones: each scenario driver is its
 * median value with the supplying draft's anchor; the moat class is the
 * median class with its draft's mechanism; the policy constants travel
 * together from the draft with the median stress margin; the stories are the
 * "lead" draft's — the one that supplied the most driver values. Medians keep
 * every per-draft ordering (bear ≤ base ≤ bull), but the combination is
 * validated again; if it fails, the lead draft itself — which passed — is the
 * sheet, and the reason is recorded.
 */
export function combineDrafts(
  proposals: DraftProposal[],
  validate: (proposal: DraftProposal) => string[]
): { proposal: DraftProposal; method: string } {
  if (proposals.length === 1) return { proposal: proposals[0], method: `one draft (1 of ${DRAFTS_PER_SHEET} drafts usable)` };
  const of = proposals.length === DRAFTS_PER_SHEET ? `${proposals.length} drafts` : `${proposals.length} of ${DRAFTS_PER_SHEET} drafts`;
  const supplied = proposals.map(() => 0);
  const scenarios = {} as DraftProposal["scenarios"];
  for (const key of SCENARIO_KEYS) {
    const drivers = {} as Record<(typeof DRAFT_DRIVER_KEYS)[number], DraftProposal["scenarios"][typeof key]["operatingMargin"]>;
    for (const d of DRAFT_DRIVER_KEYS) {
      const m = middle(proposals.map((p, draft) => ({ value: p.scenarios[key][d].value, draft, item: p.scenarios[key][d] })));
      supplied[m.draft]++;
      drivers[d] = m.item;
    }
    scenarios[key] = { story: "", ...drivers };
  }
  const lead = supplied.indexOf(Math.max(...supplied));
  for (const key of SCENARIO_KEYS) scenarios[key].story = proposals[lead].scenarios[key].story;
  const moat = middle(proposals.map((p, draft) => ({ value: new Decimal(MOAT_ORDER.indexOf(p.moatClass)), draft, item: p }))).item;
  const constants = middle(proposals.map((p, draft) => ({ value: p.stressMarginLevel, draft, item: p }))).item;
  const combined: DraftProposal = {
    scenarios,
    moatClass: moat.moatClass,
    moatAnchor: moat.moatAnchor,
    nopatTaxRate: constants.nopatTaxRate,
    stressMarginLevel: constants.stressMarginLevel,
    constantsAnchor: constants.constantsAnchor,
  };
  const defects = validate(combined);
  if (defects.length === 0) return { proposal: combined, method: `per-driver median of ${of}` };
  return {
    proposal: proposals[lead],
    method: `draft ${lead + 1} of ${of} — the median combination failed: ${defects.join("; ")}`,
  };
}

/**
 * Drafts one sheet for a company. `call` null (offline, or no model key)
 * still settles a company that cannot be drafted from history at all; any
 * other company is then REFUSED with that cause.
 */
export async function draftAssumptionSheet(
  ticker: string,
  acquired: AcquiredCompany,
  call: AnalystCall | null,
  client: SecClient | null,
  on: string = new Date().toISOString().slice(0, 10)
): Promise<DraftOutcome> {
  const currentRevenue = factDecimal(acquired, "current-revenue");
  const dilutedShares = dilutedSharesOf(acquired);

  if (currentRevenue === null || !currentRevenue.greaterThan(0)) {
    const research = await researchFor(acquired, null);
    const reason =
      "this company's filings report no revenue (pre-revenue, or none tagged), so there is no operating history to anchor " +
      "growth, margin or returns to — the valuation cannot be concluded from filed history";
    return { kind: "CANNOT CONCLUDE", content: cannotConcludeContent(reason, currentRevenue, research, dilutedShares) };
  }

  if (call === null) return { kind: "REFUSED", cause: "no model is configured to draft an assumption sheet (offline, or no ANTHROPIC_API_KEY)" };
  if (dilutedShares === null || !dilutedShares.greaterThan(0)) {
    return { kind: "REFUSED", cause: "the filings carry no share count to state the scenarios' share counts against" };
  }

  const research = await researchFor(acquired, client);
  const margins = marginsOf(research.measures);
  const provisional = classificationFor(currentRevenue, research.measures, new Decimal(0));
  const rateInUse = draftRate(acquired, research.measures, provisional.profile, on);
  const facts: DraftFacts = {
    ticker: ticker.toUpperCase(),
    companyName: acquired.acquisition.companyName,
    sicDescription: acquired.sicDescription,
    sources: [...research.sources, STATUTORY_SOURCE],
    rate: rateInUse.rate,
    rateBasis: rateInUse.basis,
    currentOperatingMargin: margins[margins.length - 1] ?? null,
    medianOperatingMargin: median(margins),
  };

  const defectsOf = (p: DraftProposal) =>
    errorsIn(
      validateSheet(contentFromProposal(p, research, currentRevenue, dilutedShares), {
        measures: research.measures,
        rate: rateInUse.rate,
        requireAnchors: true,
      })
    ).map((f) => `${f.check}: ${f.message}`);

  // Independent drafts: the same price-blind request, each with its own one
  // regeneration. A refused draft is left out; the sheet needs at least one.
  const drafts: DraftProposal[] = [];
  let firstFailure: string | null = null;
  for (let n = 0; n < DRAFTS_PER_SHEET; n++) {
    try {
      drafts.push(await runScenarioProposal(facts, call, defectsOf));
    } catch (err) {
      const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      firstFailure ??= message;
      writeAnalystLog(`draft ${n + 1} of ${DRAFTS_PER_SHEET} for ${ticker.toUpperCase()} refused: ${message}`);
    }
  }
  if (drafts.length === 0) {
    writeAnalystLog(`no assumption sheet drafted for ${ticker.toUpperCase()}: ${firstFailure}`);
    return { kind: "REFUSED", cause: `the drafting call failed or was refused twice — ${firstFailure}` };
  }

  const { proposal, method } = combineDrafts(drafts, defectsOf);
  return { kind: "DRAFTED", content: { ...contentFromProposal(proposal, research, currentRevenue, dilutedShares), drafting: method } };
}
