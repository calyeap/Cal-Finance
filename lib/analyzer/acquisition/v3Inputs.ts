import Decimal from "decimal.js";
import { POLICY, US_FEDERAL_STATUTORY_TAX_RATE as STATUTORY_TAX_RATE } from "../policy";
import { TAG_MAP, V3_SERIES_INPUTS, type TagCandidate } from "./tagMap";
import { annualSeries, annualSeriesWithComponents, quarterlySeriesWithDerivedQ4, type AnnualSeries, type QuarterObservation } from "./history";
import type { CompanyFactsDocument } from "./secClient";
import type { FiledAnchor, NetReinvestment, TaxResolution, V3FiledInputs } from "../types";

// ---------------------------------------------------------------------------
// CF-METHODOLOGY-V3-IMPLEMENT-01 (issue #499) — the filed inputs Cal Finance
// Methodology v3 reads, each from the company's own XBRL facts and each
// reported with how it was formed or why it could not be.
//
//   D5   the TTM operating margin, TTM revenue growth and 3-yr revenue CAGR
//        that anchor the Base ramps; the 3-year average effective tax rate.
//   D2.1 last fiscal year's net reinvestment: capex − D&A + ΔNWC +
//        acquisitions. Any component not filed for that year leaves it
//        unformed, and the whole year-1 requirement is charged (Calvin,
//        20 Oct 2026: an absent acquisitions tag is not zero).
//   D5   the coherence check's trailing 3-year actual reinvestment ÷ NOPAT;
//        the return-on-new-capital anchor (latest ROIC including goodwill,
//        3-yr incremental ROIC).
//   D8   diluted − basic weighted-average shares where the treasury-method
//        dilution tag is absent and the same filing shows no convertibles.
//
// Deterministic and price-blind; no model.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const pct = (v: Decimal) => `${v.mul(100).toFixed(1)}%`;
const bn = (v: Decimal) => `$${v.dividedBy(1e9).toFixed(1)}bn`;
const candidatesFor = (factId: string): readonly TagCandidate[] => TAG_MAP.find((e) => e.factId === factId)?.candidates ?? [];

function valueAt(series: AnnualSeries | null, fiscalYear: number): Decimal | null {
  const o = series?.observations.find((x) => x.fiscalYear === fiscalYear);
  return o === undefined ? null : new Decimal(o.value);
}

/** Four contiguous discrete quarters ending exactly at `periodEnd`, summed; null otherwise. */
function ttmEndingAt(quarters: QuarterObservation[], periodEnd: string): Decimal | null {
  const i = quarters.findIndex((q) => q.periodEnd === periodEnd);
  if (i < 3) return null;
  const four = quarters.slice(i - 3, i + 1);
  const contiguous = four.every((q, k) => k === 0 || Math.abs(Date.parse(q.periodStart) - Date.parse(four[k - 1].periodEnd)) <= 4 * DAY_MS);
  const span = (Date.parse(four[3].periodEnd) - Date.parse(four[0].periodStart)) / DAY_MS;
  if (!contiguous || span < 350 || span > 380) return null;
  return four.reduce((s, q) => s.plus(q.value), new Decimal(0));
}

/** The quarter ending about a year before `periodEnd`, if filed. */
function yearEarlier(quarters: QuarterObservation[], periodEnd: string): string | null {
  const target = Date.parse(periodEnd) - 365 * DAY_MS;
  return quarters.find((q) => Math.abs(Date.parse(q.periodEnd) - target) <= 10 * DAY_MS)?.periodEnd ?? null;
}

export interface V3InputsContext {
  /** The valuation's TTM base (companyInputs.ts valuationBaseFrom). */
  basePeriodEnd: string | null;
  baseKind: "TTM" | "FISCAL YEAR" | null;
  /** Year-end invested capital, goodwill included (companyInputs.ts investedCapitalAt). */
  investedCapitalAt: (fiscalYear: number) => Decimal | null;
  /** An adopted override of the NOPAT tax rate (sheet content `taxRateOverride`). */
  taxRateOverride: Decimal | null;
  /** Whether the treasury-method dilution tag resolved on this run. */
  treasuryDilutionTagged: boolean;
}

