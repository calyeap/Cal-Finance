import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import Decimal from "decimal.js";
import { historyFrom } from "../../lib/analyzer/sheets/research";
import { quarterlySeriesWithDerivedQ4, type QuarterObservation } from "../../lib/analyzer/acquisition/history";
import { TAG_MAP } from "../../lib/analyzer/acquisition/tagMap";
import { evaluateVerdictCheck, UNCERTAINTY_LEVELS, CHECK_RATES, type VerdictCheck } from "../../lib/analyzer/verdictSynthesisV1";
import { POLICY } from "../../lib/analyzer/policy";
import type { CompanyFactsDocument } from "../../lib/analyzer/acquisition/secClient";

// ---------------------------------------------------------------------------
// CF-METHODOLOGY-V3-DRIVERS-01 (issue #496) — TEST / evidence only.
// Calibration #2: how the base drivers are CONSTRUCTED, on #495's frozen
// sheets and 19 Oct captures (no re-drafting, no SEC call, no model call).
// The engine is #495's parameterised D2 (calibration-v3.ts), generalised to a
// year-by-year margin and growth path for years 1–5 and a tax override; with
// no variant it reproduces #495's CURRENT and OPT1 results exactly (checked).
//
// Variants (AI DEFAULTS, test-only):
//   M1  margin_t = TTM + (drafted − TTM)(t − 1)/4, t = 1..5, then held —
//       each scenario from the same TTM to its own drafted margin.
//   G1  growth_t = TTM growth + (drafted − TTM growth)(t − 1)/4, t = 1..5,
//       then the design's fade from year 5 — each scenario to its own rate.
//   T1  every scenario at the company's effective tax rate.
//   R1–R3  the BASE scenario's return on new capital yrs 1–5 (Bear and Bull
//       keep their drafted values); the fade to terminal is unchanged.
//
// Run: npx tsx scripts/analyzer/calibration-v3-drivers.ts   (free, deterministic)
// ---------------------------------------------------------------------------

export type MoatClass = "none" | "narrow" | "wide";
export type Scenario = "bear" | "base" | "bull";
export interface Row { G: number; R: number; S: Decimal }
export const row = (G: number, R: number, Spp: number): Row => ({ G, R, S: new Decimal(Spp).div(100) });
export const DESIGNS: { name: string; rows: Record<MoatClass, Row> }[] = [
  { name: "CURRENT", rows: { none: row(10, 10, 0), narrow: row(10, 10, 1), wide: row(10, 10, 3) } },
  { name: "OPT1", rows: { none: row(10, 10, 0), narrow: row(10, 15, 0), wide: row(10, 20, 0) } },
];

export const EV3 = path.join("docs", "evidence", "methodology-v3-calibration");
export const OUT = path.join("docs", "evidence", "methodology-v3-drivers");
export const CAPTURES = path.join("lib", "analyzer", "acquisition", "captures", "ar6-2026-10-19");
export const RUNS: { ticker: string; label: string; file: string }[] = [
  { ticker: "MSFT", label: "MSFT", file: path.join("docs", "evidence", "ar7-prototype", "msft-run.json") },
  { ticker: "COST", label: "COST", file: path.join(EV3, "cost-run.json") },
  { ticker: "NVDA", label: "NVDA†", file: path.join(EV3, "nvda-run-supplement.json") },
  { ticker: "NUE", label: "NUE†", file: path.join(EV3, "nue-run-supplement.json") },
  { ticker: "LLY", label: "LLY†", file: path.join(EV3, "lly-run-supplement.json") },
];
export const D = (v: unknown) => new Decimal(String(v));
export const TG = POLICY.terminalGrowth;
export const ONE = new Decimal(1);

// --- engine ------------------------------------------------------------------

export function fade(t: number, v5: Decimal, target: Decimal, Y: number): Decimal {
  if (Y <= 5) return t < Y ? v5 : target;
  if (t <= 5) return v5;
  if (t <= Y) return v5.minus(v5.minus(target).mul(t - 5).div(Y - 5));
  return target;
}

export interface Drivers { g: Decimal[]; m: Decimal[]; ronic: Decimal; shares: Decimal } // g, m: years 1–5
export interface Company {
  ticker: string;
  label: string;
  price: Decimal;
  rate: Decimal;
  tax: Decimal;
  stub: Decimal;
  baseRevenue: Decimal;
  bridge: Decimal;
  moat: MoatClass;
  drivers: Record<Scenario, Drivers>;
}
export const flat = (v: Decimal) => [v, v, v, v, v];

export function valueEv(c: Company, d: Drivers, tax: Decimal, rate: Decimal, r: Row) {
  const N = Math.max(r.G, r.R);
  const terminalReturn = rate.plus(r.S);
  const after = ONE.minus(tax);
  const disc = ONE.plus(rate);
  const g = (t: number) => (t > N ? TG : t <= 5 ? d.g[t - 1] : fade(t, d.g[4], TG, r.G));
  const m = (t: number) => (t <= 5 ? d.m[t - 1] : d.m[4]);
  let revenue = c.baseRevenue;
  let pv = new Decimal(0);
  for (let t = 1; t <= N; t++) {
    revenue = revenue.mul(ONE.plus(g(t)));
    const nopat = revenue.mul(m(t)).mul(after);
    const reinvest = nopat.mul(g(t + 1)).div(fade(t, d.ronic, terminalReturn, r.R));
    pv = pv.plus(nopat.minus(reinvest).div(disc.pow(new Decimal(t).minus("0.5").minus(c.stub))));
  }
  const terminalFcf = revenue.mul(m(N)).mul(after).mul(ONE.plus(TG)).mul(ONE.minus(TG.div(terminalReturn)));
  const tvPv = terminalFcf.div(rate.minus(TG)).div(disc.pow(new Decimal(N).minus("0.5").minus(c.stub)));
  return { ev: pv.plus(tvPv), tvPv };
}

