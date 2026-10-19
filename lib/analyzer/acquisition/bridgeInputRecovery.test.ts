import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { acquire, type AcquisitionResult } from "./acquire";
import { buildCompanyInputs, type AnalystInputs } from "./companyInputs";
import { FINANCE_LEASES_INSIDE_TOTAL_DEBT, TAG_MAPPING_VERSION, tagMapEntry } from "./tagMap";
import { resolveEntry } from "./selectTagged";
import { instantAnnualSeries } from "./history";
import type { CompanyFactsDocument } from "./secClient";
import { computeEnterpriseValue, type EnterpriseValueInput } from "../modules/enterpriseValue";
import { evaluateLeverage } from "../gates";
import { CLEAN_PROVENANCE } from "../provenance";
import { MSFT_FIXTURE } from "../fixtures/msft";

// ---------------------------------------------------------------------------
// CF-AR6-BRIDGE-INPUT-RECOVERY-01 (issue #468), DO 5 — the deterministic proof,
// on six real captures taken 18 Oct 2026 (./captures/ar6-2026-10-18, by
// scripts/analyzer/capture-companyfacts.ts --out=ar6-2026-10-18). No network,
// no model.
//
// What this outcome changes is the DEBT side of the §3.5 EV bridge and the
// §6.5 leverage precondition: which total-debt figure acquisition resolves,
// and at what date. Everything below that is not acquired is a STATED TEST
// INPUT, named as one: the price (no recorded quote exists for most of these
// filers) and the §4.4 non-operating-investments judgment (an analyst's call,
// not this outcome's subject), plus treasury-method dilution where the filer
// tags none (NVDA, NUE, KO, LLY — the separately recorded gap of
// docs/tag-mapping-version-review.md §5.3; a real run takes it from the
// §3.8.1 fallback, never from here). They move EV's LEVEL, never whether the
// bridge's debt side is coherent, so the leverage RATIO is asserted to
// compute and to equal its own definition, while PASS/FAIL against the
// threshold — which a stated price decides — is pinned only for MSFT and
// COST, as the byte-identical before/after check.
//
// The bridge is assembled exactly as companyInputs.ts assembles it: the three
// named inputs and their as-of dates from the acquired facts, and the AR4
// cited-disclosure record keyed by CIK. computeEnterpriseValue's own
// same-date test (CALVIN RULING A, #308/#309) is the one that decides.
// ---------------------------------------------------------------------------

const STATED_PRICE = new Decimal(100);
const STATED_NON_OPERATING_AT_BOOK = new Decimal(0);

const COMPANIES = {
  MSFT: "0000789019",
  COST: "0000909832",
  NVDA: "0001045810",
  NUE: "0000073309",
  KO: "0000021344",
  LLY: "0000059478",
} as const;
type Ticker = keyof typeof COMPANIES;

function capture(ticker: Ticker): CompanyFactsDocument {
  return JSON.parse(
    readFileSync(join(__dirname, "captures", "ar6-2026-10-18", `${ticker.toLowerCase()}-companyfacts.json`), "utf8")
  ) as CompanyFactsDocument;
}

function acquired(ticker: Ticker): AcquisitionResult {
  return acquire({
    ticker,
    cik: COMPANIES[ticker],
    companyName: ticker,
    companyFacts: capture(ticker),
    price: { value: STATED_PRICE, timestamp: "2026-10-16T21:00:00Z", source: "stated test input" },
    acquiredAt: "2026-10-18T00:00:00.000Z",
  });
}

/** One USD instant row of a captured tag at an exact date, straight from the capture. */
function filed(ticker: Ticker, tag: string, end: string): number {
  const rows = capture(ticker).facts["us-gaap"]?.[tag]?.units?.USD ?? [];
  const row = rows.find((r) => r.end === end && r.start === undefined);
  if (row === undefined) throw new Error(`${ticker} ${tag} has no row at ${end}`);
  return row.val;
}

interface Bridge {
  totalDebt: { value: number; asOf: string } | null;
  lease: { value: number; asOf: string } | null;
  cash: { value: number; asOf: string } | null;
  ev: ReturnType<typeof computeEnterpriseValue>;
  leverage: ReturnType<typeof evaluateLeverage>;
}

