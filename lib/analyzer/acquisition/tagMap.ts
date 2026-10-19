// ---------------------------------------------------------------------------
// The fixed, versioned tag mapping. §3.8.1.
//
// This file is the boundary the 6 September ruling draws. Where a figure is
// available as a tagged filing element under this mapping, the software
// acquires it that way; a model may not read a table where a tag exists. The
// mapping is DATA — a table, reproducible without a model — and its version
// string is recorded on every fact it produces, which is what §3.8.1 grants
// the queue exemption to.
//
// Two properties this file must keep:
//
//  1. Every entry names its tags explicitly. There is no "search the document
//     for something that looks like revenue" path, because that is extraction,
//     not mapping, and it would carry the mapping version while behaving like
//     a model.
//  2. The version changes whenever any entry changes. A mis-mapped tag is
//     wrong for every company at once, which is precisely why §3.8.1 rests the
//     exemption on the mapping's own version review rather than on an analyst
//     confirming one figure at a time.
// ---------------------------------------------------------------------------

/**
 * Bump on ANY change to the entries below — a tag added, removed, reordered or
 * re-scoped — AND on any change to the rule that decides which candidate wins
 * (`selectTagged.resolveEntry`). §3.8.1 requires the version to identify how a
 * fact was obtained; a version that could resolve different tags depending on
 * selection logic would not do that, so selection is part of what this string
 * names. Recorded on every fact acquired through this mapping, and it is the
 * handle a later reviewer uses to ask what a run was built on.
 *
 * -09-2 (9 September 2026) — the acquisition and mapping pass. Two changes,
 * one bump, one review (docs/tag-mapping-version-review.md):
 *
 *   1. SELECTION: a candidate whose series the filer has stopped reporting no
 *      longer wins over one that is current. Defect D's acquisition half.
 *   2. CANDIDATES: one added — the noncurrent/current debt pair under
 *      `total-debt`, below.
 *
 * The review measured five facts across the ten calibration companies whose
 * resolution changes, and NO fact moving between the §3.8.1 exempt and queued
 * sides. That second finding is the one that mattered: it is what kept the
 * bump inside an acquisition pass rather than making it a Command Center
 * decision.
 *
 * -09-3 (24 September 2026) — CF-RONIC-DELTAS-RECON-01 (issue #298), under
 * `CALVIN RULING — AUTHORISE NARROW TOTAL-EQUITY CAPTURE`. One change, no
 * selection-rule touch: `total-equity`, below, added to supply RONIC's
 * invested-capital denominator per `CALVIN RULING — FINANCING-SIDE INVESTED
 * CAPITAL` (issue #298, both 2026-09-24). Review
 * (docs/tag-mapping-version-review.md §9): a brand-new factId cannot change
 * which candidate any EXISTING entry resolves to, so this bump moves zero
 * previously-acquired facts across the §3.8.1 exempt/queued boundary — it
 * only ever adds a new one, present or absent per filer like any other entry.
 *
 * -10-1 (17 October 2026) — CF-AR4-RATE-REINVESTMENT-TERMINAL-01 (R5, the
 * bridge flags). Six factIds added, no existing entry or selection rule
 * touched: minority interests, preferred stock and convertible debt (the
 * Methodology's common-equity completeness claims), the disclosed fair value
 * of equity-method stakes, and two contingent items (unrecognised tax
 * benefits, guarantee exposure). As with -09-3, a new factId cannot change
 * which candidate any existing entry resolves to, so no previously-acquired
 * fact moves across the §3.8.1 exempt/queued boundary. Plus one cited
 * issuer-disclosure record, FINANCE_LEASES_INSIDE_TOTAL_DEBT, below the map.
 *
 * -10-2 (18 October 2026) — CF-AR6-BRIDGE-INPUT-RECOVERY-01 (issue #468).
 * Two candidates added to `total-debt` (below) and one SELECTION change:
 * `history.annualFiscalYears` — the source of `latestAnnualFiscalYear`, which
 * decides what "current" means in `selectTagged.preferCurrent` — no longer
 * counts a period that ends after the filing carrying it was filed. Review
 * (docs/tag-mapping-version-review.md §10): across the seven captured
 * companies, total-debt moves for NUE, KO and LLY only (value, row and
 * history series); MSFT, COST, NVDA and OKLO resolve byte-identically; NO
 * fact moves between the §3.8.1 exempt and queued sides.
 *
 * -10-3 (19 October 2026) — CF-LEG2-KO-COMMERCIAL-PAPER-01 (issue #487). One
 * component added, no selection-rule touch: `CommercialPaper` joins the last
 * `total-debt` candidate (`LongTermDebtAndCapitalLeaseObligations` + current
 * portion + `ShortTermBorrowings`), as it already is in candidates 1 and 4 —
 * the entry's own basis says commercial paper is "added where tagged". A
 * `plus` component never changes which candidate wins (`preferCurrent` reads
 * primaries only), only the winning candidate's sum. Review
 * (docs/tag-mapping-version-review.md §11): across the nine captures only KO
 * moves — 43,558M → 43,808M at 2026-04-03, FY2023–FY2025 history up by its
 * tagged paper; NUE records CommercialPaper absent at an unchanged value;
 * MSFT, COST, NVDA, LLY and OKLO resolve byte-identically; NO fact moves
 * between the §3.8.1 exempt and queued sides.
 */