export function scenarioRow(design: (typeof DESIGNS)[number], cls: MoatClass, s: Scenario): Row {
  if (s === "bear") return { ...design.rows.none, S: new Decimal(0) };
  const r = design.rows[cls];
  return s === "bull" ? { ...r, S: r.S.plus(POLICY.bullMoatCreditUplift) } : r;
}

export function value(c: Company, drivers: Record<Scenario, Drivers>, tax: Decimal, design: (typeof DESIGNS)[number]) {
  const at = (s: Scenario, rate = c.rate) => {
    const v = valueEv(c, drivers[s], tax, rate, scenarioRow(design, c.moat, s));
    return { ps: v.ev.minus(c.bridge).div(drivers[s].shares), share: v.tvPv.div(v.ev) };
  };
  const base = at("base");
  const off = POLICY.discountRate.verdictCheckOffset;
  const baseAt = { lower: at("base", c.rate.minus(off)).ps, rate: base.ps, upper: at("base", c.rate.plus(off)).ps };
  let check: VerdictCheck | null = null;
  try {
    check = evaluateVerdictCheck({ price: c.price, baseAt });
  } catch {
    check = null;
  }
  const closeCalls = check === null ? null : UNCERTAINTY_LEVELS.filter((u) => new Set(CHECK_RATES.map((r) => check!.grid[r][u])).size > 1).length;
  return { bear: at("bear").ps, base: base.ps, bull: at("bull").ps, terminalShare: base.share, priceOverBase: c.price.div(base.ps), check, closeCalls };
}

// --- filed data ----------------------------------------------------------------

const candidatesFor = (id: string) => TAG_MAP.find((e) => e.factId === id)?.candidates ?? [];
const DAY = 86_400_000;
function ttm(qs: QuarterObservation[], endIndex: number): { value: Decimal; end: string } | null {
  const last4 = qs.slice(endIndex - 3, endIndex + 1);
  if (endIndex < 3 || last4.length !== 4) return null;
  const contiguous = last4.every((q, i) => i === 0 || Math.abs(Date.parse(q.periodStart) - Date.parse(last4[i - 1].periodEnd)) <= 4 * DAY);
  return contiguous ? { value: last4.reduce((s, q) => s.plus(q.value), new Decimal(0)), end: last4[3].periodEnd } : null;
}
const yearAgoIndex = (qs: QuarterObservation[], i: number) =>
  qs.findIndex((q) => Math.abs(Date.parse(q.periodEnd) - (Date.parse(qs[i].periodEnd) - 365 * DAY)) <= 10 * DAY);
const cagr = (to: Decimal, from: Decimal, years: number) => new Decimal(to.div(from).toNumber() ** (1 / years) - 1);
const median = (v: Decimal[]) => {
  const s = [...v].sort((a, b) => a.comparedTo(b));
  return s.length === 0 ? null : s.length % 2 ? s[(s.length - 1) / 2] : s[s.length / 2 - 1].plus(s[s.length / 2]).div(2);
};

// --- supplementary SEC facts (fresh pull, 20 Oct 2026) ----------------------------
//
// The frozen 19 Oct captures carry no tax, pre-tax, working-capital or
// acquisition tags, and NUE and LLY tag no operating income. Calvin approved
// one free companyfacts pull to fill those gaps (#496, 20 Oct 2026); the
// facts are extracted verbatim by calibration-v3-sec-extract.py into
// docs/evidence/methodology-v3-drivers/sec-2026-10-20. The frozen sheets,
// prices and captures are unchanged.

const SEC = path.join(OUT, "sec-2026-10-20");
type Dated = Record<string, { val: number; accn: string; tag?: string }>;
// Cash-flow working-capital lines (us-gaap IncreaseDecreaseIn*): a positive
// asset-side value is an increase in the asset (cash used); a positive
// liability-side value is an increase in the liability (cash provided).
// Deferred and current income-tax movements other than accrued taxes payable
// are not working capital and are left out.
const WC_ASSET = ["AccountsReceivable", "AccountsAndOtherReceivables", "Inventories", "OtherCurrentAssets", "PrepaidDeferredExpenseAndOtherAssets", "OtherOperatingAssets", "OtherNoncurrentAssets", "OtherOperatingCapitalNet"];
const WC_LIABILITY = ["AccountsPayable", "AccountsPayableAndAccruedLiabilities", "AccruedLiabilitiesAndOtherOperatingLiabilities", "AccruedIncomeTaxesPayable", "ContractWithCustomerLiability", "OtherCurrentLiabilities", "OtherNoncurrentLiabilities", "EmployeeRelatedLiabilities"];

