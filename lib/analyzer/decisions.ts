// The Step 2 and Step 6 decision vocabulary, with no server dependency.
//
// This is split out of runStore so client components can render the controls
// without importing the store — runStore reaches lib/db, and pulling `pg` into
// a client bundle fails the build. The vocabulary belongs to both sides of
// that boundary; the storage does not.
//
// The strings are the spec's own (§3.8.3, §3.8.4, §6.3), matching the CHECK
// constraints in 002_analyzer_runs.sql exactly, so no mapping layer exists
// between what the interface shows, what the server validates and what the
// database stores.

export type FactDecision = "CONFIRMED" | "NOT CONFIRMED";

export type ReasonCode = "CONTRADICTED BY SOURCE" | "NOT LOCATED";

/** §3.8.4 — a fixed two-option select. No free text, no third option, no "other". */
export const REASON_CODES: readonly ReasonCode[] = ["CONTRADICTED BY SOURCE", "NOT LOCATED"];

export type ProfileDecision = "CONFIRMED" | "OVERRIDDEN" | "CANNOT JUDGE";

export type JudgmentKey =
  | "ACCOUNTING-BASIS WINDOW"
  | "NON-OPERATING INVESTMENTS"
  | "MEDIAN-MARGIN NOPAT WINDOW";

/** §4.4 — three inputs labelled FACT that are judgments. R6 places them in Step 2. */
export const JUDGMENT_KEYS: readonly JudgmentKey[] = [
  "ACCOUNTING-BASIS WINDOW",
  "NON-OPERATING INVESTMENTS",
  "MEDIAN-MARGIN NOPAT WINDOW",
];

/**
 * WHO took a Step 2 decision — CF-ANALYZER-AUTORUN-01, on Calvin's ruling of
 * 22 September 2026 04:28:04Z.
 *
 * This is NOT a third decision and NOT a fifth verification state. §3.8.3's
 * two decisions are unchanged and criterion A24 still fixes the verification
 * state at four values; the origin travels beside the decision instead, which
 * is the shape the 8 September 2026 "record, do not amend" ruling established
 * for exactly this class of question.
 *
 * It exists so the record can never present an automatic confirmation as a
 * human one. Every surface that shows a decision shows this beside it.
 */
export type DecisionOrigin = "HUMAN" | "AUTOMATIC";

export interface StoredFactDecision {
  factId: string;
  decision: FactDecision;
  reasonCode: ReasonCode | null;
  origin: DecisionOrigin;
}

export interface StoredJudgment {
  judgmentKey: JudgmentKey;
  selection: string;
  reason: string | null;
}
