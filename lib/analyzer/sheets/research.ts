import Decimal from "decimal.js";
import type { AcquiredCompany } from "../acquisition/provider";
import type { CompanyFactsDocument, SecClient, SubmissionsDocument } from "../acquisition/secClient";
import { filingDocumentUrl } from "../acquisition/secClient";
import { annualSeries, instantAnnualSeries, quarterlySeriesWithDerivedQ4, type AnnualSeries } from "../acquisition/history";
import { TAG_MAP, type TagCandidate } from "../acquisition/tagMap";
import { investedCapitalAt } from "../acquisition/companyInputs";
import { htmlToPlainText } from "../acquisition/item1Extraction";
import { isMaterialFilingForm } from "../materialFilings";
import type { SheetBasis, SheetSource } from "./sheet";

// ---------------------------------------------------------------------------
// CF-AR6-ANY-TICKER-DRAFTS-01 — the research a draft is written from
// (frozen spec §14.9 AR0-6; issue #454 DO 1 and 2).
//
// Two kinds of source, both cited by id from every driver anchor:
//
//   - HISTORY (deterministic, from the company's own XBRL facts): revenue,
//     operating income and margin, capital expenditure, depreciation and
//     amortisation, operating cash flow, stock-based compensation, NOPAT,
//     invested capital, return on invested capital, the incremental return
//     on new capital, backlog (remaining performance obligations) and the
//     latest quarters. Each series is one source, cited by the accession of
//     its latest observation.
//   - FILING TEXT: the 10-K Item 1 business description the acquisition
//     already extracted (item1Extraction.ts's fixed rule), and the most
//     recent 8-K earnings releases (item 2.02, their exhibit 99 text) —
//     where guidance and backlog are discussed. Each is one source with its
//     form, accession, filing date and URL.
//
// PRICE-BLIND BY CONSTRUCTION (issue #454 DO NOT: "The draft never sees the
// price"). Nothing here reads a quote, a market capitalisation or anything
// derived from one: the acquisition handed in is made with no price, the
// history is filed accounting data, and every sentence of filing text that
// speaks of the stock's price or market value is removed before the text is
// kept (`redactMarketPrice`). The reverse DCF and every market-implied figure
// are never computed for a draft at all.
// ---------------------------------------------------------------------------

/** The general statutory rate the history's NOPAT is stated at — the same reference the drafting call cites. */
export const STATUTORY_TAX_RATE = new Decimal("0.21");

const HISTORY_YEARS = 10;
const RECENT_EARNINGS_RELEASES = 2;
const EXCERPT_LIMIT = 9000;
const ITEM1_LIMIT = 9000;

export interface HistoryYear {
  fiscalYear: number;
  revenue: Decimal | null;
  operatingIncome: Decimal | null;
  capex: Decimal | null;
  depreciationAndAmortisation: Decimal | null;
  operatingCashFlow: Decimal | null;
  stockBasedCompensation: Decimal | null;
  nopat: Decimal | null;
  investedCapital: Decimal | null;
  backlog: Decimal | null;
}

export interface LatestQuarter {
  periodEnd: string;
  revenue: Decimal;
  /** Growth on the same quarter a year earlier, where both exist. */
  yearOnYearGrowth: Decimal | null;
  /** The four quarters to this one, where they are contiguous. */
  ttmRevenue: Decimal | null;
}

/** The deterministic measures the validators and the draft both read. */
export interface HistoryMeasures {
  years: HistoryYear[];
  /** Revenue CAGR over the window, where its endpoints exist. */
  revenueCagr: { years: number; value: Decimal } | null;
  /** Best and worst single-year revenue growth in the window. */
  revenueGrowthRange: { low: Decimal; high: Decimal } | null;
  operatingMarginRange: { low: Decimal; high: Decimal } | null;
  /** Return on invested capital, NOPAT ÷ year-end invested capital, per year. */
  roicRange: { low: Decimal; high: Decimal } | null;
  /** ΔNOPAT ÷ Δinvested capital over the latest five years, where both moved. */
  incrementalReturn: Decimal | null;
  /** Median (capex − D&A) ÷ revenue — net reinvestment share. */
  medianNetReinvestmentShare: Decimal | null;
  latestQuarter: LatestQuarter | null;
}

export interface ResearchPack {
  sources: SheetSource[];
  measures: HistoryMeasures;
  basis: SheetBasis;
  /** Why a filing-text source is absent, where it is. */
  gaps: string[];
}

function candidatesFor(factId: string): readonly TagCandidate[] {
  return TAG_MAP.find((e) => e.factId === factId)?.candidates ?? [];
}

