import Decimal from "decimal.js";
import type { AcquiredCompany } from "./provider";
import type { SecClient } from "./secClient";
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
import type { Profile } from "../types";
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

/** The D1 rate a draft will be valued at — policy, from the SIC code and filed margins; never market data. */
export function draftRate(acquired: AcquiredCompany, measures: HistoryMeasures, profile: Profile, on: string) {
  const margins = marginsOf(measures);
  const triggerBFired = margins.length > 1 && worstSingleYearDecline(margins).greaterThan(POLICY.triggerBDeclinePoints);
  return selectDiscountRate({ sic: acquired.sic, triggerBFired, profile, leveragePass: true, priceDate: on });
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

function dilutedSharesOf(acquired: AcquiredCompany): Decimal | null {
  const outstanding = factDecimal(acquired, "shares-outstanding");
  if (outstanding === null) return null;
  return outstanding.plus(factDecimal(acquired, "treasury-method-dilution") ?? new Decimal(0));
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

  let proposal: DraftProposal;
  try {
    proposal = await runScenarioProposal(facts, call, (p) =>
      errorsIn(
        validateSheet(contentFromProposal(p, research, currentRevenue, dilutedShares), {
          measures: research.measures,
          rate: rateInUse.rate,
          requireAnchors: true,
        })
      ).map((f) => `${f.check}: ${f.message}`)
    );
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    writeAnalystLog(`no assumption sheet drafted for ${ticker.toUpperCase()}: ${message}`);
    return { kind: "REFUSED", cause: `the drafting call failed or was refused twice — ${message}` };
  }

  return { kind: "DRAFTED", content: contentFromProposal(proposal, research, currentRevenue, dilutedShares) };
}
