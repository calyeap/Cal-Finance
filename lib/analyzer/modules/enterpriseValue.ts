import Decimal from "decimal.js";
import { combineProvenance } from "../provenance";
import { computedValue, suppressedValue } from "../figures";
import type { BridgeClaim, BridgeFlags, EnterpriseValueBridge, SourcedValue } from "../types";

// M1 — enterprise value and equity bridge (§2.1, §3.5, §7.2). Single
// definition, applied identically to every company (§9 mistake 18): no
// per-company variation, no alternate path.

export interface EnterpriseValueInput {
  sharesOutstanding: SourcedValue<Decimal> | null;
  treasuryMethodDilution: SourcedValue<Decimal> | null;
  price: SourcedValue<Decimal> | null;
  totalDebt: SourcedValue<Decimal> | null;
  financeLeaseLiabilities: SourcedValue<Decimal> | null;
  cashAndMarketableDebtSecurities: SourcedValue<Decimal> | null;
  nonOperatingEquityInvestmentsAtBook: SourcedValue<Decimal> | null;
  // Descriptive only, not a computed figure — carried alongside the book
  // value per §3.5. Independent of whether the other REQUIRED inputs are
  // present.
  nonOperatingInvestmentsErrorDirection: "understates" | "overstates" | null;
  // CALVIN RULING — A, REQUIRE SAME-DATE EV BRIDGE INPUTS (issue #308,
  // 25 Sep 2026 03:46:48Z, implemented under #309). The as-of date each of
  // the three named instant balance-sheet inputs above resolved to —
  // internal plumbing for this module's own INCOMPLETE cause, carrying no
  // new rendered state and no new public contract. Optional so a caller
  // that does not carry dates (e.g. calibrate-position.ts, and every
  // existing unit test's synthetic input) skips the same-date test below
  // entirely rather than being read as a mismatch — the ruling requires
  // REFUSING an incoherent bridge, never inventing coherence for one that
  // was never dated at all.
  totalDebtAsOfDate?: string | null;
  financeLeaseLiabilitiesAsOfDate?: string | null;
  cashAndMarketableDebtSecuritiesAsOfDate?: string | null;
  // CF-AR4-RATE-REINVESTMENT-TERMINAL-01 (R5) — the Methodology's
  // common-equity completeness rule: senior or non-common claims are either
  // in the bridge or flagged. Optional so a caller that never acquired them
  // (every pre-AR4 input) reads as "not tagged" — flagged, never zero.
  // Minority interests and preferred stock, where tagged, are claims ahead
  // of common equity and are added to enterprise value like debt.
  minorityInterest?: SourcedValue<Decimal> | null;
  preferredStock?: SourcedValue<Decimal> | null;
  // Convertible notes are inside the us-gaap debt totals the total-debt
  // mapping reads, so a tagged figure is shown, never added a second time.
  convertibleDebt?: SourcedValue<Decimal> | null;
  // The as-of date each claim above resolved to. A claim dated other than
  // total debt is not part of this balance sheet: flagged NOT CURRENT and
  // not added — the same-date discipline CALVIN RULING A applies above.
  seniorClaimAsOfDates?: { minorityInterest?: string | null; preferredStock?: string | null; convertibleDebt?: string | null };
  // A disclosed fair value for the strategic stakes carried at book above —
  // shown beside the book figure, never substituted for it.
  nonOperatingEquityInvestmentsFairValue?: SourcedValue<Decimal> | null;
  // Contingent items (unrecognised tax benefits such as an IRS dispute,
  // guarantees) — listed with the bridge, never deducted.
  contingentItems?: { item: string; amount: SourcedValue<Decimal> }[];
  // A cited issuer disclosure that this filer's finance leases sit inside
  // its total-debt figure (tagMap.ts FINANCE_LEASES_INSIDE_TOTAL_DEBT). The
  // leases are then counted once — inside total debt — and the separate
  // finance-lease term is neither required nor added (closed issue #311).
  financeLeasesInsideTotalDebt?: { source: string } | null;
  // Methodology v2.1 D7 (issue #491 ruling B; CF-AR6-FINANCE-LEASE-UPPER-
  // BOUND-01, issue #492). A cited upper bound for a finance-lease liability
  // the filer never reports: filed total liabilities less the bridge's total
  // debt, from the same balance sheet. Used only where no lease figure was
  // acquired and no nesting record applies; then the bridge carries the bound
  // as its lease term (overstated on purpose, never zero) and says so.
  financeLeaseLiabilitiesUpperBound?: { value: SourcedValue<Decimal>; asOfDate: string | null; source: string } | null;
}

