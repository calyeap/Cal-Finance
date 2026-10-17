import type { MoatClass } from "./types";
import type { RoicFloorResult } from "./roicFloor";
import { NOT_SURE, type VerdictJudgements } from "./verdictJudgements";

// ---------------------------------------------------------------------------
// CF-AR5-VERDICT-CONSOLIDATION-01 — Methodology v2.1 D4, the minimum
// business-quality bar Verdict synthesis policy v1 requires for a BUY
// (product-decisions item 29):
//   1. the five required process items;
//   2. computed floor: 5-yr average ROIC including goodwill above the rate;
//   3. at least a narrow moat, its mechanism cited (JUDGEMENT);
//   4. management Calvin does not rate "poor" (JUDGEMENT).
//
// Three outcomes:
// - PASS: every item is met. A BUY may issue.
// - FAIL: an item is definitively not met — no moat, the floor not met, or
//   management rated poor. Policy v1: "If valuation reaches a BUY band but the
//   minimum quality bar does not pass, the verdict is HOLD". Cheap without a
//   moat is HOLD or SELL, never BUY.
// - OPEN: nothing has failed, but something is unanswered, "not sure" or not
//   computable. The result stays "BUY candidate" — never a manufactured HOLD
//   and never a BUY.
//
// The bar is checked only for a BUY. It adds no score: each item is read as
// met / not met / open, exactly as D4 states it.
// ---------------------------------------------------------------------------

export interface QualityBarInput {
  /** The adopted sheet's moat class (D2), or null where the sheet carries none. */
  moatClass: MoatClass | null;
  roicFloor: RoicFloorResult | null;
  judgements: VerdictJudgements;
}

export interface QualityBarResult {
  status: "PASS" | "FAIL" | "OPEN";
  /** Items definitively not met, in plain words. */
  failed: string[];
  /** Items still waiting for an answer or a figure, in plain words. */
  open: string[];
  /** Items met, in plain words. */
  met: string[];
}

export function evaluateQualityBar(input: QualityBarInput): QualityBarResult {
  const failed: string[] = [];
  const open: string[] = [];
  const met: string[] = [];
  const j = input.judgements;

  // 1 — the five process items.
  if (j.processItems === null) open.push("the five process items (thesis, valuation, key risks, invalidation criteria, strongest bear case) are not adopted yet");
  else if (j.processItems.answer === NOT_SURE) open.push("you answered \"not sure\" on the five process items");
  else met.push("the five process items are adopted");

  // 2 — the computed floor.
  if (input.roicFloor === null) open.push("the five-year return-on-capital floor is not computed on this run");
  else if (input.roicFloor.status === "PASS") met.push(input.roicFloor.reason);
  else if (input.roicFloor.status === "FAIL") failed.push(input.roicFloor.reason);
  else open.push(`the five-year return-on-capital floor cannot be computed: ${input.roicFloor.reason}`);

  // 3 — at least a narrow moat, its mechanism cited.
  if (input.moatClass === "none") failed.push("the adopted sheet rates the moat as none — a BUY needs at least a narrow moat");
  else if (input.moatClass === null) open.push("the assumption sheet carries no moat class");
  else if (j.moatMechanism === null) open.push(`the ${input.moatClass} moat's mechanism is not cited yet`);
  else if (j.moatMechanism.answer === NOT_SURE) open.push("you answered \"not sure\" on the moat mechanism");
  else met.push(`${input.moatClass} moat, mechanism cited`);

  // 4 — management not rated poor.
  if (j.management === null) open.push("management is not rated yet");
  else if (j.management.answer === NOT_SURE) open.push("you answered \"not sure\" on management");
  else if (j.management.answer === "poor") failed.push("you rate management poor");
  else met.push("management is not rated poor");

  const status = failed.length > 0 ? "FAIL" : open.length > 0 ? "OPEN" : "PASS";
  return { status, failed, open, met };
}