function bridge(ticker: Ticker, leaseRecord = FINANCE_LEASES_INSIDE_TOTAL_DEBT[COMPANIES[ticker]] ?? null): Bridge {
  const a = acquired(ticker);
  const fact = (id: string) => a.facts.find((f) => f.id === id && f.value !== null) ?? null;
  const sourced = (id: string) => {
    const f = fact(id);
    return f === null ? null : { value: new Decimal(String(f.value)), provenance: CLEAN_PROVENANCE };
  };
  const debt = fact("total-debt");
  const lease = fact("finance-lease-liabilities");
  const cash = fact("cash-and-marketable-debt-securities");

  const input: EnterpriseValueInput = {
    sharesOutstanding: sourced("shares-outstanding"),
    // Stated where untagged — see the header. Never a reading of the filing.
    treasuryMethodDilution: sourced("treasury-method-dilution") ?? { value: new Decimal(0), provenance: CLEAN_PROVENANCE },
    price: { value: STATED_PRICE, provenance: CLEAN_PROVENANCE },
    totalDebt: sourced("total-debt"),
    totalDebtAsOfDate: debt?.asOfDate ?? null,
    financeLeaseLiabilities: sourced("finance-lease-liabilities"),
    financeLeaseLiabilitiesAsOfDate: lease?.asOfDate ?? null,
    cashAndMarketableDebtSecurities: sourced("cash-and-marketable-debt-securities"),
    cashAndMarketableDebtSecuritiesAsOfDate: cash?.asOfDate ?? null,
    nonOperatingEquityInvestmentsAtBook: { value: STATED_NON_OPERATING_AT_BOOK, provenance: CLEAN_PROVENANCE },
    nonOperatingInvestmentsErrorDirection: null,
    financeLeasesInsideTotalDebt: leaseRecord,
  };
  const ev = computeEnterpriseValue(input);
  const leverage = evaluateLeverage({
    totalDebt: input.totalDebt?.value ?? null,
    financeLeaseLiabilities: leaseRecord !== null ? new Decimal(0) : (input.financeLeaseLiabilities?.value ?? null),
    cashAndMarketableDebtSecurities: input.cashAndMarketableDebtSecurities?.value ?? null,
    enterpriseValue: ev.suppressed ? null : ev.value.enterpriseValue,
    operatingLeaseLiabilities: null,
    leveredResidualExceptionApplies: false,
  });

  return {
    totalDebt: debt === null ? null : { value: Number(debt.value), asOf: debt.asOfDate! },
    lease: lease === null ? null : { value: Number(lease.value), asOf: lease.asOfDate! },
    cash: cash === null ? null : { value: Number(cash.value), asOf: cash.asOfDate! },
    ev,
    leverage,
  };
}

/** The tags total-debt resolved through, primary first, and which components were absent. */
function debtComposition(ticker: Ticker): { tags: string[]; absent: string[] } {
  const r = resolveEntry(capture(ticker), tagMapEntry("total-debt")!);
  if (r.outcome !== "RESOLVED") throw new Error(`${ticker} total-debt ${r.outcome}`);
  return {
    tags: r.value.contributingTags.map((c) => c.ref.tag),
    absent: r.value.absentComponents.map((c) => c.tag),
  };
}

function computed(b: Bridge) {
  if (b.ev.suppressed) throw new Error(`EV suppressed: ${b.ev.cause}`);
  return b.ev.value;
}