export function supplement(ticker: string) {
  const s = JSON.parse(readFileSync(path.join(SEC, `${ticker.toLowerCase()}-supplementary-facts.json`), "utf8"));
  const a = s.annual as Record<string, Dated>;
  const byFy = (m: Dated | undefined) => new Map(Object.entries(m ?? {}).map(([end, v]) => [Number(end.slice(0, 4)), D(v.val)]));
  const pretax = byFy(a.pretax);
  const tax = byFy(a.tax);
  const nonop = byFy(a.nonoperating);
  const intExp = byFy(a.interestExpense);
  const intInc = byFy(a.interestIncome);
  const eq = byFy(a.equityMethodIncome);
  // Operating income where the filer tags none: LLY = pre-tax income − non-operating income (expense), the
  // construction that reproduces MSFT's and NVDA's tagged operating income exactly; NUE (no non-operating
  // total tagged) = pre-tax income + interest expense − interest income − equity-method earnings.
  const construction = ticker === "LLY" ? "pre-tax income − non-operating income (expense)" : ticker === "NUE" ? "pre-tax income + interest expense − interest income − equity-method earnings" : null;
  const construct = (fy: number, get: (k: string) => Decimal | undefined): Decimal | null => {
    const p = get("pretax");
    if (p === undefined) return null;
    if (ticker === "LLY") return get("nonoperating") === undefined ? null : p.minus(get("nonoperating")!);
    if (ticker === "NUE") return p.plus(get("interestExpense") ?? 0).minus(get("interestIncome") ?? 0).minus(get("equityMethodIncome") ?? 0);
    return null;
  };
  const maps: Record<string, Map<number, Decimal>> = { pretax, nonoperating: nonop, interestExpense: intExp, interestIncome: intInc, equityMethodIncome: eq };
  const constructedOi = new Map<number, Decimal>();
  if (construction !== null) for (const fy of pretax.keys()) { const v = construct(fy, (k) => maps[k].get(fy)); if (v !== null) constructedOi.set(fy, v); }
  const ttmOf = (k: string) => (s.ttm[k] ? D(s.ttm[k].val) : undefined);
  const ttmOi = construction === null ? null : (() => { const v = construct(0, ttmOf); return v === null ? null : { value: v, end: s.ttm.pretax.end as string }; })();

  // ΔNWC per fiscal year from the cash-flow statement; a value repeated under two tags of one side in the same year (LLY's duplicate prepaid / other-operating-assets) counts once.
  const wc = s.workingCapitalCashFlow as Record<string, Dated>;
  const unclassified: string[] = [];
  const dNwc = new Map<number, Decimal>();
  const seen = new Map<string, Set<string>>();
  for (const [tag, rows] of Object.entries(wc)) {
    const name = tag.replace(/^IncreaseDecreaseIn/, "");
    const side = WC_ASSET.includes(name) ? 1 : WC_LIABILITY.includes(name) ? -1 : 0;
    if (side === 0) { unclassified.push(name); continue; }
    for (const [end, v] of Object.entries(rows)) {
      const fy = Number(end.slice(0, 4));
      const key = `${fy}:${side}`;
      const vals = seen.get(key) ?? new Set<string>();
      if (vals.has(String(v.val))) continue;
      vals.add(String(v.val));
      seen.set(key, vals);
      dNwc.set(fy, (dNwc.get(fy) ?? new Decimal(0)).plus(new Decimal(v.val).mul(side)));
    }
  }
  // Acquisitions per fiscal year: cash paid for businesses where tagged; MSFT tags no cash figure after FY2011, so
  // goodwill + finite-lived intangibles acquired stands in (labelled); a filer with none of these tags in a year acquired nothing tagged.
  const cashAcq = [a.acqBusinesses, a.acqBusinessTwo, a.acqOther].map(byFy);
  const cashTagged = cashAcq.some((m) => [...m.keys()].some((fy) => fy >= 2022));
  const acquisitions = new Map<number, Decimal>();
  const acqBasis = cashTagged ? "cash paid for businesses, net of cash acquired" : ticker === "MSFT" ? "goodwill + finite-lived intangibles acquired (no cash tag after FY2011)" : "none tagged";
  for (let fy = 2018; fy <= 2026; fy++) {
    const parts = cashTagged ? cashAcq.map((m) => m.get(fy)) : ticker === "MSFT" ? [byFy(a.goodwillAcquired).get(fy), byFy(a.intangiblesAcquired).get(fy)] : [];
    acquisitions.set(fy, parts.reduce<Decimal>((sum, v) => sum.plus(v ?? 0), new Decimal(0)));
  }
  const ltdNoncurrent = byFy(s.instant.longTermDebtNoncurrent);
  const capex = byFy(a.capex);
  return { capex, capexTag: Object.values(a.capex ?? {})[0]?.tag ?? null, pretax, tax, constructedOi, construction, ttmOi, dNwc, unclassified, acquisitions, acqBasis, ltdNoncurrent, source: s.source as string, fetchedAt: s.fetchedAt as string };
}
export type Supplement = ReturnType<typeof supplement>;

