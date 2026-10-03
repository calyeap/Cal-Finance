import Decimal from "decimal.js";
import type { AcquiredCompany } from "./provider";
import type { AnalystInputBundle } from "./analystInputs";
import type { AnalystCall } from "../ai/analystCall";
import { runScenarioProposal, type ScenarioProposalFacts } from "../ai/scenarioProposal";
import { revenueSeries, achievedRevenueCagr, comparatorRecency } from "../calibration/inputs";
import { annualSeries, operatingMarginSeries } from "./history";
import { TAG_MAP } from "./tagMap";
import { windowRange, worstSingleYearDecline } from "../marginMath";
import type { ScenarioInputSet, ScenarioDriverInputs } from "../assemble";
import type { Profile, ProfileClassificationInputs, ScenarioDriverSet } from "../types";

// ---------------------------------------------------------------------------
// CF-ANALYZER-V1-SETTLE-01's CALVIN RULING — A (issue #399, 3 Oct 2026):
// "wire COST end-to-end through the existing deterministic valuation engine."
//
// analystInputs.ts's own header states the rule this file is the third,
// bounded exception to: a company with no bundle has no scenarios and cannot
// open a run — "that is a refusal, not a gap to be filled with invented
// numbers." An AI-PROPOSED bundle is still not an invented one: every driver
// and both policy constants are scenarioProposal.ts's own fact-grounded,
// plausibility-checked proposal (never this file's own invention), and an
// explicit analyst bundle — committed or recorded — still resolves first and
// overrides this entirely (analystInputs.ts's own resolution order is
// unchanged; this is consulted only where both existing sources return null).
//
// What this file adds beyond the drivers/constants scenarioProposal.ts
// itself proposes: the two §6.3 fields no AI call here proposes, because the
// frozen spec (§6.3) explicitly forbids hard auto-assignment of them and
// Calvin's ruling authorises only "the existing bounded scenario-proposal
// call" — not a second judgment call. Both are MECHANICAL, non-judgmental,
// real-data derivations, both cosmetic (see below), never AI-authored and
// never this file inventing a classification:
//
//   - `scenarioValues` is left null — never computed here. §4.4's
//     non-operating-investments judgment is not yet resolved at the point a
//     bundle is built (gate.ts calls this before Step 2), so there is no
//     debt/cash bridge to convert an enterprise value into a per-share
//     figure yet. assemble.ts's M15 section computes it later, once that
//     judgment (or its absence) is known, through the SAME
//     computeScenarioEnterpriseValue model + EV bridge every explicit
//     bundle's own hand-authored dollar values are already consistent with.
//   - `profile` is the run's software RECOMMENDATION, automatically used and
//     explicitly marked NOT human-confirmed (§6.3, §9.6 rule 2) — the exact,
//     spec-sanctioned path "Where nobody has decided, the run proceeds on
//     the recommended profile as an automatic resolution that is not...
//     recorded as human-confirmed" (§6.3 amendment record). `profile` is
//     read ONLY for display (assemble.ts passes it straight through to the
//     result) and its one spec-defined consequence — suppressing §10.6's
//     BUY/HOLD/SELL-style position and action clause — is already moot: this
//     whole outcome is explicitly "No BUY/HOLD/SELL" (issue #399's own
//     stated scope). The fair-value range itself still renders regardless
//     (§6.3: "the fair-value range still renders").
// ---------------------------------------------------------------------------

const SHARE_COUNT_MULTIPLIER_BAND = { lo: new Decimal("0.5"), hi: new Decimal("3.0") };

function factDecimal(acquired: AcquiredCompany, factId: string): Decimal | null {
  const fact = acquired.acquisition.facts.find((f) => f.id === factId);
  if (fact === undefined || fact.value === null) return null;
  return fact.value instanceof Decimal ? fact.value : new Decimal(String(fact.value));
}

/** Mirrors calibrate-position.ts's own `medianMargin` helper exactly — the
 * one existing way this codebase turns a company's filed facts into a margin
 * series, reused rather than re-derived a second way. */
function marginSeriesFor(acquired: AcquiredCompany): { fiscalYear: number; margin: number }[] | null {
  const operatingIncomeTags = TAG_MAP.find((e) => e.factId === "operating-income")?.candidates;
  if (operatingIncomeTags === undefined) return null;
  const series = operatingMarginSeries(revenueSeries(acquired.companyFacts), annualSeries(acquired.companyFacts, operatingIncomeTags));
  return series?.years ?? null;
}

function median(values: Decimal[]): Decimal | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a.comparedTo(b));
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : sorted[mid - 1].plus(sorted[mid]).dividedBy(2);
}