const REQUIRED_FIELD_NAMES = [
  "sharesOutstanding",
  "treasuryMethodDilution",
  "price",
  "totalDebt",
  "financeLeaseLiabilities",
  "cashAndMarketableDebtSecurities",
  "nonOperatingEquityInvestmentsAtBook",
] as const satisfies readonly (keyof EnterpriseValueInput)[];

// Suppressed by: a missing REQUIRED input (§7.2 M1), or — CALVIN RULING A,
// issue #308/#309 — the three named instant balance-sheet bridge inputs
// (total-debt, finance-lease-liabilities, cash-and-marketable-debt-
// securities) resolving to different as-of dates. Both return INCOMPLETE;
// neither computes a value on partial or incoherent data.
export function computeEnterpriseValue(input: EnterpriseValueInput): EnterpriseValueBridge {
  const leasesInsideDebt = input.financeLeasesInsideTotalDebt ?? null;
  // D7 — the bound stands in only for a lease figure that is genuinely absent.
  const leaseBound =
    input.financeLeaseLiabilities === null && leasesInsideDebt === null ? (input.financeLeaseLiabilitiesUpperBound ?? null) : null;
  const missing = REQUIRED_FIELD_NAMES.filter(
    (name) =>
      input[name] === null && !(name === "financeLeaseLiabilities" && (leasesInsideDebt !== null || leaseBound !== null))
  );
  if (missing.length > 0) {
    return suppressedValue("INCOMPLETE", `missing REQUIRED input(s): ${missing.join(", ")}`);
  }

  // CALVIN RULING — A, REQUIRE SAME-DATE EV BRIDGE INPUTS (issue #308,
  // ruled 25 Sep 2026 03:46:48Z; implemented under issue #309). Applies
  // only to these three named inputs — not sharesOutstanding, price,
  // treasuryMethodDilution or nonOperatingEquityInvestmentsAtBook (the
  // ruling's own carve-out).
  //
  // Zero tolerance, no new constant: an exact string comparison of each
  // resolved as-of date, the identical strictness
  // acquisition/selectTagged.ts's componentAtSamePeriod already uses
  // (`row.end !== primary.end`) for the same kind of same-period test one
  // mapping entry over. Skipped entirely when a caller supplies no dates
  // (undefined/null) for one or more of the three — that is a caller which
  // never carried this plumbing (every pre-#309 EnterpriseValueInput
  // caller), not a bridge the ruling has grounds to refuse.
  // A filer whose leases are inside total debt contributes no lease term,
  // so only the two terms the bridge actually adds are compared.
  const bridgeDates: { factId: string; asOfDate: string | null | undefined }[] = [
    { factId: "total-debt", asOfDate: input.totalDebtAsOfDate },
    ...(leasesInsideDebt === null
      ? [
          {
            factId: "finance-lease-liabilities",
            asOfDate: leaseBound !== null ? leaseBound.asOfDate : input.financeLeaseLiabilitiesAsOfDate,
          },
        ]
      : []),
    { factId: "cash-and-marketable-debt-securities", asOfDate: input.cashAndMarketableDebtSecuritiesAsOfDate },
  ];
  if (bridgeDates.every((d) => d.asOfDate != null)) {
    const known = bridgeDates as { factId: string; asOfDate: string }[];
    const disagree = known.some((d) => d.asOfDate !== known[0].asOfDate);
    if (disagree) {
      const detail = known.map((d) => `${d.factId}=${d.asOfDate}`).join(", ");
      return suppressedValue(
        "INCOMPLETE",
        `EV bridge inputs resolve to different as-of dates (CALVIN RULING A, issue #308/#309): ${detail}`
      );
    }
  }

  const sharesOutstanding = input.sharesOutstanding as SourcedValue<Decimal>;
  const treasuryMethodDilution = input.treasuryMethodDilution as SourcedValue<Decimal>;
  const price = input.price as SourcedValue<Decimal>;
  const totalDebt = input.totalDebt as SourcedValue<Decimal>;
  // Counted once: a filer whose leases are inside total debt adds nothing
  // here, whether or not a separate lease figure was also tagged.
  const financeLeaseLiabilities: SourcedValue<Decimal> =
    leasesInsideDebt !== null
      ? { value: new Decimal(0), provenance: totalDebtProvenanceOf(input) }
      : leaseBound !== null
        ? leaseBound.value
        : (input.financeLeaseLiabilities as SourcedValue<Decimal>);
  const cashAndMarketableDebtSecurities = input.cashAndMarketableDebtSecurities as SourcedValue<Decimal>;
  const nonOperatingEquityInvestmentsAtBook = input.nonOperatingEquityInvestmentsAtBook as SourcedValue<Decimal>;

  // Most recent shares outstanding plus treasury-method dilution — never
  // the weighted-average diluted share count (§3.5).
  const dilutedShares = sharesOutstanding.value.plus(treasuryMethodDilution.value);
  const marketCap = dilutedShares.mul(price.value);

  const current = (value: SourcedValue<Decimal> | null | undefined, asOf: string | null | undefined) =>
    value != null && !(asOf != null && input.totalDebtAsOfDate != null && asOf !== input.totalDebtAsOfDate) ? value : null;
  const dates = input.seniorClaimAsOfDates ?? {};
  const minorityInterest = current(input.minorityInterest, dates.minorityInterest);
  const preferredStock = current(input.preferredStock, dates.preferredStock);

  const enterpriseValue = marketCap
    .plus(totalDebt.value)
    .plus(financeLeaseLiabilities.value)
    .plus(minorityInterest?.value ?? 0)
    .plus(preferredStock?.value ?? 0)
    .minus(cashAndMarketableDebtSecurities.value)
    .minus(nonOperatingEquityInvestmentsAtBook.value);

  const provenance = combineProvenance(
    sharesOutstanding.provenance,
    treasuryMethodDilution.provenance,
    price.provenance,
    totalDebt.provenance,
    financeLeaseLiabilities.provenance,
    cashAndMarketableDebtSecurities.provenance,
    nonOperatingEquityInvestmentsAtBook.provenance,
    ...[minorityInterest, preferredStock].filter((v): v is SourcedValue<Decimal> => v !== null).map((v) => v.provenance)
  );

  return computedValue(
    {
      marketCap,
      totalDebt: totalDebt.value,
      financeLeaseLiabilities: financeLeaseLiabilities.value,
      cashAndMarketableDebtSecurities: cashAndMarketableDebtSecurities.value,
      nonOperatingEquityInvestmentsAtBook: nonOperatingEquityInvestmentsAtBook.value,
      nonOperatingInvestmentsErrorDirection: input.nonOperatingInvestmentsErrorDirection,
      enterpriseValue,
      bridgeFlags: buildBridgeFlags(input, nonOperatingEquityInvestmentsAtBook.value, leasesInsideDebt, leaseBound, dilutedShares),
    },
    provenance
  );
}