export const TAG_MAPPING_VERSION = "calboard-secmap-2026-10-3";

export interface TagRef {
  ns: "us-gaap" | "dei";
  tag: string;
}

/**
 * One way of acquiring a quantity: a primary tag, plus any tags that must be
 * summed onto it to make up the whole.
 *
 * `plus` belongs to the CANDIDATE, not to the entry, and that is load-bearing.
 * Microsoft tags depreciation and amortisation as two separate elements while
 * other filers tag one combined DepreciationDepletionAndAmortization. An
 * entry-level `plus` would add the amortisation element onto the combined tag
 * as well, double-counting it for every filer using the combined form — a
 * mis-mapping that would be wrong for a whole class of companies at once and
 * would look entirely plausible in the report.
 */
export interface TagCandidate {
  ref: TagRef;
  plus?: TagRef[];
}

export interface TagMapEntry {
  /** The fact id the rest of the system knows this quantity by. */
  factId: string;
  name: string;
  /**
   * An instant (a balance-sheet position) or a duration (a flow over a
   * period). Drives which rows are eligible and what the as-of date means.
   */
  period: "instant" | "duration";
  /**
   * Duration entries only. "annual" takes a full fiscal year; "quarter" takes
   * a single quarter. A quarterly figure read as annual, or the reverse, is a
   * 4x error that looks entirely plausible — hence an explicit field rather
   * than whatever the latest row happens to be.
   */
  duration?: "annual" | "quarter";
  unit: "USD" | "shares" | "pure";
  /**
   * Ordered. The first candidate that resolves wins, and the resolved tag is
   * recorded on the fact — so a run always says which tag it actually used,
   * not merely which ones were possible.
   *
   * The order is a mapping decision, not a preference to be re-derived at
   * runtime: it goes most-specific first.
   *
   * Each candidate carries its own `plus` components, summed onto it where
   * present. A component that is absent is recorded as absent on the fact,
   * never silently treated as zero (§4.3) — `contributingTags` on the acquired
   * fact lists exactly what went in.
   */
  candidates: TagCandidate[];
  /** Why this mapping and not another. Read by a reviewer, not by code. */
  basis: string;
}

const usGaap = (tag: string): TagRef => ({ ns: "us-gaap", tag });
const dei = (tag: string): TagRef => ({ ns: "dei", tag });

/** A candidate taking one tag alone. */
const only = (ref: TagRef): TagCandidate => ({ ref });
/** A candidate whose quantity is that tag plus the named components. */
const withPlus = (ref: TagRef, ...plus: TagRef[]): TagCandidate => ({ ref, plus });

