import Decimal from "decimal.js";
import { acquireCompany, type AcquiredCompany, type AcquisitionSource } from "./acquisition/provider";
import { buildCompanyInputs, type NonOperatingInvestmentSelection } from "./acquisition/companyInputs";
import { analystInputsFor } from "./acquisition/analystInputs";
import type { CandidateInvestment } from "./acquisition/acquire";
import {
  sectorClassificationFromSic,
  industryClassificationFromSic,
  interestIncomeOverRevenue,
  hasInsurancePremiumOrReserveLineItems,
} from "./acquisition/gate0Inputs";
import type { CompanyFixture } from "./assemble";
import type { BusinessSectionContent, MarketContextSectionContent } from "./types";
import { activeProvider } from "../marketdata";

// CF-ANALYZER-V1-SETTLE-01 — §4.4's non-operating-investments judgment has
// no options to offer the analyst when a filer's own SEC tags surface no
// candidates at all (acquire.ts's candidateNonOperatingInvestments comes
// back empty — acquire.ts is explicit that IT may not read anything beyond
// the tag mapping). This is a FALLBACK, consulted only in that empty case,
// never a second vote against a real tagged candidate: the market-data
// provider's own balance-sheet surface (yahooProvider.ts's
// fetchNonOperatingInvestments) is offered as one additional, honestly
// labelled candidate — the analyst still makes the §4.4 classification; this
// only gives them something to classify where SEC tagging gave them
// nothing. A provider failure, an untyped/missing field, or a genuine zero
// all return null from the provider call already (see its own comment), so
// this never fabricates a figure — it only forwards what the provider
// actually returned.
const PROVIDER_FALLBACK_TAG = "market-data:shortTermInvestments+longTermInvestments (fallback)";

/** Exported for acquiredRunNonOperatingFallback.test.ts only — not a second call site. */
export async function nonOperatingInvestmentsFallbackCandidate(
  ticker: string,
  source: AcquisitionSource | undefined
): Promise<CandidateInvestment | null> {
  // Same offline switch acquiredRun.ts's own options.source already carries
  // (gate.ts passes "CAPTURE" for ANALYZER_OFFLINE): no live call from an
  // offline run, for the identical reason latestPrice/fundamentals/
  // fiftyTwoWeekRange never call out in offline mode either.
  if (source === "CAPTURE") return null;

  const provider = activeProvider();
  const figure = await provider.fetchNonOperatingInvestments?.(ticker);
  if (figure == null) return null;

  return {
    tag: PROVIDER_FALLBACK_TAG,
    value: new Decimal(figure.value),
    asOfDate: figure.asOfDate,
    form: `${provider.sourceName} (fallback — no SEC-tagged candidate)`,
  };
}

// ---------------------------------------------------------------------------
// One run's inputs, assembled from real filings.
//
// This is the seam M8-a replaces. Before it, a run's numbers came from a
// fixture someone wrote by hand; after it, every FACT comes from a filing and
// carries how it was obtained. The analyst-side inputs still come from the
// validation bundle, and analystInputs.ts is where that is stated plainly.
// ---------------------------------------------------------------------------

/**
 * §6.1's five REQUIRED inputs, all four testable ones acquired.
 *
 * THE DEFECT THIS REPLACES had two halves, and fixing either alone would have
 * been worse than fixing neither:
 *
 *  1. `interestIncomeOverRevenue` and `hasInsurancePremiumOrReserveLineItems`
 *     were hard-coded null, so Gate 0 failed closed on every run for every
 *     company.
 *  2. Both classification fields were the SIC DESCRIPTION, which is never the
 *     vocabulary §6.1 tests against — so once the two nulls were filled, the
 *     sector and industry tests would still never fire and a bank would pass
 *     Gate 0. Supplying the nulls without fixing the lookup would have turned a
 *     gate that refused everything into a gate that refused nothing.
 */
