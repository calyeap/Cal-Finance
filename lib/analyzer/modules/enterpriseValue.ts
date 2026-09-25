import Decimal from "decimal.js";
import { combineProvenance } from "../provenance";
import { computedValue, suppressedValue } from "../figures";
import type { EnterpriseValueBridge, SourcedValue } from "../types";

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
  const missing = REQUIRED_FIELD_NAMES.filter((name) => input[name] === null);
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
  const bridgeDates: { factId: string; asOfDate: string | null | undefined }[] = [
    { factId: "total-debt", asOfDate: input.totalDebtAsOfDate },
    { factId: "finance-lease-liabilities", asOfDate: input.financeLeaseLiabilitiesAsOfDate },
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
  const financeLeaseLiabilities = input.financeLeaseLiabilities as SourcedValue<Decimal>;
  const cashAndMarketableDebtSecurities = input.cashAndMarketableDebtSecurities as SourcedValue<Decimal>;
  const nonOperatingEquityInvestmentsAtBook = input.nonOperatingEquityInvestmentsAtBook as SourcedValue<Decimal>;

  // Most recent shares outstanding plus treasury-method dilution — never
  // the weighted-average diluted share count (§3.5).
  const dilutedShares = sharesOutstanding.value.plus(treasuryMethodDilution.value);
  const marketCap = dilutedShares.mul(price.value);

  const enterpriseValue = marketCap
    .plus(totalDebt.value)
    .plus(financeLeaseLiabilities.value)
    .minus(cashAndMarketableDebtSecurities.value)
    .minus(nonOperatingEquityInvestmentsAtBook.value);

  const provenance = combineProvenance(
    sharesOutstanding.provenance,
    treasuryMethodDilution.provenance,
    price.provenance,
    totalDebt.provenance,
    financeLeaseLiabilities.provenance,
    cashAndMarketableDebtSecurities.provenance,
    nonOperatingEquityInvestmentsAtBook.provenance
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
    },
    provenance
  );
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
