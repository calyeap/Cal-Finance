import { readFileSync } from "node:fs";
import Decimal from "decimal.js";
import type { AnalystCall, AnalystCallRequest } from "../ai/analystCall";
import type { HistoryMeasures } from "./research";
import { join } from "node:path";
import { getPool } from "../../db";
import { __resetSheetResolution } from "../acquisition/analystInputs";
import { bundleFromSheet } from "./sheet";
import { sheetInForce } from "./sheetStore";

// ---------------------------------------------------------------------------
// CF-AR6-ANY-TICKER-DRAFTS-01 — TEST SUPPORT ONLY; never imported by
// application code. The sheet table is append-only (its trigger refuses
// UPDATE and DELETE), so a test that writes sheets restores the migrated
// state the way CI's one-time `npm run migrate` leaves it: TRUNCATE (which
// the row trigger does not cover) and re-apply migration 014's own SQL —
// the migration file itself, not a value typed out a second time.
// ---------------------------------------------------------------------------

export const SHEETS_MIGRATION_SQL = readFileSync(join(process.cwd(), "migrations", "014_assumption_sheets.sql"), "utf-8");

/** Every sheet gone, then migration 014 re-applied: each recorded bundle back as its version 1 draft. */
export async function resetSheetsToMigrated(): Promise<void> {
  await getPool().query("TRUNCATE analyzer_assumption_sheets RESTART IDENTITY");
  await getPool().query(SHEETS_MIGRATION_SQL);
  __resetSheetResolution();
}

/** The bundle the ticker's sheet in force gives, or null where it has none. */
export async function bundleInForce(ticker: string) {
  const sheet = await sheetInForce(ticker);
  return sheet === null ? null : bundleFromSheet(sheet);
}

// ---------------------------------------------------------------------------
// A stand-in for the drafting model in tests: answers the drafting call
// with drivers placed inside the company's own filed history (read from the
// request's history sources' measures), every one anchored to a supplied
// source. It is a test double for the model's RESPONSE — the request it
// receives is real and is recorded for assertions (price-blindness).
// ---------------------------------------------------------------------------

/**
 * The drafting call's wire shape (scenarioProposal.ts RESPONSE_SCHEMA) from
 * the readable nested form tests build and tweak — `{ bear: { story,
 * revenueGrowth: { value, anchor, cites }, … }, …, moat, policyConstants }`.
 * Scenarios or drivers deleted from the nested form are simply absent.
 */
export function toDraftWire(nested: Record<string, any>): Record<string, unknown> {
  const { moat, policyConstants } = nested;
  const stories: Record<string, unknown> = {};
  const drivers: Record<string, unknown>[] = [];
  for (const scenario of ["bear", "base", "bull"]) {
    const s = nested[scenario];
    if (s === undefined) continue;
    stories[scenario] = s.story;
    for (const [driver, d] of Object.entries(s)) {
      if (driver === "story" || d === undefined) continue;
      drivers.push({ scenario, driver, ...(d as object) });
    }
  }
  return { stories, drivers, moat, policyConstants };
}

export interface StubDraftCall {
  call: AnalystCall;
  requests: AnalystCallRequest[];
}

function d(v: Decimal): string {
  return v.toDecimalPlaces(4).toString();
}

/** A well-formed draft inside `measures`, valued at `rate` (narrow moat). `tweak` edits the nested form before it is put on the wire (toDraftWire). */
export function stubDraftCall(measures: HistoryMeasures, rate: Decimal, tweak: (raw: Record<string, any>) => void = () => {}): StubDraftCall {
  const requests: AnalystCallRequest[] = [];
  const cagr = measures.revenueCagr?.value ?? new Decimal("0.05");
  const gLow = measures.revenueGrowthRange?.low ?? cagr.minus("0.05");
  const gHigh = measures.revenueGrowthRange?.high ?? cagr.plus("0.05");
  const growth = {
    bear: Decimal.max(gLow, cagr.minus("0.04")),
    base: cagr,
    bull: Decimal.min(gHigh, cagr.plus("0.04")),
  };
  const mLow = measures.operatingMarginRange?.low ?? new Decimal("0.1");
  const mHigh = measures.operatingMarginRange?.high ?? new Decimal("0.2");
  const span = mHigh.minus(mLow);
  const margin = { bear: mLow.plus(span.mul("0.3")), base: mLow.plus(span.mul("0.6")), bull: mHigh };
  const ronic = { bear: rate.plus("0.02"), base: rate.plus("0.05"), bull: rate.plus("0.07") };
  const reinvest = measures.medianNetReinvestmentShare ?? new Decimal("0.05");
  const driver = (value: Decimal, why: string, cites: string[]) => ({ value: d(value), anchor: why, cites });
  const scenario = (k: "bear" | "base" | "bull") => ({
    story: `Test draft — the ${k} case, placed inside the filed history.`,
    revenueGrowth: driver(growth[k], "Within the filed single-year revenue growth range.", ["H:revenue"]),
    operatingMargin: driver(margin[k], "Within the filed operating-margin range.", ["H:margin"]),
    returnOnNewInvestment: driver(ronic[k], "Within the filed returns on invested capital.", ["H:returns"]),
    reinvestmentShare: driver(reinvest, "The filed median net reinvestment share.", ["H:capex"]),
    shareCountMultiple: driver(new Decimal(1), "No cited buyback or dilution.", ["H:cashflow"]),
  });
  const call: AnalystCall = async (request) => {
    requests.push(request);
    const raw: Record<string, any> = {
      bear: scenario("bear"),
      base: scenario("base"),
      bull: scenario("bull"),
      moat: { class: "narrow", mechanism: "Test draft — returns above the rate across the filed history.", cites: ["H:returns"] },
      policyConstants: { nopatTaxRate: "0.21", stressMarginLevel: d(mLow), anchor: "The statutory rate; the filed low margin.", cites: ["STATUTORY", "H:margin"] },
    };
    tweak(raw);
    return toDraftWire(raw);
  };
  return { call, requests };
}
