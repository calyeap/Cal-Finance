import Decimal from "decimal.js";
import { CLEAN_PROVENANCE, MARKET_DATA_PROVENANCE, combineProvenance } from "../provenance";
import { TAG_MAP } from "./tagMap";
import {
  annualSeries,
  instantAnnualSeries,
  operatingMarginSeries,
  filedAnnualYearsCount,
  quarterlySeries,
  type AnnualSeries,
} from "./history";
import { computeAcquiredCashBasis, type AcquiredCashBasisResult } from "../modules/preRevenue";
import { achievedRevenueCagr, comparatorRecency, type WindowRecency } from "../calibration/inputs";
import type { AcquisitionResult } from "./acquire";
import type { CompanyFactsDocument } from "./secClient";
import type { CompanyFixture } from "../assemble";
import type { FactRecord, ProvenanceTokens, SourcedValue } from "../types";

// ---------------------------------------------------------------------------
// Acquisition -> the assembly seam.
//
// Every FACT-derived module input below is either a real acquired figure or
// NULL. There is no third case, and in particular there is no default: the
// modules resolve a null REQUIRED input to INCOMPLETE (§5.2), and that cascade
// "is correct and must not be softened" (§5.4).
//
// WHAT THIS FILE DOES NOT SUPPLY, and why it is a parameter rather than a
// value: the analyst-side inputs. Scenarios, their values, the base-case
// revaluation function and the four undefined policy constants (§7.1) are not
// facts and were never acquired from anything — they are Step 7's output, and
// Step 7's interface is not built. They arrive through `AnalystInputs` so that
// a reader of this file can see exactly where the fact set stops and the
// analyst's judgment begins.
// ---------------------------------------------------------------------------

function sourcedFrom(fact: FactRecord | undefined): SourcedValue<Decimal> | null {
  if (fact === undefined || fact.value === null) return null;
  const value = fact.value instanceof Decimal ? fact.value : new Decimal(String(fact.value));
  return {
    value,
    provenance: {
      sourceClass: fact.sourceClass,
      extractionType: fact.extractionType,
      verificationState: fact.verificationState,
    },
  };
}

function tokensOf(fact: FactRecord | undefined): ProvenanceTokens | null {
  if (fact === undefined) return null;
  return {
    sourceClass: fact.sourceClass,
    extractionType: fact.extractionType,
    verificationState: fact.verificationState,
  };
}

export interface NonOperatingInvestmentSelection {
  /** The tags the analyst classified as non-operating (§4.4). */
  tags: string[];
  value: Decimal;
  /** §3.5 requires the direction of the likely error beside the carrying value. */
  errorDirection: "understates" | "overstates" | null;
}

export interface AnalystInputs {
  profile: CompanyFixture["profile"];
  /**
   * §4.4's non-operating-investments judgment. NULL until the analyst makes
   * it, and null means enterprise value is INCOMPLETE — which is the correct
   * state, not a gap. No tag says which investments are non-operating.
   */
  nonOperatingInvestments: NonOperatingInvestmentSelection | null;
  /** 52-week range, from the price feed. Null where not fetched. */
  fiftyTwoWeek: { low: Decimal; high: Decimal } | null;
  /** Step 7. Not facts, not acquired. */
  scenarios: CompanyFixture["scenarios"];
  scenarioValues: CompanyFixture["scenarioValues"];
  revalueBaseCaseAtRate: CompanyFixture["revalueBaseCaseAtRate"];
  configuredConstants: CompanyFixture["configuredConstants"];
  preRevenue: CompanyFixture["preRevenue"];
  /** Gate 0's classification lookups, from the SEC submissions record. */
  gate0: CompanyFixture["gate0"];
  /**
   * §9.6 rule 2's two run-level inputs. Supplied by whoever knows them —
   * gate.ts reads the profile decision out of the database and the cross-check
   * outcomes off the acquisition — rather than defaulted here, because a
   * default would have trust describe a run it never looked at.
   */
  trustInputs: CompanyFixture["trustInputs"];
}

export interface CompanyInputsResult {
  fixture: CompanyFixture;
  /**
   * Which fact-derived module inputs came back null, and therefore which
   * outputs will return INCOMPLETE. Reported, never silently absorbed.
   */
  absentInputs: string[];
}