describe("CF-AR6-BRIDGE-INPUT-RECOVERY-01 — same-date debt inputs on six real captures", () => {
  it("runs under the bumped mapping version", () => {
    // -10-3: CF-LEG2-KO-COMMERCIAL-PAPER-01 (issue #487) added CommercialPaper
    // to the lease-inclusive total-debt candidate.
    expect(TAG_MAPPING_VERSION).toBe("calboard-secmap-2026-10-3");
  });

  it("LLY: total debt is the latest presented balance sheet's, same date as cash, and EV and the leverage ratio compute", () => {
    const b = bridge("LLY");
    // Debt, current + long-term debt at 30 Jun 2026 — LLY's latest 10-Q
    // balance sheet — not the 10-K-only combined element at 31 Dec 2025.
    expect(debtComposition("LLY")).toEqual({ tags: ["DebtCurrent", "LongTermDebtNoncurrent"], absent: [] });
    expect(b.totalDebt).toEqual({ value: 7_050_000_000 + 47_858_000_000, asOf: "2026-06-30" });
    expect(b.totalDebt!.value).toBe(filed("LLY", "DebtCurrent", "2026-06-30") + filed("LLY", "LongTermDebtNoncurrent", "2026-06-30"));
    // Reconciled to the filing: at the 10-K instant the same two lines foot
    // exactly to LLY's own combined total-debt element (AR2 golden lly.json).
    expect(filed("LLY", "DebtCurrent", "2025-12-31") + filed("LLY", "LongTermDebtNoncurrent", "2025-12-31")).toBe(
      filed("LLY", "DebtLongtermAndShorttermCombinedAmount", "2025-12-31")
    );
    expect(filed("LLY", "DebtLongtermAndShorttermCombinedAmount", "2025-12-31")).toBe(42_503_000_000);
    expect(b.cash).toEqual({ value: 8_950_000_000, asOf: "2026-06-30" });
    // Leases counted once, inside total debt, on the existing cited record.
    expect(FINANCE_LEASES_INSIDE_TOTAL_DEBT[COMPANIES.LLY]).toBeDefined();
    const ev = computed(b);
    expect(ev.totalDebt.toString()).toBe("54908000000");
    expect(ev.financeLeaseLiabilities.toString()).toBe("0");
    expect(ev.bridgeFlags?.financeLeases.treatment).toBe("INCLUDED IN TOTAL DEBT");
    expect(b.leverage.netDebtRatio).not.toBeNull();
    expect(b.leverage.netDebtRatio!.toString()).toBe(
      new Decimal(54_908_000_000).minus(8_950_000_000).dividedBy(ev.enterpriseValue).toString()
    );
  });

  it("NUE: total debt is current and same-date with cash; leases counted once on the cited record, and EV and the leverage ratio compute", () => {
    const b = bridge("NUE");
    // The AR2 golden composition (nue.json), at NUE's latest balance sheet.
    // NUE tags no CommercialPaper at that instant (-10-3), so it is recorded
    // absent and the value is unchanged.
    expect(debtComposition("NUE")).toEqual({
      tags: ["LongTermDebtAndCapitalLeaseObligations", "LongTermDebtAndCapitalLeaseObligationsCurrent", "ShortTermBorrowings"],
      absent: ["CommercialPaper"],
    });
    expect(b.totalDebt).toEqual({ value: 6_389_000_000 + 581_000_000 + 129_000_000, asOf: "2026-07-04" });
    expect(b.cash).toEqual({ value: 2_692_000_000, asOf: "2026-07-04" });
    // Reconciled to the golden at the 10-K instant: 6,909 + 90 + 122 = 7,121M.
    expect(
      filed("NUE", "LongTermDebtAndCapitalLeaseObligations", "2025-12-31") +
        filed("NUE", "LongTermDebtAndCapitalLeaseObligationsCurrent", "2025-12-31") +
        filed("NUE", "ShortTermBorrowings", "2025-12-31")
    ).toBe(7_121_000_000);
    // DO 3: NUE's FY2025 10-K Note 6 classifies its finance leases (24M
    // current + 234M noncurrent = 258M) inside those two debt lines — the
    // cited record. The captured amounts tie to that disclosure, and the
    // current line foots: 66M debt + 24M lease = 90M.
    expect(FINANCE_LEASES_INSIDE_TOTAL_DEBT[COMPANIES.NUE]?.source).toContain("0001193125-26-071575");
    expect(filed("NUE", "FinanceLeaseLiabilityCurrent", "2025-12-31") + filed("NUE", "FinanceLeaseLiabilityNoncurrent", "2025-12-31")).toBe(
      filed("NUE", "FinanceLeaseLiability", "2025-12-31")
    );
    expect(filed("NUE", "FinanceLeaseLiability", "2025-12-31")).toBe(258_000_000);
    expect(filed("NUE", "LongTermDebtCurrent", "2025-12-31") + filed("NUE", "FinanceLeaseLiabilityCurrent", "2025-12-31")).toBe(
      filed("NUE", "LongTermDebtAndCapitalLeaseObligationsCurrent", "2025-12-31")
    );
    // The separate lease fact is still acquired (10-K only), but the bridge
    // counts it once, inside total debt — no date is substituted for it.
    expect(b.lease).toEqual({ value: 258_000_000, asOf: "2025-12-31" });
    const ev = computed(b);
    expect(ev.totalDebt.toString()).toBe("7099000000");
    expect(ev.financeLeaseLiabilities.toString()).toBe("0");
    expect(ev.bridgeFlags?.financeLeases.treatment).toBe("INCLUDED IN TOTAL DEBT");
    expect(b.leverage.netDebtRatio).not.toBeNull();
    expect(b.leverage.netDebtRatio!.toString()).toBe(
      new Decimal(7_099_000_000).minus(2_692_000_000).dividedBy(ev.enterpriseValue).toString()
    );
  });

  it("KO: total debt is current and same-date with cash; INCOMPLETE on its exact cause — no finance-lease input and no cited record", () => {
    const b = bridge("KO");
    expect(debtComposition("KO")).toEqual({
      tags: ["LongTermDebtAndCapitalLeaseObligations", "LongTermDebtAndCapitalLeaseObligationsCurrent", "CommercialPaper"],
      absent: ["ShortTermBorrowings"],
    });
    // 39,065 + 4,493 = 43,558M — equal to KO's own
    // LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities at
    // 3 Apr 2026 on live companyfacts (an unmapped element, so not in the
    // trimmed capture) — plus KO's 250M of tagged commercial paper (-10-3,
    // CF-LEG2-KO-COMMERCIAL-PAPER-01, issue #487) = 43,808M. At FY2025 the
    // two lease-inclusive elements sum to 43,941M, which leaves out KO's
    // 1,551M of loans and notes payable: the AR2 golden total (ko.json) is
    // 45,492M (CF-LEG2-KO-GOLDEN-DEBT-01, issue #485). The mapping now adds
    // the 1,495M of commercial paper inside that 1,551M; the other 56M is
    // unmapped by decision (see the CF-LEG2-KO-COMMERCIAL-PAPER-01 block below).
    expect(b.totalDebt).toEqual({ value: 39_065_000_000 + 4_493_000_000 + 250_000_000, asOf: "2026-04-03" });
    expect(
      filed("KO", "LongTermDebtAndCapitalLeaseObligations", "2025-12-31") +
        filed("KO", "LongTermDebtAndCapitalLeaseObligationsCurrent", "2025-12-31")
    ).toBe(43_941_000_000);
    expect(b.cash).toEqual({ value: 10_574_000_000, asOf: "2026-04-03" });
    expect(FINANCE_LEASES_INSIDE_TOTAL_DEBT[COMPANIES.KO]).toBeUndefined();
    expect(b.lease).toBeNull();
    expect(b.ev.suppressed && b.ev.cause).toBe("missing REQUIRED input(s): financeLeaseLiabilities");
    expect(b.leverage.result).toBe("LEVERAGE UNSUPPORTED IN v1");
  });

  it("NVDA: unchanged and still INCOMPLETE — no finance-lease liability in any current filing", () => {
    const b = bridge("NVDA");
    expect(debtComposition("NVDA").tags).toEqual(["LongTermDebt"]);
    expect(b.totalDebt).toEqual({ value: 33_366_000_000, asOf: "2026-07-26" });
    expect(b.cash).toEqual({ value: 22_443_000_000, asOf: "2026-07-26" });
    expect(b.lease).toBeNull();
    expect(FINANCE_LEASES_INSIDE_TOTAL_DEBT[COMPANIES.NVDA]).toBeUndefined();
    expect(b.ev.suppressed && b.ev.cause).toBe("missing REQUIRED input(s): financeLeaseLiabilities");
    expect(b.leverage.result).toBe("LEVERAGE UNSUPPORTED IN v1");
  });

  // The byte-identical check. Every figure below is what the PREVIOUS mapping
  // (calboard-secmap-2026-10-1) produces on these same captures — this block
  // passes unchanged on master, which is how "unchanged" was established
  // rather than asserted.
  it.each([
    ["MSFT", ["LongTermDebt"], 40_294_000_000, "2026-06-30", 66_594_000_000, 76_843_000_000, "774999549100", "0.038767764490819366336"],
    ["COST", ["LongTermDebtNoncurrent", "LongTermDebtCurrent"], 6_162_000_000, "2026-08-30", 1_413_000_000, 21_301_000_000, "30634334900", "-0.44805934402708380654"],
  ] as const)("%s: resolved values, EV and leverage byte-identical to before", (ticker, tags, debt, asOf, lease, cash, ev, ratio) => {
    const b = bridge(ticker);
    expect(debtComposition(ticker).tags).toEqual(tags);
    expect(b.totalDebt).toEqual({ value: debt, asOf });
    expect(b.lease).toEqual({ value: lease, asOf });
    expect(b.cash).toEqual({ value: cash, asOf });
    expect(computed(b).enterpriseValue.toString()).toBe(ev);
    expect(b.leverage.netDebtRatio!.toString()).toBe(ratio);
    expect(b.leverage.result).toBe("PASS");
  });
});