export const TAG_MAP: readonly TagMapEntry[] = [
  {
    factId: "shares-outstanding",
    name: "Shares outstanding",
    period: "instant",
    unit: "shares",
    // §3.5: "the most recent shares outstanding from the filing COVER PAGE or
    // balance sheet". dei:EntityCommonStockSharesOutstanding IS the cover
    // page, and it is more recent than the balance-sheet count by the weeks
    // between period end and filing.
    //
    // Explicitly NOT WeightedAverageNumberOfDilutedSharesOutstanding: §3.5
    // refuses it in terms ("Not the weighted-average diluted share count,
    // which is a backward-looking average of the period").
    candidates: [only(dei("EntityCommonStockSharesOutstanding")), only(usGaap("CommonStockSharesOutstanding"))],
    basis:
      "§3.5 — cover-page shares outstanding. dei:EntityCommonStockSharesOutstanding is the cover page itself; the balance-sheet count is the fallback where a filer omits it.",
  },
  {
    factId: "treasury-method-dilution",
    name: "Treasury-method dilution",
    period: "duration",
    duration: "annual",
    unit: "shares",
    // The incremental shares in the diluted-EPS denominator ARE the
    // treasury-method dilution from options, RSUs and warrants — that is what
    // the tag means and how the figure is computed under ASC 260.
    //
    // Cross-checkable exactly: diluted weighted-average minus basic
    // weighted-average must equal this (see crosschecks/reconciliation.ts).
    candidates: [only(usGaap("IncrementalCommonSharesAttributableToShareBasedPaymentArrangements"))],
    basis:
      "§3.5 — 'treasury-method dilution from options, RSUs and warrants per the equity note'. This tag is the incremental-share figure in the diluted-EPS denominator, which is that quantity. Genuinely absent for a loss-making company, where the awards are antidilutive and diluted equals basic — absence there is a fact, not a gap.",
  },
  {
    factId: "total-debt",
    name: "Total debt",
    period: "instant",
    unit: "USD",
    // us-gaap:LongTermDebt is the TOTAL carrying amount of long-term debt,
    // current portion included — it foots to LongTermDebtCurrent +
    // LongTermDebtNoncurrent, which crosschecks/footing.ts asserts.
    // Short-term borrowings sit outside the long-term-debt total and are added
    // to it. Absent for most filers, and recorded as absent rather than as
    // zero. The combined-amount fallback already includes them, so it takes no
    // components of its own.
    // The third candidate is the same quantity ASSEMBLED FROM ITS PARTS, and
    // it is last on purpose. LongTermDebt is the total as the filer states it;
    // the combined element is the same total under a different name; only
    // where a filer reports NEITHER total is the figure reconstructed from the
    // current and noncurrent halves it foots to.
    //
    // Added -09-2. Oklo tags LongTermDebtNoncurrent and no total at all, so
    // total-debt was NOT ACQUIRED and enterprise value was INCOMPLETE for a
    // reason that had nothing to do with §4.4. Costco and Rivian are the
    // second case: both stopped tagging LongTermDebt (2022 and 2024) while
    // continuing to report both halves, so both were carrying a stale total
    // that the selection rule alone could not rescue — there was nothing
    // current to rescue it WITH until this candidate existed.
    //
    // Why the parts and not LongTermDebtNoncurrent alone, which is what the
    // filers above have in common: noncurrent debt is not total debt. Taking
    // it alone would silently drop the current portion — $9.2bn of Microsoft's
    // $40.3bn — and understate the EV bridge for every filer this candidate
    // ever reaches. The current half is summed onto it, and where a filer does
    // not tag one (Oklo has no current portion) its absence is RECORDED on the
    // fact rather than read as a zero, per §4.3.
    //
    // -10-2 (CF-AR6-BRIDGE-INPUT-RECOVERY-01, issue #468) adds two more.
    //
    // Second: DebtCurrent + LongTermDebtNoncurrent. us-gaap:DebtCurrent is the
    // whole current debt line — current maturities, commercial paper and other
    // short-term borrowings together — so it takes no further components. It
    // is the PRIMARY here, not the noncurrent half, so the candidate only ever
    // resolves for a filer that tags it: led by the noncurrent half it would
    // resolve for every filer reporting LongTermDebtNoncurrent at all, and
    // would beat the fourth candidate below with the current portion recorded
    // absent (Costco's $2.2bn). It sits AHEAD of the combined element on
    // purpose: Eli Lilly tags the
    // combined element in its 10-K only, while its quarterly balance sheet
    // reports these two lines, so the combined figure trails the filer's
    // latest balance sheet (and its cash) by up to three quarters while still
    // reading as current by fiscal year. At the 10-K instant the two are the
    // same quantity — LLY 2025-12-31: 40,868M + 1,635M = 42,503M, exactly the
    // combined element.
    //
    // Last: LongTermDebtAndCapitalLeaseObligations + its current portion +
    // ShortTermBorrowings, the AR2 golden composition for NUE and KO
    // (lib/analyzer/golden/{nue,ko}.json), both of which stopped tagging any
    // debt-only element. These elements INCLUDE capital (finance) lease
    // obligations by definition, which is why this candidate is ranked last —
    // a debt-only total wins wherever one is current (docs/lease-once-
    // measurement.md §6) — and why reaching it never counts the leases once
    // by itself: that takes a cited issuer disclosure in
    // FINANCE_LEASES_INSIDE_TOTAL_DEBT below. Without one the separate lease
    // term stays REQUIRED.
    //
    // -10-3 (CF-LEG2-KO-COMMERCIAL-PAPER-01, issue #487) adds CommercialPaper
    // to that last candidate, in the same place it sits in the first and the
    // parts candidate: the lease-inclusive elements are long-term debt and
    // capital leases, noncurrent and current, so commercial paper sits outside
    // them and, per the basis below, is added where tagged. KO tags it (250M at 2026-04-03,
    // 1,495M at FY2025); NUE does not at its current instant and records it
    // absent. NotesAndLoansPayable / OtherShortTermBorrowings stay unmapped.
    candidates: [
      withPlus(usGaap("LongTermDebt"), usGaap("CommercialPaper"), usGaap("ShortTermBorrowings")),
      withPlus(usGaap("DebtCurrent"), usGaap("LongTermDebtNoncurrent")),
      only(usGaap("DebtLongtermAndShorttermCombinedAmount")),
      withPlus(
        usGaap("LongTermDebtNoncurrent"),
        usGaap("LongTermDebtCurrent"),
        usGaap("CommercialPaper"),
        usGaap("ShortTermBorrowings")
      ),
      withPlus(
        usGaap("LongTermDebtAndCapitalLeaseObligations"),
        usGaap("LongTermDebtAndCapitalLeaseObligationsCurrent"),
        usGaap("CommercialPaper"),
        usGaap("ShortTermBorrowings")
      ),
    ],
    basis:
      "§3.5's EV bridge takes 'total debt' separately from finance leases. us-gaap:LongTermDebt carries the full long-term carrying amount including the current portion; commercial paper and other short-term borrowings sit outside it and are added where tagged. Verified against the frozen mock-report-msft.html: 40.294 + 66.594 finance leases - 76.843 cash = 30.045, the mock's stated $30.0B net debt. Where a filer reports no debt total at all, the same quantity is reconstructed from LongTermDebtNoncurrent + LongTermDebtCurrent — the two halves us-gaap:LongTermDebt is defined to foot to, which is why the footing cross-check can be run against it unchanged.",
  },
  {
    factId: "total-equity",
    name: "Total equity",
    period: "instant",
    unit: "USD",
    // CALVIN RULING — FINANCING-SIDE INVESTED CAPITAL (issue #298,
    // 2026-09-24T17:24:14Z): RONIC's invested-capital denominator is "total
    // equity + interest-bearing debt + lease liabilities not already
    // included in debt − cash − marketable securities," goodwill included.
    // This entry supplies the first term. us-gaap:StockholdersEquity is
    // parent-company-only equity; the noncontrolling-interest-inclusive
    // variant is the fallback for a filer that reports consolidated equity
    // under that element instead. Neither candidate excludes goodwill, so
    // no ex-goodwill adjustment is introduced by taking either.
    candidates: [
      only(usGaap("StockholdersEquity")),
      only(usGaap("StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest")),
    ],
    basis:
      "CALVIN RULING — FINANCING-SIDE INVESTED CAPITAL (issue #298, 2026-09-24T17:24:14Z) names total equity as one term of RONIC's ruled invested-capital denominator. us-gaap:StockholdersEquity is the standard total-equity element; the noncontrolling-interest-inclusive variant is the fallback where a filer tags consolidated equity that way instead — same composition question the ruling settles, applied consistently to whichever tag a given filer uses.",
  },
  {
    factId: "finance-lease-liabilities",
    name: "Finance lease liabilities",
    period: "instant",
    unit: "USD",
    candidates: [only(usGaap("FinanceLeaseLiability"))],
    basis:
      "§3.5 — FINANCE leases only; operating leases stay in opex and out of the bridge. us-gaap:FinanceLeaseLiability is the total, current and noncurrent. Verified against mock-report-msft.html's stated $66.6B.",
  },
  {
    factId: "cash-and-marketable-debt-securities",
    name: "Cash and marketable debt securities",
    period: "instant",
    unit: "USD",
    candidates: [withPlus(usGaap("CashAndCashEquivalentsAtCarryingValue"), usGaap("ShortTermInvestments"))],
    // THE ONE MAPPING WITH TWO LIVE READINGS, resolved from the frozen
    // contract rather than by preference. See the plan document for the
    // arithmetic. The alternative — cash + AvailableForSaleSecuritiesDebt-
    // Securities (the investments NOTE rather than the balance sheet) — gives
    // Microsoft 92.019 and a net CASH position, which contradicts the frozen
    // mock's own sentence that "the sign of the net cash position flips to net
    // debt once $66.6B of finance leases are counted". It would also double-
    // count: cash equivalents' own debt securities appear in that note total.
    basis:
      "§3.5 — 'cash and marketable debt securities', deducted separately from non-operating EQUITY investments. Mapped to the balance-sheet cash line plus short-term investments. The investments-note total (AvailableForSaleSecuritiesDebtSecurities) is NOT used: it double-counts cash equivalents and contradicts the frozen mock's stated net-debt sign for Microsoft.",
  },
  {
    factId: "operating-lease-liabilities",
    name: "Operating lease liabilities (memo only)",
    period: "instant",
    unit: "USD",
    candidates: [only(usGaap("OperatingLeaseLiability"))],
    basis:
      "§3.5 — memo line in the §3.4 leverage test only. Never enters the EV bridge; including the liability while leaving rent in opex double-counts.",
  },
  {
    factId: "current-revenue",
    name: "Current-period revenue",
    period: "duration",
    duration: "annual",
    unit: "USD",
    candidates: [
      only(usGaap("RevenueFromContractWithCustomerExcludingAssessedTax")),
      only(usGaap("Revenues")),
      only(usGaap("RevenueFromContractWithCustomerIncludingAssessedTax")),
    ],
    basis:
      "§3.8 material fact. ASC 606 filers tag RevenueFromContractWithCustomerExcludingAssessedTax; Revenues is the older/general element and the fallback.",
  },
  {
    factId: "operating-income",
    name: "Operating income",
    period: "duration",
    duration: "annual",
    unit: "USD",
    candidates: [only(usGaap("OperatingIncomeLoss"))],
    basis:
      "The numerator of the operating margin (§3.8). Acquired as its own tagged fact so the margin is a derived figure whose inputs are themselves recorded (§3.1), never a figure read off a feed.",
  },
  {
    factId: "capex",
    name: "Capital expenditure (cash)",
    period: "duration",
    duration: "annual",
    unit: "USD",
    candidates: [
      only(usGaap("PaymentsToAcquirePropertyPlantAndEquipment")),
      only(usGaap("PaymentsToAcquireProductiveAssets")),
    ],
    basis:
      "§3.5 — 'cash capex' in all three FCF definitions. The cash-flow-statement payment line, not the property note's additions.",
  },
  {
    factId: "finance-lease-rou-additions",
    name: "Finance-lease ROU assets obtained in the period",
    period: "duration",
    duration: "annual",
    unit: "USD",
    candidates: [only(usGaap("RightOfUseAssetObtainedInExchangeForFinanceLeaseLiability"))],
    basis:
      "§3.6 — the ROU-ASSETS-OBTAINED disclosure, explicitly not the year-over-year change in the lease liability, which nets off principal repayments and understates the period's investment. §5.4 makes this the worked case of a REQUIRED input often absent from structured feeds.",
  },
  {
    factId: "operating-cash-flow",
    name: "Operating cash flow",
    period: "duration",
    duration: "annual",
    unit: "USD",
    candidates: [only(usGaap("NetCashProvidedByUsedInOperatingActivities"))],
    basis: "§3.5 — the first term of cash FCF.",
  },
  {
    factId: "sbc",
    name: "Share-based compensation",
    period: "duration",
    duration: "annual",
    unit: "USD",
    candidates: [only(usGaap("ShareBasedCompensation")), only(usGaap("AllocatedShareBasedCompensationExpense"))],
    basis: "I6 / §3.5 — cash FCF less SBC is the figure compared to the required return.",
  },
  {
    factId: "depreciation-and-amortisation",
    name: "Depreciation and amortisation",
    period: "duration",
    duration: "annual",
    unit: "USD",
    // Filers split here. The first three tags are already COMBINED figures and
    // take no components. Microsoft tags neither: it reports Depreciation and
    // AmortizationOfIntangibleAssets as two elements, so that candidate — and
    // only that candidate — sums them. Attaching the amortisation element to
    // the combined tags instead would double-count it.
    candidates: [
      only(usGaap("DepreciationDepletionAndAmortization")),
      only(usGaap("DepreciationAmortizationAndAccretionNet")),
      only(usGaap("DepreciationAndAmortization")),
      withPlus(usGaap("Depreciation"), usGaap("AmortizationOfIntangibleAssets")),
    ],
    basis:
      "§3.5 — the D&A term in unlevered FCF and in the §8.2 capex/D&A precondition. Where a filer reports no combined element, depreciation and intangible amortisation are summed; the combined tags are never summed with a component they already contain.",
  },
  // --- pre-revenue limb (§3.8) ------------------------------------------
  {
    factId: "cash-balance",
    name: "Cash balance",
    period: "instant",
    unit: "USD",
    candidates: [only(usGaap("CashAndCashEquivalentsAtCarryingValue"))],
    basis: "§3.8 pre-revenue limb. The balance itself, before any burn adjustment.",
  },
  {
    factId: "quarterly-burn",
    // Named for what the tag IS, not for what the pre-revenue module calls it.
    // The same element is Microsoft's +$45bn of quarterly operating cash flow
    // and Oklo's -$65m of burn; labelling the first "Quarterly burn" on a fact
    // card would put a false description on the one screen whose whole purpose
    // is checking figures against their sources.
    name: "Operating cash flow, latest single quarter (burn where negative)",
    period: "duration",
    duration: "quarter",
    unit: "USD",
    candidates: [only(usGaap("NetCashProvidedByUsedInOperatingActivities"))],
    basis:
      "§3.8 pre-revenue limb. A SINGLE QUARTER of operating cash flow — `duration: quarter` exists so this can never resolve to a year-to-date or annual row, which would understate the burn rate by up to four times.",
  },
  // --- CF-AR4-RATE-REINVESTMENT-TERMINAL-01 (R5) — bridge flags ----------
  // Each is OPTIONAL to the bridge: tagged, it is used or shown; absent, the
  // bridge flags it as unverified (enterpriseValue.ts) — never a zero.
  {
    factId: "minority-interest",
    name: "Minority (noncontrolling) interests",
    period: "instant",
    unit: "USD",
    candidates: [only(usGaap("MinorityInterest"))],
    basis:
      "Methodology, common-equity completeness: equity attributable to noncontrolling interests is a claim ahead of the common shareholder, so the bridge adds it to enterprise value like debt. us-gaap:MinorityInterest is the balance-sheet element.",
  },
  {
    factId: "preferred-stock",
    name: "Preferred stock",
    period: "instant",
    unit: "USD",
    candidates: [only(usGaap("PreferredStockValue"))],
    basis:
      "Methodology, common-equity completeness: preferred stock is senior to common equity, so the bridge adds it to enterprise value like debt. us-gaap:PreferredStockValue is the balance-sheet carrying amount.",
  },
  {
    factId: "convertible-debt",
    name: "Convertible debt (memo — inside total debt)",
    period: "instant",
    unit: "USD",
    candidates: [only(usGaap("ConvertibleDebt")), only(usGaap("ConvertibleNotesPayable"))],
    basis:
      "Methodology, common-equity completeness: convertible notes are inside the us-gaap debt totals `total-debt` reads, so this figure is shown, never added again. Dilution on conversion is not modelled.",
  },
  {
    factId: "equity-method-investments-fair-value",
    name: "Equity-method investments — disclosed quoted fair value (memo)",
    period: "instant",
    unit: "USD",
    candidates: [only(usGaap("EquityMethodInvestmentQuotedMarketValue"))],
    basis:
      "R5: strategic stakes stay at book in the bridge (§3.5, §4.4); where the filer discloses their quoted market value it is shown beside the book figure, never substituted for it.",
  },
  {
    factId: "unrecognized-tax-benefits",
    name: "Unrecognized tax benefits (contingent — memo)",
    period: "instant",
    unit: "USD",
    candidates: [only(usGaap("UnrecognizedTaxBenefits"))],
    basis:
      "R5: contingent items are listed with the bridge, never deducted. Unrecognized tax benefits are the structured trace of an open tax dispute (e.g. KO's IRS case); the disputed total, where larger, lives in filing text this mapping does not read.",
  },
  {
    factId: "guarantee-maximum-exposure",
    name: "Guarantee obligations — maximum exposure (contingent — memo)",
    period: "instant",
    unit: "USD",
    candidates: [only(usGaap("GuaranteeObligationsMaximumExposure"))],
    basis:
      "R5: contingent items are listed with the bridge, never deducted. us-gaap:GuaranteeObligationsMaximumExposure is the undiscounted maximum the filer could be required to pay.",
  },
];