export interface H3CashBasis {
  cashBasis: AcquiredCashBasisResult;
  cashPerShareProvenance: ProvenanceTokens | null;
  quarterlyBurnProvenance: ProvenanceTokens | null;
  /**
   * Runway's own weakest-input provenance — the acquired cash balance AND
   * the acquired quarterly burn (§7.2 M16's runway dependency), never the
   * shares-outstanding token cashPerShareProvenance carries (H3 conformance
   * correction: runway does not depend on share count).
   */
  runwayProvenance: ProvenanceTokens | null;
}

/**
 * The H3 acquired-cash-basis calculation (methodology v2), derived from
 * whatever verification state a fact set's own three cash/share/burn facts
 * currently carry.
 *
 * Called twice in a real run's life, over two different fact arrays, never
 * two different mechanisms: once here in `buildCompanyInputs`, at
 * acquisition time, before any human decision exists; again by
 * `gate.ts:loadGateState`, over the SAME facts after `applyDecisions` has
 * recorded this run's final decisions. A fact this run marked NOT CONFIRMED
 * (a Cannot-verify decision) is treated exactly like one that was never
 * acquired — its value must not keep computing beside a rejected input
 * (H3 conformance correction, §3.8/§5.2). Reusing this one function for both
 * calls is what keeps that a single decision derivation rather than a second,
 * competing one.
 */
export function deriveH3CashBasis(facts: readonly FactRecord[]): H3CashBasis {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const cashBalanceFact = byId.get("cash-balance");
  const sharesOutstandingFact = byId.get("shares-outstanding");
  const quarterlyBurnFact = byId.get("quarterly-burn");

  const rejected = (f: FactRecord | undefined): boolean =>
    f !== undefined && f.verificationState === "NOT CONFIRMED";

  const usableRaw = (f: FactRecord | undefined): Decimal | null => {
    if (f === undefined || f.value === null || rejected(f)) return null;
    return f.value instanceof Decimal ? f.value : new Decimal(String(f.value));
  };

  const cashBasis = computeAcquiredCashBasis({
    cashBalance: usableRaw(cashBalanceFact),
    cashBalanceAsOfDate: cashBalanceFact?.asOfDate ?? null,
    sharesOutstanding: usableRaw(sharesOutstandingFact),
    quarterlyBurnRaw: usableRaw(quarterlyBurnFact),
    quarterlyBurnAsOfDate: quarterlyBurnFact?.asOfDate ?? null,
  });

  // A value nulled by REJECTION, rather than absence, still deserves an
  // accurate cause: "missing REQUIRED input" is not what happened to a fact
  // that WAS acquired and then marked NOT CONFIRMED.
  const rejectionCause = (name: string) =>
    `${name} is NOT CONFIRMED (a Cannot-verify decision) — a rejected input is not computed`;
  if (cashBasis.cashPerShare === null) {
    if (rejected(cashBalanceFact)) cashBasis.cashPerShareCause = rejectionCause("the acquired cash balance");
    else if (rejected(sharesOutstandingFact))
      cashBasis.cashPerShareCause = rejectionCause("shares outstanding used by the acquired run");
  }
  if (cashBasis.quarterlyBurn === null && rejected(quarterlyBurnFact)) {
    cashBasis.quarterlyBurnCause = rejectionCause("the acquired quarterly operating cash flow (burn)");
  }
  if (cashBasis.runway === null) {
    if (rejected(cashBalanceFact)) cashBasis.runwayCause = rejectionCause("the acquired cash balance");
    else if (rejected(quarterlyBurnFact)) cashBasis.runwayCause = rejectionCause("the acquired quarterly burn");
  }

  const cashPerShareProvenance =
    cashBasis.cashPerShare !== null && cashBalanceFact !== undefined && sharesOutstandingFact !== undefined
      ? combineProvenance(tokensOf(cashBalanceFact)!, tokensOf(sharesOutstandingFact)!)
      : null;
  const quarterlyBurnProvenance = cashBasis.quarterlyBurn !== null ? tokensOf(quarterlyBurnFact) : null;
  const runwayProvenance =
    cashBasis.runway !== null && cashBalanceFact !== undefined && quarterlyBurnFact !== undefined
      ? combineProvenance(tokensOf(cashBalanceFact)!, tokensOf(quarterlyBurnFact)!)
      : null;

  return { cashBasis, cashPerShareProvenance, quarterlyBurnProvenance, runwayProvenance };
}