export function filedData(ticker: string, tax: Decimal, sup: Supplement) {
  const doc = JSON.parse(readFileSync(path.join(CAPTURES, `${ticker.toLowerCase()}-companyfacts.json`), "utf8")) as CompanyFactsDocument;
  const { measures } = historyFrom(doc);
  // Fill operating income from the supplement where the capture has none (NUE, LLY), and correct LLY's invested
  // capital: its mapped total-debt series is us-gaap:DebtCurrent alone, so long-term debt is added back.
  const years = measures.years.map((y) => ({
    ...y,
    operatingIncome: y.operatingIncome ?? sup.constructedOi.get(y.fiscalYear) ?? null,
    // LLY's mapped capex candidates are retired in its recent filings (it now tags
    // PaymentsToAcquireOtherPropertyPlantAndEquipment), so the supplement fills the gap.
    capex: y.capex ?? sup.capex.get(y.fiscalYear) ?? null,
    investedCapital:
      ticker === "LLY" && y.investedCapital !== null ? (sup.ltdNoncurrent.has(y.fiscalYear) ? y.investedCapital.plus(sup.ltdNoncurrent.get(y.fiscalYear)!) : null) : y.investedCapital,
  }));
  const rev = quarterlySeriesWithDerivedQ4(doc, candidatesFor("current-revenue"));
  const oi = quarterlySeriesWithDerivedQ4(doc, candidatesFor("operating-income"));
  const li = rev.length - 1;
  const ttmRev = ttm(rev, li);
  const ya = li >= 0 ? yearAgoIndex(rev, li) : -1;
  const ttmRevYearAgo = ya >= 0 ? ttm(rev, ya) : null;
  const lqYoY = ya >= 0 && rev[ya].value > 0 ? new Decimal(rev[li].value).div(rev[ya].value).minus(1) : null;
  const oiIdx = ttmRev === null ? -1 : oi.findIndex((q) => q.periodEnd === ttmRev.end);
  const ttmOi = oiIdx >= 0 ? ttm(oi, oiIdx) : sup.ttmOi !== null && ttmRev !== null && sup.ttmOi.end === ttmRev.end ? sup.ttmOi : null;

  const withRev = years.filter((y) => y.revenue !== null && y.revenue.greaterThan(0));
  const lastFy = withRev.at(-1)!;
  const fyBack = (n: number) => withRev.find((y) => y.fiscalYear === lastFy.fiscalYear - n);
  const margins = years.filter((y) => y.revenue !== null && y.operatingIncome !== null).map((y) => ({ fy: y.fiscalYear, m: y.operatingIncome!.div(y.revenue!) }));
  const last5Margins = margins.slice(-5).map((x) => x.m);

  const roicYears = years
    .map((y) => ({ fy: y.fiscalYear, nopat: y.operatingIncome === null ? null : y.operatingIncome.mul(ONE.minus(tax)), ic: y.investedCapital, capex: y.capex, da: y.depreciationAndAmortisation }))
    .filter((y) => y.nopat !== null && y.ic !== null && y.ic.greaterThan(0));
  const latest = roicYears.at(-1);
  const back3 = latest === undefined ? undefined : roicYears.find((y) => y.fy === latest.fy - 3);
  const last5 = roicYears.slice(-5);
  const incremental3 = latest && back3 && !latest.ic!.minus(back3.ic!).isZero() ? latest.nopat!.minus(back3.nopat!).div(latest.ic!.minus(back3.ic!)) : null;
  const last3 = years.filter((y) => y.operatingIncome !== null && y.capex !== null && y.depreciationAndAmortisation !== null).slice(-3);
  const nopat3 = last3.reduce((s, y) => s.plus(y.operatingIncome!.mul(ONE.minus(tax))), new Decimal(0));
  const sum3 = (f: (y: (typeof last3)[number]) => Decimal | null) => (last3.every((y) => f(y) !== null) ? last3.reduce((s, y) => s.plus(f(y)!), new Decimal(0)) : null);
  const capexLessDa = sum3((y) => y.capex!.minus(y.depreciationAndAmortisation!));
  const dNwc3 = sum3((y) => sup.dNwc.get(y.fiscalYear) ?? null);
  const acq3 = sum3((y) => sup.acquisitions.get(y.fiscalYear) ?? null);
  const netReinvest3 = last3.length === 3 && capexLessDa !== null ? capexLessDa.div(nopat3) : null;
  const fullReinvest3 = last3.length === 3 && capexLessDa !== null && dNwc3 !== null && acq3 !== null ? capexLessDa.plus(dNwc3).plus(acq3).div(nopat3) : null;
  const taxYears = [...sup.pretax.keys()].filter((fy) => sup.tax.has(fy)).sort((x, y) => x - y).slice(-3);
  const tax3 =
    taxYears.length === 3
      ? { from: taxYears[0], to: taxYears[2], v: taxYears.reduce((s2, fy) => s2.plus(sup.tax.get(fy)!), new Decimal(0)).div(taxYears.reduce((s2, fy) => s2.plus(sup.pretax.get(fy)!), new Decimal(0))) }
      : null;

  return {
    ttmRevenue: ttmRev,
    ttmGrowth: ttmRev && ttmRevYearAgo ? ttmRev.value.div(ttmRevYearAgo.value).minus(1) : null,
    latestQuarter: li >= 0 ? rev[li].periodEnd : null,
    lqYoY,
    cagr3: fyBack(3) ? cagr(lastFy.revenue!, fyBack(3)!.revenue!, 3) : null,
    cagr5: fyBack(5) ? cagr(lastFy.revenue!, fyBack(5)!.revenue!, 5) : null,
    lastFy: lastFy.fiscalYear,
    ttmMargin: ttmOi && ttmRev ? ttmOi.value.div(ttmRev.value) : null,
    median5Margin: median(last5Margins),
    marginRange: margins.length ? { lo: Decimal.min(...margins.map((x) => x.m)), hi: Decimal.max(...margins.map((x) => x.m)) } : null,
    growthRange: measures.revenueGrowthRange,
    // From the years above (operating income filled for NUE and LLY, LLY's invested capital corrected).
    roicRange: roicYears.length ? { low: Decimal.min(...roicYears.map((y) => y.nopat!.div(y.ic!))), high: Decimal.max(...roicYears.map((y) => y.nopat!.div(y.ic!))) } : null,
    roicLatest: latest ? { fy: latest.fy, v: latest.nopat!.div(latest.ic!) } : null,
    roic5: last5.length === 5 ? last5.reduce((s, y) => s.plus(y.nopat!.div(y.ic!)), new Decimal(0)).div(5) : null,
    incremental3: incremental3 === null ? null : { from: back3!.fy, to: latest!.fy, v: incremental3 },
    netReinvest3: netReinvest3 === null ? null : { from: last3[0].fiscalYear, to: last3[2].fiscalYear, v: netReinvest3 },
    fullReinvest3:
      fullReinvest3 === null
        ? null
        : { from: last3[0].fiscalYear, to: last3[2].fiscalYear, v: fullReinvest3, capexLessDa: capexLessDa!.div(nopat3), dNwc: dNwc3!.div(nopat3), acquisitions: acq3!.div(nopat3), acqBasis: sup.acqBasis },
    tax3,
    lastFyReinvestment: (() => {
      const y = last3.at(-1);
      if (y === undefined) return null;
      const dNwc = sup.dNwc.get(y.fiscalYear) ?? null;
      const acq = sup.acquisitions.get(y.fiscalYear) ?? null;
      if (dNwc === null || acq === null) return null;
      const capexLessDa = y.capex!.minus(y.depreciationAndAmortisation!);
      return { fy: y.fiscalYear, capexLessDa, dNwc, acquisitions: acq, total: capexLessDa.plus(dNwc).plus(acq) };
    })(),
    operatingIncomeConstruction: sup.construction,
    unclassifiedWorkingCapitalTags: sup.unclassified,
  };
}