function proposalFactsFor(ticker: string, companyName: string, acquired: AcquiredCompany): ScenarioProposalFacts {
  const margins = marginSeriesFor(acquired);
  const marginDecimals = (margins ?? []).map((y) => new Decimal(y.margin));
  const currentOperatingMargin = marginDecimals.length === 0 ? null : marginDecimals[marginDecimals.length - 1];
  const medianOperatingMargin = median(marginDecimals);

  const revSeries = revenueSeries(acquired.companyFacts);
  const historicalRevenueCagr =
    revSeries === null
      ? null
      : achievedRevenueCagr(revSeries, 10, comparatorRecency(acquired.companyFacts, revSeries)).value?.cagr ?? null;

  return {
    ticker,
    companyName,
    businessNarrative: acquired.business.narrative?.text ?? null,
    sicDescription: acquired.sicDescription,
    currentRevenue: factDecimal(acquired, "current-revenue"),
    historicalRevenueCagr,
    currentOperatingMargin,
    medianOperatingMargin,
  };
}

/**
 * The run's software-recommended profile and its classification inputs —
 * mechanical, real-data, cosmetic-only (see this file's header). Null only
 * where there isn't enough real data to classify revenue scale at all, which
 * fails this whole bundle closed exactly like a missing current-revenue fact
 * already does.
 */
function recommendedProfile(
  facts: ScenarioProposalFacts,
  baseReinvestmentCapitalIntensity: Decimal,
  margins: { fiscalYear: number; margin: number }[] | null
): { profile: Profile; classificationInputs: ProfileClassificationInputs } | null {
  if (facts.currentRevenue === null) return null;

  const revenueScale: ProfileClassificationInputs["revenueScale"] =
    facts.currentRevenue.isZero() ? "zero" : facts.currentRevenue.greaterThanOrEqualTo(new Decimal("1000000000")) ? "large" : "small";

  const revenueGrowthBand: ProfileClassificationInputs["revenueGrowthBand"] =
    facts.historicalRevenueCagr === null
      ? "<10%"
      : facts.historicalRevenueCagr.greaterThan("0.3")
        ? ">30%"
        : facts.historicalRevenueCagr.greaterThanOrEqualTo("0.1")
          ? "10-30%"
          : "<10%";

  const fcfCharacter: ProfileClassificationInputs["fcfCharacter"] =
    facts.currentOperatingMargin === null
      ? "negative"
      : facts.currentOperatingMargin.greaterThan(0)
        ? "positive_stable"
        : "negative";

  const marginDecimals = (margins ?? []).map((y) => new Decimal(y.margin));
  const cyclicality =
    marginDecimals.length === 0
      ? { tenYearMarginRange: new Decimal(0), worstSingleYearChange: new Decimal(0) }
      : { tenYearMarginRange: windowRange(marginDecimals), worstSingleYearChange: worstSingleYearDecline(marginDecimals) };

  const balanceSheetNature: ProfileClassificationInputs["balanceSheetNature"] =
    baseReinvestmentCapitalIntensity.lessThan("0.1") ? "asset-light" : "asset-heavy";

  const profile: Profile = revenueGrowthBand === ">30%" ? "HIGH_GROWTH_PROFITABLE_UNCERTAIN_DURABILITY" : "MATURE_PROFITABLE_STABLE_FCF";

  return {
    profile,
    classificationInputs: { revenueScale, fcfCharacter, revenueGrowthBand, capitalIntensity: baseReinvestmentCapitalIntensity, cyclicality, balanceSheetNature },
  };
}

function toScenarioDriverInputs(driver: ScenarioDriverSet, dilutedShares: Decimal | null): ScenarioDriverInputs {
  // scenarioProposal.ts's own shareCount is a MULTIPLE of the current share
  // count (0.5x-3x, 1.0 = no change) — converted here to the ABSOLUTE count
  // every other bundle in this codebase carries (MSFT's fixture, NVDA's
  // recorded bundle), so Section F shows one consistent unit regardless of a
  // run's bundle source. Left as the proposed multiple (clamped into the same
  // band scenarioProposal.ts already checked) only where there is no diluted
  // share count to multiply it against yet.
  const shareCount = dilutedShares === null ? driver.shareCount : dilutedShares.mul(driver.shareCount);
  return {
    revenueGrowthOrPath: driver.revenueGrowthOrPath,
    operatingMargin: driver.operatingMargin,
    reinvestmentCapitalIntensity: driver.reinvestmentCapitalIntensity,
    shareCount,
    writtenAnchor: driver.writtenAnchor,
  };
}