export function buildCompanyInputs(
  acquisition: AcquisitionResult,
  companyFacts: CompanyFactsDocument,
  analyst: AnalystInputs,
  // CF-NOPRICE-HONESTY-RECON-01. Null exactly where this run has no price
  // (acquiredRun.ts's own options.price). CompanyFixture.price (§3.4 —
  // "always a value and a timestamp") and multiplesInput.price keep the
  // flattened $0 sentinel below, unchanged from before this outcome; only
  // enterpriseValue.price carries the honest absence through, since that is
  // the one REQUIRED input computeEnterpriseValue already knows how to read
  // as missing (modules/enterpriseValue.ts).
  price: { value: Decimal; timestamp: string } | null
): CompanyInputsResult {
  const byId = new Map(acquisition.facts.map((f) => [f.id, f]));
  const get = (id: string) => sourcedFrom(byId.get(id));
  const raw = (id: string): Decimal | null => {
    const f = byId.get(id);
    if (f === undefined || f.value === null) return null;
    return f.value instanceof Decimal ? f.value : new Decimal(String(f.value));
  };

  const revenueTags = TAG_MAP.find((e) => e.factId === "current-revenue")!.candidates;
  const operatingIncomeTags = TAG_MAP.find((e) => e.factId === "operating-income")!.candidates;

  const revenueAnnualSeries = annualSeries(companyFacts, revenueTags);
  const operatingIncomeAnnualSeries = annualSeries(companyFacts, operatingIncomeTags);
  const margins = operatingMarginSeries(revenueAnnualSeries, operatingIncomeAnnualSeries);

  // RONIC's invested-capital denominator (CALVIN RULING — FINANCING-SIDE
  // INVESTED CAPITAL, issue #298): total equity + interest-bearing debt +
  // lease liabilities not already in debt − cash and marketable securities,
  // each an instant (balance-sheet) quantity read across fiscal year-ends via
  // `instantAnnualSeries` — the instant counterpart of the `annualSeries`
  // calls just above, reusing the SAME candidate lists the current-period
  // `total-debt`/`finance-lease-liabilities`/`cash-and-marketable-debt-
  // securities` facts already resolve through (`get(...)` below), per
  // RETRIEVE FIRST item 3.
  const totalEquityAnnualSeries = instantAnnualSeries(
    companyFacts,
    TAG_MAP.find((e) => e.factId === "total-equity")!.candidates
  );
  const totalDebtAnnualSeries = instantAnnualSeries(
    companyFacts,
    TAG_MAP.find((e) => e.factId === "total-debt")!.candidates
  );
  const financeLeaseLiabilitiesAnnualSeries = instantAnnualSeries(
    companyFacts,
    TAG_MAP.find((e) => e.factId === "finance-lease-liabilities")!.candidates
  );
  const cashAndMarketableDebtSecuritiesAnnualSeries = instantAnnualSeries(
    companyFacts,
    TAG_MAP.find((e) => e.factId === "cash-and-marketable-debt-securities")!.candidates
  );
  // Weakest-input provenance behind the three genuinely REQUIRED terms
  // (§3.3) — null, and so blocking the whole delta, unless all three
  // resolved this fiscal year. Finance-lease liabilities are folded in only
  // when present: their absence is a reading (already in debt, per the
  // ruling's own carve-out), not a missing input, so it must not gate
  // provenance either.
  const investedCapitalProvenance: ProvenanceTokens | null = (() => {
    const equity = get("total-equity");
    const debt = get("total-debt");
    const cash = get("cash-and-marketable-debt-securities");
    if (equity === null || debt === null || cash === null) return null;
    const lease = get("finance-lease-liabilities");
    return lease === null
      ? combineProvenance(equity.provenance, debt.provenance, cash.provenance)
      : combineProvenance(equity.provenance, debt.provenance, cash.provenance, lease.provenance);
  })();

  // §10.6.2/§13 (CF-VERDICT-NONPOLICY-GAPS-01) — Step 7's achieved-history
  // comparator, ten years preferred (§10.6.2). Computed from the SAME
  // single-tag revenue series `margins` above already reads, and from
  // `companyFacts` directly (comparatorRecency), so this needs no
  // acquisition this seam does not already have. A ten-year figure is
  // reported blocked, with the function's own honest cause, on the (common,
  // per §10.6.2) filer whose single-tag series does not reach back that far
  // — no acquisition-time fallback horizon is chosen here, matching M8-c's
  // own calibration script, which reports both horizons separately rather
  // than substituting one for the other.
  const revenueRecency: WindowRecency =
    revenueAnnualSeries === null
      ? { currentFiscalYear: 0, reachedBy: null }
      : comparatorRecency(companyFacts, revenueAnnualSeries);
  const achievedRevenueCagrResult = achievedRevenueCagr(revenueAnnualSeries, 10, revenueRecency);
  const marginDecimals = (margins?.years ?? []).map((y) => new Decimal(y.margin));
  const quarters = quarterlySeries(companyFacts, revenueTags);

  const nonOp = analyst.nonOperatingInvestments;
  const nonOpSourced: SourcedValue<Decimal> | null =
    nonOp === null ? null : { value: nonOp.value, provenance: CLEAN_PROVENANCE };

  const absentInputs: string[] = [];
  const track = <T>(name: string, value: T | null): T | null => {
    if (value === null) absentInputs.push(name);
    return value;
  };

  const quarterSourced = (offset: number): SourcedValue<Decimal> | null => {
    const q = quarters[quarters.length - offset];
    return q === undefined ? null : { value: new Decimal(q.value), provenance: CLEAN_PROVENANCE };
  };

  // CalFinance Methodology v2's acquired-run cash basis (§7.2 M16). Overrides
  // the analyst bundle's own cashPerShare/quarterlyBurn/runway — which, where
  // one exists at all, is carried from the M5/M7 validation fixture and is not
  // filing data (analystInputs.ts) — with this run's own acquired facts.
  // Everything else in the analyst's preRevenue block (unit economics, the
  // funding stack, each success definition's V_success/rates) is not a fact
  // and is untouched here.
  // Weakest-input provenance (§3.3) behind each H3 output this acquisition
  // seam derives — carried through to assembly rather than dropped at the
  // acquired-fact boundary, so a SECONDARY / AI-EXTRACTED / not-confirmed
  // input still qualifies the figure at every point of use (H3 conformance
  // correction). At acquisition time no fact yet carries a human decision,
  // so this is identical to the pre-decision state; gate.ts re-derives the
  // same basis from this run's post-decision facts before assembly.
  const { cashBasis, cashPerShareProvenance, quarterlyBurnProvenance, runwayProvenance } = deriveH3CashBasis(
    acquisition.facts
  );
  const preRevenue: CompanyFixture["preRevenue"] =
    analyst.preRevenue === null
      ? null
      : {
          ...analyst.preRevenue,
          cashPerShare: cashBasis.cashPerShare,
          cashPerShareAsOfDate: cashBasis.cashPerShareAsOfDate,
          cashPerShareCause: cashBasis.cashPerShareCause,
          cashPerShareProvenance,
          quarterlyBurn: cashBasis.quarterlyBurn,
          quarterlyBurnAsOfDate: cashBasis.quarterlyBurnAsOfDate,
          quarterlyBurnCause: cashBasis.quarterlyBurnCause,
          quarterlyBurnProvenance,
          runway: cashBasis.runway,
          runwayCause: cashBasis.runwayCause,
          runwayProvenance,
          // Step 7 (the real analyst-authored per-definition V_success date
          // and comparable-basis evidence) does not exist yet, so
          // analyst.preRevenue.successDefinitions here is always the M5
          // illustrative validation bundle's own dollar figures, reused for
          // lack of anything else (analystInputs.ts). That bundle's own
          // vSuccessAsOfDate/vSuccessBasis are a deliberate claim about ITS
          // OWN illustrative construction — never acquired evidence for a
          // real run — so a real run explicitly nulls both back out here
          // rather than reporting a fabricated date/basis as if it had been
          // established for this company's actual filings (H3 conformance
          // correction). This correctly leaves every success weight
          // suppressed, honestly, on a real run until Step 7 exists.
          successDefinitions: analyst.preRevenue.successDefinitions.map((d) => ({
            ...d,
            vSuccessAsOfDate: null,
            vSuccessBasis: null,
          })),
        };

  const fixture: CompanyFixture = {
    schemaVersion: "v1.0.2",
    runId: `acquired-${acquisition.ticker.toLowerCase()}`,
    ticker: acquisition.ticker,
    companyName: acquisition.companyName,
    price: { value: price?.value ?? new Decimal(0), timestamp: price?.timestamp ?? "" },
    facts: acquisition.facts,

    gate0: analyst.gate0,
    trustInputs: analyst.trustInputs,
    gate1: { filedYearsCount: filedAnnualYearsCount(companyFacts) },
    leverage: {
      totalDebt: raw("total-debt"),
      financeLeaseLiabilities: raw("finance-lease-liabilities"),
      cashAndMarketableDebtSecurities: raw("cash-and-marketable-debt-securities"),
      // Filled by assemble from M1's own output; null here means M1 was
      // INCOMPLETE, which fails the leverage test closed (§5.3, §6.5).
      enterpriseValue: null,
      operatingLeaseLiabilities: raw("operating-lease-liabilities"),
      leveredResidualExceptionApplies: false,
    },
    triggerMargins: { yearlyOperatingMargins: marginDecimals },

    profile: analyst.profile,

    enterpriseValue: {
      sharesOutstanding: track("sharesOutstanding", get("shares-outstanding")),
      treasuryMethodDilution: track("treasuryMethodDilution", get("treasury-method-dilution")),
      // CF-NOPRICE-HONESTY-RECON-01. The only one of these seven REQUIRED
      // inputs that used to reach computeEnterpriseValue as a flattened $0
      // instead of the missing input it actually was — EnterpriseValueInput
      // already typed this field nullable (modules/enterpriseValue.ts);
      // nothing here previously supplied the null the type already allowed.
      price: track("price", price === null ? null : { value: price.value, provenance: CLEAN_PROVENANCE }),
      totalDebt: track("totalDebt", get("total-debt")),
      financeLeaseLiabilities: track("financeLeaseLiabilities", get("finance-lease-liabilities")),
      cashAndMarketableDebtSecurities: track(
        "cashAndMarketableDebtSecurities",
        get("cash-and-marketable-debt-securities")
      ),
      nonOperatingEquityInvestmentsAtBook: track(
        "nonOperatingEquityInvestmentsAtBook (§4.4 judgment — not a tagged fact)",
        nonOpSourced
      ),
      nonOperatingInvestmentsErrorDirection: nonOp?.errorDirection ?? null,
    },

    multiplesInput: {
      // CF-MULTIPLES-NOPRICE-RECON-01. The one named, not-fixed member of
      // the zero-price flattening class docs/noprice-honesty-
      // reconciliation.md §4 left open — the identical fix CF-NOPRICE-
      // HONESTY-RECON-01 gave enterpriseValue.price two lines above, applied
      // here. MultiplesInput.price is already SourcedValue<Decimal> | null
      // (modules/multiples.ts), so the already-known absence is carried
      // through via track() instead of being flattened to a $0 SourcedValue.
      // simpleMultiple (multiples.ts) already returns INCOMPLETE for a null
      // operand — nothing new is built for the suppressed case.
      price: track("price", price === null ? null : { value: price.value, provenance: CLEAN_PROVENANCE }),
      // EPS is not in this mapping version: the tagged element exists but the
      // §3.5 basis question (GAAP vs the I5 non-operating-items adjustment) is
      // a per-company decision this milestone does not make. Null, so P/E is
      // INCOMPLETE rather than computed on an unstated basis.
      epsTrailing: track("epsTrailing", null),
      epsForward: track("epsForward", null),
      enterpriseValue: null,
      ebit: get("operating-income"),
      ebitda: track("ebitda", null),
      cashFcf: get("cash-fcf"),
      marketCap: null,
      bookValue: track("bookValue", null),
      revenue: track("revenue", get("current-revenue")),
      impliedMarginForNormalMultiple: new Decimal("0.20"),
      // I5's symmetric trigger needs pre-tax income and the non-operating item
      // beside it. Neither is mapped in this version, so the basis is
      // unstated and P/E stays INCOMPLETE rather than being shown on a GAAP
      // basis that I5 might require adjusting.
      peBasis: {
        gaapEps: null,
        nonOperatingItemPretax: null,
        preTaxIncome: null,
        taxRate: null,
      },
      ownHistoryCurrentValue: null,
      ownHistoryValues: null,
    },

    marginHistory: {
      yearlyOperatingMargins: marginDecimals.map((m) => ({
        value: m,
        provenance: CLEAN_PROVENANCE,
      })),
      // Not CLEAN_PROVENANCE: that token is what the illustrative fixtures'
      // hand-authored analyst.fiftyTwoWeek happens to carry, and a real run's
      // range is a market-data-feed figure, not a fixture author's clean
      // construction. MARKET_DATA_PROVENANCE is the acquisition path's own
      // classification for that kind of value (see provenance.ts).
      fiftyTwoWeekLow:
        analyst.fiftyTwoWeek === null
          ? track("fiftyTwoWeekLow", null)
          : { value: analyst.fiftyTwoWeek.low, provenance: MARKET_DATA_PROVENANCE },
      fiftyTwoWeekHigh:
        analyst.fiftyTwoWeek === null
          ? track("fiftyTwoWeekHigh", null)
          : { value: analyst.fiftyTwoWeek.high, provenance: MARKET_DATA_PROVENANCE },
    },

    fcf: {
      operatingCashFlow: track("operatingCashFlow", get("operating-cash-flow")),
      cashCapex: track("cashCapex", get("capex")),
      financeLeaseRouAdditions: track(
        "financeLeaseRouAdditions",
        get("finance-lease-rou-additions")
      ),
      // NOPAT needs the §7.1 NOPAT tax rate, which is one of the four
      // undefined policy constants. Derived only where the run configures one.
      nopat: track("nopat", nopatFrom(get("operating-income"), analyst.configuredConstants.nopatTaxRate)),
      depreciationAndAmortization: track(
        "depreciationAndAmortization",
        get("depreciation-and-amortisation")
      ),
      deltaNwc: track("deltaNwc", null),
      sbc: track("sbc", get("sbc")),
    },

    reinvestment: {
      capex: get("capex"),
      // Genuinely nil is different from unknown (§4.3). Not acquired in this
      // mapping version, so null.
      acquisitions: track("acquisitions", null),
      financeLeaseRouAdditions: get("finance-lease-rou-additions"),
      depreciationAndAmortization: get("depreciation-and-amortisation"),
      deltaNwc: null,
      deltaRevenue: null,
    },
    // CF-RONIC-DELTAS-RECON-01 — both inputs are now acquired.
    //
    // `fiveYearDeltaNopat` needs a trailing five-year change in NOPAT,
    // computed from the SAME operating-income tag and the SAME configured
    // nopatTaxRate the single-period `nopat` field above already uses
    // (`nopatFrom`, defined below) — `fiveYearNopatDelta` applies that
    // identical per-year derivation to both endpoints of the operating-income
    // series already read for `margins` above (:202) rather than a second
    // acquisition, per RETRIEVE FIRST item 5.
    //
    // `fiveYearDeltaInvestedCapital` applies CALVIN RULING — FINANCING-SIDE
    // INVESTED CAPITAL (issue #298, 2026-09-24T17:24:14Z) — total equity +
    // interest-bearing debt + lease liabilities not already in debt − cash −
    // marketable securities — to both endpoints of the SAME trailing
    // five-year window `fiveYearDeltaNopat` uses, per `fiveYearInvestedCapital
    // Delta` below. Total equity was absent from every already-committed
    // capture at the time of the prior two passes; CALVIN RULING — AUTHORISE
    // NARROW TOTAL-EQUITY CAPTURE (issue #298, 2026-09-24T17:47:12Z) lifted
    // this outcome's own no-new-capture/EDGAR bound narrowly enough to supply
    // it, and that capture is now done (a `total-equity` TAG_MAP entry,
    // TAG_MAPPING_VERSION bumped to -09-3, NVDA/MSFT/OKLO re-captured — see
    // docs/ronic-deltas-composition-reconciliation.md §7). Finance-lease
    // liabilities stay governed by the ruling's own carve-out: where a filer
    // carries no separately captured lease-liability observation for a given
    // fiscal year, that is read as the lease already sitting inside the debt
    // figure — nothing additional to add — not a missing REQUIRED term
    // (`investedCapitalAt` below). Total equity, total debt and cash remain
    // genuinely REQUIRED: either endpoint missing leaves the whole delta null
    // with its cause, per spec `:455`'s cascade.
    ronic: {
      fiveYearDeltaNopat: track(
        "fiveYearDeltaNopat",
        fiveYearNopatDelta(
          operatingIncomeAnnualSeries,
          analyst.configuredConstants.nopatTaxRate,
          get("operating-income")?.provenance ?? null
        )
      ),
      fiveYearDeltaInvestedCapital: track(
        "fiveYearDeltaInvestedCapital",
        fiveYearInvestedCapitalDelta(
          operatingIncomeAnnualSeries,
          totalEquityAnnualSeries,
          totalDebtAnnualSeries,
          financeLeaseLiabilitiesAnnualSeries,
          cashAndMarketableDebtSecuritiesAnnualSeries,
          investedCapitalProvenance
        )
      ),
      lagBiasDirection: "conservative",
    },
    impliedReturnOnNewCapital: null,

    reverseDcf: {
      baseYearRevenue: get("current-revenue"),
      // Filled by assemble from M1's own output; null here means M1 was
      // INCOMPLETE, which fails the reverse-DCF grid closed (§5.4, §6.5's
      // seam, reused).
      targetEnterpriseValue: null,
      currentMargin: get("current-operating-margin"),
      medianMargin: track("medianMargin", medianOf(marginDecimals)),
      configuredStressMarginLevel: analyst.configuredConstants.stressMarginLevel,
      configuredNopatTaxRate: analyst.configuredConstants.nopatTaxRate,
    } as CompanyFixture["reverseDcf"],

    fcfYieldGrowth: {
      capex: get("capex"),
      financeLeaseRouAdditions: get("finance-lease-rou-additions"),
      depreciationAndAmortization: get("depreciation-and-amortisation"),
      // The ten-year FCF-conversion range is not acquired in this mapping
      // version. Null, so the precondition fails rather than passing untested
      // — §8.2's own output on failure is PRECONDITION FAILED, never a number.
      fcfConversionWithinNormalRange: null,
      fcfYieldValue: null,
    },

    runRate: {
      currentQuarterRevenue: quarterSourced(1),
      priorQuarterRevenue: quarterSourced(2),
      sameQuarterYear1: quarterSourced(5),
      sameQuarterYear1Prior: quarterSourced(6),
      sameQuarterYear2: quarterSourced(9),
      sameQuarterYear2Prior: quarterSourced(10),
      ttm: ttmFrom(quarters),
    },

    shapeMismatch: { guidedNearTermGrowth: null, impliedConstantGrowth: null },
    rateSensitivityCells: null,
    terminalValuePv: null,
    impliedExitMultipleMetric: { value: null, metricName: "EV/EBIT (operating income)" },

    scenarios: analyst.scenarios,
    scenarioValues: analyst.scenarioValues,
    revalueBaseCaseAtRate: analyst.revalueBaseCaseAtRate,
    configuredConstants: analyst.configuredConstants,
    achievedRevenueCagr: achievedRevenueCagrResult,
    preRevenue,
  };

  return { fixture, absentInputs };
}

