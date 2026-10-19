// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { readFileSync, copyFileSync, rmSync } from "node:fs";
import path from "node:path";
import Decimal from "decimal.js";
import { render, cleanup } from "@testing-library/react";
import { getPool } from "../db";
import { createRun } from "./runStore";
import { advanceRunAutomatically } from "./autoRun";
import { computeAnalysisForRun, isSupportedTicker } from "./gate";
import { buildAcquiredRun } from "./acquiredRun";
import { assembleAnalysisResult } from "./assemble";
import { deriveVerdict } from "./verdict";
import { analystInputsFor, resolveSheet, __resetSheetResolution } from "./acquisition/analystInputs";
import { acquireCompany, captureFor, __resetAcquisitionCache } from "./acquisition/provider";
import { historyFrom } from "./sheets/research";
import { sheetHistory, sheetInForce } from "./sheets/sheetStore";
import { adoptSheet, validationContextFor } from "./sheets/adopt";
import { draftRate, DRAFTS_PER_SHEET } from "./acquisition/aiProposedBundle";
import { resetSheetsToMigrated, stubDraftCall } from "./sheets/testSupport";
import { AnalyzerReport } from "@/app/components/AnalyzerReport";
import AssumptionSheetPage from "@/app/analyzer/inputs/[ticker]/page";

// ---------------------------------------------------------------------------
// CF-AR6-ANY-TICKER-DRAFTS-01 — "a new ticker completes end to end with no
// migration or PR" (issue #454 DONE WHEN), proven offline on a real capture.
//
// `NEW_TICKER` is a synthetic symbol with no sheet, no recorded bundle and no
// committed fixture; beforeAll copies MSFT's committed SEC capture to its
// filename, so acquisition reads real filing data. The drafting model is
// replaced by a test double (sheets/testSupport.ts stubDraftCall) that
// answers with drivers inside the company's own filed history — the request
// it receives is the real one, and is asserted price-blind below. Everything
// else is the production path: research, validators, the append-only store,
// the one resolver, the gated run, the engine, the verdict and adoption.
//
// Replaces recordedAnalystInputEntryOnRealRun.test.tsx, which proved the
// recorded-bundle entry path this milestone deletes.
// ---------------------------------------------------------------------------

const NEW_TICKER = "ZZZNEWCO";
const CAPTURES = path.resolve(__dirname, "acquisition", "captures");
const SOURCE_CAPTURE = path.join(CAPTURES, "msft-companyfacts.json");
const TEST_CAPTURE = path.join(CAPTURES, `${NEW_TICKER.toLowerCase()}-companyfacts.json`);
const PRICE = { value: new Decimal("499.70"), timestamp: "2026-09-04", source: "recorded capture" };
const NON_OPERATING = { tags: ["us-gaap:LongTermInvestments"], value: new Decimal("36348000000"), errorDirection: "understates" as const };

const captureAcquire = (t: string) => acquireCompany(t, { price: null, source: "CAPTURE" });

async function draftWithStub() {
  const acquired = await captureAcquire(NEW_TICKER);
  const { measures } = historyFrom(acquired.companyFacts);
  const rate = draftRate(acquired, measures, "MATURE_PROFITABLE_STABLE_FCF", "2026-09-04").rate;
  const stub = stubDraftCall(measures, rate);
  const sheet = await resolveSheet(NEW_TICKER, { call: stub.call, client: null, acquire: captureAcquire });
  return { sheet, stub };
}

async function valuedRun() {
  __resetAcquisitionCache();
  const run = await buildAcquiredRun({ ticker: NEW_TICKER, price: PRICE, source: "CAPTURE", nonOperatingInvestments: NON_OPERATING, profileHumanConfirmed: true });
  return assembleAnalysisResult(run.fixture);
}

