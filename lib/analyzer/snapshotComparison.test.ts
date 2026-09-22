import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { diffStoredSnapshots, type SnapshotComparison } from "./snapshotComparison";
import { deriveVerdict } from "./verdict";
import { assembleAnalysisResult } from "./assemble";
import { MSFT_FIXTURE } from "./fixtures/msft";
import type { AnalysisResult } from "./types";
import type { StoredSnapshot } from "./snapshotStore";
import type { AiLayerReport } from "./reportAnalysis";

// ---------------------------------------------------------------------------
// CF-LOOP-UPDATE-01's comparison engine, exercised as a pure function of two
// hand-built StoredSnapshots — the same style verdict.test.ts and trust.test.ts
// use for deriveVerdict: build one real AnalysisResult with
// assembleAnalysisResult (never touches the database or any calculation
// module beyond that one assembly), then override only the members each case
// is actually about. This file's own real-MSFT/real-OKLO proof, driven
// through the database and the acquired captures, is
// snapshotComparisonOnRealRun.test.ts.
// ---------------------------------------------------------------------------

const AI_LAYER: AiLayerReport = { status: "NOT CONFIGURED", model: null, detail: null };

function snapshotOf(result: AnalysisResult, version: number): StoredSnapshot {
  return {
    runId: "fixture-run",
    version,
    result,
    aiLayer: AI_LAYER,
    verdict: deriveVerdict(result),
    createdAt: `2026-09-2${version}T00:00:00Z`,
  };
}

function baseResult(): AnalysisResult {
  return assembleAnalysisResult(MSFT_FIXTURE);
}

function changedField(comparison: SnapshotComparison, field: string) {
  return comparison.changed.find((c) => c.field === field);
}