/** An annual duration series with each candidate's `plus` components summed in, year by year. */
function annualWithPlus(doc: CompanyFactsDocument, factId: string): Map<number, { value: Decimal; accession: string | null }> {
  const out = new Map<number, { value: Decimal; accession: string | null }>();
  const candidates = candidatesFor(factId);
  const series = annualSeries(doc, candidates);
  if (series === null) return out;
  for (const obs of series.observations) out.set(obs.fiscalYear, { value: new Decimal(obs.value), accession: obs.accession });
  const winning = candidates.find((c) => c.ref.tag === series.tag);
  for (const plus of winning?.plus ?? []) {
    const component = annualSeries(doc, [{ ref: plus }]);
    for (const obs of component?.observations ?? []) {
      const held = out.get(obs.fiscalYear);
      if (held !== undefined) out.set(obs.fiscalYear, { ...held, value: held.value.plus(obs.value) });
    }
  }
  return out;
}

function seriesMap(series: AnnualSeries | null): Map<number, { value: Decimal; accession: string | null }> {
  const out = new Map<number, { value: Decimal; accession: string | null }>();
  for (const obs of series?.observations ?? []) out.set(obs.fiscalYear, { value: new Decimal(obs.value), accession: obs.accession });
  return out;
}

const BACKLOG_CANDIDATES: TagCandidate[] = [{ ref: { ns: "us-gaap", tag: "RevenueRemainingPerformanceObligation" } }];

function median(values: Decimal[]): Decimal | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a.comparedTo(b));
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : sorted[mid - 1].plus(sorted[mid]).dividedBy(2);
}

function range(values: Decimal[]): { low: Decimal; high: Decimal } | null {
  if (values.length === 0) return null;
  return {
    low: values.reduce((m, v) => (v.lessThan(m) ? v : m)),
    high: values.reduce((m, v) => (v.greaterThan(m) ? v : m)),
  };
}