function nopatFrom(
  operatingIncome: SourcedValue<Decimal> | null,
  taxRate: Decimal | null
): SourcedValue<Decimal> | null {
  if (operatingIncome === null || taxRate === null) return null;
  return {
    value: operatingIncome.value.mul(new Decimal(1).minus(taxRate)),
    provenance: operatingIncome.provenance,
  };
}

/**
 * NOPAT's own trailing five-year change: `nopatFrom` applied to both
 * endpoints of the operating-income annual series, five fiscal years apart.
 *
 * Mirrors `calibration/inputs.ts`'s `achievedRevenueCagr` endpoint-existence
 * refusal (RETRIEVE FIRST item 5) rather than inventing a second series
 * harness: the LATEST observation is the "to" endpoint (a single-candidate
 * tag, so there is no live-alternative-series recency check to make — see
 * docs/ronic-deltas-composition-reconciliation.md §1a), and the "from"
 * endpoint is the exact fiscal year five years earlier. Null unless BOTH
 * exist — no interpolation, no nearest-year substitute (§3.7).
 */
function fiveYearNopatDelta(
  series: AnnualSeries | null,
  nopatTaxRate: Decimal | null,
  operatingIncomeProvenance: ProvenanceTokens | null
): SourcedValue<Decimal> | null {
  if (series === null || nopatTaxRate === null || operatingIncomeProvenance === null) return null;

  const observations = series.observations;
  const to = observations[observations.length - 1];
  if (to === undefined) return null;

  const fromFiscalYear = to.fiscalYear - 5;
  const from = observations.find((o) => o.fiscalYear === fromFiscalYear);
  if (from === undefined) return null;

  const oneMinusTaxRate = new Decimal(1).minus(nopatTaxRate);
  const toNopat = new Decimal(to.value).mul(oneMinusTaxRate);
  const fromNopat = new Decimal(from.value).mul(oneMinusTaxRate);

  return { value: toNopat.minus(fromNopat), provenance: operatingIncomeProvenance };
}