/** The latest-FY effective rate from the committed golden facts (lib/analyzer/golden), the only tax data in the frozen inputs. */
function goldenTax(ticker: string): { rate: Decimal; fy: number; accession: string } | null {
  const g = JSON.parse(readFileSync(path.join("lib", "analyzer", "golden", `${ticker.toLowerCase()}.json`), "utf8"));
  const tax = g.facts.incomeTaxExpense;
  const pre = g.facts.incomeBeforeTax;
  if (!tax || !pre || !pre.value) return null;
  return { rate: D(tax.value).div(pre.value), fy: tax.fiscalYear, accession: tax.accessionNumber };
}

// --- loading -------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function load(entry: (typeof RUNS)[number]): Company {
  const run = JSON.parse(readFileSync(entry.file, "utf8"));
  const content = run.sheet.content;
  const result = run.result;
  const ev = result.diagnostics.enterpriseValue.value;
  const s = content.scenarios;
  const drv = (k: Scenario): Drivers => ({ g: flat(D(s[k].revenueGrowthOrPath)), m: flat(D(s[k].operatingMargin)), ronic: D(s[k].returnOnNewInvestment), shares: D(s[k].shareCount) });
  return {
    ticker: entry.ticker,
    label: entry.label,
    price: D(run.capture.price.value),
    rate: D(result.valuationBasis.discountRate.rate),
    tax: D(content.configuredConstants.nopatTaxRate),
    stub: D(result.runIdentity.valuationTiming.stubYears),
    baseRevenue: D(run.engineInputs?.baseRevenue ?? content.basis.ttmRevenue),
    bridge: D(ev.enterpriseValue).minus(D(ev.marketCap)),
    moat: content.moatClass,
    drivers: { bear: drv("bear"), base: drv("base"), bull: drv("bull") },
  };
}

// --- implied single driver -------------------------------------------------------

type Band = { lo: Decimal; hi: Decimal; basis: string };
function solve(f: (x: Decimal) => Decimal, target: Decimal, band: Band): string {
  const steps = 400;
  const xs = Array.from({ length: steps + 1 }, (_, i) => band.lo.plus(band.hi.minus(band.lo).mul(i).div(steps)));
  const ys = xs.map((x) => f(x).minus(target));
  const roots: Decimal[] = [];
  for (let i = 1; i < xs.length; i++) {
    if (ys[i - 1].isZero()) roots.push(xs[i - 1]);
    else if (ys[i - 1].isNegative() !== ys[i].isNegative()) {
      let lo = xs[i - 1];
      let hi = xs[i];
      const loNeg = ys[i - 1].isNegative();
      for (let k = 0; k < 60; k++) {
        const mid = lo.plus(hi).div(2);
        if (f(mid).minus(target).isNegative() === loNeg) lo = mid;
        else hi = mid;
      }
      roots.push(lo.plus(hi).div(2));
    }
  }
  const pct = (v: Decimal) => `${v.mul(100).toFixed(1)}%`;
  const note = band.basis === "the drafting band" ? "" : ` (within ${band.basis})`;
  if (roots.length === 1) return pct(roots[0]) + note;
  if (roots.length > 1) return `NON-UNIQUE (${roots.map(pct).join(", ")})`;
  const maxV = Decimal.max(...xs.map(f));
  return `no solution within ${band.basis} [${pct(band.lo)}, ${pct(band.hi)}] — Base at most $${maxV.toFixed(0)}`;
}

// --- report --------------------------------------------------------------------

export const pct = (v: Decimal | null | undefined, dp = 1) => (v === null || v === undefined ? "n/a" : `${v.mul(100).toFixed(dp)}%`);
export const money = (v: Decimal) => `$${v.toFixed(0)}`;
export const grid = (chk: VerdictCheck | null) => (chk === null ? "—" : CHECK_RATES.map((r) => UNCERTAINTY_LEVELS.map((u) => chk.grid[r][u][0]).join("")).join(" / "));