// ---------------------------------------------------------------------------
// The same counted-once record on the invested-capital side (CALVIN RULING —
// FINANCING-SIDE INVESTED CAPITAL, issue #298: "lease liabilities not already
// in debt"). NUE's debt series is now the lease-inclusive golden composition,
// so adding its separately tagged lease liability again would count it twice.
//
// NUE tags no OperatingIncomeLoss, so on the real capture neither the ROIC
// history nor the RONIC delta reaches invested capital at all. To exercise it
// the capture gets ONE test-only addition — an operating-income series whose
// values are irrelevant to invested capital — and nothing else is touched.
// ---------------------------------------------------------------------------

function withTestOnlyOperatingIncome(doc: CompanyFactsDocument, fiscalYears: number[]): CompanyFactsDocument {
  const usGaap = doc.facts["us-gaap"] ?? {};
  return {
    ...doc,
    facts: {
      ...doc.facts,
      "us-gaap": {
        ...usGaap,
        OperatingIncomeLoss: {
          label: "TEST-ONLY operating income",
          description: "Injected by bridgeInputRecovery.test.ts; not a filed value.",
          units: {
            USD: fiscalYears.map((fy) => ({
              start: `${fy}-01-01`,
              end: `${fy}-12-31`,
              val: 1_000_000_000,
              accn: `TEST-ONLY-${fy}`,
              fy,
              fp: "FY",
              form: "10-K",
              filed: `${fy + 1}-02-25`,
            })),
          },
        },
      },
    },
  } as CompanyFactsDocument;
}