describe("diffStoredSnapshots", () => {
  it("reports no changes and every field unchanged when both versions are the same result", () => {
    const result = baseResult();
    const comparison = diffStoredSnapshots(snapshotOf(result, 1), snapshotOf(result, 2));

    expect(comparison.changed).toEqual([]);
    expect(comparison.unchanged.length).toBeGreaterThan(0);
    expect(comparison.unchanged).toContain("verdict.status");
    expect(comparison.unchanged).toContain("fairValueRange");
  });

  it("compares Decimal figures by value — two numerically-equal Decimals round-tripped through the store are unchanged", () => {
    const a = baseResult();
    // A fresh Decimal instance, numerically equal but never object-identical
    // to a.price.value — this is exactly what getSnapshot hands back after a
    // JSON round trip through snapshotStore's __decimal__ tag walk.
    const b: AnalysisResult = { ...a, price: { ...a.price, value: new Decimal(a.price.value.toString()) } };

    expect(a.price.value).not.toBe(b.price.value);
    expect(a.price.value.equals(b.price.value)).toBe(true);

    const comparison = diffStoredSnapshots(snapshotOf(a, 1), snapshotOf(b, 2));

    expect(comparison.unchanged).toContain("price.value");
    expect(changedField(comparison, "price.value")).toBeUndefined();
  });

  it("reports a genuine numeric move with both figures, not merely that something changed", () => {
    const a = baseResult();
    const movedPrice = a.price.value.plus(5);
    const b: AnalysisResult = { ...a, price: { ...a.price, value: movedPrice } };

    const comparison = diffStoredSnapshots(snapshotOf(a, 1), snapshotOf(b, 2));

    const change = changedField(comparison, "price.value");
    expect(change).toBeDefined();
    expect(change!.from).toBe(a.price.value.toString());
    expect(change!.to).toBe(movedPrice.toString());
    expect(comparison.unchanged).not.toContain("price.value");
  });

  it("reports a suppression appearing as a real event on fairValueRange, never skipped as a null", () => {
    const a = baseResult();
    const b: AnalysisResult = {
      ...a,
      trust: { status: "UNUSABLE", determinedBy: [{ kind: "suppressing state", detail: "LEVERAGE UNSUPPORTED IN v1" }] },
      fairValueRange: { kind: "suppressed", state: "LEVERAGE UNSUPPORTED IN v1", cause: "inputs missing" },
    };

    const comparison = diffStoredSnapshots(snapshotOf(a, 1), snapshotOf(b, 2));

    const rangeChange = changedField(comparison, "fairValueRange");
    expect(rangeChange).toBeDefined();
    expect((rangeChange!.from as { kind: string }).kind).toBe(a.fairValueRange.kind);
    expect((rangeChange!.to as { kind: string }).kind).toBe("suppressed");

    const trustChange = changedField(comparison, "trust.status");
    expect(trustChange).toEqual({ field: "trust.status", from: a.trust.status, to: "UNUSABLE" });
  });

  it("reports a suppression clearing as a real event, symmetrically", () => {
    const suppressed = baseResult();
    const b: AnalysisResult = {
      ...suppressed,
      trust: { status: "UNUSABLE", determinedBy: [{ kind: "suppressing state", detail: "LEVERAGE UNSUPPORTED IN v1" }] },
      fairValueRange: { kind: "suppressed", state: "LEVERAGE UNSUPPORTED IN v1", cause: "inputs missing" },
    };
    const cleared = baseResult();

    const comparison = diffStoredSnapshots(snapshotOf(b, 1), snapshotOf(cleared, 2));

    const rangeChange = changedField(comparison, "fairValueRange");
    expect(rangeChange).toBeDefined();
    expect((rangeChange!.from as { kind: string }).kind).toBe("suppressed");
    expect((rangeChange!.to as { kind: string }).kind).toBe(cleared.fairValueRange.kind);
  });

  it("covers gates.leverage as one reportable field across its own PASS / UNSUPPORTED shapes", () => {
    const a = baseResult();
    expect(a.gates.leverage.result).toBe("PASS");
    const b: AnalysisResult = {
      ...a,
      gates: {
        ...a.gates,
        leverage: {
          netDebtRatio: null,
          operatingLeaseInclusiveMemo: null,
          result: "LEVERAGE UNSUPPORTED IN v1",
          leveredResidualExceptionApplies: false,
        },
      },
    };

    const comparison = diffStoredSnapshots(snapshotOf(a, 1), snapshotOf(b, 2));

    const change = changedField(comparison, "gates.leverage");
    expect(change).toBeDefined();
    expect((change!.from as { result: string }).result).toBe("PASS");
    expect((change!.to as { result: string }).result).toBe("LEVERAGE UNSUPPORTED IN v1");
  });

  it("covers the qualifying flags as their own field, order-sensitively", () => {
    const a = baseResult();
    const b: AnalysisResult = {
      ...a,
      states: {
        ...a.states,
        qualifying: [...a.states.qualifying, { flag: "CAPITAL-LIGHT", appliesTo: "reinvestment/RONIC" }],
      },
    };

    const comparison = diffStoredSnapshots(snapshotOf(a, 1), snapshotOf(b, 2));

    expect(changedField(comparison, "states.qualifying")).toBeDefined();
  });

  it("covers scenario outputs (bear/base/bull, weighted distribution, price location) as their own fields", () => {
    const a = baseResult();
    const b: AnalysisResult = {
      ...a,
      scenarioOutputs: {
        ...a.scenarioOutputs,
        values: { ...a.scenarioOutputs.values, base: a.scenarioOutputs.values.base.plus(1) },
      },
    };

    const comparison = diffStoredSnapshots(snapshotOf(a, 1), snapshotOf(b, 2));

    expect(changedField(comparison, "scenarioOutputs.values")).toBeDefined();
    expect(comparison.unchanged).toContain("scenarioOutputs.weightedDistribution");
    expect(comparison.unchanged).toContain("scenarioOutputs.priceLocationWithinRange");
  });

  it("covers the verdict's label and reason independently — a reason can move while the status stays INCOMPLETE", () => {
    const a = baseResult();
    const suppressed: AnalysisResult = {
      ...a,
      trust: { status: "UNUSABLE", determinedBy: [{ kind: "suppressing state", detail: "LEVERAGE UNSUPPORTED IN v1" }] },
      fairValueRange: { kind: "suppressed", state: "LEVERAGE UNSUPPORTED IN v1", cause: "inputs missing" },
    };

    expect(deriveVerdict(a).status).toBe("INCOMPLETE");
    expect(deriveVerdict(suppressed).status).toBe("INCOMPLETE");

    const comparison = diffStoredSnapshots(snapshotOf(a, 1), snapshotOf(suppressed, 2));

    expect(comparison.unchanged).toContain("verdict.status");
    expect(changedField(comparison, "verdict.reason")).toBeDefined();
  });

  it("is deterministic — the same two versions compared twice produce an identical result", () => {
    const a = baseResult();
    const b: AnalysisResult = { ...a, price: { ...a.price, value: a.price.value.plus(1) } };

    const first = diffStoredSnapshots(snapshotOf(a, 1), snapshotOf(b, 2));
    const second = diffStoredSnapshots(snapshotOf(a, 1), snapshotOf(b, 2));

    expect(first).toEqual(second);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("orders both changed and unchanged fields by a fixed list, not by an object's own key enumeration order", () => {
    const a = baseResult();
    // Two AnalysisResults built by spreading the same base in a different
    // property order — object key enumeration would differ if this module
    // relied on it, but nothing here reads Object.keys(AnalysisResult) at
    // the top level, so the output's field order must be identical anyway.
    const bInOrder: AnalysisResult = { ...a, price: { ...a.price, value: a.price.value.plus(2) } };
    // Same key/value pairs as bInOrder, reversed insertion order — object
    // key enumeration follows insertion order for string keys, so this
    // actually changes Object.keys(bReordered)'s order without changing a
    // single value.
    const bReordered = Object.fromEntries(Object.entries(bInOrder).reverse()) as AnalysisResult;

    const first = diffStoredSnapshots(snapshotOf(a, 1), snapshotOf(bInOrder, 2));
    const second = diffStoredSnapshots(snapshotOf(a, 1), snapshotOf(bReordered, 2));

    expect(first.changed.map((c) => c.field)).toEqual(second.changed.map((c) => c.field));
    expect(first.unchanged).toEqual(second.unchanged);
    // The one field that differs (price.value) sorts ahead of every
    // unchanged field in FIELD_SPECS' own declared order.
    expect(first.changed.map((c) => c.field)).toEqual(["price.value"]);
    expect(first.unchanged[0]).toBe("verdict.status");
    expect(first.unchanged[1]).toBe("verdict.reason");
  });
});