const BY_FACT_ID = new Map(TAG_MAP.map((e) => [e.factId, e]));

export function tagMapEntry(factId: string): TagMapEntry | null {
  return BY_FACT_ID.get(factId) ?? null;
}

// ---------------------------------------------------------------------------
// Deliberately NOT in the mapping, and why. §3.8.1's fallback conditions turn
// on "no tag exists" versus "the tag is present but unmapped in the version in
// force", so an absence has to be a recorded decision rather than an omission
// nobody wrote down.
// ---------------------------------------------------------------------------

export interface UnmappedFact {
  factId: string;
  name: string;
  /**
   * NO_TAG    — the quantity is not a tagged filing element for any filer.
   * JUDGMENT  — it is a §4.4 judgment, not a reported line; acquisition
   *             supplies candidates and the human classifies.
   * NOT_FILING — it does not come from a filing at all.
   */
  reason: "NO_TAG" | "JUDGMENT" | "NOT_FILING";
  basis: string;
}

export const UNMAPPED_FACTS: readonly UnmappedFact[] = [
  {
    factId: "price",
    name: "Price",
    reason: "NOT_FILING",
    basis:
      "A market quote, not a filing element. Acquired from the market-data provider with its timestamp (§3.4). DETERMINISTIC/STRUCTURED but NOT tag-mapped, so it is QUEUED under §3.8.1 guard 1 — a structured feed field with no mapping version is queued like any other.",
  },
  {
    factId: "non-operating-equity-investments",
    name: "Non-operating equity investments at book",
    reason: "JUDGMENT",
    basis:
      "§4.4 — 'a classification, not a reported line'. No tag says which of a company's equity investments are non-operating; that is the judgment the analyst makes. Acquisition supplies the CANDIDATE line items (see candidateNonOperatingInvestmentTags) carried at book, and the human confirms. Auto-mapping a tag here would be a judgment presented as a fact, which is the exact failure §4.4 exists to prevent.",
  },
];