function totalDebtProvenanceOf(input: EnterpriseValueInput) {
  return (input.totalDebt as SourcedValue<Decimal>).provenance;
}

const NOT_TAGGED_NOTE = "not found in this filer's structured data — a missing tag is not zero, so this claim is unverified";

function seniorClaim(
  claim: BridgeClaim["claim"],
  value: SourcedValue<Decimal> | null | undefined,
  asOf: string | null | undefined,
  bridgeDate: string | null | undefined
): BridgeClaim {
  if (value == null) return { claim, status: "NOT TAGGED", amount: null, note: NOT_TAGGED_NOTE };
  if (asOf != null && bridgeDate != null && asOf !== bridgeDate) {
    return {
      claim,
      status: "NOT CURRENT",
      amount: value.value,
      note: `tagged as of ${asOf}, not at the bridge's ${bridgeDate} balance sheet — unverified for today, so not added`,
    };
  }
  return { claim, status: "IN BRIDGE", amount: value.value, note: "a claim ahead of common equity — added to enterprise value like debt" };
}

// R5 — reported beside the bridge so the reader sees each claim's treatment.
function buildBridgeFlags(
  input: EnterpriseValueInput,
  stakesAtBook: Decimal,
  leasesInsideDebt: { source: string } | null,
  leaseBound: { value: SourcedValue<Decimal>; source: string } | null,
  dilutedShares: Decimal
): BridgeFlags {
  const convertible = input.convertibleDebt ?? null;
  const fairValue = input.nonOperatingEquityInvestmentsFairValue ?? null;
  const dates = input.seniorClaimAsOfDates ?? {};
  return {
    claims: [
      seniorClaim("minority interests", input.minorityInterest, dates.minorityInterest, input.totalDebtAsOfDate),
      seniorClaim("preferred stock", input.preferredStock, dates.preferredStock, input.totalDebtAsOfDate),
      convertible === null
        ? { claim: "convertible debt", status: "NOT TAGGED", amount: null, note: NOT_TAGGED_NOTE }
        : {
            claim: "convertible debt",
            status: "IN TOTAL DEBT",
            amount: convertible.value,
            note: "inside the total-debt figure at carrying value, not added again; dilution on conversion is not modelled",
          },
    ],
    strategicStakes: {
      atBook: stakesAtBook,
      disclosedFairValue: fairValue?.value ?? null,
      note:
        fairValue === null
          ? "carried at book; no disclosed fair value was tagged"
          : "carried at book in the bridge; the disclosed fair value is shown alongside, not substituted",
    },
    contingentItems: (input.contingentItems ?? []).map(({ item, amount }) => ({
      item,
      amount: amount.value,
      note: "listed, not deducted — a contingent item, not balance-sheet debt",
    })),
    financeLeases:
      leasesInsideDebt !== null
        ? {
            treatment: "INCLUDED IN TOTAL DEBT",
            note: `counted once, inside total debt (${leasesInsideDebt.source}); no separate lease term is added`,
          }
        : leaseBound !== null
          ? {
              treatment: "UPPER BOUND — NOT DISCLOSED",
              note:
                `not disclosed — valued at its upper bound (Methodology D7): ${leaseBound.source}. The true figure is ` +
                `no larger, so value is understated by at most $${perShare(leaseBound.value.value, dilutedShares)} per diluted share ` +
                `and leverage is overstated, never the reverse`,
            }
          : { treatment: "ADDED SEPARATELY", note: "finance leases added to total debt as their own term" },
  };
}

function perShare(amount: Decimal, dilutedShares: Decimal): string {
  return dilutedShares.isZero() ? "—" : amount.dividedBy(dilutedShares).toFixed(2);
}

// "The equity bridge reverses this exactly" (§3.5) — used by later modules
// (M6 steady-state EV, M7 reverse DCF) to convert an independently derived
// enterprise value back to implied equity value, using the same cash,
// investments, debt and lease figures as the forward bridge above. Never a
// second definition of the same quantity (§9 mistake 18).
export function computeEquityValueFromEnterpriseValue(
  enterpriseValue: Decimal,
  cashAndMarketableDebtSecurities: Decimal,
  nonOperatingEquityInvestmentsAtBook: Decimal,
  totalDebt: Decimal,
  financeLeaseLiabilities: Decimal
): Decimal {
  return enterpriseValue
    .plus(cashAndMarketableDebtSecurities)
    .plus(nonOperatingEquityInvestmentsAtBook)
    .minus(totalDebt)
    .minus(financeLeaseLiabilities);
}