function gate0InputsFrom(acquired: AcquiredCompany): CompanyFixture["gate0"] {
  const revenueFact = acquired.acquisition.facts.find((f) => f.id === "current-revenue");
  const revenue =
    revenueFact?.value instanceof Decimal
      ? revenueFact.value
      : revenueFact?.value != null
        ? new Decimal(String(revenueFact.value))
        : null;

  return {
    // Looked up from the SIC CODE. A company with a code has a classification,
    // so only a failed submissions lookup leaves these null — and then Gate 0
    // fails closed, which is §6.1's instruction rather than a gap.
    sectorClassification: sectorClassificationFromSic(acquired.sic, acquired.sicDescription),
    industryClassification: industryClassificationFromSic(acquired.sic, acquired.sicDescription),
    // Zero where no operating interest-income line appears; null only where
    // revenue is unavailable, which leaves the test genuinely unevaluable.
    interestIncomeOverRevenue: interestIncomeOverRevenue(acquired.companyFacts, revenue),
    // Read off the company's own reported elements. Null only where the fact
    // document itself is missing.
    hasInsurancePremiumOrReserveLineItems: hasInsurancePremiumOrReserveLineItems(
      acquired.companyFacts
    ),
    override: null,
  };
}

export class AnalystInputsUnavailableError extends Error {
  constructor(ticker: string) {
    super(
      `No analyst input bundle for ${ticker}. Scenarios are Step 7's output and ` +
        `cannot be acquired or invented — a run without them has no fair-value range.`
    );
    this.name = "AnalystInputsUnavailableError";
  }
}

export interface AcquiredRunInputs {
  fixture: CompanyFixture;
  acquired: AcquiredCompany;
  /** Fact-derived module inputs that came back null, and so return INCOMPLETE. */
  absentInputs: string[];
  /** Rendered to the analyst: what on this run was not acquired. */
  disclosures: string[];
}

export interface BuildAcquiredRunOptions {
  ticker: string;
  price: { value: Decimal; timestamp: string; source: string } | null;
  /**
   * §4.4's judgment, once the analyst has made it. Null means enterprise value
   * is INCOMPLETE — the correct state, since no tag says which investments are
   * non-operating.
   */
  nonOperatingInvestments?: NonOperatingInvestmentSelection | null;
  fiftyTwoWeek?: { low: Decimal; high: Decimal } | null;
  /**
   * Trailing/forward EPS, off the same market-data feed as `price` — a
   * provider field, never a filing tag (see companyInputs.ts's own comment
   * on why EPS has no §4.4 tag mapping). Null where not fetched; P/E reports
   * INCOMPLETE exactly as it already does for a missing filing input.
   */
  epsTrailing?: Decimal | null;
  epsForward?: Decimal | null;
  source?: AcquisitionSource;
  acquiredAt?: string;
  /**
   * §6.3. False after *Cannot judge* — the profile was used provisionally and
   * nobody confirmed it, which §9.6 rule 2 reads as PARTIAL.
   *
   * Defaults to false, the fail-closed direction: an unanswered run has not
   * been confirmed by anybody, and claiming otherwise would overstate how much
   * of the analysis can be used.
   */
  profileHumanConfirmed?: boolean;
}

