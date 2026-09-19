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

describe("the two M9 routes' gate redirects are byte-for-byte unchanged", () => {
  const routes = ["app/analyzer/[runId]/page.tsx", "app/analyzer/[runId]/report/page.tsx"];

  it("both redirect to /profile when profileDecision is null", () => {
    for (const route of routes) {
      expect(readRepoFile(route)).toContain("redirect(`/analyzer/${runId}/profile`);");
    }
  });

  it("both redirect to /facts on SpotCheckIncompleteError", () => {
    for (const route of routes) {
      const src = readRepoFile(route);
      expect(src).toContain("if (err instanceof SpotCheckIncompleteError) {");
      expect(src).toContain("redirect(`/analyzer/${runId}/facts`);");
    }
  });
});
