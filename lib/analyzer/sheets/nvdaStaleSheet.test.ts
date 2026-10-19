import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getPool } from "../../db";
import { acquireCompany } from "../acquisition/provider";
import { historyFrom } from "./research";
import { staleFindings } from "./validators";
import { sheetInForce } from "./sheetStore";
import { resetSheetsToMigrated } from "./testSupport";

// ---------------------------------------------------------------------------
// CF-AR6-ANY-TICKER-DRAFTS-01 — "NVDA's stale drivers refresh through this
// path" (issue #454 DO 6; execution handoff §6: "NVDA's recorded drivers are
// stale (year-1 revenue below the current run-rate)"). The stale-assumption
// check reads NVDA's migrated sheet against NVDA's real filed quarters and
// says so; the remedy is a redraft (a new version), which Calvin adopts.
// ---------------------------------------------------------------------------

describe("the stale-assumption check on NVDA's migrated sheet", () => {
  beforeAll(resetSheetsToMigrated);
  afterAll(async () => {
    await getPool().end();
  });

  it("flags year-1 revenue below the latest quarter's run-rate, and a latest quarter growing far outside bear…bull", async () => {
    const acquired = await acquireCompany("NVDA", { price: null, source: "CAPTURE" });
    const { measures } = historyFrom(acquired.companyFacts);
    const sheet = await sheetInForce("NVDA");
    expect(sheet?.origin).toBe("MIGRATED BUNDLE");
    const messages = staleFindings(sheet!.content, measures).map((f) => f.message);
    expect(messages.some((m) => /below the latest quarter's annualised run-rate/.test(m))).toBe(true);
    expect(messages.some((m) => /outside this sheet's bear…bull growth \(5\.0% to 35\.0%\)/.test(m))).toBe(true);
  });

  it("MSFT's migrated sheet is only noted for recording no drafting quarter", async () => {
    const acquired = await acquireCompany("MSFT", { price: null, source: "CAPTURE" });
    const { measures } = historyFrom(acquired.companyFacts);
    const findings = staleFindings((await sheetInForce("MSFT"))!.content, measures);
    expect(findings.map((f) => f.message)).toEqual([expect.stringMatching(/records no quarter it was drafted on/)]);
  });
});
