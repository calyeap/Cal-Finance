import Decimal from "decimal.js";
import { POLICY } from "./policy";
import { classifyCyclicality, cyclicalSicLabel } from "./cyclicalSic";
import type { DatedDiscountRate, DiscountRateInUse, LeverageResult, MoatClass, Profile, RateDomain } from "./types";

// CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — Cal Finance Methodology v2.1 D1
// (frozen spec §14.9 AR0-1): the one discount rate a run is valued at.
//
// - Stable businesses: the market's expected return.
// - Cyclical industries (the SEC SIC code is on cyclicalSic.ts's list, or
//   trigger B of §6.4 fired) and pre-revenue companies: market + 2pp.
// - Growth alone never raises the rate: nothing here reads growth.
// - Valid only inside the §6.5 net-debt gate; outside it the rate is still
//   reported, marked outside its validated domain, and the leverage state
//   already suppresses the values that would use it. Where net debt was
//   never measured the domain is marked unknown, not outside
//   (CF-LEG2-RATE-DOMAIN-COPY-01, #479).
//
// D1 is two bands, so a company the SIC route cannot place (no SIC code on
// the run) reaches the cyclical band only through trigger B or pre-revenue,
// and the basis line says the code was unavailable.

export interface DiscountRateInputs {
  sic: string | null;
  triggerBFired: boolean;
  profile: Profile;
  // The run's §6.5 leverage result, read as-is: its PASS/not-PASS result and
  // whether the net-debt ratio was measured at all. Never recomputed here.
  leverage: Pick<LeverageResult, "result" | "netDebtRatio">;
  // The run's price date; selects the dated row in force on that date.
  priceDate: string | null;
}

/** The dated row in force on `date`: the latest not after it, else the earliest. */
export function datedRateRow(date: string | null): DatedDiscountRate {
  const table = POLICY.discountRate.table;
  const day = date?.slice(0, 10) ?? null;
  const inForce = day === null ? [] : table.filter((row) => row.effectiveFrom <= day);
  return inForce.length > 0 ? inForce[inForce.length - 1] : table[table.length - 1];
}

export function selectDiscountRate(inputs: DiscountRateInputs): DiscountRateInUse {
  const row = datedRateRow(inputs.priceDate);
  const sicClass = classifyCyclicality(inputs.sic);

  let band: DiscountRateInUse["band"];
  let basis: string;
  if (inputs.profile === "PRE_REVENUE_UNPROFITABLE") {
    band = "pre-revenue";
    basis = "pre-revenue company — market + 2pp";
  } else if (sicClass === "cyclical") {
    band = "cyclical";
    basis = `cyclical industry by SEC SIC code ${inputs.sic} (${cyclicalSicLabel(inputs.sic)}) — market + 2pp`;
  } else if (inputs.triggerBFired) {
    band = "cyclical";
    basis = "cyclical by trigger B (a single-year operating-margin decline of more than 10 points) — market + 2pp";
  } else {
    band = "stable";
    basis =
      sicClass === "stable"
        ? `stable — SEC SIC code ${inputs.sic} is not a cyclical industry and trigger B did not fire; growth does not raise the rate`
        : "stable — no SEC SIC code on this run, and trigger B did not fire; growth does not raise the rate";
  }

  const rate = band === "stable" ? row.stable : row.cyclicalOrPreRevenue;
  const offset = POLICY.discountRate.verdictCheckOffset;
  return {
    rate,
    band,
    basis,
    effectiveFrom: row.effectiveFrom,
    provenance: row.provenance,
    checkRates: { lower: rate.minus(offset), upper: rate.plus(offset) },
    validatedDomain: rateDomainFromLeverage(inputs.leverage),
  };
}

/**
 * The rate's validated domain from the run's §6.5 leverage result: PASS is
 * WITHIN; a measured ratio that did not pass is OUTSIDE; no ratio at all (a
 * REQUIRED input missing) is NOT MEASURED.
 */
export function rateDomainFromLeverage(leverage: Pick<LeverageResult, "result" | "netDebtRatio">): RateDomain {
  if (leverage.netDebtRatio === null) return "NOT MEASURED";
  return leverage.result === "PASS" ? "WITHIN" : "OUTSIDE";
}

/**
 * The domain a stored or fresh rate is in. A result stored between AR4 and
 * CF-LEG2-RATE-DOMAIN-COPY-01 carries only `withinValidatedDomain`, which
 * was false for both OUTSIDE and NOT MEASURED; it is resolved from the same
 * run's own leverage result — the value that boolean was set from. Without
 * that result only the boolean's PASS case can be told apart, and the
 * ambiguous case returns null (state nothing rather than guess).
 */
export function rateDomainOf(
  rate: DiscountRateInUse,
  leverage: Pick<LeverageResult, "result" | "netDebtRatio"> | undefined
): RateDomain | null {
  if (rate.validatedDomain !== undefined) return rate.validatedDomain;
  if (leverage !== undefined) return rateDomainFromLeverage(leverage);
  return rate.withinValidatedDomain === true ? "WITHIN" : null;
}

/** "9.0%" — one decimal, the precision the dated rate is approved at. */
export function formatRate(rate: Decimal): string {
  return `${rate.mul(100).toFixed(1)}%`;
}

/**
 * Methodology v3 D2′ (amends v2.1 D2) — the terminal return on new capital is
 * the rate for every moat class; Bull takes the rate + 1.5pp. The moat class
 * no longer sets a permanent credit: it sets how long the return on new
 * capital takes to reach the rate (`returnRunwayYears`).
 */
export function terminalReturnOnNewCapital(rate: Decimal, scenario: "bear" | "base" | "bull"): Decimal {
  return scenario === "bull" ? rate.plus(POLICY.bullTerminalReturnUplift) : rate;
}

/**
 * Methodology v3 D2′ — the year the return on new capital reaches the
 * terminal return: 10 / 15 / 20 for none / narrow / wide moat. Bear uses the
 * no-moat runway whatever the class. With no moat input the runway is ten
 * years; a recorded sheet without a moat class is still pending adoption
 * (assemble.ts resolveD2Inputs), so that default never values a sheet on its
 * own.
 */
export function returnRunwayYears(moatClass: MoatClass | null, scenario: "bear" | "base" | "bull"): number {
  if (scenario === "bear" || moatClass === null) return POLICY.returnRunwayYears.none;
  return POLICY.returnRunwayYears[moatClass];
}
