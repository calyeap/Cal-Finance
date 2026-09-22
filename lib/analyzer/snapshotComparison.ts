import Decimal from "decimal.js";
import { getSnapshot, type StoredSnapshot } from "./snapshotStore";

// ---------------------------------------------------------------------------
// CF-LOOP-UPDATE-01 — the UPDATE / what-changed half of the V2 product loop.
//
// A deterministic comparison over two of a run's own stored snapshots. It
// reads ONLY the two rows getSnapshot returns — never analysisForReport,
// computeAnalysisForRun, or any calculation module — for exactly the reason
// reopenDeepSnapshot does not: the defect class this outcome exists to rule
// out is a value produced one way and compared another.
//
// This function does not judge whether a move is material, good or
// actionable — that is finance policy and is not authorised here (HARD
// BOUNDS). It reports what moved, from what, to what, and what did not.
// deriveVerdict is not touched; the verdict's status and reason are simply
// two more fields that can appear in `changed` or `unchanged` like any
// other.
// ---------------------------------------------------------------------------

export interface SnapshotFieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface SnapshotComparison {
  runId: string;
  from: number;
  to: number;
  changed: SnapshotFieldChange[];
  unchanged: string[];
}

/**
 * The field classes SCOPE item 2 names, each read straight off a
 * StoredSnapshot with no derivation. A fixed array, not an object literal's
 * keys, so the output's field order is fixed by this list's own order —
 * never by whatever order a given run happens to enumerate object
 * properties in (DONE WHEN's determinism requirement).
 *
 * `fairValueRange` and `gates.leverage` are each read whole rather than
 * field-by-field: both are tagged unions (kind: "range" | "suppressed" | ...
 * and result: "PASS" | "LEVERAGE UNSUPPORTED IN v1") whose members carry
 * different fields, so "the range" or "the leverage test" moving from one
 * shape to another — a suppression appearing or clearing — is naturally one
 * reportable field change rather than a special case bolted on afterward.
 */
const FIELD_SPECS: { field: string; get: (s: StoredSnapshot) => unknown }[] = [
  { field: "verdict.status", get: (s) => s.verdict.status },
  { field: "verdict.reason", get: (s) => s.verdict.reason },
  { field: "price.value", get: (s) => s.result.price.value },
  { field: "fairValueRange", get: (s) => s.result.fairValueRange },
  { field: "scenarioOutputs.values", get: (s) => s.result.scenarioOutputs.values },
  { field: "scenarioOutputs.weightedDistribution", get: (s) => s.result.scenarioOutputs.weightedDistribution },
  { field: "scenarioOutputs.priceLocationWithinRange", get: (s) => s.result.scenarioOutputs.priceLocationWithinRange },
  { field: "scenarioOutputs.rateAtWhichBaseEqualsPrice", get: (s) => s.result.scenarioOutputs.rateAtWhichBaseEqualsPrice },
  { field: "gates.leverage", get: (s) => s.result.gates.leverage },
  { field: "trust.status", get: (s) => s.result.trust.status },
  { field: "trust.determinedBy", get: (s) => s.result.trust.determinedBy },
  { field: "states.qualifying", get: (s) => s.result.states.qualifying },
];

/**
 * Value equality by VALUE, not by reference or JSON string — a Decimal is
 * equal to another Decimal with the same numeric value regardless of object
 * identity (the single most likely defect this outcome exists to rule out,
 * per the issue's own RETRIEVE FIRST note on snapshotStore.ts's __decimal__
 * tag walk). Object key order never affects the result: both sides' key
 * sets are compared as sorted arrays, not walked in enumeration order.
 */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a instanceof Decimal || b instanceof Decimal) {
    return a instanceof Decimal && b instanceof Decimal && a.equals(b);
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => valuesEqual(v, b[i]));
  }
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a as object).sort();
    const bKeys = Object.keys(b as object).sort();
    if (aKeys.length !== bKeys.length || aKeys.some((k, i) => k !== bKeys[i])) return false;
    return aKeys.every((k) => valuesEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return Object.is(a, b);
}

/**
 * A JSON-safe rendering of a field's value for the comparison's own output —
 * Decimal instances become their decimal string, and every object's keys
 * are written in sorted order so two structurally-identical values always
 * serialize identically, whatever order their source object's properties
 * happened to be built in.
 */
function toComparable(value: unknown): unknown {
  if (value instanceof Decimal) return value.toString();
  if (Array.isArray(value)) return value.map(toComparable);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      out[key] = toComparable((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/**
 * Pure: a function of the two rows given and nothing else. Same two
 * StoredSnapshots in, byte-identical SnapshotComparison out, every time —
 * DONE WHEN's determinism requirement, satisfied by construction rather
 * than merely observed to hold.
 */
export function diffStoredSnapshots(a: StoredSnapshot, b: StoredSnapshot): SnapshotComparison {
  const changed: SnapshotFieldChange[] = [];
  const unchanged: string[] = [];

  for (const spec of FIELD_SPECS) {
    const va = spec.get(a);
    const vb = spec.get(b);
    if (valuesEqual(va, vb)) {
      unchanged.push(spec.field);
    } else {
      changed.push({ field: spec.field, from: toComparable(va), to: toComparable(vb) });
    }
  }

  return { runId: a.runId, from: a.version, to: b.version, changed, unchanged };
}

/**
 * Reads the run's two named versions and compares them. Returns null if
 * either version does not exist for this run — the same "no fallback to
 * another version" rule reopenDeepSnapshot already applies, rather than
 * comparing against whatever version happens to exist instead.
 */
export async function compareSnapshots(
  runId: string,
  versionA: number,
  versionB: number
): Promise<SnapshotComparison | null> {
  const [a, b] = await Promise.all([getSnapshot(runId, versionA), getSnapshot(runId, versionB)]);
  if (a === null || b === null) return null;

  return diffStoredSnapshots(a, b);
}