describe("CF-AR6-ANY-TICKER-DRAFTS-01 — a new ticker, end to end, with no migration and no PR", () => {
  beforeAll(() => {
    copyFileSync(SOURCE_CAPTURE, TEST_CAPTURE);
  });

  beforeEach(async () => {
    await getPool().query("TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE");
    await resetSheetsToMigrated();
    __resetAcquisitionCache();
    __resetSheetResolution();
  });

  afterEach(cleanup);

  afterAll(async () => {
    rmSync(TEST_CAPTURE, { force: true });
    await resetSheetsToMigrated();
    await getPool().end();
  });

  it("before any draft: no sheet exists, and with no model (offline) none can be drafted — the run cannot open", async () => {
    expect(captureFor(NEW_TICKER)).not.toBeNull();
    expect(await sheetInForce(NEW_TICKER)).toBeNull();
    expect(await analystInputsFor(NEW_TICKER)).toBeNull();
  });

  it("drafts a price-blind sheet once, stores it as version 1 DRAFT, and every driver cites a supplied source", async () => {
    const { sheet, stub } = await draftWithStub();
    expect(sheet).not.toBeNull();
    expect(sheet!.version).toBe(1);
    expect(sheet!.status).toBe("DRAFT");
    expect(sheet!.origin).toBe("AI DRAFT");

    // One sheet — DRAFTS_PER_SHEET independent drafts (CALVIN RULING — A on
    // #454; was one call) — and no request carried a price: the acquisition
    // was made without one and no research source speaks of one.
    expect(stub.requests).toHaveLength(DRAFTS_PER_SHEET);
    // The system prompt is fixed text (it states the limit); the user
    // message is everything about this company the model sees.
    const request = stub.requests[0].user;
    expect(request).not.toContain("499.7");
    expect(request).not.toMatch(/share price|stock price|market cap|price per share/i);

    const ids = new Set((sheet!.content.sources ?? []).map((s) => s.id));
    for (const key of ["bear", "base", "bull"] as const) {
      for (const d of ["revenueGrowthOrPath", "operatingMargin", "returnOnNewInvestment", "reinvestmentCapitalIntensity", "shareCount"] as const) {
        const anchor = sheet!.content.scenarios[key].anchors?.[d];
        expect(anchor?.text.length).toBeGreaterThan(0);
        expect(anchor?.cites.length).toBeGreaterThan(0);
        for (const c of anchor!.cites) expect(ids.has(c)).toBe(true);
      }
    }
    expect(sheet!.content.moatClass).toBe("narrow");
    expect(sheet!.content.moatAnchor?.cites).toEqual(["H:returns"]);

    // A second resolution reads the stored draft — no second call.
    __resetSheetResolution();
    const again = await resolveSheet(NEW_TICKER, { call: stub.call, client: null, acquire: captureAcquire });
    expect(again?.id).toBe(sheet!.id);
    expect(stub.requests).toHaveLength(DRAFTS_PER_SHEET);
  });

  it("the run opens through the gate with no human step, and the report renders", async () => {
    await draftWithStub();
    expect(await isSupportedTicker(NEW_TICKER)).toBe(true);
    const runId = await createRun(NEW_TICKER, "Synthetic test company (MSFT capture)");
    await advanceRunAutomatically(runId);
    const result = await computeAnalysisForRun(runId);
    expect(result.valuationBasis?.sheet?.version).toBe(1);
    expect(result.valuationBasis?.sheet?.status).toBe("DRAFT");
    expect(() => render(<AnalyzerReport result={result} />)).not.toThrow();
  });

  it("on the draft, the valuation and the verdict zone appear; the final verdict waits for adoption", async () => {
    await draftWithStub();
    const result = await valuedRun();
    expect(result.valuationBasis?.d2.status).toBe("DRAFT");
    for (const key of ["bear", "base", "bull"] as const) expect(result.scenarioOutputs.values[key].isFinite()).toBe(true);
    expect(result.fairValueRange.kind).toBe("range");

    const verdict = deriveVerdict(result);
    expect(verdict.status).toBe("PENDING");
    expect(verdict.state).toBe("PENDING ADOPTION");
    expect(verdict.draftZone).toMatch(/BUY|HOLD|SELL/);
    expect(verdict.check).not.toBeNull();
  });

  it("adopting appends version 2 (the draft untouched); the same run then values on the adopted sheet and the verdict is no longer pending adoption", async () => {
    const { sheet } = await draftWithStub();
    const ctx = await validationContextFor(NEW_TICKER, sheet!.content, captureAcquire);
    const { sheet: adopted, changes } = await adoptSheet(NEW_TICKER, sheet!.id, {}, ctx);
    expect(adopted.version).toBe(2);
    expect(adopted.status).toBe("ADOPTED");
    expect(adopted.origin).toBe("ADOPTED AS DRAFTED");
    expect(adopted.adoptedFrom).toBe(sheet!.id);
    expect(changes).toEqual([]);

    const history = await sheetHistory(NEW_TICKER);
    expect(history.map((s) => [s.version, s.status])).toEqual([
      [1, "DRAFT"],
      [2, "ADOPTED"],
    ]);
    expect(history[0].content).toEqual(sheet!.content);

    const result = await valuedRun();
    expect(result.valuationBasis?.d2.status).toBe("ADOPTED");
    expect(result.valuationBasis?.sheet?.version).toBe(2);
    expect(deriveVerdict(result).state).not.toBe("PENDING ADOPTION");
  });

  it("adjusting a driver before adopting records the change and keeps the draft's anchor beside it", async () => {
    const { sheet } = await draftWithStub();
    const ctx = await validationContextFor(NEW_TICKER, sheet!.content, captureAcquire);
    const { sheet: adopted, changes } = await adoptSheet(
      NEW_TICKER,
      sheet!.id,
      { scenarios: { base: { operatingMargin: "0.40" } }, moatClass: "wide", note: "test adjustment" },
      ctx
    );
    expect(adopted.origin).toBe("ADOPTED WITH ADJUSTMENTS");
    expect(changes.join(" | ")).toMatch(/base operating margin .* → 0\.40/);
    expect(changes.join(" | ")).toMatch(/moat class narrow → wide/);
    expect(adopted.content.scenarios.base.operatingMargin).toBe("0.40");
    expect(adopted.content.scenarios.base.anchors?.operatingMargin?.text).toMatch(/Adjusted by Calvin .*test adjustment.*Draft anchor:/);
    expect(adopted.content.moatClass).toBe("wide");
  });

  it("the sheet page shows the draft, its anchors and the adopt form", async () => {
    await draftWithStub();
    const element = await AssumptionSheetPage({ params: Promise.resolve({ ticker: NEW_TICKER }), searchParams: Promise.resolve({}) });
    const { container } = render(element);
    expect(container.textContent).toContain(`Assumption sheet — ${NEW_TICKER}`);
    expect(container.textContent).toContain("Version 1 — draft");
    expect(container.querySelector('[data-role="adopt-sheet"]')).not.toBeNull();
    expect(container.querySelector("#source-H\\:revenue")).not.toBeNull();
  });
});

