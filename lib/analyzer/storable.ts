import Decimal from "decimal.js";

// The Decimal-preserving JSON tagging analyzer_run_snapshots (migration 004)
// introduced, moved here from snapshotStore.ts so code with no database access
// can use it too.

const DECIMAL_TAG = "__decimal__";

/**
 * AnalysisResult carries Decimal instances throughout (facts, gates,
 * scenarios, fairValueRange, ...). JSON.stringify would call Decimal's own
 * toJSON() and flatten them to plain strings before any replacer sees them,
 * which is indistinguishable on the way back from a string that was always a
 * string. Tagging first, in a walk that runs before JSON.stringify touches
 * the tree, is what makes the round trip exact rather than merely plausible.
 */
/**
 * Exported for `acquisition/aiProposedBundleSnapshot.ts` (A5,
 * CF-ANALYZER-INTEGRITY-PHASE-A-01) — the identical round-trip problem
 * (a Decimal-heavy tree that must survive a JSONB column exactly), reusing
 * this one tagging scheme rather than inventing a second.
 */
export function toStorable(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Decimal) return { [DECIMAL_TAG]: value.toString() };
  if (Array.isArray(value)) return value.map(toStorable);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = toStorable(v);
    }
    return out;
  }
  return value;
}

/** Exported alongside `toStorable` — see its own comment. */
export function fromStorable(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(fromStorable);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record[DECIMAL_TAG] === "string") {
      return new Decimal(record[DECIMAL_TAG] as string);
    }
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(record)) {
      out[key] = fromStorable(v);
    }
    return out;
  }
  return value;
}