function main(): void {
  const lines: string[] = [];
  const json: Record<string, unknown> = {};
  const prior = JSON.parse(readFileSync(path.join(EV3, "results.json"), "utf8")).results as { ticker: string; design: string; recorded: boolean; base: string; bear: string; bull: string }[];

  lines.push("# Methodology v3 calibration #2 — driver construction (TEST only, #496)", "");
  lines.push("Frozen #495 sheets and 19 Oct captures, plus supplementary SEC facts pulled 20 Oct 2026 (tax, working capital, acquisitions, NUE/LLY operating income — `sec-2026-10-20/`). † = #495's dilution supplement (not engine output). ‡ = operating income constructed from tagged lines (the filer tags none). Recorded moat class; CURRENT = 10/10/+moat credit, OPT1 = runway by moat (wide 10/20/0, narrow 10/15/0, none 10/10/0).", "");

  const companies = RUNS.map(load);
  const data = Object.fromEntries(companies.map((c) => [c.ticker, filedData(c.ticker, c.tax, supplement(c.ticker))]));
  const taxes = Object.fromEntries(companies.map((c) => [c.ticker, goldenTax(c.ticker)]));

  // Reproduction of #495.
  lines.push("## Reproduction of #495 (no variant)", "", "| Company | CURRENT | OPT1 |", "|---|---|---|");
  for (const c of companies) {
    const cells = DESIGNS.map((d) => {
      const v = value(c, c.drivers, c.tax, d);
      const p = prior.find((x) => x.ticker === c.label && x.design === d.name && x.recorded)!;
      const err = Decimal.max(v.bear.minus(p.bear).abs(), v.base.minus(p.base).abs(), v.bull.minus(p.bull).abs());
      if (err.greaterThan("1e-9")) process.exitCode = 1;
      return err.greaterThan("1e-9") ? `**MISMATCH** ${err.toExponential(2)}` : "MATCH";
    });
    lines.push(`| ${c.label} | ${cells.join(" | ")} |`);
  }
  lines.push("");

  // 1. Data.
  lines.push("## 1. Filed data", "");
  lines.push(
    "| Company | TTM rev growth | Latest-qtr YoY | 3-yr CAGR | 5-yr CAGR | Op margin TTM / 5-yr median / filed range | Eff. tax 3-yr (latest FY) | ROIC latest / 5-yr avg | 3-yr incremental ROIC | Net reinvestment ÷ NOPAT, 3 yrs = capex − D&A + ΔNWC + acquisitions | Model reinvestment ÷ NOPAT yrs 1–5 (g ÷ RONIC) | Drafted reinvestment share ÷ NOPAT |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|"
  );
  for (const c of companies) {
    const d = data[c.ticker];
    const b = c.drivers.base;
    const draftedShare = D(JSON.parse(readFileSync(RUNS.find((r) => r.ticker === c.ticker)!.file, "utf8")).sheet.content.scenarios.base.reinvestmentCapitalIntensity);
    const draftedOverNopat = draftedShare.div(b.m[0].mul(ONE.minus(c.tax)));
    const t = taxes[c.ticker];
    lines.push(
      `| ${c.label} | ${pct(d.ttmGrowth)} | ${pct(d.lqYoY)} (${d.latestQuarter}) | ${pct(d.cagr3)} | ${pct(d.cagr5)} (to FY${d.lastFy}) | ${pct(d.ttmMargin)} / ${pct(d.median5Margin)} / ${d.marginRange ? `${pct(d.marginRange.lo)}–${pct(d.marginRange.hi)}` : "n/a (operating income not tagged)"}${d.operatingIncomeConstruction ? " ‡" : ""} | ${d.tax3 ? `${pct(d.tax3.v)} (FY${d.tax3.from}–${d.tax3.to})` : "n/a"}${t ? ` (${pct(t.rate)} FY${t.fy})` : ""} | ${d.roicLatest ? `${pct(d.roicLatest.v)} (FY${d.roicLatest.fy})` : "n/a"} / ${pct(d.roic5)} | ${d.incremental3 ? `${pct(d.incremental3.v)} (FY${d.incremental3.from}→${d.incremental3.to})` : "n/a"} | ${d.fullReinvest3 ? `**${pct(d.fullReinvest3.v)}** = ${pct(d.fullReinvest3.capexLessDa)} + ${pct(d.fullReinvest3.dNwc)} + ${pct(d.fullReinvest3.acquisitions)} (FY${d.fullReinvest3.from}–${d.fullReinvest3.to}; acquisitions: ${d.fullReinvest3.acqBasis})` : "n/a"} | ${pct(b.g[0].div(b.ronic))} | ${pct(draftedOverNopat)} (${pct(draftedShare)} of revenue) |`
    );
    json[`data:${c.ticker}`] = { ...d, goldenTax: t, modelReinvestmentOverNopat: b.g[0].div(b.ronic), draftedShare, draftedOverNopat };
  }
  lines.push(
    "",
    "‡ NUE: pre-tax income + interest expense − interest income − equity-method earnings. LLY: pre-tax income − non-operating income (expense) — the construction reproduces MSFT's and NVDA's tagged operating income exactly in FY2023–26. LLY invested capital adds long-term debt back: its mapped total-debt series is us-gaap:DebtCurrent alone; LLY capex is us-gaap:PaymentsToAcquireOtherPropertyPlantAndEquipment (its mapped capex tags stop before FY2022). ΔNWC is the cash-flow statement's working-capital lines.",
    "",
    "**What drives FCF in the engine:** the return on new capital. Reinvestment_t = NOPAT_t × g_(t+1) ÷ RONIC_t (`lib/analyzer/modules/scenarioOutputs.ts:76`). The drafted reinvestment share (`reinvestmentCapitalIntensity`) is never read by the valuation — only displayed (`assemble.ts:951`) and used for the profile's capital-intensity classification (`aiProposedBundle.ts:160`).",
    ""
  );

  // 2–3. Variants.
  type Variant = { key: string; build: (c: Company) => { drivers: Record<Scenario, Drivers>; tax: Decimal } | string };
  const d0 = (c: Company) => ({ drivers: c.drivers, tax: c.tax });
  const ramp = (from: Decimal, to: Decimal) => [0, 1, 2, 3, 4].map((i) => from.plus(to.minus(from).mul(i).div(4)));
  const M1 = (c: Company, drivers = c.drivers) => {
    const m = data[c.ticker].ttmMargin;
    if (m === null) return "TTM operating margin not computable (operating income not tagged)";
    return Object.fromEntries((["bear", "base", "bull"] as Scenario[]).map((s) => [s, { ...drivers[s], m: ramp(m, drivers[s].m[4]) }])) as Record<Scenario, Drivers>;
  };
  const G1 = (c: Company, drivers = c.drivers) => {
    const g = data[c.ticker].ttmGrowth;
    if (g === null) return "TTM revenue growth not computable";
    return Object.fromEntries((["bear", "base", "bull"] as Scenario[]).map((s) => [s, { ...drivers[s], g: ramp(g, drivers[s].g[4]) }])) as Record<Scenario, Drivers>;
  };
  const T1 = (c: Company) => data[c.ticker].tax3?.v ?? null;
  const R = (c: Company, v: Decimal | null, why: string) =>
    v === null ? why : v.lessThanOrEqualTo(0) ? `not positive (${pct(v)})` : { drivers: { ...c.drivers, base: { ...c.drivers.base, ronic: v } }, tax: c.tax };
  const variants: Variant[] = [
    { key: "Drafted", build: d0 },
    { key: "M1 margin TTM→drafted", build: (c) => { const m = M1(c); return typeof m === "string" ? m : { drivers: m, tax: c.tax }; } },
    { key: "G1 growth TTM→drafted", build: (c) => { const g = G1(c); return typeof g === "string" ? g : { drivers: g, tax: c.tax }; } },
    { key: "T1 effective tax (3-yr)", build: (c) => { const t = T1(c); return t === null ? "no effective tax rate" : { drivers: c.drivers, tax: t }; } },
    { key: "R1 RONIC = latest ROIC", build: (c) => R(c, data[c.ticker].roicLatest?.v ?? null, "ROIC not computable (operating income not tagged)") },
    { key: "R2 RONIC = 3-yr incremental", build: (c) => R(c, data[c.ticker].incremental3?.v ?? null, "incremental ROIC not computable") },
    {
      key: "R3 RONIC = implied by actual reinvestment",
      build: (c) => {
        const nr = data[c.ticker].fullReinvest3?.v ?? null;
        if (nr === null) return "actual reinvestment not computable (no NOPAT)";
        if (!nr.greaterThan(0)) return `actual net reinvestment not positive (${pct(nr)} of NOPAT)`;
        return R(c, c.drivers.base.g[0].div(nr), "");
      },
    },
    {
      key: "M1+G1+T1",
      build: (c) => {
        const m = M1(c);
        if (typeof m === "string") return m;
        const g = G1(c, m);
        if (typeof g === "string") return g;
        const t = T1(c);
        return t === null ? "no effective tax rate" : { drivers: g, tax: t };
      },
    },
  ];

  lines.push("## 2–3. Variants (recorded moat class)", "");
  lines.push("Grid = verdict zones at rate −0.5pp / rate / +0.5pp, each Low·Med·High (B/H/S). ΔBase vs the drafted sheet under the same design.", "");
  lines.push("| Company | Variant | Base RONIC yrs 1–5 | Design | Bear / Base / Bull | Price÷Base | TV share | D3 grid | Close calls | ΔBase vs drafted |", "|---|---|---|---|---|---|---|---|---|---|");
  const variantJson: unknown[] = [];
  for (const c of companies) {
    const drafted = Object.fromEntries(DESIGNS.map((d) => [d.name, value(c, c.drivers, c.tax, d).base]));
    for (const v of variants) {
      const built = v.build(c);
      if (typeof built === "string") {
        lines.push(`| ${c.label} | ${v.key} | — | — | NOT COMPUTED: ${built} | | | | | |`);
        variantJson.push({ ticker: c.label, variant: v.key, notComputed: built });
        continue;
      }
      for (const d of DESIGNS) {
        const r = value(c, built.drivers, built.tax, d);
        const delta = r.base.div(drafted[d.name]).minus(1);
        lines.push(
          `| ${c.label} | ${v.key} | ${pct(built.drivers.base.ronic)} | ${d.name} | ${money(r.bear)} / **${money(r.base)}** / ${money(r.bull)} | ${r.priceOverBase.toFixed(2)}× | ${pct(r.terminalShare, 0)} | ${grid(r.check)} | ${r.closeCalls ?? "—"} | ${v.key === "Drafted" ? "—" : `${delta.greaterThanOrEqualTo(0) ? "+" : ""}${pct(delta)}`} |`
        );
        variantJson.push({ ticker: c.label, variant: v.key, design: d.name, tax: built.tax.toString(), ronicBase: built.drivers.base.ronic.toString(), bear: r.bear.toString(), base: r.base.toString(), bull: r.bull.toString(), priceOverBase: r.priceOverBase.toString(), terminalShare: r.terminalShare.toString(), grid: r.check?.grid ?? null, routing: r.check?.routing ?? null, closeCalls: r.closeCalls, deltaVsDrafted: delta.toString() });
      }
    }
  }
  json.variants = variantJson;
  lines.push("");

  // 4. Implied single driver.
  lines.push("## 4. Implied single driver (Base = price; other drivers as drafted; recorded moat class)", "");
  lines.push("Bands are the drafting rules (`scenarioProposal.ts` rule 4): growth within the filed single-year range ± 10pp; margin within the filed range −10pp / +5pp; return on new capital up to 1.5× the best filed ROIC. Where a filed range is missing, the drafter's hard bounds (`BANDS`) apply and the band is named.", "");
  lines.push("| Company | Price | Design | Growth yrs 1–5 | Flat margin | Return on new capital yrs 1–5 |", "|---|---|---|---|---|---|");
  const implied: unknown[] = [];
  for (const c of companies) {
    const d = data[c.ticker];
    const gBand: Band = d.growthRange
      ? { lo: Decimal.max(d.growthRange.low.minus("0.1"), "-0.5"), hi: Decimal.min(d.growthRange.high.plus("0.1"), "1"), basis: "the drafting band" }
      : { lo: new Decimal("-0.5"), hi: ONE, basis: "the hard bounds, no filed growth range" };
    const mBand: Band = d.marginRange
      ? { lo: Decimal.max(d.marginRange.lo.minus("0.1"), "-1"), hi: Decimal.min(d.marginRange.hi.plus("0.05"), "0.9"), basis: "the drafting band" }
      : { lo: new Decimal("-1"), hi: new Decimal("0.9"), basis: "the hard bounds, no filed margin range" };
    const rBand: Band = d.roicRange
      ? { lo: new Decimal("0.001"), hi: Decimal.min(d.roicRange.high.mul("1.5"), "2"), basis: "the drafting band" }
      : { lo: new Decimal("0.001"), hi: new Decimal("2"), basis: "the hard bounds, no filed ROIC" };
    for (const design of DESIGNS) {
      const baseWith = (patch: Partial<Drivers>) => {
        const drivers = { ...c.drivers, base: { ...c.drivers.base, ...patch } };
        const v = valueEv(c, drivers.base, c.tax, c.rate, scenarioRow(design, c.moat, "base"));
        return v.ev.minus(c.bridge).div(drivers.base.shares);
      };
      const cells = [
        solve((x) => baseWith({ g: flat(x) }), c.price, gBand),
        solve((x) => baseWith({ m: flat(x) }), c.price, mBand),
        solve((x) => baseWith({ ronic: x }), c.price, rBand),
      ];
      lines.push(`| ${c.label} | $${c.price.toFixed(2)} | ${design.name} | ${cells.join(" | ")} |`);
      implied.push({ ticker: c.label, design: design.name, growth: cells[0], margin: cells[1], ronic: cells[2], bands: { growth: gBand, margin: mBand, ronic: rBand } });
    }
  }
  json.impliedSingleDriver = implied;
  lines.push("");

  // 5. Dilution fallback check.
  lines.push("## 5. Dilution fallback check — convertibles in the 19 Oct captures", "");
  lines.push(
    "Both convertible tags (`ConvertibleDebt`, `ConvertibleNotesPayable`) are in the tag mapping (`tagMap.ts` \"convertible-debt\"), so the capture keeps every row of either over its twelve calendar years.",
    "",
    "| Company | Convertible rows in the capture | Latest | Diluted − basic weighted-average shares (latest 10-K) |",
    "|---|---|---|---|"
  );
  const dilutionJson: unknown[] = [];
  for (const c of companies.filter((x) => x.label.endsWith("†"))) {
    const doc = JSON.parse(readFileSync(path.join(CAPTURES, `${c.ticker.toLowerCase()}-companyfacts.json`), "utf8"));
    const g = doc.facts["us-gaap"] ?? {};
    const rows = ["ConvertibleDebt", "ConvertibleNotesPayable"].flatMap((t) =>
      ((g[t]?.units?.USD ?? []) as { end: string; val: number; form: string; accn: string }[]).map((r) => ({ tag: t, ...r }))
    );
    const latest = rows.sort((a, b) => a.end.localeCompare(b.end)).at(-1);
    const lastNonZero = rows.filter((r) => r.val > 0).at(-1);
    const sh = (tag: string) =>
      ((g[tag]?.units?.shares ?? []) as { end: string; val: number; form: string; fp: string }[]).filter((r) => r.form === "10-K" && r.fp === "FY").sort((a, b) => a.end.localeCompare(b.end)).at(-1);
    const dil = sh("WeightedAverageNumberOfDilutedSharesOutstanding");
    const bas = sh("WeightedAverageNumberOfSharesOutstandingBasic");
    const gap = dil && bas ? new Decimal(dil.val).minus(bas.val) : null;
    lines.push(
      `| ${c.ticker} | ${rows.length === 0 ? "none, in any period" : `${rows.length} rows; last non-zero $${(lastNonZero!.val / 1e6).toFixed(0)}m at ${lastNonZero!.end}`} | ${latest ? `${latest.tag} $${(latest.val / 1e6).toFixed(0)}m at ${latest.end} (${latest.form} ${latest.accn})` : "—"} | ${gap ? `${(gap.toNumber() / 1e6).toFixed(1)}m (${gap.div(bas!.val).mul(100).toFixed(2)}% of basic, FY ending ${dil!.end})` : "n/a"} |`
    );
    dilutionJson.push({ ticker: c.ticker, rows: rows.length, latest, lastNonZero, dilutedMinusBasic: gap?.toString() ?? null });
  }
  json.dilutionCheck = dilutionJson;
  lines.push("");

  writeFileSync(path.join(OUT, "results.md"), lines.join("\n") + "\n");
  writeFileSync(path.join(OUT, "results.json"), JSON.stringify(json, (_k, v) => (v instanceof Decimal ? v.toString() : v), 2) + "\n");
  console.log(lines.join("\n"));
}

// Run only when executed directly; calibration-v3-final.ts imports the engine.
if (process.argv[1]?.endsWith("calibration-v3-drivers.ts")) main();