/** One instant series's value at a given fiscal year, or null if it has none. */
function instantValueAt(series: AnnualSeries | null, fiscalYear: number): number | null {
  if (series === null) return null;
  const obs = series.observations.find((o) => o.fiscalYear === fiscalYear);
  return obs === undefined ? null : obs.value;
}

/**
 * CALVIN RULING — FINANCING-SIDE INVESTED CAPITAL (issue #298,
 * 2026-09-24T17:24:14Z), applied at one fiscal year-end: total equity +
 * interest-bearing debt + lease liabilities not already in debt − cash −
 * marketable securities.
 *
 * Total equity, total debt and cash are genuinely REQUIRED: either one
 * absent for this fiscal year returns null (spec `:455`'s cascade). Finance
 * lease liabilities are not — the ruling's own carve-out ("add a separately
 * captured lease liability only when it is not already contained in the debt
 * figure") reads a filer with no separately captured observation for this
 * fiscal year as the lease already sitting inside the debt figure, so its
 * absence contributes zero rather than blocking the whole term. This is not
 * a proxy or a default for a genuinely missing REQUIRED fact: it is what the
 * ruling itself says an absent separate lease-liability tag means.
 */
function investedCapitalAt(
  fiscalYear: number,
  equitySeries: AnnualSeries | null,
  debtSeries: AnnualSeries | null,
  leaseSeries: AnnualSeries | null,
  cashSeries: AnnualSeries | null
): Decimal | null {
  const equity = instantValueAt(equitySeries, fiscalYear);
  const debt = instantValueAt(debtSeries, fiscalYear);
  const cash = instantValueAt(cashSeries, fiscalYear);
  if (equity === null || debt === null || cash === null) return null;

  const lease = instantValueAt(leaseSeries, fiscalYear) ?? 0;

  return new Decimal(equity).plus(debt).plus(lease).minus(cash);
}

