import Decimal from "decimal.js";
import { POLICY, buildProvisionalLabels } from "./policy";
import { computeEnterpriseValue, computeEquityValueFromEnterpriseValue, type EnterpriseValueInput } from "./modules/enterpriseValue";
import { computeMultiples, type MultiplesInput } from "./modules/multiples";
import { computeMarginHistory, type MarginHistoryInput } from "./modules/marginHistory";
import { computeFcf, type FcfInput } from "./modules/fcf";
import {
  computeReinvestmentRonic,
  computeImpliedReturnOnNewCapital,
  type ReinvestmentInput,
  type RonicInput,
  type ImpliedReturnOnNewCapitalInput,
} from "./modules/reinvestmentRonic";
import { evaluateRoicFloor, type RoicYearInput } from "./roicFloor";
import type { VerdictJudgements } from "./verdictJudgements";
import { computeSteadyStateEvPvgo } from "./modules/steadyStateEvPvgo";
import { solveReverseDcf, type ReverseDcfFacts } from "./modules/reverseDcf";
import { selectDiscountRate, terminalReturnOnNewCapital } from "./discountRate";
import { computeTerminalDiagnostics } from "./modules/terminalDiagnostics";
import { computeImpliedExitMultiple } from "./modules/impliedExitMultiple";
import { computeRateSensitivity, rateSensitivityNotModelled } from "./modules/rateSensitivity";
import { computeFcfYieldGrowth, type FcfYieldGrowthInput } from "./modules/fcfYieldGrowth";
import { computeRunRate, type RunRateInput } from "./modules/runRate";
import { computeShapeMismatch } from "./modules/shapeMismatch";
import {
  buildSensitivityResult,
  computeTornado,
  computeGrowthMarginTable,
  computeRateTerminalGrowthTable,
  type AnalystSuppliedRange,
} from "./modules/sensitivity";
import {
  computeScenarioValuation,
  computeScenarioOutputs,
  rateSearchBracket,
  type ScenarioValuation,
} from "./modules/scenarioOutputs";
import { buildFixedShapeGrowthPath } from "./growthPath";
import { sensitivityRangesFor } from "./acquisition/analystInputs";
import { notComputed, NOT_COMPUTED_BINDING } from "./notComputed";
import {
  computeFundingStackYearByYear,
  computeBothFundingRamps,
  computeImpliedProbability,
  computeUnitExitBreakEvenPrice,
  successWeightDateCause,
  successWeightBasisCause,
  ACQUIRED_CASH_SHARE_BASIS,
  type FundingStackYearParams,
  type UnitExitEconomicsInput,
} from "./modules/preRevenue";
import { evaluateGate0, evaluateGate1, evaluateLeverage, evaluateTriggerA, evaluateTriggerB } from "./gates";
import type { Gate0Input, Gate1Input, LeverageInput, TriggerMarginInput } from "./gates";
import { CLEAN_PROVENANCE, combineProvenance } from "./provenance";
import { stubYearsBetween } from "./valuationTiming";
import { codeVersion, fingerprint } from "./runIdentity";
import { computeTrustStatus } from "./trust";
import {
  gate0Cause,
  leverageCause,
  stateRemovingFairValueRange,
  type ActiveSuppression,
} from "./suppression";
import type {
  AchievedGrowth,
  AnalysisResult,
  BusinessSectionContent,
  FactRecord,
  Figure,
  D2Inputs,
  LatestFiling,
  MarketContextSectionContent,
  MoatClass,
  OverrideRecord,
  Profile,
  ProfileClassificationInputs,
  ProvenanceTokens,
  QualifyingFlag,
  RawInput,
  ScenarioDriverSet,
  ScenarioSet,
  SensitivityResult,
  SourcedValue,
  SuccessDefinitionRow,
  SuccessDefinitionState,
  SuppressingState,
  UndefinedPolicyConstants,
} from "./types";

// ---------------------------------------------------------------------------
// Milestone 5 — Analysis Result assembly.
// ---------------------------------------------------------------------------
//
// Wires the already-accepted M1–M16 outputs into the frozen AnalysisResult
// contract (types.ts). Every calculation call below reuses an accepted
// module's EXPORTED function unmodified — this file contains no valuation
// arithmetic of its own, only orchestration: building each module's input
// shape from the fixture, threading gate/trigger/M5 outputs into the
// modules that require them, and assembling the results into one object.
//
// SCOPE DELIBERATELY NARROWER than the full contract, consistent with
// Milestone 5 (not Milestone 6/8): `provenance` (the full derivation graph)
// is left as an empty array — building it exhaustively for every value is
// report-assembly/Step-4-adjacent work, not required to prove the M1–M16
// wiring itself is correct. `interpretation` is empty (§8.2's plain-English
// layer is AI-narrative, not a deterministic M1–M16 output) and `challenger`
// is always null (populated only after a separate call, §8.5.4). `facts`
// carries only the fixture's own hand-supplied FactRecords, not a fact for
// every input.
//
// PROFILE CLASSIFICATION is taken directly from the fixture, not computed
// by a general classifier — none exists in this codebase, and the
// methodology's own text (§1) frames this step as software RECOMMENDING a
// profile that an analyst then confirms or overrides ("hard auto-assignment
// is too crude... the table is the recommendation rule, not the final
// word"), not a rigid deterministic function. For MSFT and OKLO the profile
// is already stated as confirmed in the frozen design mocks, so this
// assembly takes that confirmed profile as a fixture input rather than
// inventing a classifier the frozen contract does not actually specify.

export interface CompanyFixture {
  schemaVersion: string;
  runId: string;
  ticker: string;
  companyName: string;
  price: { value: Decimal; timestamp: string };
  facts: FactRecord[];

  // M9-ITEM5-CONTENT-01. Optional — a fixture built before this outcome, or
  // one testing something unrelated, carries neither; assembleAnalysisResult
  // then falls back to the same honest "not yet available" content the
  // sections rendered before this outcome. The acquisition path
  // (acquiredRun.ts) always sets both, from the fact set it already acquired.
  business?: BusinessSectionContent;
  marketContext?: MarketContextSectionContent;
  // CF-ANALYZER-V1-SETTLE-01 — see `LatestFiling`'s own doc comment. Same
  // optionality reasoning as `business`/`marketContext` above.
  latestFiling?: LatestFiling | null;

  gate0: Gate0Input;
  gate1: Gate1Input;
  leverage: LeverageInput;
  triggerMargins: TriggerMarginInput;

  profile: {
    recommended: Profile;
    confirmedOrOverridden: Profile;
    override: OverrideRecord | null;
    classificationInputs: ProfileClassificationInputs;
  };

  enterpriseValue: EnterpriseValueInput;

  multiplesInput: Omit<MultiplesInput, "gate1State" | "triggerBFired">;

  marginHistory: MarginHistoryInput;

  fcf: FcfInput;

  reinvestment: ReinvestmentInput;
  ronic: RonicInput;
  impliedReturnOnNewCapital: ImpliedReturnOnNewCapitalInput | null;

  // The facts M6 and M7 read (reverseDcf.ts ReverseDcfFacts).
  reverseDcf: ReverseDcfFacts;

  fcfYieldGrowth: FcfYieldGrowthInput;

  runRate: RunRateInput;

  shapeMismatch: { guidedNearTermGrowth: Decimal | null; impliedConstantGrowth: Decimal | null };

  rateSensitivityCells: { plusOnePoint: Decimal; minusOnePoint: Decimal } | null;

  scenarios: ScenarioInputSet;
  // CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — Methodology v2.1 D2's moat class,
  // Calvin's per-company JUDGEMENT on the assumption sheet: the terminal
  // return on new capital is the rate plus its credit. Absent or null means
  // the sheet is pending adoption (resolveD2Inputs).
  moatClass?: MoatClass | null;
  // CF-AR5-VERDICT-CONSOLIDATION-01 — Methodology v2.1 D4 item 2's inputs:
  // NOPAT and year-end invested capital (goodwill included) for each fiscal
  // year, and how many fiscal years of annual results the company has filed.
  // Absent or null: the floor is unavailable on this run.
  roicHistory?: { years: RoicYearInput[]; filedHistoryYears: number } | null;
  // CF-AR5-VERDICT-CONSOLIDATION-01 — Calvin's recorded verdict judgements,
  // carried onto the result for verdict.ts (frozen spec §14.9 AR0-5). Not an
  // engine input: no figure reads them, and they are left out of
  // `inputsFingerprint`, which a close-call answer is bound to.
  verdictJudgements?: VerdictJudgements;
  // CF-ANALYZER-V1-SETTLE-01 — CALVIN RULING — A (issue #399). null only for
  // a bundle with no analyst-authored dollar values (an AI-proposed bundle —
  // acquisition/analystInputs.ts's aiProposedAnalystInputBundle): assembly
  // then computes these THROUGH THE SAME M15 model (computeScenarioEnterpriseValue)
  // and EV bridge every other output already uses, from `scenarios` above and
  // `enterpriseValue`/`reverseDcf.baseYearRevenue` — never a second valuation
  // model. An explicit analyst bundle (MSFT, NVDA) still supplies these
  // directly and overrides the dynamic computation, UNLESS
  // `recordedScenarioValuesComputeFromDrivers` below says otherwise (see its
  // own doc comment).
  scenarioValues: { bear: Decimal; base: Decimal; bull: Decimal } | null;
  // A4 (CF-ANALYZER-INTEGRITY-PHASE-A-01) — true only where the explicit
  // dollar values above are carried from a COMMITTED VALIDATION FIXTURE
  // (analystInputs.ts's MSFT/OKLO bundles: MSFT_FIXTURE's own hardcoded
  // 265/510/650), supplied to a REAL acquired run rather than to the
  // fixture's own direct unit/snapshot tests. Those numbers were never a
  // computed fair value for the real company and must never be shown as
  // one: when true, assembly treats `scenarioValues` as absent AND refuses
  // the M15 dynamic fallback too (the fallback's own drivers are the SAME
  // validation-fixture authorship, so it would only substitute a different
  // fictional number for a real company's report) — it reports the
  // fair-value range NOT COMPUTED through the existing missing-REQUIRED-
  // input mechanism, never a speculative second valuation. Absent/false
  // everywhere else: every hand-authored fixture (MSFT_FIXTURE/OKLO_FIXTURE
  // used directly in assemble.test.ts/AnalyzerReport.test.tsx), every
  // recorded human-approved analyst bundle, and every AI-proposed bundle
  // (whose scenarioValues is already null) are unaffected.
  scenarioValuesAreFixtureCarried?: boolean;
  // CF-ANALYZER-REAL-VALUATION-UNBLOCK-01 (REVIEW-38678066585-1, CORRECT) —
  // true only where `scenarioValues` above is a recorded, human-approved
  // bundle (recordedBundles.ts's recordedAnalystInputBundle) AND every
  // scenario's three drivers (growth, margin, reinvestment) are authored.
  // When true, assembly ignores the typed `scenarioValues` above and
  // recomputes the range through the SAME M15 dynamicScenarioValue path an
  // AI-proposed bundle already uses — a typed dollar figure must not stand
  // in for a real computation once there is enough to compute one. Absent/
  // false everywhere else: a hand-authored fixture used directly
  // (MSFT_FIXTURE/OKLO_FIXTURE in assemble.test.ts/AnalyzerReport.test.tsx),
  // a committed bundle (A4 above already blocks those), a recorded bundle
  // with any scenario's drivers left blank (the typed figure is the only
  // honest source then), and an AI-proposed bundle (whose scenarioValues is
  // already null) are all unaffected.
  recordedScenarioValuesComputeFromDrivers?: boolean;
  // null where the fixture has no real revaluation-at-rate solver — see
  // computeScenarioOutputs's own doc comment (CB-AUDIT-01 H2). Never a
  // placeholder formula standing in for one.
  revalueBaseCaseAtRate: ((rate: Decimal) => Decimal) | null;

