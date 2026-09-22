import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

// ---------------------------------------------------------------------------
// #118 runway item 10 (M9-REAL-COMPANY-VALIDATION-01) — HARD BOUNDS guards.
//
// This outcome must not touch verdict.ts (no cut-point, band, threshold or
// comparator anywhere) or either M9 route's two gate redirects. Not a
// frozen-artefact check — docs/frozen/ and FROZEN_HASHES are a separate
// mechanism this outcome's HARD BOUNDS forbid touching — a narrow regression
// pin scoped to exactly the files this validation pass must leave alone.
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..", "..");

function readRepoFile(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("verdict.ts is untouched by this validation pass", () => {
  it("hashes to the content this outcome started from — no cut-point, band, threshold or comparator added", () => {
    const hash = createHash("sha256").update(readRepoFile("lib/analyzer/verdict.ts")).digest("hex");
    expect(hash).toBe("02ce2d490ada12eb739b9556f28c4d6a1a9f83ecf1aea9ff4d240351059791a7");
  });
});

// ---------------------------------------------------------------------------
// AMENDED by CF-ANALYZER-AUTORUN-01, on Calvin's CALVIN RULING of 22 September
// 2026 04:28:04Z (PR #216 comment 5771211284).
//
// This block used to pin the two M9 routes' gate redirects as "byte-for-byte
// unchanged" — a HARD BOUNDS guard belonging to the real-company validation
// pass (#118 item 10), which was not allowed to touch them. Calvin has since
// ruled on exactly those two redirects: "After I enter/select a ticker and
// start analysis, I should not be required to manually verify prices, margins,
// SEC facts, extraction states, provenance, gates, or other routine inputs ...
// V1 acceptance target: enter ticker → analyze → report."
//
// So the guard is inverted rather than deleted. The property worth pinning is
// now the opposite one, and pinning it keeps the old behaviour from creeping
// back in the same way the original pin kept it from being lost.
//
// Note what is NOT inverted: the verdict.ts hash above, and the gate itself.
// SpotCheckIncompleteError is still raised by computeAnalysisForRun and still
// caught by both routes — they answer it with an INCOMPLETE state instead of a
// redirect to an operator screen, which is the whole of the change.
// ---------------------------------------------------------------------------
describe("the two M9 routes never send the analyst to a human step (CF-ANALYZER-AUTORUN-01)", () => {
  const routes = ["app/analyzer/[runId]/page.tsx", "app/analyzer/[runId]/report/page.tsx"];

  it("neither redirects to Screen 3 on an undecided profile", () => {
    for (const route of routes) {
      expect(readRepoFile(route)).not.toContain("redirect(`/analyzer/${runId}/profile`);");
    }
  });

  it("neither redirects to Screen 2 on SpotCheckIncompleteError", () => {
    for (const route of routes) {
      const src = readRepoFile(route);
      // Still caught — the gate is untouched and a refusal is still handled.
      expect(src).toContain("if (err instanceof SpotCheckIncompleteError) {");
      // Answered with an honest state at the run, never a route into Screen 2.
      expect(src).not.toContain("redirect(`/analyzer/${runId}/facts`);");
      expect(src).toContain("INCOMPLETE");
    }
  });

  it("both reach verification-complete by running the automatic pass, not by relaxing the gate", () => {
    for (const route of routes) {
      expect(readRepoFile(route)).toContain("advanceRunAutomatically(runId)");
    }
    // The chokepoint itself still checks before it computes, in that order.
    const gate = readRepoFile("lib/analyzer/gate.ts");
    expect(gate).toContain("if (!state.spotCheckComplete) {");
    expect(gate).toContain("throw new SpotCheckIncompleteError(runId, state.outstandingFactIds);");
  });

  it("both offer Screens 2 and 3 as optional detail instead", () => {
    for (const route of routes) {
      expect(readRepoFile(route)).toContain("SourcesAndDetails");
    }
    const detail = readRepoFile("app/components/SourcesAndDetails.tsx");
    expect(detail).toContain("/facts");
    expect(detail).toContain("/profile");
  });
});