// The one resolver, restated (the static pins recordedAnalystInputEntryOnRealRun.test.tsx carried).
describe("analystInputsFor stays the one resolver — no second resolution path", () => {
  const ROOT = path.resolve(__dirname, "..", "..");
  const read = (relPath: string) => readFileSync(path.join(ROOT, relPath), "utf8");

  it("the sheet store's in-force read is reached only through analystInputs.ts on the run path", () => {
    for (const file of ["lib/analyzer/acquiredRun.ts", "scripts/analyzer/calibrate-position.ts", "lib/analyzer/gate.ts"]) {
      expect(read(file)).not.toContain("sheetInForce");
    }
    expect(read("lib/analyzer/acquisition/analystInputs.ts")).toContain('import { appendSheet, sheetInForce } from "../sheets/sheetStore"');
  });

  it("both call sites resolve through analystInputsFor, and gate.ts defers to it", () => {
    expect(read("lib/analyzer/acquiredRun.ts")).toContain("await analystInputsFor(options.ticker)");
    expect(read("scripts/analyzer/calibrate-position.ts")).toContain("await analystInputsFor(company.ticker)");
    expect(read("lib/analyzer/gate.ts")).toContain("await analystInputsFor(ticker)) !== null");
  });

  it("no committed fixture reaches the resolver", () => {
    const imports = read("lib/analyzer/acquisition/analystInputs.ts")
      .split("\n")
      .filter((line) => line.startsWith("import "));
    expect(imports.some((line) => /fixtures\//.test(line))).toBe(false);
  });
});
