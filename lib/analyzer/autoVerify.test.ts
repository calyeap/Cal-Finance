import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { automaticDecisionFor, automaticDecisionsFor, automaticRefusalCause } from "./autoVerify";
import { VERIFICATION_STATES, type FactRecord } from "./types";
import { REASON_CODES } from "./decisions";

// ---------------------------------------------------------------------------
// CF-ANALYZER-AUTORUN-01 — the rule by which the software confirms a fact
// itself, pinned condition by condition.
//
// These are deliberately unit tests over a constructed fact rather than over a
// real run: the point is to reach every refusal branch, and neither committed
// capture produces an AI-EXTRACTED or SECONDARY queued fact today. The real
// runs are proved separately, end to end, in
// automaticAnalysisOnRealRun.test.ts — this file is about the rule, that one
// is about the product.
// ---------------------------------------------------------------------------

function fact(over: Partial<FactRecord> = {}): FactRecord {
  return {
    id: "some-fact",
    name: "Some fact",
    type: "FACT",
    value: new Decimal(1),
    source: "FY2026 Form 10-K",
    sourceUrl: null,
    sourceClass: "PRIMARY",
    extractionType: "DETERMINISTIC/STRUCTURED",
    verificationState: "SPOT-CHECK PENDING",
    asOfDate: "FY2026",
    retrievalTimestamp: "2026-09-04T21:04:00-04:00",
    supersedesFactId: null,
    tagMappingVersion: null,
    derivedFrom: null,
    verificationOrigin: null,
    verificationReasonCode: null,
    ...over,
  };
}

const NO_FAILURES = new Set<string>();

describe("what the software will confirm on its own", () => {
  it("confirms a PRIMARY, deterministically acquired figure with its provenance intact and no failing cross-check", () => {
    const d = automaticDecisionFor(fact(), NO_FAILURES);
    expect(d).toEqual({
      factId: "some-fact",
      decision: "CONFIRMED",
      reasonCode: null,
      cause: null,
    });
  });

  it("produces only §3.8.3's two decisions — it invents no third", () => {
    const cases: FactRecord[] = [
      fact(),
      fact({ value: null }),
      fact({ extractionType: "AI-EXTRACTED" }),
      fact({ sourceClass: "SECONDARY" }),
      fact({ source: "  " }),
    ];
    for (const f of cases) {
      const d = automaticDecisionFor(f, NO_FAILURES);
      expect(["CONFIRMED", "NOT CONFIRMED"]).toContain(d.decision);
      // And every decision it takes maps onto a value criterion A24 already
      // fixes — no fifth verification state is reachable from here.
      expect(VERIFICATION_STATES as readonly string[]).toContain(d.decision);
    }
  });
});