/**
 * Invested capital's own trailing five-year change, over the SAME two fiscal
 * years `fiveYearNopatDelta` computes its own delta over (`operatingIncome
 * Series`'s latest observation, and that year minus five) — RONIC's ratio
 * compares two five-year changes over one identical window, not two
 * independently-anchored ones. Null unless BOTH endpoints resolve, per
 * `investedCapitalAt` above.
 */
function fiveYearInvestedCapitalDelta(
  operatingIncomeSeries: AnnualSeries | null,
  equitySeries: AnnualSeries | null,
  debtSeries: AnnualSeries | null,
  leaseSeries: AnnualSeries | null,
  cashSeries: AnnualSeries | null,
  investedCapitalProvenance: ProvenanceTokens | null
): SourcedValue<Decimal> | null {
  if (operatingIncomeSeries === null || investedCapitalProvenance === null) return null;

  const observations = operatingIncomeSeries.observations;
  const to = observations[observations.length - 1];
  if (to === undefined) return null;
  const fromFiscalYear = to.fiscalYear - 5;

  const toCapital = investedCapitalAt(to.fiscalYear, equitySeries, debtSeries, leaseSeries, cashSeries);
  const fromCapital = investedCapitalAt(fromFiscalYear, equitySeries, debtSeries, leaseSeries, cashSeries);
  if (toCapital === null || fromCapital === null) return null;

  return { value: toCapital.minus(fromCapital), provenance: investedCapitalProvenance };
}

function medianOf(values: Decimal[]): SourcedValue<Decimal> | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a.comparedTo(b));
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? sorted[mid - 1].plus(sorted[mid]).dividedBy(2) : sorted[mid];
  return { value: median, provenance: CLEAN_PROVENANCE };
}

/**
 * Trailing twelve months from four discrete quarters.
 *
 * Null unless FOUR are present. Three quarters annualised is an estimate, and
 * §5.1 admits no estimate anywhere — "not by an interpolation".
 */
function ttmFrom(
  quarters: { value: number }[]
): SourcedValue<Decimal> | null {
  if (quarters.length < 4) return null;
  const last4 = quarters.slice(-4);
  const sum = last4.reduce((acc, q) => acc.plus(q.value), new Decimal(0));
  return { value: sum, provenance: CLEAN_PROVENANCE };
}
