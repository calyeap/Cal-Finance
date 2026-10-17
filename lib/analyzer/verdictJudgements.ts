import type { UncertaintyLevel, V1Zone } from "./verdictSynthesisV1";

// ---------------------------------------------------------------------------
// CF-AR5-VERDICT-CONSOLIDATION-01 — Calvin's verdict judgements as dated,
// versioned inputs (Methodology v2.1 D3/D4; frozen spec §14.9 AR0-5).
//
// Each answer is a row (migration 013): never edited, never deleted. The
// latest row for a key is the one in force, and it carries its own date and
// version. "Not sure" is a real answer that is stored as such. It is never
// read as agreement and never yields a verdict (verdict.ts).
//
// Scope of each answer:
// - company-wide (latest wins): the uncertainty level, the thesis state, the
//   management rating, the moat mechanism and the five process items;
// - the close call: bound to the exact run inputs it answered
//   (`runIdentity.inputsFingerprint`), because a close call is about one
//   set of numbers and must not carry to a different price or sheet.
//
// The moat class itself is not here: D2 puts it in the assumption sheet,
// and the verdict reads it from there (`valuationBasis.d2.moatClass`).
// ---------------------------------------------------------------------------

export const NOT_SURE = "not sure" as const;
export type NotSure = typeof NOT_SURE;

export const VERDICT_JUDGEMENT_KEYS = [
  "UNCERTAINTY LEVEL",
  "CLOSE CALL",
  "THESIS STATE",
  "MANAGEMENT RATING",
  "MOAT MECHANISM",
  "PROCESS ITEMS",
] as const;
export type VerdictJudgementKey = (typeof VERDICT_JUDGEMENT_KEYS)[number];

export type ThesisState = "intact" | "broken";
export type ManagementRating = "not poor" | "poor";

/** The five items Methodology requires before a new BUY ("Required process before a new BUY"). */
export const PROCESS_ITEMS = [
  { key: "thesis", label: "Written investment thesis" },
  { key: "valuation", label: "Valuation / expected-return assessment" },
  { key: "keyRisks", label: "Key risks" },
  { key: "invalidation", label: "Thesis invalidation criteria" },
  { key: "bearCase", label: "Strongest bear case" },
] as const;
export type ProcessItemKey = (typeof PROCESS_ITEMS)[number]["key"];
export type ProcessItems = Record<ProcessItemKey, string>;

export interface Recorded<T> {
  answer: T | NotSure;
  /** Calvin's own words where the key takes them (evidence, mechanism, reason). */
  note: string | null;
  recordedAt: string;
  /** 1 for the first answer to this key, then 2, 3, … */
  version: number;
}

export interface VerdictJudgements {
  uncertainty: Recorded<UncertaintyLevel> | null;
  /** The latest close-call answer for each set of run inputs it was bound to. */
  closeCalls: (Recorded<V1Zone> & { boundTo: string })[];
  thesis: Recorded<ThesisState> | null;
  management: Recorded<ManagementRating> | null;
  /** `note` is the cited mechanism. */
  moatMechanism: Recorded<"cited"> | null;
  /** The five texts are carried in `items`; all five non-empty for "adopted". */
  processItems: (Recorded<"adopted"> & { items: ProcessItems | null }) | null;
}

export const NO_VERDICT_JUDGEMENTS: VerdictJudgements = {
  uncertainty: null,
  closeCalls: [],
  thesis: null,
  management: null,
  moatMechanism: null,
  processItems: null,
};

/** The answers each key accepts, "not sure" included. */
export const ALLOWED_ANSWERS: Record<VerdictJudgementKey, readonly string[]> = {
  "UNCERTAINTY LEVEL": ["Low", "Medium", "High", NOT_SURE],
  "CLOSE CALL": ["BUY", "HOLD", "SELL", NOT_SURE],
  "THESIS STATE": ["intact", "broken", NOT_SURE],
  "MANAGEMENT RATING": ["not poor", "poor", NOT_SURE],
  "MOAT MECHANISM": ["cited", NOT_SURE],
  "PROCESS ITEMS": ["adopted", NOT_SURE],
};

export interface VerdictJudgementInput {
  key: VerdictJudgementKey;
  answer: string;
  note: string | null;
  items: ProcessItems | null;
  boundTo: string | null;
}

/**
 * Why this answer cannot be recorded, or null when it can. The rules a stored
 * row must satisfy, checked before it is written: a cited mechanism needs its
 * words, adopted process items need all five texts, a close call needs the
 * run inputs it answers.
 */
export function judgementInputProblem(input: VerdictJudgementInput): string | null {
  if (!ALLOWED_ANSWERS[input.key].includes(input.answer)) {
    return `${input.key} accepts ${ALLOWED_ANSWERS[input.key].join(" / ")}, not "${input.answer}"`;
  }
  if (input.key === "MOAT MECHANISM" && input.answer === "cited" && (input.note ?? "").trim() === "") {
    return "a cited moat mechanism needs the mechanism written down";
  }
  if (input.key === "PROCESS ITEMS" && input.answer === "adopted") {
    const missing = PROCESS_ITEMS.filter((p) => (input.items?.[p.key] ?? "").trim() === "").map((p) => p.label);
    if (missing.length > 0) return `adopting the process items needs all five written: missing ${missing.join(", ")}`;
  }
  if (input.key === "CLOSE CALL" && (input.boundTo ?? "").trim() === "") {
    return "a close-call answer must be bound to the run inputs it answers";
  }
  return null;
}