/** The history the draft and the validators read — filed accounting data only. */
export function historyFrom(doc: CompanyFactsDocument): { measures: HistoryMeasures; accessions: Record<string, string | null> } {
  const revenue = annualWithPlus(doc, "current-revenue");
  const operatingIncome = annualWithPlus(doc, "operating-income");
  const capex = annualWithPlus(doc, "capex");
  const da = annualWithPlus(doc, "depreciation-and-amortisation");
  const ocf = annualWithPlus(doc, "operating-cash-flow");
  const sbc = annualWithPlus(doc, "sbc");
  const equity = instantAnnualSeries(doc, candidatesFor("total-equity"));
  const debt = instantAnnualSeries(doc, candidatesFor("total-debt"));
  const leases = instantAnnualSeries(doc, candidatesFor("finance-lease-liabilities"));
  const cash = instantAnnualSeries(doc, candidatesFor("cash-and-marketable-debt-securities"));
  const backlog = seriesMap(instantAnnualSeries(doc, BACKLOG_CANDIDATES));

  const latestYear = Math.max(...[...revenue.keys(), ...operatingIncome.keys()], -Infinity);
  const years: HistoryYear[] = [];
  if (Number.isFinite(latestYear)) {
    for (let fy = latestYear - HISTORY_YEARS + 1; fy <= latestYear; fy++) {
      const oi = operatingIncome.get(fy)?.value ?? null;
      const ic = investedCapitalAt(fy, equity, debt, leases, cash);
      const row: HistoryYear = {
        fiscalYear: fy,
        revenue: revenue.get(fy)?.value ?? null,
        operatingIncome: oi,
        capex: capex.get(fy)?.value ?? null,
        depreciationAndAmortisation: da.get(fy)?.value ?? null,
        operatingCashFlow: ocf.get(fy)?.value ?? null,
        stockBasedCompensation: sbc.get(fy)?.value ?? null,
        nopat: oi === null ? null : oi.mul(new Decimal(1).minus(STATUTORY_TAX_RATE)),
        investedCapital: ic === null ? null : new Decimal(ic),
        backlog: backlog.get(fy)?.value ?? null,
      };
      if (Object.entries(row).some(([k, v]) => k !== "fiscalYear" && v !== null)) years.push(row);
    }
  }

  const withRevenue = years.filter((y) => y.revenue !== null && y.revenue.greaterThan(0));
  const first = withRevenue[0];
  const last = withRevenue[withRevenue.length - 1];
  const span = first !== undefined && last !== undefined ? last.fiscalYear - first.fiscalYear : 0;
  const revenueCagr =
    span > 0 ? { years: span, value: new Decimal(last.revenue!.dividedBy(first.revenue!).toNumber() ** (1 / span) - 1) } : null;

  const growths: Decimal[] = [];
  for (let i = 1; i < years.length; i++) {
    const prev = years[i - 1].revenue;
    const cur = years[i].revenue;
    if (prev !== null && cur !== null && prev.greaterThan(0) && years[i].fiscalYear === years[i - 1].fiscalYear + 1) {
      growths.push(cur.dividedBy(prev).minus(1));
    }
  }
  const margins = years
    .filter((y) => y.revenue !== null && y.operatingIncome !== null && y.revenue.greaterThan(0))
    .map((y) => y.operatingIncome!.dividedBy(y.revenue!));
  const roics = years
    .filter((y) => y.nopat !== null && y.investedCapital !== null && y.investedCapital.greaterThan(0))
    .map((y) => y.nopat!.dividedBy(y.investedCapital!));

  const withReturns = years.filter((y) => y.nopat !== null && y.investedCapital !== null);
  let incrementalReturn: Decimal | null = null;
  const to = withReturns[withReturns.length - 1];
  const from = to === undefined ? undefined : withReturns.find((y) => y.fiscalYear === to.fiscalYear - 5);
  if (to !== undefined && from !== undefined) {
    const deltaIc = to.investedCapital!.minus(from.investedCapital!);
    if (deltaIc.greaterThan(0)) incrementalReturn = to.nopat!.minus(from.nopat!).dividedBy(deltaIc);
  }

  const netShares = years
    .filter((y) => y.capex !== null && y.depreciationAndAmortisation !== null && y.revenue !== null && y.revenue.greaterThan(0))
    .map((y) => y.capex!.minus(y.depreciationAndAmortisation!).dividedBy(y.revenue!));

  const quarters = quarterlySeriesWithDerivedQ4(doc, candidatesFor("current-revenue"));
  let latestQuarter: LatestQuarter | null = null;
  const lq = quarters[quarters.length - 1];
  if (lq !== undefined) {
    const yearAgo = quarters.find((q) => Math.abs(Date.parse(q.periodEnd) - (Date.parse(lq.periodEnd) - 365 * 86_400_000)) <= 10 * 86_400_000);
    const last4 = quarters.slice(-4);
    const contiguous =
      last4.length === 4 &&
      last4.every((q, i) => i === 0 || Math.abs(Date.parse(q.periodStart) - Date.parse(last4[i - 1].periodEnd)) <= 4 * 86_400_000);
    latestQuarter = {
      periodEnd: lq.periodEnd,
      revenue: new Decimal(lq.value),
      yearOnYearGrowth: yearAgo === undefined || yearAgo.value <= 0 ? null : new Decimal(lq.value).dividedBy(yearAgo.value).minus(1),
      ttmRevenue: contiguous ? last4.reduce((s, q) => s.plus(q.value), new Decimal(0)) : null,
    };
  }

  const latestAccession = (m: Map<number, { accession: string | null }>): string | null => {
    const keys = [...m.keys()].sort((a, b) => a - b);
    return keys.length === 0 ? null : m.get(keys[keys.length - 1])!.accession;
  };

  return {
    measures: {
      years,
      revenueCagr,
      revenueGrowthRange: range(growths),
      operatingMarginRange: range(margins),
      roicRange: range(roics),
      incrementalReturn,
      medianNetReinvestmentShare: median(netShares),
      latestQuarter,
    },
    accessions: {
      revenue: latestAccession(revenue),
      operatingIncome: latestAccession(operatingIncome),
      capex: latestAccession(capex),
      da: latestAccession(da),
      ocf: latestAccession(ocf),
      sbc: latestAccession(sbc),
      backlog: latestAccession(backlog),
      returns: equity?.observations.at(-1)?.accession ?? null,
    },
  };
}

function millions(v: Decimal | null): string {
  return v === null ? "n/a" : `${v.dividedBy(1_000_000).toDecimalPlaces(0).toFixed(0)}m`;
}

function pct(v: Decimal | null): string {
  return v === null ? "n/a" : `${v.mul(100).toFixed(1)}%`;
}

function line(years: HistoryYear[], f: (y: HistoryYear) => string): string {
  return years.map((y) => `FY${y.fiscalYear} ${f(y)}`).join("; ");
}

function historySource(id: string, label: string, accession: string | null, excerpt: string): SheetSource {
  return { id, kind: "HISTORY", label, form: "XBRL company facts", accession, filed: null, url: null, excerpt };
}

