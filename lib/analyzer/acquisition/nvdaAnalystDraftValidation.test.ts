import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { getPool } from "../../db";
import { analystInputsFor } from "./analystInputs";
import { isSupportedTicker } from "../gate";
import { resetSheetsToMigrated } from "../sheets/testSupport";
import { sheetInForce } from "../sheets/sheetStore";

// ---------------------------------------------------------------------------
// CF-ANALYST-DRAFT-NVDA-01 / CF-ANALYST-DRAFT-NVDA-SCENARIO-02 — SCOPE
// item 5 / item 6.
//
// This file does two things, neither of which records NVDA:
//
//   1. Proves the exact field values docs/analyst-drafts/nvda-step7-draft.md
//      proposes for NVDA behave exactly as the store's own validation rules
//      say they should, by writing them to a throwaway ticker in the test
//      database. The ticker is deliberately NOT "NVDA" — this file must
//      never create, even transiently, a row that would make the real
//      ticker resolvable — and the row is deleted before and after every
//      test, the same discipline recordedBundles.test.ts already uses for
//      its own throwaway ticker.
//
//      CF-ANALYST-DRAFT-NVDA-SCENARIO-02 re-derived the three scenario
//      dollar values under CALVIN RULING — C and found the current
//      approved methodology cannot support a defensible one from already-
//      authorised inputs alone (see the draft's "Scenario values" section
//      for the full reconciliation) — a named evidence gap, not a hand
//      estimate. The drafted `scenarioValues` are therefore blank, exactly
//      like an unauthored scenario driver, and `recordAnalystBundle`'s own
//      rule that a scenario value is REQUIRED (unlike a driver) means the
//      store refuses to record this bundle until Calvin closes the gap —
//      which is the point being pinned below, not a defect in the store.
//
//   2. Pins that nothing else in the runtime resolution path moved: MSFT
//      and OKLO still resolve from their committed bundles, and the
//      committed-ticker list is unchanged. NVDA itself is not written by
//      THIS file — but CF-ANALYZER-V1-SETTLE-01 (issue #392, Calvin ruling
//      3) has since durably recorded the real ticker's already-approved
//      scenario values (migration 008, transcribed byte-faithful from this
//      same draft's later "CALVIN RULING — APPROVE AS DRAFTED" outcome,
//      PR #295) so a fresh run no longer needs the per-run human act
//      CF-NVDA-RUN-OBSERVE-01's own HARD BOUNDS previously required —
//      pinned below as the current, intentional state, not a regression.
//
// CF-AR6-ANY-TICKER-DRAFTS-01 — reviewed evaluator change. Part 1 tested the
// recorded-bundle store's own write rules; that store is deleted (its rows
// are migration 014's version 1 sheets), so part 1 goes with it. Part 2's
// "resolution path is unchanged" pins are restated for the one resolver that
// replaces it: MSFT and NVDA resolve their migrated sheets, and OKLO — whose
// committed fixture no longer reaches a real run — resolves a sheet that
// records it cannot be concluded from filed history.
// ---------------------------------------------------------------------------

const REPO_ROOT = join(__dirname, "..", "..", "..");
const THIS_FILE = relative(REPO_ROOT, __filename).replace(/\.js$/, ".ts");
const SCAN_ROOTS = ["lib", "app", "scripts", "migrations", ".github"];
const DRAFT_REFERENCE = /nvda-step7-draft|analyst-drafts/;
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next"]);
// CF-NVDA-RUN-OBSERVE-01 (issue #296) transcribes the now-approved draft
// byte-faithful into the recorded store and cites the draft's own path in
// its provenance comment, exactly as this test's own docstring above does —
// a prose citation, never an import of the artefact itself (it hand-copies
// the field values as string literals). Allowed here for the same reason
// THIS_FILE is.
const ALLOWED_DRAFT_REFERENCES = new Set([
  THIS_FILE,
  "lib/analyzer/nvdaRealRunObservation.test.ts",
  // CF-ANALYZER-V1-SETTLE-01 (issue #392) — same class of provenance
  // citation as the two entries above: names the draft's path in a comment
  // explaining where the durably-seeded values came from, never imports or
  // reads the artefact file itself at runtime.
  "migrations/008_nvda_recorded_bundle_seed.sql",
]);