  configuredConstants: UndefinedPolicyConstants;

  // §9.6 rule 2 needs two facts about the run that no calculation module
  // produces: whether a human confirmed the profile (§6.3's *Cannot judge*
  // raises PROFILE NOT CONFIRMED on the valuation path) and which facts failed
  // a §3.8.2 cross-check. Both are already known where a real run is built —
  // see gate.ts — and they arrive here rather than being guessed at, because
  // guessing either way would make trust say something about a run that is not
  // true of it.
  trustInputs: {
    profileHumanConfirmed: boolean;
    crossCheckFailedFactIds: readonly string[];
    // CF-ANALYZER-V1-SETTLE-01 — non-null only on the pure automatic path
    // (autoRun.ts Step 6, never a human decision). Combined below with Gate
    // 0 PASS to decide whether this run's profile is unambiguous enough to
    // stand in for a human confirmation on the V1 presentation path — see
    // the comment at its one use below.
    profileAutoResolved: string | null;
  };

  // §10.6.2/§13 (CF-VERDICT-NONPOLICY-GAPS-01) — Step 7's achieved-history
  // comparator fact. This is already the RawInput<AchievedGrowth> outcome
  // (lib/analyzer/calibration/inputs.ts's `achievedRevenueCagr`), not raw
  // ingredients: computing it needs the filer's multi-year annual revenue
  // series and how current the filer's own filings run (comparatorRecency),
  // neither of which a fixture built by hand — or assembleAnalysisResult
  // itself, which never sees a CompanyFactsDocument — can derive. The
  // acquisition seam (companyInputs.ts) has that evidence and computes this
  // before the fixture reaches here; a hand-authored fixture states its own
  // honest blocked reason instead of inventing a series it never acquired.
  achievedRevenueCagr: RawInput<AchievedGrowth>;

  // Populated only for the pre-revenue profile.
  preRevenue: PreRevenueFixture | null;

  // CF-AR3-REPRODUCIBLE-RUNS-01 — Methodology v2.1 D2's TTM base: the twelve
  // months `reverseDcf.baseYearRevenue` covers and when they end, so both
  // DCF engines can be valued at the price date (valuationTiming.ts).
  // companyInputs.ts sets it on every acquired run; a hand-authored fixture
  // that omits it is valued at its base period end (no stub) and its timing
  // record says the base period end is unknown.
  valuationBase?: ValuationBase | null;
}

export interface ValuationBase {
  periodEnd: string;
  // "TTM" — four contiguous discrete quarters; "FISCAL YEAR" — the latest
  // annual figure, used where no TTM is computable or the annual figure is
  // the more recent twelve months.
  kind: "TTM" | "FISCAL YEAR";
}

/**
 * Step 7's three scenarios as they arrive — where a driver may be null because
 * nobody authored it (CB-AUDIT-01 H4c: the OKLO validation set carries 0 for
 * all nine, which Section F printed as 0.0% growth, margin and reinvestment).
 * A null driver reaches the result as NaN, with INCOMPLETE bound to that
 * scenario (notComputed.ts) — the schema's ScenarioSet has no way to hold the
 * absence itself.
 */
type NullableDrivers = "revenueGrowthOrPath" | "operatingMargin" | "reinvestmentCapitalIntensity";
export type ScenarioDriverInputs = Omit<ScenarioDriverSet, NullableDrivers> & {
  [K in NullableDrivers]: ScenarioDriverSet[K] | null;
};
export type ScenarioInputSet = Record<keyof ScenarioSet, ScenarioDriverInputs>;

const DRIVER_LABELS: Record<NullableDrivers, string> = {
  revenueGrowthOrPath: "revenue growth",
  operatingMargin: "operating margin",
  reinvestmentCapitalIntensity: "reinvestment",
};

export interface PreRevenueFixture {
  // CalFinance Methodology v2's acquired-run cash basis. null only where the
  // component facts behind it were not acquired/authored for this run — see
  // the matching *Cause field, which assembly turns into the bound
  // notComputed.ts state (never a zero or fixture substitute). vFail below is
  // always this same basis — it is not a per-definition input.
  cashPerShare: Decimal | null;
  cashPerShareAsOfDate: string | null;
  cashPerShareCause: string | null;
  // Weakest-input provenance behind cashPerShare (§3.3 propagation) — the
  // acquired cash balance and shares outstanding it was divided by. null
  // where cashPerShare itself is null (nothing to qualify) or where the
  // fixture has no acquired-fact provenance to report (the illustrative
  // validation bundle) — never upgraded to CLEAN/CONFIRMED on its behalf.
  cashPerShareProvenance: ProvenanceTokens | null;
  quarterlyBurn: Decimal | null;
  quarterlyBurnAsOfDate: string | null;
  quarterlyBurnCause: string | null;
  quarterlyBurnProvenance: ProvenanceTokens | null;
  runway: Decimal | null;
  runwayCause: string | null;
  // Runway's own weakest-input provenance — the acquired cash balance AND
  // the acquired quarterly burn (§7.2 M16's actual dependency), never the
  // shares-outstanding token cashPerShareProvenance carries (H3 conformance
  // correction). null exactly where runway itself is unavailable.
  runwayProvenance: ProvenanceTokens | null;
  unitEconomics: UnitExitEconomicsInput;
  fundingStackShared: Omit<FundingStackYearParams, "capacityAddedByYear">;
  backLoadedCapacityByYear: Decimal[];
  steadyCapacityByYear: Decimal[];
  successDefinitions: {
    definition: string;
    vSuccess: Decimal;
    // Analyst-authored valuation date for THIS success definition's own
    // V_success figure (Step 7, not yet built) — null where no such date has
    // actually been recorded. Never defaulted to the run's price timestamp
    // or any other "as of today" attribution (H3 conformance correction):
    // a quote timestamp is not evidence that this specific dollar figure was
    // revalued as of that moment, and a stale illustrative number must not
    // be dressed up as freshly current.
    vSuccessAsOfDate: string | null;
    // Analyst-authored comparable-basis evidence (Step 7) — a description of
    // the share count / dilution treatment this V_success figure assumes.
    // null where not recorded. Must name the IDENTICAL treatment as
    // ACQUIRED_CASH_SHARE_BASIS (preRevenue.ts) to be treated as comparable
    // to V_fail — no alignment tolerance.
    vSuccessBasis: string | null;
    rSuccess: Decimal;
    rFail: Decimal;
    rateCapped: boolean;
  }[];
}

function sourced(value: Decimal): SourcedValue<Decimal> {
  return { value, provenance: CLEAN_PROVENANCE };
}

