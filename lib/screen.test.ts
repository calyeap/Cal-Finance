import { describe, it, expect } from "vitest";
import type { LatestRunSummary } from "./analyzer/runStore";
import { CANDIDATE_UNIVERSE_TICKERS, candidateTickers, buildScreenCandidates } from "./screen";

const MSFT_RUN: LatestRunSummary = {
  runId: "11111111-1111-1111-1111-111111111111",
  resolvedCompanyName: "Microsoft Corporation",
};
const NVDA_RUN: LatestRunSummary = {
  runId: "22222222-2222-2222-2222-222222222222",
  resolvedCompanyName: "NVIDIA Corporation",
};

describe("candidateTickers — deterministic set difference (DO 1, VERIFY)", () => {
  it("excludes a currently-held symbol from the candidate universe", () => {
    const held = new Set(["MSFT"]);
    expect(candidateTickers(held)).toEqual(
      CANDIDATE_UNIVERSE_TICKERS.filter((t) => t !== "MSFT")
    );
    expect(candidateTickers(held)).not.toContain("MSFT");
  });

  it("returns the full fixed universe when nothing is held", () => {
    expect(candidateTickers(new Set())).toEqual(CANDIDATE_UNIVERSE_TICKERS);
  });

  it("is deterministic and stable — same input, same order, every call", () => {
    const held = new Set(["OKLO"]);
    const a = candidateTickers(held);
    const b = candidateTickers(held);
    expect(a).toEqual(b);
    // The fixed universe's own order, not alphabetical or any other derived
    // order — proof there is no ranking rule hiding behind "deterministic".
    expect(a).toEqual(CANDIDATE_UNIVERSE_TICKERS.filter((t) => t !== "OKLO"));
  });
});

describe("buildScreenCandidates — candidate set (DO 1, VERIFY)", () => {
  it("a not-held ticker with an existing Analyzer report appears", () => {
    const runs = new Map<string, LatestRunSummary | null>([["MSFT", MSFT_RUN]]);
    const candidates = buildScreenCandidates(new Set(), runs);
    expect(candidates.find((c) => c.symbol === "MSFT")).toEqual({
      symbol: "MSFT",
      analyzerRun: MSFT_RUN,
    });
  });

  it("a currently-held symbol with an Analyzer report does NOT appear", () => {
    const runs = new Map<string, LatestRunSummary | null>([["MSFT", MSFT_RUN]]);
    const candidates = buildScreenCandidates(new Set(["MSFT"]), runs);
    expect(candidates.find((c) => c.symbol === "MSFT")).toBeUndefined();
  });

  it("a not-held ticker with no existing Analyzer report does not appear (not a candidate to run, only to view)", () => {
    const runs = new Map<string, LatestRunSummary | null>([["NVDA", null]]);
    const candidates = buildScreenCandidates(new Set(), runs);
    expect(candidates.find((c) => c.symbol === "NVDA")).toBeUndefined();
  });

  it("a ticker missing from the lookup map entirely is treated the same as an explicit null", () => {
    const candidates = buildScreenCandidates(new Set(), new Map());
    expect(candidates).toEqual([]);
  });

  it("empty candidate set when every universe ticker is either held or reportless", () => {
    const held = new Set(CANDIDATE_UNIVERSE_TICKERS);
    const candidates = buildScreenCandidates(held, new Map([["MSFT", MSFT_RUN]]));
    expect(candidates).toEqual([]);
  });

  it("orders candidates by the fixed universe order, never by anything report-derived", () => {
    const runs = new Map<string, LatestRunSummary | null>([
      ["NVDA", NVDA_RUN],
      ["MSFT", MSFT_RUN],
    ]);
    const candidates = buildScreenCandidates(new Set(), runs);
    expect(candidates.map((c) => c.symbol)).toEqual(
      CANDIDATE_UNIVERSE_TICKERS.filter((t) => runs.get(t) != null)
    );
  });

  it("carries only runId and resolvedCompanyName — no verdict, score, or BUY/HOLD/SELL content", () => {
    const runs = new Map<string, LatestRunSummary | null>([["MSFT", MSFT_RUN]]);
    const candidates = buildScreenCandidates(new Set(), runs);
    const serialised = JSON.stringify(candidates);
    for (const forbidden of ["BUY", "SELL", "HOLD", "verdict", "score", "ranking", "INCOMPLETE"]) {
      expect(serialised.toUpperCase()).not.toContain(forbidden.toUpperCase());
    }
  });
});
