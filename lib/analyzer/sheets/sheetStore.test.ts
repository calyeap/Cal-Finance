import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../../db";
import { appendSheet, latestDraft, sheetHistory, sheetInForce } from "./sheetStore";
import { resetSheetsToMigrated, SHEETS_MIGRATION_SQL } from "./testSupport";
import type { SheetContent } from "./sheet";

// ---------------------------------------------------------------------------
// CF-AR6-ANY-TICKER-DRAFTS-01 — the append-only store and migration 014,
// proven on the disposable test database (cloud workers never touch Calvin's
// database; his `npm run migrate`, after a pg_dump, is the production gate).
// ---------------------------------------------------------------------------

const T = "ZZZSTORE";

function content(tag: string): SheetContent {
  const s = { revenueGrowthOrPath: "0.05", operatingMargin: "0.2", reinvestmentCapitalIntensity: "0.03", returnOnNewInvestment: "0.15", shareCount: "100", writtenAnchor: tag };
  return {
    profile: "MATURE_PROFITABLE_STABLE_FCF",
    classificationInputs: {
      revenueScale: "large",
      fcfCharacter: "positive_stable",
      revenueGrowthBand: "<10%",
      capitalIntensity: "0.03",
      cyclicality: { tenYearMarginRange: "0.1", worstSingleYearChange: "0.01" },
      balanceSheetNature: "asset-light",
    },
    scenarios: { bear: s, base: s, bull: s },
    moatClass: "narrow",
    configuredConstants: { nopatTaxRate: "0.21", stressMarginLevel: "0.1", preRevenueUnleveredRate: null, projectDebtCost: null },
  };
}

describe("the assumption-sheet store", () => {
  beforeEach(resetSheetsToMigrated);

  it("appends versions 1, 2, 3 … per ticker", async () => {
    const a = await appendSheet({ ticker: T.toLowerCase(), status: "DRAFT", origin: "AI DRAFT", content: content("a") });
    const b = await appendSheet({ ticker: T, status: "DRAFT", origin: "AI DRAFT", content: content("b") });
    expect([a.ticker, a.version, b.version]).toEqual([T, 1, 2]);
    expect((await sheetHistory(T)).map((s) => s.content.scenarios.base.writtenAnchor)).toEqual(["a", "b"]);
  });

  it("is append-only: the table refuses UPDATE and DELETE", async () => {
    const a = await appendSheet({ ticker: T, status: "DRAFT", origin: "AI DRAFT", content: content("a") });
    await expect(getPool().query("UPDATE analyzer_assumption_sheets SET status = 'ADOPTED' WHERE id = $1", [a.id])).rejects.toThrow(/append-only/);
    await expect(getPool().query("DELETE FROM analyzer_assumption_sheets WHERE id = $1", [a.id])).rejects.toThrow(/append-only/);
    expect((await sheetHistory(T))[0].status).toBe("DRAFT");
  });

  it("an adoption must name the version it adopts; a draft must not", async () => {
    await expect(appendSheet({ ticker: T, status: "ADOPTED", origin: "ADOPTED AS DRAFTED", content: content("x") })).rejects.toThrow();
    const a = await appendSheet({ ticker: T, status: "DRAFT", origin: "AI DRAFT", content: content("a") });
    await expect(appendSheet({ ticker: T, status: "DRAFT", origin: "AI DRAFT", content: content("y"), adoptedFrom: a.id })).rejects.toThrow();
  });

  it("the sheet in force is the latest adopted version; a later draft waits beside it", async () => {
    const d1 = await appendSheet({ ticker: T, status: "DRAFT", origin: "AI DRAFT", content: content("d1") });
    expect((await sheetInForce(T))?.id).toBe(d1.id);
    const a2 = await appendSheet({ ticker: T, status: "ADOPTED", origin: "ADOPTED AS DRAFTED", content: content("a2"), adoptedFrom: d1.id });
    const d3 = await appendSheet({ ticker: T, status: "DRAFT", origin: "AI DRAFT", content: content("d3") });
    expect((await sheetInForce(T))?.id).toBe(a2.id);
    expect((await latestDraft(T))?.id).toBe(d3.id);
  });

  it("two writers racing for the same version both land, on consecutive versions", async () => {
    const [x, y] = await Promise.all([
      appendSheet({ ticker: T, status: "DRAFT", origin: "AI DRAFT", content: content("x") }),
      appendSheet({ ticker: T, status: "DRAFT", origin: "AI DRAFT", content: content("y") }),
    ]);
    expect([x.version, y.version].sort()).toEqual([1, 2]);
  });
});

describe("migration 014", () => {
  beforeEach(resetSheetsToMigrated);
  afterAll(async () => {
    await resetSheetsToMigrated();
    await getPool().end();
  });

  it("copies every recorded bundle in as its version 1 DRAFT, MIGRATED BUNDLE — so MSFT and NVDA each need one re-adoption", async () => {
    const { rows: recorded } = await getPool().query<{ ticker: string }>("SELECT ticker FROM analyzer_recorded_analyst_bundles ORDER BY ticker");
    const { rows: sheets } = await getPool().query<{ ticker: string; version: number; status: string; origin: string }>(
      "SELECT ticker, version, status, origin FROM analyzer_assumption_sheets ORDER BY ticker"
    );
    expect(recorded.map((r) => r.ticker)).toEqual(expect.arrayContaining(["MSFT", "NVDA"]));
    expect(sheets).toEqual(recorded.map((r) => ({ ticker: r.ticker, version: 1, status: "DRAFT", origin: "MIGRATED BUNDLE" })));
    const msft = await sheetInForce("MSFT");
    expect(msft?.content.legacyScenarioValues?.base).toBe("283.31");
    expect(msft?.content.scenarios.base.revenueGrowthOrPath).toBe("0.14");
  });

  it("is idempotent and additive: a second run inserts nothing and leaves the recorded bundles untouched", async () => {
    const before = await getPool().query("SELECT * FROM analyzer_recorded_analyst_bundles ORDER BY ticker");
    const count = async () => Number((await getPool().query("SELECT count(*) AS n FROM analyzer_assumption_sheets")).rows[0].n);
    const n = await count();
    await getPool().query(SHEETS_MIGRATION_SQL);
    await getPool().query(SHEETS_MIGRATION_SQL);
    expect(await count()).toBe(n);
    const after = await getPool().query("SELECT * FROM analyzer_recorded_analyst_bundles ORDER BY ticker");
    expect(after.rows).toEqual(before.rows);
  });

  it("never re-migrates a ticker that already has a sheet", async () => {
    await getPool().query("TRUNCATE analyzer_assumption_sheets RESTART IDENTITY");
    await appendSheet({ ticker: "MSFT", status: "DRAFT", origin: "AI DRAFT", content: content("fresh") });
    await getPool().query(SHEETS_MIGRATION_SQL);
    const msft = await sheetHistory("MSFT");
    expect(msft).toHaveLength(1);
    expect(msft[0].origin).toBe("AI DRAFT");
  });
});