/**
 * The tagged line items offered to §4.4's non-operating-investments judgment.
 *
 * These are CANDIDATES, not a mapping. Nothing here is acquired as the
 * non-operating-investments fact; each is presented with its book value so the
 * analyst can classify. §3.5 requires the carrying value and the direction of
 * the likely error to be stated beside whatever they choose.
 */
export const CANDIDATE_NON_OPERATING_INVESTMENT_TAGS: readonly TagRef[] = [
  usGaap("EquityMethodInvestments"),
  usGaap("EquitySecuritiesWithoutReadilyDeterminableFairValueAmount"),
  usGaap("EquitySecuritiesFvNiCurrentAndNoncurrent"),
  usGaap("LongTermInvestments"),
];

// ---------------------------------------------------------------------------
// CF-AR4-RATE-REINVESTMENT-TERMINAL-01 (R5; closed issue #311) — filers whose
// own filings state that their finance leases sit inside the total-debt
// figure `total-debt` resolves. For them the bridge counts the leases once,
// inside total debt, and adds no separate lease term (enterpriseValue.ts).
//
// A cited issuer disclosure, never an inference from a tag being present or
// absent (docs/lease-once-measurement.md §6). Keyed by zero-padded CIK.
// ---------------------------------------------------------------------------

export const FINANCE_LEASES_INSIDE_TOTAL_DEBT: Readonly<Record<string, { ticker: string; source: string }>> = {
  "0000059478": {
    ticker: "LLY",
    source:
      'Eli Lilly FY2024 Form 10-K, leases note: "Finance leases are included in property and equipment, short-term ' +
      'borrowings and current maturities of long-term debt, and long-term debt in our consolidated balance sheets" ' +
      "(docs/filing-text-evidence-routes.md)",
  },
  "0000073309": {
    ticker: "NUE",
    source:
      "Nucor FY2025 Form 10-K (accession 0001193125-26-071575), Note 6 leases, supplemental balance-sheet table: " +
      'current finance lease liabilities ($24M) classified in "Current portion of long-term debt and finance lease ' +
      'obligations"; non-current finance lease liabilities ($234M) classified in "Long-term debt and finance lease ' +
      'obligations due after one year" (docs/evidence/nue-fy2025-finance-lease-classification-capture.md)',
  },
};