function analystStatedForTest(): AnalystInputs {
  return {
    profile: MSFT_FIXTURE.profile,
    nonOperatingInvestments: null,
    fiftyTwoWeek: null,
    epsTrailing: null,
    epsForward: null,
    scenarios: MSFT_FIXTURE.scenarios,
    scenarioValues: MSFT_FIXTURE.scenarioValues,
    scenarioValuesAreFixtureCarried: false,
    revalueBaseCaseAtRate: null,
    configuredConstants: MSFT_FIXTURE.configuredConstants,
    preRevenue: null,
    gate0: MSFT_FIXTURE.gate0,
    trustInputs: MSFT_FIXTURE.trustInputs,
  };
}

function investedCapitalByYear(ticker: Ticker, doc: CompanyFactsDocument): Map<number, string | null> {
  const a = acquire({
    ticker,
    cik: COMPANIES[ticker],
    companyName: ticker,
    companyFacts: doc,
    price: { value: STATED_PRICE, timestamp: "2026-10-16T21:00:00Z", source: "stated test input" },
    acquiredAt: "2026-10-18T00:00:00.000Z",
  });
  const { fixture } = buildCompanyInputs(a, doc, analystStatedForTest(), { value: STATED_PRICE, timestamp: "2026-10-16T21:00:00Z" });
  return new Map((fixture.roicHistory?.years ?? []).map((y) => [y.fiscalYear, y.investedCapital?.toString() ?? null]));
}