function findDraftReferences(dir: string, results: string[]): void {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (SKIP_DIRS.has(entry)) continue;
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      findDraftReferences(fullPath, results);
      continue;
    }
    let contents: string;
    try {
      contents = readFileSync(fullPath, "utf8");
    } catch {
      continue; // binary or unreadable file — cannot contain a source-level import
    }
    if (DRAFT_REFERENCE.test(contents)) {
      results.push(relative(REPO_ROOT, fullPath));
    }
  }
}

describe("CF-ANALYST-DRAFT-NVDA-01 — the draft artefact is not imported by any runtime module (SCOPE item 6)", () => {
  it("no file under lib/, app/, scripts/, migrations/ or .github/ (other than the allowed provenance citations) references the draft artefact", () => {
    const results: string[] = [];
    for (const root of SCAN_ROOTS) {
      findDraftReferences(join(REPO_ROOT, root), results);
    }
    expect(results.filter((path) => !ALLOWED_DRAFT_REFERENCES.has(path))).toEqual([]);
  });
});

describe("CF-ANALYST-DRAFT-NVDA-01 — the runtime resolution path, restated for the sheet store (CF-AR6-ANY-TICKER-DRAFTS-01)", () => {
  beforeAll(async () => {
    await resetSheetsToMigrated();
  });

  it("analystInputsFor resolves MSFT's migrated sheet, and OKLO's committed fixture never reaches a real run", async () => {
    const msft = await analystInputsFor("MSFT");
    expect(msft?.inputs.profile.confirmedOrOverridden).toBe("MATURE_PROFITABLE_STABLE_FCF");
    expect(msft?.inputs.sheet?.origin).toBe("MIGRATED BUNDLE");

    const oklo = await analystInputsFor("OKLO");
    expect(oklo?.inputs.sheet?.origin).toBe("CANNOT CONCLUDE");
    expect(oklo?.inputs.preRevenue).toBeNull();
    expect(oklo?.inputs.scenarioValuesAreFixtureCarried).toBe(false);
    for (const key of ["bear", "base", "bull"] as const) expect(oklo?.inputs.scenarios[key].revenueGrowthOrPath).toBeNull();
  });

  // CF-ANALYZER-V1-SETTLE-01 (issue #392) — migration 008 durably records
  // NVDA's already Calvin-approved scenario bundle (PR #295, "CALVIN
  // RULING — APPROVE AS DRAFTED"); migration 014 carries it into NVDA's
  // version 1 sheet, a draft awaiting one re-adoption.
  it("NVDA has a durably migrated sheet (migrations 008 and 014) and analystInputsFor(\"NVDA\") resolves it", async () => {
    const sheet = await sheetInForce("NVDA");
    expect(sheet?.status).toBe("DRAFT");
    expect(sheet?.origin).toBe("MIGRATED BUNDLE");
    const bundle = await analystInputsFor("NVDA");
    expect(bundle).not.toBeNull();
    expect(bundle?.inputs.profile.confirmedOrOverridden).toBe("HIGH_GROWTH_PROFITABLE_UNCERTAIN_DURABILITY");
    expect(bundle?.inputs.scenarioValues?.bear.toString()).toBe("28.08");
    expect(bundle?.inputs.scenarioValues?.base.toString()).toBe("102.38");
    expect(bundle?.inputs.scenarioValues?.bull.toString()).toBe("296.44");
  });

  it("a run for NVDA no longer fails closed: isSupportedTicker(\"NVDA\") is true", async () => {
    expect(await isSupportedTicker("NVDA")).toBe(true);
  });

  afterAll(async () => {
    await resetSheetsToMigrated();
    await getPool().end();
  });
});