export function assembleAnalysisResult(fixture: CompanyFixture): AnalysisResult {
  // --- Gates + triggers (Milestone 3, unchanged) ---------------------------
  const gate0 = evaluateGate0(fixture.gate0);
  const gate1 = evaluateGate1(fixture.gate1);
  const triggerA = evaluateTriggerA(fixture.triggerMargins);
  const triggerB = evaluateTriggerB(fixture.triggerMargins);

  // --- M1 — enterprise value ------------------------------------------------
  const enterpriseValueBridge = computeEnterpriseValue(fixture.enterpriseValue);
  const currentEnterpriseValue: SourcedValue<Decimal> | null = enterpriseValueBridge.suppressed
    ? null
    : sourced(enterpriseValueBridge.value.enterpriseValue);
  // M15's own dynamic scenario-value computation (below) needs the bridge's
  // market cap too — the same bridge output, read a second time rather than
  // a second EV computation.
  const currentMarketCap: Decimal | null = enterpriseValueBridge.suppressed
    ? null
    : enterpriseValueBridge.value.marketCap;
  // CF-AR3-REPRODUCIBLE-RUNS-01 — the valuations below read base revenue's
  // bare value, so a NOT CONFIRMED base revenue is withheld here exactly as a
  // missing one is; figures that carry its provenance are gated by
  // computedValue (figures.ts) instead. M7 reads fixture.reverseDcf directly
  // and is gated that way.
  const baseRevenueSourced =
    fixture.reverseDcf.baseYearRevenue?.provenance.verificationState === "NOT CONFIRMED"
      ? null
      : fixture.reverseDcf.baseYearRevenue;

  // CF-AR3-REPRODUCIBLE-RUNS-01 — "valued at the price date" (Methodology
  // v2.1 D2). The real price's own date, never the $0 display sentinel's
  // (a priceless run has nothing to roll forward to and is valued at its
  // base period end).
  const priceDate = fixture.enterpriseValue.price !== null ? fixture.price.timestamp : null;
  const basePeriodEnd = fixture.valuationBase?.periodEnd ?? null;
  const stubYears = stubYearsBetween(basePeriodEnd, priceDate);

  // --- §6.5 — the leverage precondition, AFTER M1 ---------------------------
  //
  // The ratio's denominator is enterprise value, so the precondition cannot be
  // evaluated before M1 has produced one. It used to be evaluated first, which
  // meant an acquired run — where companyInputs.ts supplies
  // `leverage.enterpriseValue` as null precisely because "it is filled by
  // assemble from M1's own output" — failed the test closed on a missing input
  // whatever the company's actual leverage. V4 pins Microsoft at "Leverage PASS
  // at 0.8%", and a run that cannot reach a ratio cannot reach that.
  //
  // The fixture's own EV still wins where it supplies one, so a fixture that
  // states the bridge directly is unaffected. Where it supplies null and M1
  // computed a value, M1's is used; where M1 is itself suppressed,
  // `currentEnterpriseValue` is null and the precondition fails closed exactly
  // as before (§5.3, §6.5, V8).
  const leverage = evaluateLeverage({
    ...fixture.leverage,
    enterpriseValue: fixture.leverage.enterpriseValue ?? currentEnterpriseValue?.value ?? null,
  });

  // --- M2 — multiples --------------------------------------------------------
  //
  // Same seam as §6.5's leverage precondition and M7's reverse-DCF grid,
  // above: companyInputs.ts sets `multiplesInput.enterpriseValue` to null
  // because it is filled by assemble from M1's own output, and until this
  // fix nothing did the filling here — so every acquired run returned
  // EV/EBIT, EV/EBITDA and EV/Revenue INCOMPLETE regardless of whether the
  // company actually had a usable enterprise value. The fixture's own value
  // still wins where it supplies one (A2); where M1 is itself suppressed,
  // `currentEnterpriseValue` is null and each EV-based multiple fails closed
  // exactly as before — missing EBIT/EBITDA/revenue still independently
  // suppresses its own multiple without touching the others.
  const multiples = computeMultiples({
    ...fixture.multiplesInput,
    enterpriseValue: fixture.multiplesInput.enterpriseValue ?? currentEnterpriseValue,
    gate1State: gate1.state,
    triggerBFired: triggerB.fired,
  });

  // --- M3 — margin history -----------------------------------------------
  const marginHistory = computeMarginHistory(fixture.marginHistory);

  // --- M4 — FCF ------------------------------------------------------------
  const fcf = computeFcf(fixture.fcf);

  // --- Methodology v2.1 D1 — the one rate this run is valued at ----------
  //
  // CF-AR4-RATE-REINVESTMENT-TERMINAL-01 (frozen spec §14.9 AR0-1). Replaces
  // the 8/10/12% grid's middle cell every rate-dependent module below used to
  // read. The rate, its band, the route that chose it and its dated policy
  // row are recorded in `valuationBasis` for the report.
  const discountRate = selectDiscountRate({
    sic: fixture.marketContext?.sic ?? null,
    triggerBFired: triggerB.fired,
    profile: fixture.profile.confirmedOrOverridden,
    leverage,
    priceDate,
  });
  const rate = discountRate.rate;

  // --- M5 — reinvestment / RONIC + implied-return-on-new-capital diagnostic
  const reinvestmentRonic = computeReinvestmentRonic(fixture.reinvestment, fixture.ronic, rate);
  // §10.0.1 / §10.2 Section D require every M1-M14 diagnostic in the
  // output, and V4 pins this one's MSFT value at 20.9% — so it belongs in
  // DiagnosticsResult like every other M1-M14 figure (schema corrected;
  // see DiagnosticsResult.impliedReturnOnNewCapital's own doc comment).
  // The formula is unchanged (computeImpliedReturnOnNewCapital, untouched).
  // A fixture that supplies no input (e.g. OKLO, pre-revenue — no
  // per-unit NOPAT concept) still produces a real Figure here, via the
  // SAME missing-REQUIRED-input path the function already uses for any
  // other incomplete call — never a field that's simply absent.
  const impliedReturnOnNewCapital = fixture.impliedReturnOnNewCapital
    ? computeImpliedReturnOnNewCapital(fixture.impliedReturnOnNewCapital)
    : computeImpliedReturnOnNewCapital({
        reinvestmentInput: {
          capex: null,
          acquisitions: null,
          financeLeaseRouAdditions: null,
          depreciationAndAmortization: null,
          deltaNwc: null,
          deltaRevenue: null,
        },
        currentNopat: null,
        currentYearNopatGrowth: null,
      });

  // --- M6 — steady-state EV / PVGO -----------------------------------------
  // Steady-state EV needs median-margin NOPAT directly. Derived here from
  // the reverseDcf bundle's own median margin x base revenue, after tax,
  // using the SAME nopatTaxRate every other module in this run reads from
  // `fixture.configuredConstants` — not a second, independently-chosen rate.
  const nopatTaxRateForRun = fixture.configuredConstants.nopatTaxRate;
  const medianMarginNopat: SourcedValue<Decimal> | null =
    fixture.reverseDcf.medianMargin !== null && baseRevenueSourced !== null && nopatTaxRateForRun !== null
      ? {
          value: baseRevenueSourced.value.mul(fixture.reverseDcf.medianMargin.value).mul(new Decimal(1).minus(nopatTaxRateForRun)),
          provenance: combineProvenance(baseRevenueSourced.provenance, fixture.reverseDcf.medianMargin.provenance),
        }
      : null;
  const currentMarginNopat: SourcedValue<Decimal> | null =
    fixture.reverseDcf.currentMargin !== null && baseRevenueSourced !== null && nopatTaxRateForRun !== null
      ? {
          value: baseRevenueSourced.value.mul(fixture.reverseDcf.currentMargin.value).mul(new Decimal(1).minus(nopatTaxRateForRun)),
          provenance: combineProvenance(baseRevenueSourced.provenance, fixture.reverseDcf.currentMargin.provenance),
        }
      : null;

  const steadyStateEvPvgo = computeSteadyStateEvPvgo({
    currentEnterpriseValue,
    medianMarginNopat,
    currentNopat: currentMarginNopat,
    discountRate: sourced(rate),
    leverageUnsupported: leverage.result === "LEVERAGE UNSUPPORTED IN v1",
    triggerAOrBFired: triggerA.fired || triggerB.fired,
  });

  // --- Methodology v2.1 D2 — the sheet's inputs, and the one engine -------
  //
  // CF-AR4-RATE-REINVESTMENT-TERMINAL-01 (frozen spec §14.9 AR0-3). A sheet
  // without a return on new investment for every scenario and a moat class
  // is PENDING ADOPTION (Calvin, 17 Oct 2026, Option A on #447): no D2 value
  // is computed from it — not by the engine, and not from a dollar figure
  // typed under the superseded conventions — and the report says so. No
  // agent authors either input (product-decisions item 19).
  const d2 = resolveD2Inputs(fixture, rate);

  // Every value below — M7, M8, M9, M14, M15 and the expected return — is
  // this one function: the scenario's growth (fixed path shape), margin and
  // return on new investment, the D2 terminal, the D1 rate and D2 timing.
  // `cause` names the first missing input where it cannot run.
  type ScenarioRun = { valuation: ScenarioValuation; cause: null } | { valuation: null; cause: string };
  const valueScenario = (
    key: keyof ScenarioSet,
    overrides: { growth?: Decimal; margin?: Decimal; ronic?: Decimal; terminalRoic?: Decimal; rate?: Decimal } = {}
  ): ScenarioRun => {
    const driver = fixture.scenarios[key];
    if (baseRevenueSourced === null) {
      return { valuation: null, cause: "base-year revenue is INCOMPLETE on this run (missing, or NOT CONFIRMED)" };
    }
    if (nopatTaxRateForRun === null) {
      return { valuation: null, cause: "missing REQUIRED input: the NOPAT tax rate (§7.1), not configured for this run" };
    }
    if (d2.terminal === null) return { valuation: null, cause: d2.statement };
    const growth = overrides.growth ?? (driver.revenueGrowthOrPath instanceof Decimal ? driver.revenueGrowthOrPath : null);
    const margin = overrides.margin ?? driver.operatingMargin;
    if (growth === null || margin === null) {
      return {
        valuation: null,
        cause: `missing REQUIRED input: the ${key} scenario's growth and margin are not both authored as single rates for this run`,
      };
    }
    const valuation = computeScenarioValuation(
      baseRevenueSourced.value,
      buildFixedShapeGrowthPath(growth),
      margin,
      overrides.ronic ?? (driver.returnOnNewInvestment as Decimal),
      overrides.terminalRoic ?? d2.terminal[key],
      overrides.rate ?? rate,
      nopatTaxRateForRun,
      POLICY.terminalGrowth,
      stubYears
    );
    return { valuation, cause: null };
  };
  const baseRun = valueScenario("base");

  // --- M7 — the reverse DCF: one solve on the main engine (AR0-2) ----------
  //
  // Same seam as §6.5's leverage precondition, above: companyInputs.ts sets
  // `reverseDcf.targetEnterpriseValue` to null because "filled by assemble
  // from M1's own output". The fixture's own value still wins where it
  // supplies one; where it supplies null and M1 is itself suppressed,
  // `currentEnterpriseValue` is null and the solve fails closed (§5.4).
  const baseDriver = fixture.scenarios.base;
  const reverseDcf = solveReverseDcf({
    baseYearRevenue: baseRevenueSourced,
    targetEnterpriseValue: fixture.reverseDcf.targetEnterpriseValue ?? currentEnterpriseValue,
    rate,
    nopatTaxRate: nopatTaxRateForRun,
    heldDrivers:
      d2.terminal !== null && baseDriver.operatingMargin !== null
        ? {
            operatingMargin: baseDriver.operatingMargin,
            returnOnNewInvestment: baseDriver.returnOnNewInvestment as Decimal,
            terminalReturnOnNewCapital: d2.terminal.base,
          }
        : null,
    heldDriversMissing: d2.terminal === null ? d2.statement : "missing REQUIRED input: the base scenario's operating margin",
    stubYears,
  });

  // --- M8 — terminal diagnostics, from this run's own base scenario DCF ----
  //
  // CF-AR3-REPRODUCIBLE-RUNS-01: the terminal value's share of the base
  // scenario's own M15 valuation. Where any input is missing the share is
  // NaN with its cause bound (notComputed.ts), never a zero.
  const terminalNotComputedCause: string | null = baseRun.cause;
  const terminal =
    baseRun.valuation !== null
      ? computeTerminalDiagnostics(baseRun.valuation.terminalValuePv, baseRun.valuation.enterpriseValue)
      : { terminalShareOfValue: new Decimal(NaN), terminalFcfConsistencyApplied: true as const };

  // --- M9 — implied exit multiple, labelled by the metric it actually divides
  //
  // The base scenario's own terminal value (undiscounted, at year 10) over
  // its own year-10 operating income — both from the valuation M8 reads.
  // CF-AR4-RATE-REINVESTMENT-TERMINAL-01 deleted the fixture-supplied
  // terminal-value placeholder this used to read (null on every run).
  const impliedExitMultiple = computeImpliedExitMultiple(
    baseRun.valuation !== null ? sourced(baseRun.valuation.terminalValue) : null,
    baseRun.valuation !== null ? sourced(baseRun.valuation.year10OperatingIncome) : null,
    "year-10 operating income (EBIT), base scenario"
  );

  // --- M10 — rate sensitivity ------------------------------------------------
  //
  // CB-AUDIT-01 H4. currentEnterpriseValue absent used to fall through to
  // `?? new Decimal(0)` here, substituting a zero enterprise value into a
  // real computation (0/0, a NaN sensitivity dressed up as a figure). Both
  // inputs are required before computing at all; without either, the module's
  // not-modelled state stands (no figure), and the reason is bound to the
  // output below so the report can say which input was missing.
  const rateSensitivityMissing =
    fixture.rateSensitivityCells === null
      ? "missing REQUIRED input: the base case revalued at a discount rate one point higher and one point lower — none was supplied for this run"
      : currentEnterpriseValue === null
        ? "missing REQUIRED input: enterprise value, which is INCOMPLETE on this run"
        : null;
  const rateSensitivity =
    fixture.rateSensitivityCells !== null && currentEnterpriseValue !== null
      ? computeRateSensitivity(
          currentEnterpriseValue.value,
          currentEnterpriseValue.value.mul(new Decimal(1).plus(fixture.rateSensitivityCells.plusOnePoint)),
          currentEnterpriseValue.value.mul(new Decimal(1).plus(fixture.rateSensitivityCells.minusOnePoint))
        )
      : rateSensitivityNotModelled();

  // --- M11 — FCF yield + growth ----------------------------------------------
  const fcfYieldGrowth = computeFcfYieldGrowth(fixture.fcfYieldGrowth);

  // --- M12 — run rate ----------------------------------------------------
  const runRate = computeRunRate(fixture.runRate);

  // --- M13 — shape mismatch -------------------------------------------------
  const shapeMismatch = computeShapeMismatch(fixture.shapeMismatch.guidedNearTermGrowth, fixture.shapeMismatch.impliedConstantGrowth);

  // --- M14 — sensitivity (§7.2), on the same engine ---------------------------
  //
  // AR0-2 moves the rate-band ends, growth, margin, return on new investment
  // and moat here. Every row varies one input of the base scenario's own
  // valuation (valueScenario above) and holds the rest:
  // - growth, operating margin: the analyst-supplied ranges
  //   (sensitivityRangesFor — MSFT only, CALVIN RULING — A); absent ranges
  //   report the module's own "missing REQUIRED analyst-supplied range";
  // - discount rate: D1's own ±0.5pp check points, the terminal return
  //   moving with the rate as D2 defines it (rate + moat credit);
  // - return on new investment: the adopted sheet's own bear / base / bull
  //   values;
  // - moat: D2's three credits;
  // - terminal growth: no range is approved, so it stays unavailable.
  const sensitivityRanges = sensitivityRangesFor(fixture.ticker);
  const sensitivity: SensitivityResult =
    baseRun.valuation === null || d2.terminal === null || d2.moatClass === null
      ? buildSensitivityResult()
      : (() => {
          const baseCaseValue = baseRun.valuation.enterpriseValue;
          const terminalCredit = d2.terminal.base.minus(rate);
          const at = (overrides: Parameters<typeof valueScenario>[1]): Decimal => {
            const run = valueScenario("base", overrides);
            return run.valuation === null ? new Decimal(NaN) : run.valuation.enterpriseValue;
          };
          const checkRange: AnalystSuppliedRange = {
            values: [discountRate.checkRates.lower, rate, discountRate.checkRates.upper],
            rationale: "Methodology v2.1 D1: the rate in use and its ±0.5pp verdict check points",
          };
          const ronicRange: AnalystSuppliedRange = {
            values: [
              fixture.scenarios.bear.returnOnNewInvestment as Decimal,
              fixture.scenarios.base.returnOnNewInvestment as Decimal,
              fixture.scenarios.bull.returnOnNewInvestment as Decimal,
            ],
            rationale: "the adopted sheet's bear / base / bull return on new investment",
          };
          const moatRange: AnalystSuppliedRange = {
            values: [POLICY.moatCredit.none, POLICY.moatCredit.narrow, POLICY.moatCredit.wide],
            rationale: "Methodology v2.1 D2: the moat credit for none / narrow / wide",
          };
          const tornado = computeTornado(baseCaseValue, {
            growth: { range: sensitivityRanges?.growth ?? null, valuationFunction: (g) => at({ growth: g }) },
            operatingMargin: { range: sensitivityRanges?.operatingMargin ?? null, valuationFunction: (m) => at({ margin: m }) },
            discountRate: { range: checkRange, valuationFunction: (r) => at({ rate: r, terminalRoic: r.plus(terminalCredit) }) },
            terminalGrowth: { range: null, valuationFunction: () => baseCaseValue },
            ronic: { range: ronicRange, valuationFunction: (x) => at({ ronic: x }) },
            moat: { range: moatRange, valuationFunction: (credit) => at({ terminalRoic: rate.plus(credit) }) },
          });
          const twoWayGrowthMargin = computeGrowthMarginTable(
            sensitivityRanges?.growth ?? null,
            sensitivityRanges?.operatingMargin ?? null,
            (g, m) => at({ growth: g, margin: m })
          );
          const twoWayRateTerminalGrowth = computeRateTerminalGrowthTable(checkRange, null, () => baseCaseValue);
          return { tornado, twoWayGrowthMargin, twoWayRateTerminalGrowth, debtShareRemoved: true as const };
        })();

  // --- M15 — scenario outputs ------------------------------------------------
  //
  // CF-NOPRICE-HONESTY-RECON-01 / CF-PRICE-DISPLAY-HONESTY-RECON-01.
  // `fixture.price.value` is §3.4's own always-present display sentinel
  // ($0 on a priceless run — unchanged); `fixture.enterpriseValue.price` is
  // the honest signal, already null exactly when this run has no price
  // (modules/enterpriseValue.ts's own REQUIRED input, wired in
  // acquisition/companyInputs.ts). Extracted once here so every consumer of
  // "does this run have a real price" — computeScenarioOutputs and the two
  // presentation bindings below — reads the identical value, never a second
  // signal invented for the same fact.
  const currentPrice = fixture.enterpriseValue.price?.value ?? null;

  // CF-ANALYZER-V1-SETTLE-01 — CALVIN RULING — A. Where no analyst authored
  // dollar scenario values (fixture.scenarioValues === null — an AI-proposed
  // bundle), each scenario is valued through the SAME engine (valueScenario)
  // to an enterprise value, then the SAME debt/cash/non-operating-investments
  // bridge term this run's own M1 output already carries converts that to
  // an equity value, divided by this scenario's own share count. Never a
  // second valuation model, and never computed where a REQUIRED input is
  // itself missing — scenarioValuesMissing names which, and the fair-value
  // range reports INCOMPLETE exactly as it already does for any other
  // missing REQUIRED input of it.
  // A4 — see `CompanyFixture.scenarioValuesAreFixtureCarried`'s own doc
  // comment. Checked before either `fixture.scenarioValues` or the dynamic
  // fallback below is read, so a fixture-carried real run reaches neither.
  const scenarioValuesBlockedAsFixtureCarried = fixture.scenarioValuesAreFixtureCarried === true;
  let scenarioValuesMissing: string | null = scenarioValuesBlockedAsFixtureCarried
    ? "this run's scenario dollar values are carried from the M5/M7 validation fixture (analystInputs.ts), not computed for this real acquired report — no acquisition-time valuation path supplies them yet (A4, CF-ANALYZER-INTEGRITY-PHASE-A-01)"
    : null;
  // The bridge's own net debt/cash/non-operating-investments term, held
  // constant across bear/base/bull exactly as the debt and cash on a
  // company's balance sheet do not change by scenario — inverting the
  // identical M1 formula rather than re-deriving a second one.
  const perShare = (enterpriseValue: Decimal, shareCount: Decimal): Decimal | null =>
    currentEnterpriseValue === null || currentMarketCap === null
      ? null
      : enterpriseValue.minus(currentEnterpriseValue.value.minus(currentMarketCap)).dividedBy(shareCount);
  const dynamicScenarioValue = (key: keyof ScenarioSet): Decimal => {
    if (currentEnterpriseValue === null || currentMarketCap === null) {
      scenarioValuesMissing = "enterprise value is INCOMPLETE on this run, so there is no debt/cash bridge to apply";
      return new Decimal(NaN);
    }
    const run = valueScenario(key);
    if (run.valuation === null) {
      scenarioValuesMissing = run.cause;
      return new Decimal(NaN);
    }
    return perShare(run.valuation.enterpriseValue, fixture.scenarios[key].shareCount) as Decimal;
  };

  // CF-ANALYZER-REAL-VALUATION-UNBLOCK-01 (REVIEW-38678066585-1, CORRECT) —
  // `fixture.recordedScenarioValuesComputeFromDrivers`'s own doc comment:
  // only a bundle read back from the recorded store (recordedBundles.ts)
  // with every scenario's drivers authored sets this, so a typed dollar
  // figure on that one source stops standing in for a real computation once
  // there is enough to compute one — never a hand-authored test fixture
  // (MSFT_FIXTURE/OKLO_FIXTURE used directly) or a partially-driven recorded
  // bundle, both of which keep the typed figure exactly as before.
  //
  // The trial below falls back to the typed figure when the recomputation
  // itself cannot run for a reason other than D2 adoption — e.g. NVDA's EV
  // bridge is INCOMPLETE for unrelated reasons. A sheet PENDING ADOPTION
  // never falls back: its typed figures were computed under the superseded
  // rate and reinvestment conventions, and D2 forbids presenting a value for
  // it at all.
  const recordedBundleFullyDriven =
    fixture.scenarioValues !== null &&
    !scenarioValuesBlockedAsFixtureCarried &&
    fixture.recordedScenarioValuesComputeFromDrivers === true;

  // CF-ANALYZER-REAL-VALUATION-UNBLOCK-01 (REVIEW-38680230521-1, CORRECT) —
  // `driver.shareCount` inside `dynamicScenarioValue` above divides a
  // raw-USD equity value, so it must be this run's own absolute diluted
  // share count. On the recorded-bundle entry path (recordedBundles.ts)
  // that field carries no stored unit contract — an analyst can type "7430"
  // meaning millions or "24.1" meaning billions, not the raw count — and
  // nothing before this outcome caught the mismatch (test 4's own
  // recomputation repeated the identical division, so it agreed with the
  // error instead of catching it). Checked only for a fully-driven recorded
  // bundle: an AI-proposed bundle's own `shareCount` is a buyback/dilution
  // MULTIPLE of the current share count, already converted to an absolute,
  // correctly-scaled count by aiProposedBundle.ts's `toScenarioDriverInputs`
  // before it ever reaches here, and is deliberately allowed to differ
  // across bear/base/bull (CF-ANALYZER-V1-SETTLE-01) — untouched by this
  // check.
  //
  // `dilutedSharesForRun` is this run's own M1 quantity, read back the same
  // way `perShare` above already inverts M1's enterprise-value formula
  // rather than re-deriving a second one (marketCap = dilutedShares * price,
  // so dilutedShares = marketCap / price). The band is a plumbing sanity
  // bound — not a finance assumption and never used to pick or weight a
  // valuation — wide enough for ordinary drift between when the bundle was
  // recorded and this run's own as-of date, and more than tight enough to
  // catch a thousand- or billion-scale unit mistake, which misses it by many
  // orders of magnitude.
  const dilutedSharesForRun: Decimal | null =
    currentMarketCap !== null && currentPrice !== null && !currentPrice.isZero()
      ? currentMarketCap.dividedBy(currentPrice)
      : null;
  const RECORDED_SHARE_COUNT_SANITY_BAND = { lo: new Decimal("0.8"), hi: new Decimal("1.2") };
  const recordedShareCountImplausible =
    recordedBundleFullyDriven &&
    dilutedSharesForRun !== null &&
    (["bear", "base", "bull"] as const).some((key) => {
      const ratio = fixture.scenarios[key].shareCount.dividedBy(dilutedSharesForRun);
      return ratio.lessThan(RECORDED_SHARE_COUNT_SANITY_BAND.lo) || ratio.greaterThan(RECORDED_SHARE_COUNT_SANITY_BAND.hi);
    });

  let dynamicScenarioValues: { bear: Decimal; base: Decimal; bull: Decimal } | null = null;
  if (recordedShareCountImplausible) {
    // Fail closed — never an absurd per-share figure, and never the typed
    // fixture.scenarioValues fallback below, which would silently reproduce
    // the first correction's own defect (a typed number standing in for a
    // genuine M1-M15 computation).
    scenarioValuesMissing =
      "this run's recorded share count is not plausible as an absolute raw share count for this run's own enterprise-value bridge (expected close to this run's own diluted share count; recordedBundles.ts stores no unit contract for it)";
  } else if ((fixture.scenarioValues === null || recordedBundleFullyDriven) && !scenarioValuesBlockedAsFixtureCarried) {
    const scenarioValuesMissingBeforeTrial = scenarioValuesMissing;
    const trial = { bear: dynamicScenarioValue("bear"), base: dynamicScenarioValue("base"), bull: dynamicScenarioValue("bull") };
    const trialFullyComputed = !trial.bear.isNaN() && !trial.base.isNaN() && !trial.bull.isNaN();
    if (trialFullyComputed || fixture.scenarioValues === null || d2.status === "PENDING ADOPTION") {
      dynamicScenarioValues = trial;
    } else {
      // The recomputation did not run to completion and there is a typed
      // figure to fall back to — revert the cause dynamicScenarioValue
      // recorded about ITS OWN attempt; it does not apply to the typed
      // value being used instead.
      scenarioValuesMissing = scenarioValuesMissingBeforeTrial;
    }
  }

  // Expected return at today's price: the discount rate at which the base
  // case's own cash flows — terminal return held at the D1 rate plus the
  // moat credit — are worth exactly the price. Searched above terminal
  // growth, where the Gordon terminal value is defined. Only where the base
  // value shown IS the engine's (a typed figure cannot be revalued).
  const revalueBaseCaseAtRate =
    dynamicScenarioValues !== null && !dynamicScenarioValues.base.isNaN() && currentEnterpriseValue !== null && currentMarketCap !== null
      ? (r: Decimal): Decimal => {
          const run = valueScenario("base", { rate: r });
          return run.valuation === null
            ? new Decimal(NaN)
            : (perShare(run.valuation.enterpriseValue, fixture.scenarios.base.shareCount) as Decimal);
        }
      : fixture.revalueBaseCaseAtRate;
  // The floor applies to the engine's own revaluation only; a fixture's
  // supplied function keeps the solver's default bracket.
  const rateSearchLo =
    revalueBaseCaseAtRate !== fixture.revalueBaseCaseAtRate
      ? POLICY.terminalGrowth.plus(EXPECTED_RETURN_SEARCH_FLOOR_ABOVE_TERMINAL_GROWTH)
      : undefined;

  // CF-AR5-VERDICT-CONSOLIDATION-01 — the Base at the D1 rate's ±0.5pp check
  // points (Methodology v2.1 D1/D3). The terminal return moves with the rate
  // as D2 defines it (rate + moat credit), exactly as M14's rate row above
  // revalues it. Only where the Base shown is the engine's own: a typed
  // figure cannot be revalued, and the check never mixes the two.
  const baseAtCheckRates: { baseAtCheckRates: { lower: Decimal; rate: Decimal; upper: Decimal } | null; baseAtCheckRatesCause: string | null } =
    (() => {
      if (dynamicScenarioValues === null || dynamicScenarioValues.base.isNaN()) {
        return {
          baseAtCheckRates: null,
          baseAtCheckRatesCause:
            scenarioValuesMissing ?? "the Base shown is a typed scenario value, which the engine cannot revalue at another rate",
        };
      }
      if (d2.terminal === null) return { baseAtCheckRates: null, baseAtCheckRatesCause: d2.statement };
      const terminalCredit = d2.terminal.base.minus(rate);
      const at = (r: Decimal): Decimal => {
        const run = valueScenario("base", { rate: r, terminalRoic: r.plus(terminalCredit) });
        return run.valuation === null
          ? new Decimal(NaN)
          : ((perShare(run.valuation.enterpriseValue, fixture.scenarios.base.shareCount) as Decimal | null) ?? new Decimal(NaN));
      };
      return {
        baseAtCheckRates: { lower: at(discountRate.checkRates.lower), rate: dynamicScenarioValues.base, upper: at(discountRate.checkRates.upper) },
        baseAtCheckRatesCause: null,
      };
    })();

  // A recorded sheet (recordedBundles.ts sets the flag either way) pending
  // adoption never falls back to its typed dollar figures either: they were
  // entered under the superseded rate and reinvestment conventions. A
  // hand-authored test fixture, which sets no flag, keeps its typed figures.
  const recordedSheetPendingAdoption =
    fixture.recordedScenarioValuesComputeFromDrivers !== undefined && d2.status === "PENDING ADOPTION";
  if (recordedSheetPendingAdoption && dynamicScenarioValues === null && !scenarioValuesBlockedAsFixtureCarried && !recordedShareCountImplausible) {
    scenarioValuesMissing = d2.statement;
  }
  const effectiveScenarioValues =
    scenarioValuesBlockedAsFixtureCarried || recordedShareCountImplausible || dynamicScenarioValues !== null || recordedSheetPendingAdoption
      ? null
      : fixture.scenarioValues;
  const scenarioOutputs = computeScenarioOutputs({
    bearValue: effectiveScenarioValues?.bear ?? dynamicScenarioValues?.bear ?? new Decimal(NaN),
    baseValue: effectiveScenarioValues?.base ?? dynamicScenarioValues?.base ?? new Decimal(NaN),
    bullValue: effectiveScenarioValues?.bull ?? dynamicScenarioValues?.bull ?? new Decimal(NaN),
    // Equal-weight, summing to 1 — display only, never a headline. Was
    // {1,1,1}, which sums to 3 and turned the weighted average into a
    // plain sum (B1, third-pass fix; authorised for this one line only).
    weights: { bear: new Decimal("1").dividedBy(3), base: new Decimal("1").dividedBy(3), bull: new Decimal("1").dividedBy(3) },
    currentPrice,
    revalueBaseCaseAtRate,
    rateSearchLo,
  });

  // --- §10 F — the analyst's scenarios, as the result carries them -----------
  //
  // A driver nobody authored reaches the schema's ScenarioSet as NaN — it has
  // no way to hold the absence — and the scenario gets INCOMPLETE bound to it
  // below, naming which drivers are missing.
  const missingDriversByScenario: Partial<Record<keyof ScenarioSet, string[]>> = {};
  const scenarioAsCarried = (key: keyof ScenarioSet): ScenarioDriverSet => {
    const s = fixture.scenarios[key];
    const missing = (Object.keys(DRIVER_LABELS) as NullableDrivers[]).filter((d) => s[d] === null);
    if (missing.length > 0) missingDriversByScenario[key] = missing.map((d) => DRIVER_LABELS[d]);
    return {
      ...s,
      revenueGrowthOrPath: s.revenueGrowthOrPath ?? new Decimal(NaN),
      operatingMargin: s.operatingMargin ?? new Decimal(NaN),
      reinvestmentCapitalIntensity: s.reinvestmentCapitalIntensity ?? new Decimal(NaN),
    };
  };
  const scenarios: ScenarioSet = {
    bear: scenarioAsCarried("bear"),
    base: scenarioAsCarried("base"),
    bull: scenarioAsCarried("bull"),
  };

  // --- states summary, BEFORE the range that has to read it ----------------
  //
  // M8-d FIX 1. This block used to sit at the bottom of the function, after
  // the fair-value range had already been built — so `gate0.result` was
  // recorded here and never read again, and a range rendered beside a state
  // saying there is no range. It is computed first now because the range is
  // downstream of it, which is the actual dependency.
  //
  // Each entry carries the §9.3 scope of what it suppresses (defaulted from
  // the state's own row by `scopeOf`) and its cause, so the output that gets
  // removed can name why (§9.5).
  const suppressing: ActiveSuppression[] = [];
  const qualifying: { flag: QualifyingFlag; appliesTo: string }[] = [];

  if (gate0.result !== "PASS") {
    suppressing.push({
      state: gate0.result,
      appliesTo: "all valuation outputs",
      cause: gate0Cause(gate0),
    });
  }
  // Gate 1 never refuses: HISTORY INSUFFICIENT (<5 filed years) is the only
  // SuppressingState it can return. SHORT HISTORY (5-9 years) is a
  // QualifyingFlag — the window is labelled, not suppressed (§6.2).
  if (gate1.state === "HISTORY INSUFFICIENT") {
    suppressing.push({
      state: "HISTORY INSUFFICIENT",
      appliesTo: "own-history percentile and history-based normalisation",
      cause: `${gate1.filedYearsCount} filed years`,
    });
  } else if (gate1.state === "SHORT HISTORY") {
    qualifying.push({ flag: "SHORT HISTORY", appliesTo: `history statistics (${gate1.filedYearsCount}-year window)` });
  }
  if (leverage.result === "LEVERAGE UNSUPPORTED IN v1") {
    suppressing.push({
      state: leverage.result,
      appliesTo: "every rate-dependent output",
      cause: leverageCause(leverage),
    });
  }
  if (fcfYieldGrowth.precondition === "PRECONDITION FAILED") {
    suppressing.push({ state: "PRECONDITION FAILED", appliesTo: "FCF yield + growth" });
  }
  if (reverseDcf.fiveYearGrowth.suppressed) {
    suppressing.push({
      state: reverseDcf.fiveYearGrowth.state,
      appliesTo: "the reverse-DCF solve",
      // The solve only, never the range (§9.3 row 5's "affected reverse-DCF
      // cell", which AR0-2 reads as the single solve).
      scope: "the affected reverse-DCF cell",
      cause: reverseDcf.fiveYearGrowth.cause,
    });
  }
  // --- outputs the schema types as a bare Decimal (notComputed.ts) --------
  //
  // Each was printed as a figure, or given a false reason for its absence,
  // when nothing computed it (CB-AUDIT-01 H2/H4). None is an input of the
  // fair-value range, so none removes it.
  if (rateSensitivityMissing !== null) {
    suppressing.push(notComputed(NOT_COMPUTED_BINDING.rateSensitivity, "INCOMPLETE", rateSensitivityMissing));
  }
  if (terminalNotComputedCause !== null) {
    suppressing.push(notComputed(NOT_COMPUTED_BINDING.terminalShareOfValue, "INCOMPLETE", terminalNotComputedCause));
  }
  // G. Three different outcomes all arrive as a null rate, and they are
  // three different statements: no revaluation function was supplied, so
  // nothing ran — a function was supplied but this run has no price to
  // solve toward (CF-PRICE-DISPLAY-HONESTY-RECON-01, CONTEXT item 6: the
  // module no longer solves against the flattened $0 `rateSolveTargetPrice`
  // used to substitute here) — or a function and a real price were both
  // present, the solver searched, and the bracket held no root. Checked in
  // that order so a run that already had no revaluation function supplied
  // (every real acquired run and MSFT_FIXTURE, today) keeps its existing
  // cause unchanged regardless of price.
  if (revalueBaseCaseAtRate === null) {
    suppressing.push(
      notComputed(
        NOT_COMPUTED_BINDING.rateAtWhichBaseEqualsPrice,
        "INCOMPLETE",
        baseRun.cause ??
          (currentEnterpriseValue === null
            ? "missing REQUIRED input: enterprise value, which is INCOMPLETE on this run, so the base case has no per-share value to solve for"
            : scenarioValuesMissing ??
              "this run's scenario values are typed figures, not the engine's own valuation, so there is no base case to revalue at other rates")
      )
    );
  } else if (currentPrice === null) {
    suppressing.push(
      notComputed(
        NOT_COMPUTED_BINDING.rateAtWhichBaseEqualsPrice,
        "INCOMPLETE",
        "missing REQUIRED input: a price for this run — a price is never estimated or carried forward from an earlier day"
      )
    );
  } else if (scenarioOutputs.rateAtWhichBaseEqualsPrice === null) {
    // Design §6's cause line for this state is "the bracket and the value at
    // each end". The bracket only: `states` is one of the members the blind
    // challenger receives (§8.5.1), so a base-case value written into a cause
    // here would reach the one call §8.5.2 keeps valuation outputs away from.
    const b = rateSearchBracket(revalueBaseCaseAtRate, rateSearchLo);
    const asPct = (r: Decimal) => `${r.mul(100).toDecimalPlaces(2).toString()}%`;
    suppressing.push(
      notComputed(
        NOT_COMPUTED_BINDING.rateAtWhichBaseEqualsPrice,
        "NO SOLUTION IN RANGE",
        `searched ${asPct(b.lo)} to ${asPct(b.hi)}: no rate in that bracket brings the base case to the price`
      )
    );
  }
  // CF-NOPRICE-HONESTY-RECON-01 — §3.4 / acquiredRun.ts's own committed
  // disclosure: a priceless run's position within the scenario range
  // reports incomplete rather than a number with no real price behind it
  // (docs/nvda-realrun-observation.md's "reported, not fixed" observation).
  // Not an input of the fair-value range (notComputed's own default INCOMPLETE
  // scope — "the affected reverse-DCF cell" — does not cover it, correctly,
  // same as rateAtWhichBaseEqualsPrice and rateSensitivity above).
  if (scenarioOutputs.priceLocationWithinRange === null) {
    suppressing.push(
      notComputed(
        NOT_COMPUTED_BINDING.priceLocationWithinRange,
        "INCOMPLETE",
        "missing REQUIRED input: a price for this run — none was available, so today's price has no position to report within the scenario range"
      )
    );
  } else if (scenarioOutputs.priceLocationWithinRange.isNaN()) {
    // A4 — a real price but NaN bear/bull values (scenarioValuesMissing above:
    // either an AI-proposed bundle's own missing drivers, pre-existing, or
    // this outcome's fixture-carried-validation block) has no real range to
    // locate the price within. Same binding/cause family as the null case
    // above — never a rendered "NaN%".
    suppressing.push(
      notComputed(
        NOT_COMPUTED_BINDING.priceLocationWithinRange,
        "INCOMPLETE",
        scenarioValuesMissing ?? "the scenario bear/bull values this position would be located within are not computed"
      )
    );
  }
  // CF-PRICE-DISPLAY-HONESTY-RECON-01 — §3.4's own AnalysisResult.price
  // stays a value and a timestamp always (never nullable, per HARD BOUNDS);
  // this is the state a presentation consumer binds to instead, so the
  // "Current price" tile, Section A's price row, the price chart panel and
  // the [C] price slot each show INCOMPLETE — never the flattened $0/blank
  // timestamp — on exactly the run this same `currentPrice` signal already
  // suppresses `priceLocationWithinRange` for, above. Not a second,
  // differently-derived signal: the identical `currentPrice` read.
  if (currentPrice === null) {
    suppressing.push(
      notComputed(
        NOT_COMPUTED_BINDING.price,
        "INCOMPLETE",
        "missing REQUIRED input: a price for this run — a price is never estimated or carried forward from an earlier day"
      )
    );
  }
  for (const key of ["bear", "base", "bull"] as const) {
    const missing = missingDriversByScenario[key];
    if (missing === undefined) continue;
    suppressing.push(
      notComputed(
        NOT_COMPUTED_BINDING.scenarioDrivers(key),
        "INCOMPLETE",
        `missing REQUIRED input(s): ${missing.join(", ")} — not authored for this scenario`
      )
    );
  }
  // CF-ANALYZER-V1-SETTLE-01 — CALVIN RULING — A. scenarioValuesMissing is
  // set above where fixture.scenarioValues is null (an AI-proposed bundle,
  // never an explicit analyst bundle) AND the dynamic computation through
  // the existing M15 model could not run — or (CF-ANALYZER-REAL-VALUATION-
  // UNBLOCK-01, REVIEW-38680230521-1) where a fully-driven recorded bundle's
  // own share count failed the plausibility check above, which fails this
  // closed rather than ever falling back to that bundle's typed figure.
  // Scoped explicitly to the range itself — the same override cashPerShare's
  // own check below uses — since these values ARE the range's bear/base/bull
  // (§9.6 rule 1's second clause), not a display figure of their own.
  if (scenarioValuesMissing !== null) {
    suppressing.push({
      ...notComputed(NOT_COMPUTED_BINDING.scenarioValues, "INCOMPLETE", scenarioValuesMissing),
      scope: "the fair-value range",
    });
  }
  // --- §7.2 M16 / CalFinance Methodology v2 — the acquired-run cash basis --
  //
  // cashPerShare is a REQUIRED input of the fair-value range (it IS the
  // range's `failure`/`cashFloor`), so its absence removes the range itself
  // (§9.6 rule 1's second clause) — the explicit `scope` override
  // suppression.ts documents for exactly this case. quarterlyBurn and
  // runway are not range inputs; their absence stays scoped to themselves.
  if (fixture.preRevenue !== null) {
    const pr = fixture.preRevenue;
    if (pr.cashPerShare === null) {
      suppressing.push({
        ...notComputed(NOT_COMPUTED_BINDING.cashPerShare, "INCOMPLETE", pr.cashPerShareCause ?? "not established"),
        scope: "the fair-value range",
      });
    }
    if (pr.quarterlyBurn === null) {
      suppressing.push(notComputed(NOT_COMPUTED_BINDING.quarterlyBurn, "INCOMPLETE", pr.quarterlyBurnCause ?? "not established"));
    }
    if (pr.runway === null) {
      suppressing.push(notComputed(NOT_COMPUTED_BINDING.runway, "INCOMPLETE", pr.runwayCause ?? "not established"));
    }
    // CF-MULTIPLES-NOPRICE-RECON-01. §10.3 names "success as the price
    // requires" (successAsPriceRequires, below) as one of the range's own
    // four parts for a pre-revenue company, so a missing price is a
    // REQUIRED input of the range itself here — the same standing
    // cashPerShare's check above already has — not merely of one displayed
    // figure inside it. fixture.enterpriseValue.price is the honest signal
    // (the same one the scenarioOutputs currentPrice read below reuses);
    // fixture.price.value stays the unconditional §3.4 display sentinel.
    if (fixture.enterpriseValue.price === null) {
      suppressing.push({
        ...notComputed(
          NOT_COMPUTED_BINDING.successAsPriceRequires,
          "INCOMPLETE",
          "missing REQUIRED input: a price for this run — a price is never estimated or carried forward from an earlier day"
        ),
        scope: "the fair-value range",
      });
    }
  }

  if (triggerA.fired) qualifying.push({ flag: "MARGIN AT HISTORICAL HIGH", appliesTo: "operating margin" });
  if (reinvestmentRonic.capitalLight) qualifying.push({ flag: "CAPITAL-LIGHT", appliesTo: "reinvestment/RONIC" });

  // --- §10 H — fair-value range ------------------------------------------
  // `successAsCommonlyDescribed` is a RANGE (types.ts), not a single
  // Decimal — corrected per the approved OKLO design mock
  // (design2/mock-report-oklo.html, hash-verified), which shows this as
  // "$31-$48" twice (lines 306, 683), never a single number. Populated
  // here from the [min, max] of every qualifying success value
  // (vSuccess > vFail) — no selection between them, both preserved
  // exactly as successDefinitions itself already holds them. When no
  // definition qualifies, both bounds fall back to cashFloor (the one
  // figure guaranteed present) rather than being invented.
  // vFail is always the acquired-run cash-per-share basis (methodology v2) —
  // never a per-definition input — so "qualifies" compares against that one
  // shared value, not a field the fixture's successDefinitions carry.
  const cashPerShareBasis = fixture.preRevenue?.cashPerShare ?? null;
  const qualifyingSuccessValues =
    fixture.preRevenue !== null && cashPerShareBasis !== null
      ? fixture.preRevenue.successDefinitions.filter((d) => d.vSuccess.greaterThan(cashPerShareBasis)).map((d) => d.vSuccess)
      : undefined;
  const computedFairValueRange: AnalysisResult["fairValueRange"] =
    fixture.preRevenue !== null
      ? {
          kind: "pre-revenue-distribution",
          failure: cashPerShareBasis ?? new Decimal(NaN),
          successAsCommonlyDescribed:
            qualifyingSuccessValues && qualifyingSuccessValues.length > 0
              ? {
                  low: qualifyingSuccessValues.reduce((min, v) => (v.lessThan(min) ? v : min)),
                  high: qualifyingSuccessValues.reduce((max, v) => (v.greaterThan(max) ? v : max)),
                }
              : { low: cashPerShareBasis ?? new Decimal(NaN), high: cashPerShareBasis ?? new Decimal(NaN) },
          successAsPriceRequires: fixture.price.value,
          cashFloor: cashPerShareBasis ?? new Decimal(NaN),
        }
      : {
          kind: "range",
          // Reads scenarioOutputs' own values rather than fixture.scenarioValues
          // directly — identical on an explicit analyst bundle, and the only
          // way to reach the AI-proposed/dynamic figures computeScenarioOutputs
          // was built from above (fixture.scenarioValues is null there).
          bear: scenarioOutputs.values.bear,
          bull: scenarioOutputs.values.bull,
          weightedValueInside: scenarioOutputs.weightedDistribution,
          drivingInputs: ["years 1-5 revenue growth", "operating margin path", "return on new investment"],
          scenarioLabelsWarning: triggerA.fired || triggerB.fired,
        };

  // §10.3 / §9.5 — "Where any suppressing state is active there is no
  // fair-value range. The state IS the output."
  //
  // The decision is the RULE in suppression.ts, over §9.3's own mapping of
  // state to suppressed output — not a check against the states this file
  // happens to know about. A state added to §9.3 later inherits this without
  // anything here changing.
  const rangeRemovedBy = stateRemovingFairValueRange(suppressing);
  const fairValueRange: AnalysisResult["fairValueRange"] =
    rangeRemovedBy === null
      ? computedFairValueRange
      : {
          kind: "suppressed",
          state: rangeRemovedBy.state,
          cause: rangeRemovedBy.cause ?? `suppressed with ${rangeRemovedBy.appliesTo}`,
        };

  // The range's own removal is itself an active state bound to the range
  // (§10.0.1: each state "bound to the output it applies to"), so the §10.2
  // section A manifest says the range is gone and why — rather than leaving
  // the reader to infer it from the absence.
  if (rangeRemovedBy !== null) {
    suppressing.push({
      state: rangeRemovedBy.state,
      appliesTo: "the fair-value range",
      scope: "the fair-value range",
      cause: rangeRemovedBy.cause,
    });
  }

  // --- M16 — pre-revenue module (populated only for that profile) --------
  const preRevenue =
    fixture.preRevenue !== null
      ? (() => {
          const p = fixture.preRevenue as PreRevenueFixture;
          const ramps = computeBothFundingRamps(p.backLoadedCapacityByYear, p.steadyCapacityByYear, p.fundingStackShared);
          const breakEven = computeUnitExitBreakEvenPrice(p.unitEconomics);
          const unitEconomicsBreakeven: Figure<Decimal> = breakEven.available
            ? { suppressed: false, value: breakEven.breakEvenOutputPrice, qualification: { provenanceTokens: CLEAN_PROVENANCE, analyticFlags: [] } }
            : { suppressed: true, state: "INCOMPLETE" as SuppressingState, cause: breakEven.cause };

          // V_fail is always the acquired-run cash-per-share basis — never a
          // per-definition input (CalFinance Methodology v2). V_success's
          // valuation date and comparable-basis evidence are each authored
          // per definition (Step 7, not yet built) and read as-is — assembly
          // never substitutes the run's price timestamp or any other "as of
          // today" attribution for a date nobody actually recorded (H3
          // conformance correction): doing so let a later, unrelated price
          // quote silently redate an unchanged success valuation.
          const vFail = p.cashPerShare ?? new Decimal(NaN);
          const vFailAsOfDate = p.cashPerShare !== null ? p.cashPerShareAsOfDate : null;

          const successDefinitions: SuccessDefinitionRow[] = p.successDefinitions
            .map((d) => {
              // "may be computed only when V_fail and V_success are
              // expressed on the same valuation date and otherwise
              // comparable basis" — both checked per row, since a future
              // per-definition V_success date/basis must not silently skip
              // either. The basis is only checked once the date has already
              // cleared — it is a second, independent reason to withhold,
              // not a substitute finding.
              const dateCause = successWeightDateCause(vFailAsOfDate, d.vSuccessAsOfDate);
              const cause = dateCause ?? successWeightBasisCause(ACQUIRED_CASH_SHARE_BASIS, d.vSuccessBasis);
              // CF-MULTIPLES-NOPRICE-RECON-01. computeImpliedProbability's
              // price is a real market comparator, not the §3.4 display
              // sentinel — fixture.enterpriseValue.price is the same honest
              // signal reused elsewhere in this file, and computeImpliedProbability
              // itself now carries the null case (its own REQUIRED-input rule,
              // checked only once the price-independent "worth less than
              // failure" case is ruled out). On today's acquired path this is
              // unreachable regardless — dateCause always fires first, since
              // vSuccessAsOfDate is unconditionally nulled a few lines above
              // by companyInputs.ts — so this corrects a $0 read that could
              // never surface today, not an observable change.
              const currentPrice = fixture.enterpriseValue.price?.value ?? null;
              const state: SuccessDefinitionState =
                cause !== null ? { kind: "NOT COMPUTED / SUPPRESSED", cause } : computeImpliedProbability(d.vSuccess, vFail, currentPrice);
              return {
                definition: d.definition,
                vSuccess: d.vSuccess,
                vSuccessAsOfDate: d.vSuccessAsOfDate,
                vFail,
                vFailAsOfDate,
                // Never defaulted to CLEAN_PROVENANCE where the fixture
                // itself carries no acquired-fact provenance to report (H3
                // conformance correction) — an absent provenance token must
                // not be silently reported as a clean, human-confirmed one.
                vFailProvenance: p.cashPerShare !== null ? p.cashPerShareProvenance : null,
                rSuccess: d.rSuccess,
                rFail: d.rFail,
                rateCapped: d.rateCapped,
                state,
              };
            })
            .sort((a, b) => a.vSuccess.minus(b.vSuccess).toNumber());

          const fundingStackByYear = {
            back_loaded: (ramps.back_loaded.years ?? []).map((y) => ({ year: y.year, lines: y.lines })),
            steady: (ramps.steady.years ?? []).map((y) => ({ year: y.year, lines: y.lines })),
          };

          return {
            cashPerShare: vFail,
            cashPerShareAsOfDate: vFailAsOfDate,
            // Never defaulted to CLEAN_PROVENANCE — same reasoning as
            // vFailProvenance above (H3 conformance correction).
            cashPerShareProvenance: p.cashPerShare !== null ? p.cashPerShareProvenance : null,
            quarterlyBurn: p.quarterlyBurn ?? new Decimal(NaN),
            quarterlyBurnAsOfDate: p.quarterlyBurn !== null ? p.quarterlyBurnAsOfDate : null,
            quarterlyBurnProvenance: p.quarterlyBurn !== null ? p.quarterlyBurnProvenance : null,
            runway: p.runway ?? new Decimal(NaN),
            runwayProvenance: p.runway !== null ? p.runwayProvenance : null,
            unitEconomicsBreakeven,
            fundingStackByYear,
            dilutionRequired: ramps.back_loaded.dilutionRequired ?? new Decimal(0),
            successDefinitions,
          };
        })()
      : null;

  // Named rather than inlined into the return, because §9.6 reads it: a
  // REQUIRED input of any other output being INCOMPLETE is one of PARTIAL's
  // conditions, and trust scans these figures for it.
  const diagnostics: AnalysisResult["diagnostics"] = {
    enterpriseValue: enterpriseValueBridge,
    multiples,
    marginHistory,
    fcf,
    reinvestmentRonic,
    impliedReturnOnNewCapital,
    terminal,
    impliedExitMultiple,
    rateSensitivity,
    fcfYieldGrowth,
    runRate,
    shapeMismatch,
    sensitivity,
  };

  const trust = computeTrustStatus({
    fairValueRange,
    states: { suppressing, qualifying },
    facts: fixture.facts,
    diagnostics,
    profileHumanConfirmed: fixture.trustInputs.profileHumanConfirmed,
    crossCheckFailedFactIds: fixture.trustInputs.crossCheckFailedFactIds,
    // CALVIN RULING — REJECT CURRENT PRODUCT SURFACE; BUILD ONE SIMPLE
    // COMPLETE RM-BRIEF PROOF (PR #399): "[manual profile confirmation]
    // must not block obvious supported operating companies... Classify
    // them deterministically/automatically." Gate 0 (§6.1) is already the
    // deterministic, fail-closed test for "is this company's profile
    // unambiguous" — it refuses every asset-based/financial/insurance/
    // reserve-extraction row, which is exactly the set the old PROFILE NOT
    // CONFIRMED qualifier existed to catch a human rubber-stamp for. So:
    // on the pure automatic path (profileAutoResolved set, never a human
    // decision — autoRun.ts Step 6) AND Gate 0 PASS, no new human act adds
    // information this run does not already have, and §6.3's own *Cannot
    // judge* escape hatch (a real human decision) still raises the
    // qualifier normally, because that path never sets profileAutoResolved
    // (autoRun.ts only resolves automatically where no decision exists).
    profileAutomaticallyUnambiguous:
      fixture.trustInputs.profileAutoResolved !== null && gate0.result === "PASS",
  });

  const factsForIdentity = fixture.facts.map((f) => ({ ...f, retrievalTimestamp: null }));

  return {
    schemaVersion: fixture.schemaVersion,
    runId: fixture.runId,
    ticker: fixture.ticker,
    companyName: fixture.companyName,
    price: fixture.price,
    facts: fixture.facts,
    provenance: [],
    gates: { gate0, gate1, leverage, triggerA, triggerB },
    profile: fixture.profile,
    // The §9.3 scope and the cause are assembly's working detail; the contract
    // member is the state and what it is bound to (§10.0.1).
    states: {
      suppressing: suppressing.map(({ state, appliesTo }) => ({ state, appliesTo })),
      qualifying,
    },
    diagnostics,
    scenarios,
    scenarioOutputs,
    priceImplied: {
      steadyStateEv: steadyStateEvPvgo.steadyStateEv,
      pvgo: steadyStateEvPvgo.pvgo,
      pvgoShareOfEv: steadyStateEvPvgo.pvgoShareOfEv,
      nopatGap: steadyStateEvPvgo.nopatGap,
      reverseDcf,
      impliedExitMultiple,
    },
    fairValueRange,
    // §9.6 — reading the `trust` computed above rather than re-deriving
    // §10.3 is what keeps the status and the refusal one fact.
    trust,
    achievedRevenueCagr: fixture.achievedRevenueCagr,
    preRevenue,
    // Both members are the AI layer's, and the AI layer runs AFTER this
    // function: §8.1 puts calculation on one side of the boundary and
    // interpretation on the other, and §8.5.4 says the challenger's findings
    // enter the report only once its own call has completed. Assembly
    // therefore produces an analysis that is complete and says nothing —
    // lib/analyzer/ai/run.ts merges the two in, and a report whose calls have
    // not run renders both sections honestly empty rather than inventing copy.
    challenger: null,
    interpretation: { statements: [], pageOne: null },
    // M9-ITEM5-CONTENT-01. The acquisition path always sets both on the
    // fixture; anything else falls back to the pre-existing honest empty
    // frame rather than assembly inventing content.
    business: fixture.business ?? {
      narrative: null,
      unavailableReason: "Business section content has not been built for this analysis.",
    },
    marketContext: fixture.marketContext ?? { sic: null, sicDescription: null },
    latestFiling: fixture.latestFiling ?? null,
    policy: {
      version: fingerprint("policy", POLICY),
      constants: POLICY,
      undefinedConstants: fixture.configuredConstants,
      provisionalLabels: buildProvisionalLabels(),
    },
    runIdentity: {
      codeVersion: codeVersion(),
      // The run id names the run, not its inputs, and a fact's retrieval
      // timestamp says when it was fetched, not what it is: two runs on
      // identical inputs share these fingerprints.
      inputsFingerprint: fingerprint("inputs", { ...fixture, runId: null, facts: factsForIdentity, verdictJudgements: undefined }),
      factSnapshot: fingerprint("facts", factsForIdentity),
      sheetVersion: fingerprint("sheet", {
        scenarios: fixture.scenarios,
        scenarioValues: fixture.scenarioValues,
        configuredConstants: fixture.configuredConstants,
        moatClass: fixture.moatClass ?? null,
      }),
      priceSnapshot: fixture.enterpriseValue.price === null ? null : { value: fixture.price.value, timestamp: fixture.price.timestamp },
      valuationTiming: {
        convention: "MID-YEAR",
        valuationDate: priceDate,
        basePeriodEnd,
        basePeriodKind: fixture.valuationBase?.kind ?? null,
        stubYears,
      },
    },
    valuationBasis: { discountRate, d2: d2.public },
    ...(fixture.verdictJudgements === undefined ? {} : { verdictJudgements: fixture.verdictJudgements }),
    verdictInputs: {
      ...baseAtCheckRates,
      roicFloor:
        fixture.roicHistory == null
          ? { status: "UNAVAILABLE", average: null, years: [], rate, reason: "no return-on-capital history was acquired for this run" }
          : evaluateRoicFloor({ ...fixture.roicHistory, rate }),
    },
  };
}