describe("CF-AR6-BRIDGE-INPUT-RECOVERY-01 — invested capital counts NUE's finance leases once", () => {
  it("NUE FY2025: equity + lease-inclusive total debt − cash, with no separate lease term on top", () => {
    const ic = investedCapitalByYear("NUE", withTestOnlyOperatingIncome(capture("NUE"), [2021, 2022, 2023, 2024, 2025]));
    const equity = filed("NUE", "StockholdersEquity", "2025-12-31");
    const debt =
      filed("NUE", "LongTermDebtAndCapitalLeaseObligations", "2025-12-31") +
      filed("NUE", "LongTermDebtAndCapitalLeaseObligationsCurrent", "2025-12-31") +
      filed("NUE", "ShortTermBorrowings", "2025-12-31");
    const cash = filed("NUE", "CashAndCashEquivalentsAtCarryingValue", "2025-12-31") + filed("NUE", "ShortTermInvestments", "2025-12-31");
    expect(debt).toBe(7_121_000_000);
    expect(ic.get(2025)).toBe(String(equity + debt - cash));
    expect(ic.get(2025)).toBe("25358000000");
    // Not 25,616M — that is the 258M lease counted a second time.
    expect(ic.get(2025)).not.toBe(String(equity + debt - cash + filed("NUE", "FinanceLeaseLiability", "2025-12-31")));
  });

  it("MSFT and COST, outside the record, still add their separate lease liability exactly as before", () => {
    // Pinned on master's code with these same captures.
    expect(investedCapitalByYear("MSFT", capture("MSFT")).get(2026)).toBe("472432000000");
    expect(investedCapitalByYear("COST", capture("COST")).get(2026)).toBe("22077000000");
  });
});

// ---------------------------------------------------------------------------
// CF-LEG2-KO-COMMERCIAL-PAPER-01 (issue #487). The approved total-debt basis
// (tagMap.ts) says commercial paper sits outside the long-term-debt totals "and
// is added where tagged". KO resolves through the lease-inclusive candidate,
// and KO tags CommercialPaper at both its latest balance sheet and its 10-K
// instant, so its acquired total debt must include it.
//
// Not added here: KO's NotesAndLoansPayable / OtherShortTermBorrowings (82M at
// 2026-04-03, 56M at FY2025). Whether those belong in total debt is a
// debt-concept decision the issue reserves, so the FY2025 history still sits
// 56M below the AR2 golden total (ko.json, 45,492M).
// ---------------------------------------------------------------------------

describe("CF-LEG2-KO-COMMERCIAL-PAPER-01 — KO's total debt includes its tagged commercial paper", () => {
  it("KO at 2026-04-03: total debt = lease-inclusive debt lines + the captured CommercialPaper (250M)", () => {
    const at = "2026-04-03";
    const paper = filed("KO", "CommercialPaper", at);
    expect(paper).toBe(250_000_000);
    const expected =
      filed("KO", "LongTermDebtAndCapitalLeaseObligations", at) +
      filed("KO", "LongTermDebtAndCapitalLeaseObligationsCurrent", at) +
      paper;
    expect(expected).toBe(43_808_000_000);
    expect(bridge("KO").totalDebt).toEqual({ value: expected, asOf: at });
    // Taken from the CommercialPaper row at the same instant, not inferred.
    const r = resolveEntry(capture("KO"), tagMapEntry("total-debt")!);
    if (r.outcome !== "RESOLVED") throw new Error(`KO total-debt ${r.outcome}`);
    expect(r.value.contributingTags.find((c) => c.ref.tag === "CommercialPaper")?.row.end).toBe(at);
  });

  it("KO FY2025 history: the 10-K instant includes its 1,495M of commercial paper too", () => {
    const series = instantAnnualSeries(capture("KO"), tagMapEntry("total-debt")!.candidates);
    const fy2025 = series?.observations.find((o) => o.fiscalYear === 2025);
    const at = "2025-12-31";
    expect(filed("KO", "CommercialPaper", at)).toBe(1_495_000_000);
    expect(fy2025?.value).toBe(
      filed("KO", "LongTermDebtAndCapitalLeaseObligations", at) +
        filed("KO", "LongTermDebtAndCapitalLeaseObligationsCurrent", at) +
        filed("KO", "CommercialPaper", at)
    );
    expect(fy2025?.value).toBe(45_436_000_000);
  });
});