export function v3FiledInputs(doc: CompanyFactsDocument, ctx: V3InputsContext): V3FiledInputs {
  const revenue = annualSeries(doc, candidatesFor("current-revenue"));
  const operatingIncome = annualSeries(doc, candidatesFor("operating-income"));
  const revenueQ = quarterlySeriesWithDerivedQ4(doc, candidatesFor("current-revenue"));
  const oiQ = quarterlySeriesWithDerivedQ4(doc, candidatesFor("operating-income"));

  // --- D5 anchors ------------------------------------------------------------
  const end = ctx.basePeriodEnd;
  const fyOf = (date: string) => new Date(date).getUTCFullYear();
  let ttmRevenue: Decimal | null = null;
  let ttmOi: Decimal | null = null;
  let priorRevenue: Decimal | null = null;
  let basisWord = "";
  if (end !== null && ctx.baseKind === "TTM") {
    ttmRevenue = ttmEndingAt(revenueQ, end);
    ttmOi = ttmEndingAt(oiQ, end);
    const prior = yearEarlier(revenueQ, end);
    priorRevenue = prior === null ? null : ttmEndingAt(revenueQ, prior);
    basisWord = `the four quarters to ${end}`;
  } else if (end !== null) {
    const fy = fyOf(end);
    ttmRevenue = valueAt(revenue, fy);
    ttmOi = valueAt(operatingIncome, fy);
    priorRevenue = valueAt(revenue, fy - 1);
    basisWord = `fiscal year ${fy} (the TTM base)`;
  }
  const ttmMargin: FiledAnchor =
    ttmRevenue !== null && ttmOi !== null && ttmRevenue.greaterThan(0)
      ? { value: ttmOi.dividedBy(ttmRevenue), basis: `operating income ÷ revenue over ${basisWord}` }
      : { value: null, basis: end === null ? "no TTM base on this run" : `no filed operating income for ${basisWord}` };
  const ttmRevenueGrowth: FiledAnchor =
    ttmRevenue !== null && priorRevenue !== null && priorRevenue.greaterThan(0)
      ? { value: ttmRevenue.dividedBy(priorRevenue).minus(1), basis: `revenue over ${basisWord} against the twelve months a year earlier` }
      : { value: null, basis: "no filed revenue for the twelve months a year before the TTM base" };
  const lastRev = revenue?.observations.at(-1);
  const rev3 = lastRev === undefined ? null : valueAt(revenue, lastRev.fiscalYear - 3);
  const revenueCagr3: FiledAnchor =
    lastRev !== undefined && rev3 !== null && rev3.greaterThan(0) && lastRev.value > 0
      ? {
          value: new Decimal((lastRev.value / rev3.toNumber()) ** (1 / 3) - 1),
          basis: `revenue FY${lastRev.fiscalYear - 3}–FY${lastRev.fiscalYear}`,
        }
      : { value: null, basis: "fewer than four fiscal years of filed revenue" };

  // --- D5 tax -----------------------------------------------------------------
  const tax = resolveTax(doc, ctx.taxRateOverride);

  // --- D2.1 and the coherence check: net reinvestment by fiscal year ---------
  const capex = annualSeriesWithComponents(doc, candidatesFor("capex"));
  const da = annualSeriesWithComponents(doc, candidatesFor("depreciation-and-amortisation"));
  const acquisitions = annualSeriesWithComponents(doc, V3_SERIES_INPUTS.acquisitions);
  const wcLines = [
    ...V3_SERIES_INPUTS.workingCapitalLines.asset.map((ref) => ({ ref, sign: 1 })),
    ...V3_SERIES_INPUTS.workingCapitalLines.liability.map((ref) => ({ ref, sign: -1 })),
  ].map((l) => ({ ...l, series: annualSeries(doc, [{ ref: l.ref }]) }));
  const deltaNwcAt = (fy: number): Decimal | null => {
    let total = new Decimal(0);
    let any = false;
    const seen = new Set<string>();
    for (const line of wcLines) {
      const v = valueAt(line.series, fy);
      if (v === null) continue;
      // The same value under two tags of one side in one year is one line
      // tagged twice (Eli Lilly FY2022–23), counted once.
      const key = `${line.sign}:${v.toString()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      total = total.plus(v.mul(line.sign));
      any = true;
    }
    return any ? total : null;
  };
  const netReinvestmentAt = (fy: number): NetReinvestment => {
    const c = valueAt(capex, fy);
    const d = valueAt(da, fy);
    const w = deltaNwcAt(fy);
    const a = valueAt(acquisitions, fy);
    const missing = [
      c === null ? "capital expenditure" : null,
      d === null ? "depreciation and amortisation" : null,
      w === null ? "the change in working capital (no cash-flow working-capital line filed)" : null,
      a === null ? "acquisitions (no cash-paid-for-businesses element filed)" : null,
    ].filter((m): m is string => m !== null);
    if (missing.length > 0) return { formed: false, fiscalYear: fy, missing };
    return { formed: true, fiscalYear: fy, capexLessDa: c!.minus(d!), deltaNwc: w!, acquisitions: a!, total: c!.minus(d!).plus(w!).plus(a!) };
  };
  const lastFy = capex?.observations.at(-1)?.fiscalYear ?? operatingIncome?.observations.at(-1)?.fiscalYear ?? null;
  const lastFyNetReinvestment: NetReinvestment = lastFy === null ? { formed: false, fiscalYear: null, missing: ["no filed fiscal year"] } : netReinvestmentAt(lastFy);

  const nopatAt = (fy: number) => {
    const oi = valueAt(operatingIncome, fy);
    return oi === null ? null : oi.mul(new Decimal(1).minus(tax.rate));
  };
  const trailing = lastFy === null ? [] : [lastFy - 2, lastFy - 1, lastFy].map((fy) => ({ fy, nr: netReinvestmentAt(fy), nopat: nopatAt(fy) }));
  const trailingMissing = trailing.flatMap((t) => [
    ...(t.nr.formed ? [] : t.nr.missing.map((m) => `FY${t.fy} ${m}`)),
    ...(t.nopat === null ? [`FY${t.fy} operating income`] : []),
  ]);
  const nopatSum = trailing.reduce((s, t) => s.plus(t.nopat ?? 0), new Decimal(0));
  const trailingNetReinvestment: V3FiledInputs["trailingNetReinvestment"] =
    trailing.length === 3 && trailingMissing.length === 0 && nopatSum.greaterThan(0)
      ? {
          formed: true,
          fromFiscalYear: trailing[0].fy,
          toFiscalYear: trailing[2].fy,
          ratioToNopat: trailing.reduce((s, t) => s.plus((t.nr as { total: Decimal }).total), new Decimal(0)).dividedBy(nopatSum),
        }
      : { formed: false, missing: trailing.length === 3 ? (trailingMissing.length > 0 ? trailingMissing : ["NOPAT not positive"]) : ["no filed fiscal year"] };

  // --- D5 return-on-new-capital anchor ------------------------------------------
  const roicAt = (fy: number) => {
    const n = nopatAt(fy);
    const ic = ctx.investedCapitalAt(fy);
    return n === null || ic === null || !ic.greaterThan(0) ? null : { n, ic };
  };
  const latestFy = operatingIncome?.observations.at(-1)?.fiscalYear ?? null;
  const latest = latestFy === null ? null : roicAt(latestFy);
  const back3 = latestFy === null ? null : roicAt(latestFy - 3);
  const roic: V3FiledInputs["roic"] = {
    latest: latest === null ? null : { fiscalYear: latestFy!, value: latest.n.dividedBy(latest.ic) },
    incremental3:
      latest !== null && back3 !== null && !latest.ic.minus(back3.ic).isZero()
        ? { fromFiscalYear: latestFy! - 3, toFiscalYear: latestFy!, value: latest.n.minus(back3.n).dividedBy(latest.ic.minus(back3.ic)) }
        : null,
  };

  return {
    ttmMargin,
    ttmRevenueGrowth,
    revenueCagr3,
    tax,
    lastFyNetReinvestment,
    trailingNetReinvestment,
    roic,
    dilutionFallback: ctx.treasuryDilutionTagged ? null : dilutionFallback(doc),
  };
}

/**
 * v3 D5 tax (Calvin, 20 Oct 2026, #499): Σ income tax ÷ Σ pre-tax income over
 * the latest three fiscal years, excluding (and showing) any year with pre-tax
 * income ≤ 0 or a rate outside the normal band; the statutory rate, labelled,
 * where fewer than two normal years remain. An adopted override wins.
 */
export function resolveTax(doc: CompanyFactsDocument, override: Decimal | null): TaxResolution {
  const taxSeries = annualSeries(doc, V3_SERIES_INPUTS.incomeTax);
  const pretaxSeries = annualSeries(doc, V3_SERIES_INPUTS.pretaxIncome);
  const fys = (pretaxSeries?.observations ?? []).map((o) => o.fiscalYear).filter((fy) => valueAt(taxSeries, fy) !== null);
  const window = fys.slice(-POLICY.taxAverageYears);
  const [lo, hi] = POLICY.taxNormalRateBand;
  const years = window.map((fy) => {
    const incomeTax = valueAt(taxSeries, fy)!;
    const pretaxIncome = valueAt(pretaxSeries, fy)!;
    const rate = pretaxIncome.greaterThan(0) ? incomeTax.dividedBy(pretaxIncome) : null;
    const excluded =
      rate === null
        ? "pre-tax income not positive"
        : rate.lessThan(lo) || rate.greaterThan(hi)
          ? `rate ${pct(rate)} outside ${pct(lo)}–${pct(hi)}`
          : null;
    return { fiscalYear: fy, incomeTax, pretaxIncome, rate, excluded };
  });
  if (override !== null) {
    return { rate: override, basis: "ADOPTED OVERRIDE", years, label: `NOPAT tax rate ${pct(override)}, set when the sheet was adopted` };
  }
  const normal = years.filter((y) => y.excluded === null);
  if (normal.length >= POLICY.taxMinimumNormalYears) {
    const rate = normal.reduce((s, y) => s.plus(y.incomeTax), new Decimal(0)).dividedBy(normal.reduce((s, y) => s.plus(y.pretaxIncome), new Decimal(0)));
    const excluded = years.filter((y) => y.excluded !== null);
    return {
      rate,
      basis: "FILED 3-YR AVERAGE",
      years,
      label:
        `NOPAT tax rate ${pct(rate)}: filed effective rate, FY${normal[0].fiscalYear}–FY${normal[normal.length - 1].fiscalYear}` +
        (excluded.length > 0 ? `; excluded ${excluded.map((y) => `FY${y.fiscalYear} (${y.excluded})`).join(", ")}` : ""),
    };
  }
  return {
    rate: STATUTORY_TAX_RATE,
    basis: "STATUTORY",
    years,
    label:
      `NOPAT tax rate ${pct(STATUTORY_TAX_RATE)} — the statutory rate: ` +
      (years.length === 0
        ? "the filings carry no income-tax and pre-tax income history"
        : `only ${normal.length} normal year${normal.length === 1 ? "" : "s"} in the latest ${years.length} (${years
            .filter((y) => y.excluded !== null)
            .map((y) => `FY${y.fiscalYear}: ${y.excluded}`)
            .join("; ")})`),
  };
}

type Row = { val: number; end: string; start?: string; form?: string; fp?: string; accn?: string };

/**
 * v3 D8 — where the incremental-shares tag is absent: diluted − basic
 * weighted-average shares from the latest 10-K, only when that same filing
 * shows no convertible debt outstanding; otherwise refused (the bridge stays
 * INCOMPLETE).
 */
function latestAnnual10KShares(doc: CompanyFactsDocument, tag: string): Row | null {
  const g = doc.facts?.["us-gaap"] ?? {};
  return (
    ((g[tag]?.units?.shares ?? []) as Row[])
      .filter((r) => r.form === "10-K" && r.start !== undefined && (Date.parse(r.end) - Date.parse(r.start)) / DAY_MS >= 300)
      .sort((a, b) => a.end.localeCompare(b.end))
      .at(-1) ?? null
  );
}

/**
 * v3 D8 — the period end of the latest 10-K's diluted weighted-average
 * shares: the share period a treasury-method dilution figure must speak for.
 * An incremental-shares tag last filed before it (LLY's ends at FY2011) is
 * absent for today's bridge, so D8's fallback applies (AR8, #457).
 */
export function latestAnnualDilutedSharesEnd(doc: CompanyFactsDocument): string | null {
  return latestAnnual10KShares(doc, "WeightedAverageNumberOfDilutedSharesOutstanding")?.end ?? null;
}

export function dilutionFallback(doc: CompanyFactsDocument): { applied: boolean; value: Decimal | null; label: string } {
  const g = doc.facts?.["us-gaap"] ?? {};
  const diluted = latestAnnual10KShares(doc, "WeightedAverageNumberOfDilutedSharesOutstanding");
  const basic = latestAnnual10KShares(doc, "WeightedAverageNumberOfSharesOutstandingBasic");
  if (diluted === null || basic === null || diluted.end !== basic.end) {
    return { applied: false, value: null, label: "dilution fallback not formed: no same-period diluted and basic weighted-average shares in a 10-K" };
  }
  const accession = diluted.accn ?? null;
  const convertible = ["ConvertibleDebt", "ConvertibleNotesPayable"].flatMap((tag) =>
    ((g[tag]?.units?.USD ?? []) as Row[]).filter((r) => r.accn === accession && r.end === diluted.end && r.val > 0)
  );
  if (convertible.length > 0) {
    return {
      applied: false,
      value: null,
      label: `dilution fallback refused: the same 10-K (${accession}) shows convertible debt of ${bn(new Decimal(convertible[0].val))} at ${diluted.end}`,
    };
  }
  const value = Decimal.max(0, new Decimal(diluted.val).minus(basic.val));
  return {
    applied: true,
    value,
    label:
      `treasury-method dilution ${(value.toNumber() / 1e6).toFixed(1)}m = diluted − basic weighted-average shares, ` +
      `10-K ${accession} (fiscal year ending ${diluted.end}); no convertibles in that filing (Methodology v3 D8 fallback)`,
  };
}
