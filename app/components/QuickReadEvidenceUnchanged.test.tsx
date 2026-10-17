// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { QuickRead } from "./QuickRead";
import { assembleAnalysisResult } from "@/lib/analyzer/assemble";
import { MSFT_FIXTURE } from "@/lib/analyzer/fixtures/msft";
import { OKLO_FIXTURE } from "@/lib/analyzer/fixtures/oklo";
import type { AnalysisResult } from "@/lib/analyzer/types";

afterEach(cleanup);

// CF-AR1-QUICK-READ-OVERVIEW-01 — issue #449 DO NOT: "no change to other
// tabs' content". The Evidence tab's own <QuickRead> must render exactly as
// it did before this outcome. The committed snapshot was generated from the
// base (`master` @ d263b2e) QuickRead.tsx, then pinned; every branch below
// is a real fixture run or a minimal mutation of one, so each of
// buildQuickRead's four early returns and the mature-company reading is
// covered, not only the paths MSFT's own fixture happens to reach.
const msft = assembleAnalysisResult(MSFT_FIXTURE);
const oklo = assembleAnalysisResult(OKLO_FIXTURE);

const cases: Record<string, AnalysisResult> = {
  "MSFT (mature reading, DEGENERATE cell, margin at high)": msft,
  "MSFT, no price": assembleAnalysisResult({
    ...MSFT_FIXTURE,
    enterpriseValue: { ...MSFT_FIXTURE.enterpriseValue, price: null },
  }),
  "MSFT, gate 0 refuses": {
    ...msft,
    gates: { ...msft.gates, gate0: { ...msft.gates.gate0, result: "UNSUPPORTED PROFILE — CLASSIFICATION UNAVAILABLE" } },
  },
  "MSFT, leverage precondition fails": {
    ...msft,
    gates: { ...msft.gates, leverage: { ...msft.gates.leverage, result: "LEVERAGE UNSUPPORTED IN v1" } },
  },
  "MSFT, non-default provenance fact": {
    ...msft,
    facts: msft.facts.map((f, i) => (i === 0 ? { ...f, sourceClass: "SECONDARY" } : f)) as AnalysisResult["facts"],
  },
  "OKLO (pre-revenue distribution)": oklo,
  "OKLO, no success worth less than failure, rate capped": {
    ...oklo,
    preRevenue: {
      ...oklo.preRevenue!,
      successDefinitions: oklo.preRevenue!.successDefinitions.map((d) => ({
        ...d,
        state: { kind: "PRICE NOT JUSTIFIABLE BY THIS OUTCOME" },
        rateCapped: true,
      })) as NonNullable<AnalysisResult["preRevenue"]>["successDefinitions"],
    },
  },
  "OKLO, acquired cash basis not established": assembleAnalysisResult({
    ...OKLO_FIXTURE,
    preRevenue: {
      ...OKLO_FIXTURE.preRevenue!,
      cashPerShare: null,
      cashPerShareAsOfDate: null,
      cashPerShareCause: "missing REQUIRED input: acquired cash balance, shares outstanding used by the acquired run",
      quarterlyBurn: null,
      quarterlyBurnAsOfDate: null,
      quarterlyBurnCause: "missing REQUIRED input: acquired quarterly operating cash flow (burn)",
      runway: null,
      runwayCause: "missing REQUIRED input: acquired cash balance, acquired quarterly burn",
    },
  }),
};

describe("QuickRead (Evidence tab) — renders exactly as on the base, per branch", () => {
  for (const [name, result] of Object.entries(cases)) {
    it(name, () => {
      const { container } = render(<QuickRead result={result} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  }
});