/** The history as citable sources — one per series. */
export function historySources(measures: HistoryMeasures, accessions: Record<string, string | null>): SheetSource[] {
  const y = measures.years;
  const sources: SheetSource[] = [
    historySource(
      "H:revenue",
      "Revenue, by fiscal year",
      accessions.revenue,
      `${line(y, (r) => millions(r.revenue))}. Window CAGR ${measures.revenueCagr === null ? "n/a" : `${pct(measures.revenueCagr.value)} over ${measures.revenueCagr.years} years`}; single-year growth ranged ${
        measures.revenueGrowthRange === null ? "n/a" : `${pct(measures.revenueGrowthRange.low)} to ${pct(measures.revenueGrowthRange.high)}`
      }.`
    ),
    historySource(
      "H:margin",
      "Operating income and operating margin, by fiscal year",
      accessions.operatingIncome,
      `${line(y, (r) => `${millions(r.operatingIncome)} (${pct(r.revenue !== null && r.operatingIncome !== null && r.revenue.greaterThan(0) ? r.operatingIncome.dividedBy(r.revenue) : null)})`)}. Margin ranged ${
        measures.operatingMarginRange === null ? "n/a" : `${pct(measures.operatingMarginRange.low)} to ${pct(measures.operatingMarginRange.high)}`
      }.`
    ),
    historySource(
      "H:capex",
      "Capital expenditure and depreciation & amortisation, by fiscal year",
      accessions.capex ?? accessions.da,
      `${line(y, (r) => `capex ${millions(r.capex)}, D&A ${millions(r.depreciationAndAmortisation)}`)}. Median net reinvestment (capex − D&A) ÷ revenue ${pct(measures.medianNetReinvestmentShare)}.`
    ),
    historySource(
      "H:cashflow",
      "Operating cash flow and stock-based compensation, by fiscal year",
      accessions.ocf ?? accessions.sbc,
      line(y, (r) => `operating cash flow ${millions(r.operatingCashFlow)}, SBC ${millions(r.stockBasedCompensation)}`) + "."
    ),
    historySource(
      "H:returns",
      `NOPAT (operating income at the ${pct(STATUTORY_TAX_RATE)} statutory rate), invested capital and return on invested capital, by fiscal year`,
      accessions.returns,
      `${line(y, (r) => `NOPAT ${millions(r.nopat)}, invested capital ${millions(r.investedCapital)}, ROIC ${pct(r.nopat !== null && r.investedCapital !== null && r.investedCapital.greaterThan(0) ? r.nopat.dividedBy(r.investedCapital) : null)}`)}. ROIC ranged ${
        measures.roicRange === null ? "n/a" : `${pct(measures.roicRange.low)} to ${pct(measures.roicRange.high)}`
      }; incremental return on new capital over the latest five years (ΔNOPAT ÷ Δinvested capital) ${pct(measures.incrementalReturn)}.`
    ),
  ];
  if (y.some((r) => r.backlog !== null)) {
    sources.push(
      historySource("H:backlog", "Remaining performance obligations (backlog), at fiscal year end", accessions.backlog, line(y.filter((r) => r.backlog !== null), (r) => millions(r.backlog)) + ".")
    );
  }
  const q = measures.latestQuarter;
  if (q !== null) {
    sources.push(
      historySource(
        "H:quarter",
        "Latest reported quarter (revenue, from the quarterly filings)",
        null,
        `Quarter ended ${q.periodEnd}: revenue ${millions(q.revenue)}, ${q.yearOnYearGrowth === null ? "no year-ago quarter" : `${pct(q.yearOnYearGrowth)} on the year-ago quarter`}; trailing twelve months ${millions(q.ttmRevenue)}.`
      )
    );
  }
  return sources;
}

const MARKET_PRICE_RE =
  /\b(stock|share|closing|trading|market)\s+price|price\s+per\s+share|market\s+(value|capitali[sz]ation)|52-week|share\s+price|stock\s+performance|total\s+shareholder\s+return/i;

/**
 * Removes every sentence that speaks of the stock's price or market value —
 * the draft never sees the price (issue #454 DO NOT).
 */
export function redactMarketPrice(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !MARKET_PRICE_RE.test(sentence))
    .join(" ");
}

function clip(text: string, limit: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= limit ? flat : `${flat.slice(0, limit)} …`;
}

interface FilingIndex {
  directory?: { item?: { name?: string; type?: string }[] };
}