const NOTE_PREFIX =
  "The three scenario driver sets and two of the four §7.1 policy constants on this run were PROPOSED by " +
  "the bounded AI scenario-proposal call (CF-ANALYZER-V1-SETTLE-01, CALVIN RULING — A), grounded only in " +
  "this company's own sourced facts below — never an analyst's own authorship, and never this software's " +
  "own invention. An explicit analyst-authored bundle for this ticker, committed or recorded, would " +
  "override this entirely; none exists yet. The dollar scenario values are not carried here at all — " +
  "they are computed once this run's own non-operating-investments judgment is known, through the " +
  "identical deterministic model every analyst-authored bundle's own values are consistent with. The " +
  "profile below is this run's software RECOMMENDATION only, automatically used and not confirmed by a " +
  "human analyst (§6.3) — mechanical, from the same sourced facts, never a judgment this software made.";

/**
 * The third, bounded source `analystInputsFor` falls back to — after the two
 * committed fixtures and the recorded-bundle store both return null. Returns
 * null, the same refusal every other unsupported ticker already gets, where
 * there is no configured AI call, not enough sourced data to propose from, or
 * the call itself could not produce an acceptable proposal after one retry
 * (callWithOneRegeneration's own fail-closed discipline) — never a thrown
 * error reaching a report render.
 */
// A ticker calls this at least twice on the same request — isSupportedTicker
// to decide whether the run can even open, buildAcquiredRun to actually
// build it — and `loadGateState` already attaches that support check to the
// SAME request `buildAcquiredRun` runs a few lines later (gate.ts). Without
// this, each would re-run the paid AI call, doubling cost and latency for
// nothing: the proposal cannot change within that single request. In-process
// only, same TTL and shape as acquisition/provider.ts's own acquireCompany
// cache, and for the identical reason — this is NOT a durable second control
// plane or queue, it is one cache with one key, sitting beside the existing
// one.
const TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; value: AnalystInputBundle | null }>();

/** Test seam and cache reset. Never called by application code. */
export function __resetAiProposedBundleCache(): void {
  cache.clear();
}

export async function aiProposedAnalystInputBundle(
  ticker: string,
  companyName: string,
  acquired: AcquiredCompany,
  call: AnalystCall | null
): Promise<AnalystInputBundle | null> {
  if (call === null) return null;

  const cacheKey = ticker.toUpperCase();
  const hit = cache.get(cacheKey);
  if (hit !== undefined && Date.now() - hit.at < TTL_MS) return hit.value;

  const resolved = await resolveAiProposedAnalystInputBundle(ticker, companyName, acquired, call);
  cache.set(cacheKey, { at: Date.now(), value: resolved });
  return resolved;
}

async function resolveAiProposedAnalystInputBundle(
  ticker: string,
  companyName: string,
  acquired: AcquiredCompany,
  call: AnalystCall
): Promise<AnalystInputBundle | null> {
  const facts = proposalFactsFor(ticker, companyName, acquired);
  if (facts.currentRevenue === null) return null;

  let proposal;
  try {
    proposal = await runScenarioProposal(facts, call);
  } catch {
    // scenarioProposal.ts's own callWithOneRegeneration already retried once
    // and logged the refusal. A second failure is the same honest "no
    // scenarios for this company" refusal analystInputsFor already gives a
    // ticker with no bundle at all — never an exception reaching a route.
    return null;
  }

  const margins = marginSeriesFor(acquired);
  const recommended = recommendedProfile(facts, proposal.base.reinvestmentCapitalIntensity, margins);
  if (recommended === null) return null;

  const dilutedShares = (() => {
    const sharesOutstanding = factDecimal(acquired, "shares-outstanding");
    if (sharesOutstanding === null) return null;
    const treasuryDilution = factDecimal(acquired, "treasury-method-dilution") ?? new Decimal(0);
    return sharesOutstanding.plus(treasuryDilution);
  })();

  const scenarios: ScenarioInputSet = {
    bear: toScenarioDriverInputs(proposal.bear, dilutedShares),
    base: toScenarioDriverInputs(proposal.base, dilutedShares),
    bull: toScenarioDriverInputs(proposal.bull, dilutedShares),
  };

  return {
    inputs: {
      profile: {
        recommended: recommended.profile,
        confirmedOrOverridden: recommended.profile,
        override: null,
        classificationInputs: recommended.classificationInputs,
      },
      scenarios,
      scenarioValues: null,
      revalueBaseCaseAtRate: null,
      configuredConstants: {
        nopatTaxRate: proposal.nopatTaxRate,
        stressMarginLevel: proposal.stressMarginLevel,
        preRevenueUnleveredRate: null,
        projectDebtCost: null,
      },
      preRevenue: null,
    },
    note: `${NOTE_PREFIX} Policy-constants citation: ${proposal.policyConstantsAnchor}`,
  };
}

export { SHARE_COUNT_MULTIPLIER_BAND };
