import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { acquire, type AcquisitionResult } from "./acquire";
import { FINANCE_LEASES_INSIDE_TOTAL_DEBT, TAG_MAPPING_VERSION, tagMapEntry } from "./tagMap";
import { resolveEntry } from "./selectTagged";
import type { CompanyFactsDocument } from "./secClient";
import { computeEnterpriseValue, type EnterpriseValueInput } from "../modules/enterpriseValue";
import { evaluateLeverage } from "../gates";
import { CLEAN_PROVENANCE } from "../provenance";

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
    expect(TAG_MAPPING_VERSION).toBe("calboard-secmap-2026-10-2");
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

  it("NUE: total debt is current and same-date with cash; EV stays INCOMPLETE until a cited lease record exists", () => {
    const b = bridge("NUE");
    // The AR2 golden composition (nue.json), at NUE's latest balance sheet.
    expect(debtComposition("NUE")).toEqual({
      tags: ["LongTermDebtAndCapitalLeaseObligations", "LongTermDebtAndCapitalLeaseObligationsCurrent", "ShortTermBorrowings"],
      absent: [],
    });
    expect(b.totalDebt).toEqual({ value: 6_389_000_000 + 581_000_000 + 129_000_000, asOf: "2026-07-04" });
    expect(b.cash).toEqual({ value: 2_692_000_000, asOf: "2026-07-04" });
    // Reconciled to the golden at the 10-K instant: 6,909 + 90 + 122 = 7,121M.
    expect(
      filed("NUE", "LongTermDebtAndCapitalLeaseObligations", "2025-12-31") +
        filed("NUE", "LongTermDebtAndCapitalLeaseObligationsCurrent", "2025-12-31") +
        filed("NUE", "ShortTermBorrowings", "2025-12-31")
    ).toBe(7_121_000_000);
    // No cited issuer disclosure places NUE's finance leases inside those
    // lines (DO 3), so the separate lease term stays REQUIRED — and NUE tags
    // it in its 10-K only. The bridge refuses; nothing is substituted.
    expect(FINANCE_LEASES_INSIDE_TOTAL_DEBT[COMPANIES.NUE]).toBeUndefined();
    expect(b.lease).toEqual({ value: 258_000_000, asOf: "2025-12-31" });
    expect(b.ev.suppressed).toBe(true);
    expect(b.ev.suppressed && b.ev.cause).toBe(
      "EV bridge inputs resolve to different as-of dates (CALVIN RULING A, issue #308/#309): " +
        "total-debt=2026-07-04, finance-lease-liabilities=2025-12-31, cash-and-marketable-debt-securities=2026-07-04"
    );
    expect(b.leverage.result).toBe("LEVERAGE UNSUPPORTED IN v1");
    expect(b.leverage.netDebtRatio).toBeNull();
  });

  it("NUE: the lease record is the ONLY remaining blocker — with one, EV and the ratio would compute on same-date inputs (hypothetical record, never added here)", () => {
    const b = bridge("NUE", { ticker: "NUE", source: "HYPOTHETICAL — test only, not a citation" });
    const ev = computed(b);
    expect(ev.totalDebt.toString()).toBe("7099000000");
    expect(ev.financeLeaseLiabilities.toString()).toBe("0");
    expect(b.leverage.netDebtRatio!.toString()).toBe(
      new Decimal(7_099_000_000).minus(2_692_000_000).dividedBy(ev.enterpriseValue).toString()
    );
  });

  it("KO: total debt is current and same-date with cash; INCOMPLETE on its exact cause — no finance-lease input and no cited record", () => {
    const b = bridge("KO");
    expect(debtComposition("KO")).toEqual({
      tags: ["LongTermDebtAndCapitalLeaseObligations", "LongTermDebtAndCapitalLeaseObligationsCurrent"],
      absent: ["ShortTermBorrowings"],
    });
    // 39,065 + 4,493 = 43,558M — equal to KO's own
    // LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities at
    // 3 Apr 2026 on live companyfacts (an unmapped element, so not in the
    // trimmed capture), and at FY2025 to the AR2 golden figure (ko.json).
    expect(b.totalDebt).toEqual({ value: 39_065_000_000 + 4_493_000_000, asOf: "2026-04-03" });
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