// The lower end of the expected-return search, above terminal growth: the
// Gordon terminal value is undefined at or below it. A plumbing bound, not
// a finance value — an expected return this close to terminal growth is
// reported as no solution in range.
const EXPECTED_RETURN_SEARCH_FLOOR_ABOVE_TERMINAL_GROWTH = new Decimal("0.0025");

const SCENARIO_KEYS = ["bear", "base", "bull"] as const;

/**
 * Methodology v2.1 D2 on this sheet: ADOPTED only with a moat class and a
 * return on new investment for every scenario. The terminal return on new
 * capital is the rate plus the moat credit — bear +0, base the class's
 * credit, bull the base credit + 1.5pp.
 */
function resolveD2Inputs(
  fixture: CompanyFixture,
  rate: Decimal
): { status: D2Inputs["status"]; moatClass: MoatClass | null; terminal: Record<keyof ScenarioSet, Decimal> | null; statement: string; public: D2Inputs } {
  const moatClass = fixture.moatClass ?? null;
  const missing: string[] = [];
  if (moatClass === null) missing.push("moat class");
  for (const key of SCENARIO_KEYS) {
    const ronic = fixture.scenarios[key].returnOnNewInvestment ?? null;
    if (ronic === null || !ronic.greaterThan(0)) missing.push(`${key} return on new investment`);
  }
  if (missing.length > 0 || moatClass === null) {
    const statement =
      `Pending adoption: this assumption sheet has no ${missing.join(", ")}, so its valuation under the approved rules ` +
      "(Methodology v2.1 D2 — reinvestment from the return on new investment, terminal return from the moat class) is not " +
      "computed. Calvin adopts the sheet with those inputs; no agent sets them.";
    const d2: D2Inputs = { status: "PENDING ADOPTION", missing, moatClass, terminalReturnOnNewCapital: null, statement };
    return { status: d2.status, moatClass, terminal: null, statement, public: d2 };
  }
  const terminal = {
    bear: terminalReturnOnNewCapital(rate, moatClass, "bear"),
    base: terminalReturnOnNewCapital(rate, moatClass, "base"),
    bull: terminalReturnOnNewCapital(rate, moatClass, "bull"),
  };
  const statement = `Adopted: ${moatClass} moat — terminal return on new capital is the rate plus ${POLICY.moatCredit[moatClass]
    .mul(100)
    .toFixed(1)}pp (bear +0pp; bull +${POLICY.moatCredit[moatClass].plus(POLICY.bullMoatCreditUplift).mul(100).toFixed(1)}pp).`;
  const d2: D2Inputs = { status: "ADOPTED", missing: [], moatClass, terminalReturnOnNewCapital: terminal, statement };
  return { status: d2.status, moatClass, terminal, statement, public: d2 };
}
