import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { acquire } from "./acquire";
import { buildCompanyInputs, type AnalystInputs } from "./companyInputs";
import { TAG_MAPPING_VERSION } from "./tagMap";
import type { CompanyFactsDocument } from "./secClient";
import { computeEnterpriseValue } from "../modules/enterpriseValue";
import { evaluateLeverage } from "../gates";
import { CLEAN_PROVENANCE } from "../provenance";
import { MSFT_FIXTURE } from "../fixtures/msft";

// ---------------------------------------------------------------------------
// CF-AR6-FINANCE-LEASE-UPPER-BOUND-01 (issue #492) — Methodology v2.1 D7
// (issue #491, ruling B), on six real captures taken 19 Oct 2026
// (./captures/ar6-2026-10-19, by scripts/analyzer/capture-companyfacts.ts
// --out=ar6-2026-10-19 under mapping -10-4). They differ from the 18 Oct set
// only by the newly mapped us-gaap:Liabilities rows. No network, no model.
//
// The bridge is built by the production assembly (buildCompanyInputs). Two
// REQUIRED inputs that are not this outcome's subject are STATED TEST
// INPUTS, named as such, exactly as bridgeInputRecovery.test.ts states them:
// the price (no recorded quote exists for most of these filers) and the §4.4
// non-operating judgment, plus treasury-method dilution where the filer tags
// none (a real run takes it from the §3.8.1 fallback). None of them touches
// the lease term or its date.
// ---------------------------------------------------------------------------

const STATED_PRICE = new Decimal(100);

const COMPANIES = {
  MSFT: "0000789019",
  COST: "0000909832",
  NVDA: "0001045810",
  NUE: "0000073309",
  KO: "0000021344",
  LLY: "0000059478",
} as const;
type Ticker = keyof typeof COMPANIES;

function capture(ticker: Ticker, set: "ar6-2026-10-18" | "ar6-2026-10-19"): CompanyFactsDocument {
  return JSON.parse(
    readFileSync(join(__dirname, "captures", set, `${ticker.toLowerCase()}-companyfacts.json`), "utf8")
  ) as CompanyFactsDocument;
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

function built(ticker: Ticker, set: "ar6-2026-10-18" | "ar6-2026-10-19" = "ar6-2026-10-19") {
  const doc = capture(ticker, set);
  const a = acquire({
    ticker,
    cik: COMPANIES[ticker],
    companyName: ticker,
    companyFacts: doc,
    price: { value: STATED_PRICE, timestamp: "2026-10-16T21:00:00Z", source: "stated test input" },
    acquiredAt: "2026-10-19T00:00:00.000Z",
  });
  const { fixture } = buildCompanyInputs(a, doc, analystStatedForTest(), { value: STATED_PRICE, timestamp: "2026-10-16T21:00:00Z" });
  // Stated, never read from the filing — see the header.
  const stated = { value: new Decimal(0), provenance: CLEAN_PROVENANCE };
  const ev = computeEnterpriseValue({
    ...fixture.enterpriseValue,
    treasuryMethodDilution: fixture.enterpriseValue.treasuryMethodDilution ?? stated,
    nonOperatingEquityInvestmentsAtBook: stated,
  });
  const leverage = evaluateLeverage({ ...fixture.leverage, enterpriseValue: ev.suppressed ? null : ev.value.enterpriseValue });
  return { fixture, ev, leverage };
}

describe("CF-AR6-FINANCE-LEASE-UPPER-BOUND-01 — Methodology D7 on six real captures", () => {
  it("runs under the bumped mapping version", () => {
    // -10-5: CF-METHODOLOGY-V3-IMPLEMENT-01 (issue #499) added derived
    // operating income and a capex candidate; neither touches the bridge.
    expect(TAG_MAPPING_VERSION).toBe("calboard-secmap-2026-10-5");
  });

  it("NVDA: no finance-lease liability reported, so the bridge carries the same-date upper bound and computes", () => {
    const { fixture, ev, leverage } = built("NVDA");
    // 10-Q 0001045810-26-000075 at 2026-07-26: Liabilities 91,288M less the
    // bridge's total debt 33,366M (LongTermDebt), on the debt and cash date.
    expect(fixture.enterpriseValue.financeLeaseLiabilities).toBeNull();
    const bound = fixture.enterpriseValue.financeLeaseLiabilitiesUpperBound!;
    expect(bound.value.value.toString()).toBe(String(91_288_000_000 - 33_366_000_000));
    expect(bound.asOfDate).toBe("2026-07-26");
    expect(bound.source).toContain("0001045810-26-000075");
    expect(fixture.enterpriseValue.totalDebtAsOfDate).toBe("2026-07-26");
    expect(fixture.enterpriseValue.cashAndMarketableDebtSecuritiesAsOfDate).toBe("2026-07-26");

    expect(ev.suppressed).toBe(false);
    if (ev.suppressed) return;
    expect(ev.value.financeLeaseLiabilities.toString()).toBe("57922000000");
    expect(ev.value.bridgeFlags!.financeLeases.treatment).toBe("UPPER BOUND — NOT DISCLOSED");

    // The §6.5 test reads the same bound, and the ratio equals its own definition.
    expect(fixture.leverage.financeLeaseLiabilities!.toString()).toBe("57922000000");
    expect(leverage.netDebtRatio).not.toBeNull();
    expect(leverage.netDebtRatio!.toString()).toBe(
      new Decimal(33_366_000_000).plus(57_922_000_000).minus(22_443_000_000).dividedBy(ev.value.enterpriseValue).toString()
    );
  });

  it("KO: tags no total liabilities, so no bound can be formed and the bridge stays INCOMPLETE on its exact cause", () => {
    const { fixture, ev, leverage } = built("KO");
    expect(fixture.enterpriseValue.financeLeaseLiabilities).toBeNull();
    expect(fixture.enterpriseValue.financeLeaseLiabilitiesUpperBound).toBeNull();
    expect(ev.suppressed && ev.cause).toBe("missing REQUIRED input(s): financeLeaseLiabilities");
    expect(fixture.leverage.financeLeaseLiabilities).toBeNull();
    expect(leverage.result).toBe("LEVERAGE UNSUPPORTED IN v1");
  });

  // Filers with a reported lease figure (MSFT, COST) or a cited nesting
  // record (NUE, LLY) form no bound, and their bridge inputs are identical to
  // the 18 Oct captures', which predate the Liabilities mapping.
  it.each(["MSFT", "COST", "NUE", "LLY"] as const)("%s: no bound, bridge and leverage inputs unchanged", (ticker) => {
    const now = built(ticker);
    const before = built(ticker, "ar6-2026-10-18");
    expect(now.fixture.enterpriseValue.financeLeaseLiabilitiesUpperBound).toBeNull();
    expect(JSON.stringify(now.fixture.enterpriseValue)).toBe(JSON.stringify(before.fixture.enterpriseValue));
    expect(JSON.stringify(now.fixture.leverage)).toBe(JSON.stringify(before.fixture.leverage));
    expect(now.ev.suppressed).toBe(false);
    expect(JSON.stringify(now.ev)).toBe(JSON.stringify(before.ev));
  });
});
