import Decimal from "decimal.js";
import { POLICY } from "./policy";
import { classifyCyclicality, cyclicalSicLabel } from "./cyclicalSic";
import type { DatedDiscountRate, DiscountRateInUse, MoatClass, Profile } from "./types";

// CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — Cal Finance Methodology v2.1 D1
// (frozen spec §14.9 AR0-1): the one discount rate a run is valued at.
//
// - Stable businesses: the market's expected return.
// - Cyclical industries (the SEC SIC code is on cyclicalSic.ts's list, or
//   trigger B of §6.4 fired) and pre-revenue companies: market + 2pp.
// - Growth alone never raises the rate: nothing here reads growth.
// - Valid only inside the §6.5 net-debt gate; outside it the rate is still
//   reported, marked outside its validated domain, and the leverage state
//   already suppresses the values that would use it.
//
// D1 is two bands, so a company the SIC route cannot place (no SIC code on
// the run) reaches the cyclical band only through trigger B or pre-revenue,
// and the basis line says the code was unavailable.

export interface DiscountRateInputs {
  sic: string | null;
  triggerBFired: boolean;
  profile: Profile;
  leveragePass: boolean;
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
    withinValidatedDomain: inputs.leveragePass,
  };
}

/** "9.0%" — one decimal, the precision the dated rate is approved at. */
export function formatRate(rate: Decimal): string {
  return `${rate.mul(100).toFixed(1)}%`;
}

/**
 * Methodology v2.1 D2 — the terminal return on new capital after year 10:
 * the rate plus the moat credit (+0 / +1 / +3pp for none / narrow / wide).
 * Bear takes +0 whatever the class; bull takes the base credit + 1.5pp.
 * With no moat input the credit is +0 — the rate (DO 3). A recorded sheet
 * without a moat class is still pending adoption (assemble.ts
 * resolveD2Inputs), so that default never values a sheet on its own.
 */
export function terminalReturnOnNewCapital(rate: Decimal, moatClass: MoatClass | null, scenario: "bear" | "base" | "bull"): Decimal {
  if (scenario === "bear") return rate;
  const baseCredit = moatClass === null ? new Decimal(0) : POLICY.moatCredit[moatClass];
  return rate.plus(baseCredit).plus(scenario === "bull" ? POLICY.bullMoatCreditUplift : 0);
}