describe("what the software refuses to confirm, and why", () => {
  // §3.8.2: a failed cross-check "never corrects the figure" and forces the
  // fact into the queue whatever its acquisition path. It is positive evidence
  // against the figure, so it is unconditional and it comes first.
  it("refuses a fact whose §3.8.2 cross-check failed, however clean the rest of the record is", () => {
    const d = automaticDecisionFor(fact(), new Set(["some-fact"]));
    expect(d.decision).toBe("NOT CONFIRMED");
    expect(d.cause).toBe("CROSS-CHECK FAILED");
    expect(d.reasonCode).toBe("CONTRADICTED BY SOURCE");
  });

  // §5.1 — nothing is estimated, carried forward or interpolated. A fact with
  // no value has nothing to confirm.
  it("refuses a fact with no value", () => {
    const d = automaticDecisionFor(fact({ value: null }), NO_FAILURES);
    expect(d.decision).toBe("NOT CONFIRMED");
    expect(d.cause).toBe("NO VALUE");
    expect(d.reasonCode).toBe("NOT LOCATED");
  });

  it("refuses a fact whose §3.2 provenance is not there to check it against", () => {
    expect(automaticRefusalCause(fact({ source: "" }), NO_FAILURES)).toBe("PROVENANCE INCOMPLETE");
    expect(automaticRefusalCause(fact({ source: "   " }), NO_FAILURES)).toBe(
      "PROVENANCE INCOMPLETE"
    );
    expect(automaticRefusalCause(fact({ asOfDate: "" }), NO_FAILURES)).toBe(
      "PROVENANCE INCOMPLETE"
    );
  });

  // §3.2 admits a null retrieval timestamp "where genuinely not applicable",
  // so requiring one would refuse facts the contract itself permits.
  it("does not refuse a fact merely for carrying no retrieval timestamp", () => {
    expect(automaticRefusalCause(fact({ retrievalTimestamp: null }), NO_FAILURES)).toBeNull();
  });

  // §3.8.1: "What remains in the queue is the AI-extracted set — which is
  // where all four recorded errors occurred." This is the one class the
  // software must not clear on its own say-so, and it is the reason this
  // outcome cannot be described as removing verification.
  it("refuses an AI-EXTRACTED figure — the population the queue exists for", () => {
    const d = automaticDecisionFor(fact({ extractionType: "AI-EXTRACTED" }), NO_FAILURES);
    expect(d.decision).toBe("NOT CONFIRMED");
    expect(d.cause).toBe("AI-EXTRACTED");
    expect(d.reasonCode).toBe("NOT LOCATED");
  });

  it("refuses a SECONDARY figure — no deterministic route back to a primary document", () => {
    const d = automaticDecisionFor(fact({ sourceClass: "SECONDARY" }), NO_FAILURES);
    expect(d.decision).toBe("NOT CONFIRMED");
    expect(d.cause).toBe("SECONDARY SOURCE");
    expect(d.reasonCode).toBe("NOT LOCATED");
  });

  // §3.2.1 — source class and extraction type are orthogonal and must not be
  // collapsed. A PRIMARY fact a model read is still refused.
  it("refuses a PRIMARY fact that is AI-EXTRACTED, keeping the two fields apart", () => {
    const d = automaticDecisionFor(
      fact({ sourceClass: "PRIMARY", extractionType: "AI-EXTRACTED" }),
      NO_FAILURES
    );
    expect(d.decision).toBe("NOT CONFIRMED");
    expect(d.cause).toBe("AI-EXTRACTED");
  });

  // Criterion A22 — a fixed two-option select, no free text, no third option.
  it("never emits a reason code outside §3.8.4's fixed pair, and never one on a confirmation", () => {
    const cases: FactRecord[] = [
      fact(),
      fact({ value: null }),
      fact({ source: "" }),
      fact({ extractionType: "AI-EXTRACTED" }),
      fact({ sourceClass: "SECONDARY" }),
    ];
    for (const f of cases) {
      const d = automaticDecisionFor(f, NO_FAILURES);
      if (d.decision === "CONFIRMED") {
        expect(d.reasonCode).toBeNull();
      } else {
        expect(REASON_CODES).toContain(d.reasonCode!);
      }
    }
    const failed = automaticDecisionFor(fact(), new Set(["some-fact"]));
    expect(REASON_CODES).toContain(failed.reasonCode!);
  });

  // The order matters for what the analyst is told, so it is pinned: a fact
  // that is both cross-check-failed and AI-extracted reports the cross-check
  // failure, which is the condition worth acting on.
  it("reports the cross-check failure first where more than one condition applies", () => {
    const d = automaticDecisionFor(
      fact({ extractionType: "AI-EXTRACTED", value: null }),
      new Set(["some-fact"])
    );
    expect(d.cause).toBe("CROSS-CHECK FAILED");
  });
});

describe("which facts the automatic pass answers at all", () => {
  const queued = fact({ id: "queued-one", tagMappingVersion: null });
  const exempt = fact({ id: "tag-mapped", tagMappingVersion: "calboard-secmap-2026-09-1" });

  it("answers the queue and nothing else — an exempt fact is never given a decision", () => {
    const decisions = automaticDecisionsFor([queued, exempt], new Set(), NO_FAILURES);
    expect(decisions.map((d) => d.factId)).toEqual(["queued-one"]);
  });

  // The property that makes it safe to run on every load, and the property
  // that keeps an analyst's own work: a decided fact is left alone.
  it("skips a fact that already carries a decision, whoever took it", () => {
    expect(
      automaticDecisionsFor([queued, exempt], new Set(["queued-one"]), NO_FAILURES)
    ).toEqual([]);
  });

  it("answers a tag-mapped fact once a cross-check has failed on it — §3.8.2 outranks the exemption", () => {
    const decisions = automaticDecisionsFor([queued, exempt], new Set(), new Set(["tag-mapped"]));
    expect(decisions.map((d) => d.factId).sort()).toEqual(["queued-one", "tag-mapped"]);
    expect(decisions.find((d) => d.factId === "tag-mapped")!.decision).toBe("NOT CONFIRMED");
  });
});