export async function buildAcquiredRun(
  options: BuildAcquiredRunOptions
): Promise<AcquiredRunInputs> {
  const bundle = await analystInputsFor(options.ticker);
  if (bundle === null) throw new AnalystInputsUnavailableError(options.ticker);

  const acquiredBeforeFallback = await acquireCompany(options.ticker, {
    price: options.price,
    source: options.source,
    acquiredAt: options.acquiredAt,
  });

  // See this file's own comment on nonOperatingInvestmentsFallbackCandidate:
  // consulted only where the SEC tag mapping itself surfaced no candidates,
  // and never a second vote against one that did.
  const fallbackCandidate =
    acquiredBeforeFallback.acquisition.candidateNonOperatingInvestments.length === 0
      ? await nonOperatingInvestmentsFallbackCandidate(options.ticker, options.source)
      : null;
  const acquired: AcquiredCompany =
    fallbackCandidate === null
      ? acquiredBeforeFallback
      : {
          ...acquiredBeforeFallback,
          acquisition: {
            ...acquiredBeforeFallback.acquisition,
            candidateNonOperatingInvestments: [fallbackCandidate],
          },
        };

  // M9-ITEM5-CONTENT-01. Neither goes through buildCompanyInputs' numeric
  // fixture shape — `business` is the already-fetched Item 1 narrative
  // (or its reason for absence), and `marketContext` restates the same
  // sic/sicDescription Gate 0 already reads off `acquired`, this time for
  // the report's Market Context section rather than a classification test.
  const business: BusinessSectionContent = acquired.business;
  const marketContext: MarketContextSectionContent = {
    sic: acquired.sic,
    sicDescription: acquired.sicDescription,
  };
  const latestFiling = acquired.latestFiling;

  const { fixture: fixtureWithoutSourceContent, absentInputs } = buildCompanyInputs(
    acquired.acquisition,
    acquired.companyFacts,
    {
      ...bundle.inputs,
      nonOperatingInvestments: options.nonOperatingInvestments ?? null,
      fiftyTwoWeek: options.fiftyTwoWeek ?? null,
      epsTrailing: options.epsTrailing ?? null,
      epsForward: options.epsForward ?? null,
      gate0: gate0InputsFrom(acquired),
      // §9.6 rule 2. The cross-check outcomes come off the acquisition that
      // just ran, so trust reads this run's own failures rather than a
      // remembered set.
      trustInputs: {
        profileHumanConfirmed: options.profileHumanConfirmed ?? false,
        crossCheckFailedFactIds: [...acquired.crossCheckFailedFactIds],
        // Acquisition-time only: no run row exists yet to carry an automatic
        // resolution, so there is nothing to report here. gate.ts overrides
        // this wholesale from the run's own stored state on every load.
        profileAutoResolved: null,
      },
    },
    // CF-NOPRICE-HONESTY-RECON-01, extended by CF-MULTIPLES-NOPRICE-RECON-01.
    // The real, possibly-absent price — never flattened to a $0/blank
    // sentinel here any more. buildCompanyInputs itself now owns exactly
    // where that flattening still belongs (CompanyFixture.price alone) and
    // where the honest null carries through instead (enterpriseValue.price
    // and multiplesInput.price, both).
    options.price
  );

  const disclosures = [acquired.provenanceNote, bundle.note];
  if (fallbackCandidate !== null) {
    disclosures.push(
      "No SEC-tagged non-operating-investments candidate exists for this company, so the single " +
        `candidate offered for that judgment (as of ${fallbackCandidate.asOfDate}) came from ` +
        `${fallbackCandidate.form} instead of a filing tag.`
    );
  }
  if (options.nonOperatingInvestments == null) {
    disclosures.push(
      "You have not yet said which of this company's investments are non-operating, " +
        "so enterprise value and everything built on it reports incomplete. No tag in " +
        "the filings answers that question — the candidate line items are below, with " +
        "what each is carried at."
    );
  }
  if (options.price === null) {
    disclosures.push(
      "No price was available for this run, so anything that needs one reports " +
        "incomplete. A price is never estimated or carried forward from an earlier day."
    );
  }
  if (options.fiftyTwoWeek != null) {
    // M9-FIFTYTWOWEEK-01, SCOPE item 3. fetchHistoricalEod serves closes, not
    // intraday extremes, so the range M3 receives is a CLOSING-PRICE 52-week
    // range — narrower than an intraday high/low would be, and this says so
    // plainly rather than letting the figure pass for one.
    disclosures.push(
      "The 52-week range is the trailing range of daily CLOSING prices, " +
        "not an intraday high/low — the market-data feed this run reads serves " +
        "closes, not intraday extremes."
    );
  }

  const fixture: CompanyFixture = { ...fixtureWithoutSourceContent, business, marketContext, latestFiling };

  return { fixture, acquired, absentInputs, disclosures };
}