/** The most recent current reports announcing results (item 2.02), newest first. */
export function recentEarningsReleases(submissions: SubmissionsDocument, limit = RECENT_EARNINGS_RELEASES) {
  const r = submissions.filings?.recent;
  const out: { accession: string; filed: string; form: string }[] = [];
  const forms = r?.form ?? [];
  for (let i = 0; i < forms.length && out.length < limit; i++) {
    const form = forms[i] ?? "";
    if (!isMaterialFilingForm(form) || !/^8-K/i.test(form)) continue;
    if (!(r?.items?.[i] ?? "").split(",").map((s) => s.trim()).includes("2.02")) continue;
    const accession = r?.accessionNumber?.[i];
    const filed = r?.filingDate?.[i];
    if (accession !== undefined && filed !== undefined) out.push({ accession, filed, form });
  }
  return out;
}

async function earningsReleaseSource(
  client: SecClient,
  cik: string,
  release: { accession: string; filed: string; form: string },
  id: string
): Promise<SheetSource | string> {
  const folder = filingDocumentUrl(cik, release.accession, "index.json");
  let index: FilingIndex;
  try {
    index = await client.getJson<FilingIndex>(folder);
  } catch (err) {
    return `the ${release.form} filed ${release.filed} could not be listed (${err instanceof Error ? err.message : String(err)})`;
  }
  const exhibit = (index.directory?.item ?? [])
    .map((i) => i.name ?? "")
    .find((name) => /\.html?$/i.test(name) && /ex[-_]?99|exhibit[-_]?99|dex99/i.test(name));
  if (exhibit === undefined) return `the ${release.form} filed ${release.filed} carries no exhibit 99 document`;
  let text: string;
  try {
    text = htmlToPlainText(await client.filingDocument(cik, release.accession, exhibit));
  } catch (err) {
    return `the ${release.form} filed ${release.filed} exhibit could not be read (${err instanceof Error ? err.message : String(err)})`;
  }
  return {
    id,
    kind: "EARNINGS RELEASE",
    label: `Earnings release (${release.form}, item 2.02, exhibit 99) filed ${release.filed}`,
    form: release.form,
    accession: release.accession,
    filed: release.filed,
    url: filingDocumentUrl(cik, release.accession, exhibit),
    excerpt: clip(redactMarketPrice(text), EXCERPT_LIMIT),
  };
}

/**
 * The research pack for one company: history always; filing text where a
 * client is supplied (a live run) and the filings carry it. An absent text
 * source is recorded in `gaps`, never invented.
 */
export async function researchFor(acquired: AcquiredCompany, client: SecClient | null): Promise<ResearchPack> {
  const { measures, accessions } = historyFrom(acquired.companyFacts);
  const sources = historySources(measures, accessions);
  const gaps: string[] = [];

  const narrative = acquired.business.narrative;
  if (narrative !== null && narrative.source !== "MARKET-DATA PROVIDER SUMMARY") {
    sources.push({
      id: "F1",
      kind: "FILING TEXT",
      label: `Business description (${narrative.filingForm} Item 1) filed ${narrative.filingDate}`,
      form: narrative.filingForm,
      accession: narrative.accessionNumber,
      filed: narrative.filingDate,
      url: null,
      excerpt: clip(redactMarketPrice(narrative.text), ITEM1_LIMIT),
    });
  } else {
    gaps.push(`no 10-K Item 1 business description: ${acquired.business.unavailableReason ?? "not acquired"}`);
  }

  if (client === null) {
    gaps.push("no earnings releases: this run reads committed captures and calls no SEC endpoint");
  } else {
    const cik = acquired.acquisition.cik;
    try {
      const submissions = await client.submissions(cik);
      const releases = recentEarningsReleases(submissions);
      if (releases.length === 0) gaps.push("no current report announcing results (8-K item 2.02) in the filing list");
      let n = 1;
      for (const release of releases) {
        const source = await earningsReleaseSource(client, cik, release, `E${n}`);
        if (typeof source === "string") gaps.push(source);
        else {
          sources.push(source);
          n++;
        }
      }
    } catch (err) {
      gaps.push(`no earnings releases: the filing list could not be read (${err instanceof Error ? err.message : String(err)})`);
    }
  }

  const latestFy = measures.years[measures.years.length - 1];
  return {
    sources,
    measures,
    gaps,
    basis: {
      latestFiscalYear: latestFy === undefined ? null : String(latestFy.fiscalYear),
      latestQuarterEnd: measures.latestQuarter?.periodEnd ?? null,
      ttmRevenue: measures.latestQuarter?.ttmRevenue?.toString() ?? null,
      dilutedShares: null,
    },
  };
}
