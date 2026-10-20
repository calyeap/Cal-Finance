import Decimal from "decimal.js";
import type { AnalysisResult } from "./types";
import { PROFILE_NOT_CONFIRMED_DETAIL } from "./trust";
import { formatRate } from "./discountRate";
import {
  CHECK_RATES,
  UNCERTAINTY_LEVELS,
  evaluateVerdictCheck,
  type CheckRate,
  type V1Zone,
  type VerdictCheck,
} from "./verdictSynthesisV1";
import { evaluateQualityBar, type QualityBarResult } from "./qualityBar";
import { NOT_SURE, NO_VERDICT_JUDGEMENTS, type Recorded } from "./verdictJudgements";

// ---------------------------------------------------------------------------
// CF-AR5-VERDICT-CONSOLIDATION-01 — the one verdict path (Methodology v2.1
// D3/D4 on Verdict synthesis policy v1; product-decisions items 1, 3, 28, 29;
// frozen spec §14.9 AR0-4, AR0-5).
//
// In order:
//   1. global prerequisite — trust, a usable range, a confirmed profile and a
//      price, for every cause adoption would not clear. A Base that cannot
//      be formed is "can't bound value"; anything else missing is
//      INCOMPLETE. Never a HOLD;
//   2. pending adoption — the final verdict waits for the sheet's adoption
//      (product-decisions item 30; Calvin, Option A on #447); then a
//      positive Base;
//   3. thesis broken → SELL (policy v1's independent SELL condition);
//   4. the nine-point check (verdictSynthesisV1.ts): automatic, one
//      uncertainty question, or a close call, resolved by Calvin's recorded
//      answer where one exists — "not sure" resolves nothing;
//   5. a BUY zone needs D4's bar (qualityBar.ts): PASS → BUY, FAIL → HOLD,
//      OPEN → "BUY candidate — needs your quality call".
//
// Pending-judgement states (adoption, the question, the close call, the BUY
// candidate) are not verdicts (AR0-4): their status is PENDING, never
// BUY/HOLD/SELL. Every `reason` is a template filled from computed numbers
// and recorded answers; no AI text reaches it.
//
// The same result — facts, adopted sheet, policy, code and recorded
// judgements (AR0-5) — always gives the same verdict: this is a pure function
// of the stored result, which carries the judgements it was computed with.
// ---------------------------------------------------------------------------

export type VerdictStatus = "BUY" | "HOLD" | "SELL" | "INCOMPLETE" | "PENDING";

export type VerdictState =
  | "ISSUED"
  | "INCOMPLETE"
  | "CANNOT BOUND VALUE"
  | "PENDING ADOPTION"
  | "UNCERTAINTY QUESTION"
  | "CLOSE CALL"
  | "BUY CANDIDATE";

/** How an issued verdict was reached. */
export type VerdictBasis = "ALL NINE CHECKS AGREE" | "YOUR UNCERTAINTY ANSWER" | "YOUR CLOSE CALL" | "THESIS BROKEN";

export const BUY_CANDIDATE_LABEL = "BUY candidate — needs your quality call";

export interface VerdictResult {
  status: VerdictStatus;
  state: VerdictState;
  reason: string;
  /** The nine-point check, wherever it was computed. */
  check: VerdictCheck | null;
  /** The rates the check used, wherever it was computed. */
  rates: Record<CheckRate, Decimal> | null;
  basis: VerdictBasis | null;
  /** D4's bar, wherever a BUY zone made it relevant. */
  qualityBar: QualityBarResult | null;
  /** The inputs fingerprint a close-call answer must be bound to; null where the result carries none. */
  closeCallBinding: string | null;
  /**
   * CF-AR6-ANY-TICKER-DRAFTS-01 — on a DRAFT sheet (PENDING ADOPTION), the
   * zone the draft's valuation points to: "BUY", "HOLD", "SELL", or the
   * zones a judgement after adoption would choose between. Not a verdict
   * (product-decisions item 30). Absent otherwise.
   */
  draftZone?: string | null;
  /**
   * CF-METHODOLOGY-V3-IMPLEMENT-01 — Methodology v3 D5: on a BUY (issued or
   * candidate) that the same check would not give with Base growth flat at
   * the drafted rate from year 1, the label saying so. A label, not a
   * different verdict. Absent otherwise.
   */
  rampDependent?: string | null;
}

export const RAMP_DEPENDENT_LABEL = "Ramp-dependent";

/** A verdict as a saved version records it (snapshotStore.ts). */
export type StoredVerdict = Pick<VerdictResult, "status" | "state" | "reason">;

const EMPTY = { check: null, rates: null, basis: null, qualityBar: null, closeCallBinding: null } as const;

function incomplete(reason: string, state: "INCOMPLETE" | "CANNOT BOUND VALUE" = "INCOMPLETE"): VerdictResult {
  return { status: "INCOMPLETE", state, reason, ...EMPTY };
}

function money(value: Decimal): string {
  return `$${value.toDecimalPlaces(2).toFixed(2)}`;
}

function times(value: Decimal): string {
  return `${value.toDecimalPlaces(2).toFixed(2)}×`;
}

function dated<T>(r: Recorded<T>): string {
  return `recorded ${r.recordedAt.slice(0, 10)}, version ${r.version}`;
}

/** "price $499.70 is 1.62× / 1.76× / 1.93× Base $308.52 / $283.31 / $259.36 at 8.5% / 9.0% / 9.5%" */
function checkLine(price: Decimal, check: VerdictCheck, baseAt: Record<CheckRate, Decimal>, rates: Record<CheckRate, Decimal>): string {
  const list = <T>(f: (r: CheckRate) => T) => CHECK_RATES.map(f).join(" / ");
  return (
    `price ${money(price)} is ${list((r) => times(check.ratios[r]))} the Base fair value ` +
    `${list((r) => money(baseAt[r]))} at ${list((r) => formatRate(rates[r]))}`
  );
}

function gridLine(check: VerdictCheck, rates: Record<CheckRate, Decimal>): string {
  return CHECK_RATES.map(
    (r) => `at ${formatRate(rates[r])}: ${UNCERTAINTY_LEVELS.map((u) => `${u} ${check.grid[r][u]}`).join(", ")}`
  ).join("; ");
}

/**
 * The one verdict path. CF-AR6-ANY-TICKER-DRAFTS-01 (product-decisions item
 * 30, D5): a sheet that could not be drafted from history can't bound value
 * (deriveVerdictOnSheet, after any upstream cause); a complete DRAFT sheet is valued and its zone computed exactly as an
 * adopted one, and the result is still PENDING ADOPTION — the final verdict
 * waits for one adopt.
 */
export function deriveVerdict(result: AnalysisResult): VerdictResult {
  const verdict = deriveVerdictOnSheet(result);
  const d2 = result.valuationBasis?.d2;
  if (d2 === undefined || d2.status !== "DRAFT" || verdict.status === "INCOMPLETE") return verdict;
  const zone =
    verdict.state === "ISSUED"
      ? verdict.status
      : verdict.state === "BUY CANDIDATE"
        ? "BUY"
        : verdict.check?.routing.kind === "UNCERTAINTY QUESTION"
          ? [...new Set(UNCERTAINTY_LEVELS.map((u) => (verdict.check!.routing as { byLevel: Record<string, V1Zone> }).byLevel[u]))].join(" or ")
          : verdict.check?.routing.kind === "CLOSE CALL"
            ? verdict.check.routing.zones.join(" or ")
            : null;
  return {
    status: "PENDING",
    state: "PENDING ADOPTION",
    reason:
      `Pending adoption — ${d2.statement} On the draft, the verdict zone is ${zone ?? "not settled"}; ` +
      `the final verdict issues when you adopt the sheet. The draft's own reading: ${verdict.reason}`,
    check: verdict.check,
    rates: verdict.rates,
    basis: null,
    qualityBar: null,
    closeCallBinding: null,
    draftZone: zone,
  };
}

function deriveVerdictOnSheet(result: AnalysisResult): VerdictResult {
  const judgements = result.verdictJudgements ?? NO_VERDICT_JUDGEMENTS;
  const d2 = result.valuationBasis?.d2;

  // A cause the un-adopted sheet itself produced (no D2 value is computed
  // from it) is not an independent blocker: adoption is the remedy, and the
  // state says so. Every other cause is reported first, since adopting the
  // sheet would not clear it.
  const pendingAdoption = d2 !== undefined && d2.status === "PENDING ADOPTION";
  const causedByAdoption = (text: string): boolean => pendingAdoption && text.includes("Pending adoption:");

  // 1 — the global prerequisite, for causes adoption would not clear.
  const range = result.fairValueRange;
  const trustDetail = result.trust.determinedBy[0]?.detail ?? "the fair-value range is not usable";
  if (result.trust.status === "UNUSABLE" && !causedByAdoption(trustDetail)) {
    return incomplete(`Can't bound value — decision-critical analysis is incomplete: ${trustDetail}`, "CANNOT BOUND VALUE");
  }
  if (range.kind === "suppressed" && !causedByAdoption(range.cause)) {
    return incomplete(`Can't bound value — no defensible Base fair value can be formed: ${range.cause}`, "CANNOT BOUND VALUE");
  }
  if (range.kind === "pre-revenue-distribution") {
    return incomplete("The pre-revenue valuation model does not yet define a BUY / HOLD / SELL boundary.");
  }
  // §10.6.3's PROFILE NOT CONFIRMED, read from trust.ts's own qualifying-flag
  // entry (AnalysisResult carries no separate field for it).
  if (result.trust.determinedBy.some((d) => d.kind === "qualifying flag" && d.detail === PROFILE_NOT_CONFIRMED_DETAIL)) {
    return incomplete(
      "Decision-critical analysis is incomplete — PROFILE NOT CONFIRMED is active on the valuation path " +
        "(spec §10.6.3): no verdict renders until a human confirms the profile."
    );
  }
  // §3.4 — the empty timestamp is the run's own "no price" signal, never a zero price.
  if (result.price.timestamp === "") {
    return incomplete("Decision-critical analysis is incomplete — no price was available for this run, so price / Base cannot be formed.");
  }

  // A sheet no draft could be made for (e.g. pre-revenue) values nothing;
  // adopting it would not change that.
  const sheet = result.valuationBasis?.sheet ?? null;
  if (sheet != null && sheet.cannotConclude !== null) {
    return incomplete(`Can't bound value — can't conclude: ${sheet.cannotConclude}`, "CANNOT BOUND VALUE");
  }

  // 2 — the final verdict waits for adoption.
  if (pendingAdoption) {
    return { status: "PENDING", state: "PENDING ADOPTION", reason: `Pending adoption — ${d2.statement}`, ...EMPTY };
  }

  const base = result.scenarioOutputs.values.base;
  if (!base.isFinite() || base.lessThanOrEqualTo(0)) {
    return incomplete(`Can't bound value — the Base fair value (${base.toString()}) is not a positive, finite figure.`, "CANNOT BOUND VALUE");
  }

  const price = result.price.value;

  // 3 — thesis broken → SELL (policy v1's independent SELL condition).
  if (judgements.thesis !== null && judgements.thesis.answer === "broken") {
    return {
      status: "SELL",
      state: "ISSUED",
      reason:
        `SELL — you recorded the thesis as broken (${dated(judgements.thesis)}). A fully invalidated thesis produces SELL ` +
        `(Verdict synthesis policy v1); price ${money(price)} against the Base fair value ${money(base)} does not change it.`,
      ...EMPTY,
      basis: "THESIS BROKEN",
    };
  }

  // 4 — the nine-point check.
  const discountRate = result.valuationBasis?.discountRate;
  const inputs = result.verdictInputs;
  if (discountRate === undefined || inputs === undefined) {
    return incomplete("Decision-critical analysis is incomplete — this result was stored before the nine-point verdict check existed; re-run it.");
  }
  if (inputs.baseAtCheckRates === null) {
    return incomplete(
      `Decision-critical analysis is incomplete — the Base fair value cannot be revalued at ${formatRate(discountRate.checkRates.lower)} ` +
        `and ${formatRate(discountRate.checkRates.upper)} for the ±0.5pp check: ${inputs.baseAtCheckRatesCause ?? "no cause recorded"}.`
    );
  }
  const baseAt = inputs.baseAtCheckRates;
  const unbounded = CHECK_RATES.find((r) => !baseAt[r].isFinite() || baseAt[r].lessThanOrEqualTo(0));
  if (unbounded !== undefined) {
    return incomplete(`Can't bound value — the Base fair value at the ${unbounded} check rate is not a positive, finite figure.`, "CANNOT BOUND VALUE");
  }

  const rates: Record<CheckRate, Decimal> = {
    lower: discountRate.checkRates.lower,
    rate: discountRate.rate,
    upper: discountRate.checkRates.upper,
  };
  const check = evaluateVerdictCheck({ price, baseAt });
  const binding = result.runIdentity?.inputsFingerprint ?? null;
  const numbers = checkLine(price, check, baseAt, rates);
  const common = { check, rates, closeCallBinding: binding };

  const routing = check.routing;
  if (routing.kind === "AUTOMATIC") {
    return resolveZone(routing.zone, "ALL NINE CHECKS AGREE", `${numbers} — the ${routing.zone} band at all nine rate × uncertainty checks.`);
  }

  if (routing.kind === "UNCERTAINTY QUESTION") {
    const byLevel = UNCERTAINTY_LEVELS.map((u) => `${u} ${routing.byLevel[u]}`).join(", ");
    const answer = judgements.uncertainty;
    if (answer !== null && answer.answer !== NOT_SURE) {
      const zone = routing.byLevel[answer.answer];
      return resolveZone(
        zone,
        "YOUR UNCERTAINTY ANSWER",
        `${numbers}. The three rates agree; only the uncertainty level matters (${byLevel}). You set ${answer.answer} uncertainty (${dated(answer)}), so the ${zone} band.`
      );
    }
    const unsure = answer !== null ? ` You answered "not sure" (${dated(answer)}), which does not settle it.` : "";
    return {
      status: "PENDING",
      state: "UNCERTAINTY QUESTION",
      reason: `One question for you — ${numbers}. The three rates agree; only the uncertainty level matters: ${byLevel}.${unsure}`,
      ...EMPTY,
      ...common,
    };
  }

  const answer = binding === null ? undefined : judgements.closeCalls.find((c) => c.boundTo === binding);
  if (answer !== undefined && answer.answer !== NOT_SURE && routing.zones.includes(answer.answer)) {
    return resolveZone(
      answer.answer,
      "YOUR CLOSE CALL",
      `${numbers}. The rate-band ends disagree (${gridLine(check, rates)}). You made the close call: the ${answer.answer} band (${dated(answer)}).`
    );
  }
  const unsure = answer !== undefined && answer.answer === NOT_SURE ? ` You answered "not sure" (${dated(answer)}), which does not settle it.` : "";
  return {
    status: "PENDING",
    state: "CLOSE CALL",
    reason: `Close call for you — ${numbers}. The rate-band ends disagree: ${gridLine(check, rates)}.${unsure}`,
    ...EMPTY,
    ...common,
  };

  // v3 D5 — would the same reading give BUY with Base growth flat at the
  // drafted rate? Read the way the BUY itself was: all nine points for an
  // automatic BUY, the three rates at the recorded level for an uncertainty
  // answer, any point for a close call. Null where the growth ramp did not
  // move Base (no flat check is recorded).
  function rampDependence(basis: VerdictBasis): string | null {
    const flat = inputs?.flatGrowthBaseAtCheckRates ?? null;
    if (flat === null || flat === undefined) return null;
    const label = (detail: string) =>
      `${RAMP_DEPENDENT_LABEL}: with Base growth flat at the drafted rate from year 1, Base is ${CHECK_RATES.map((r) => money(flat[r])).join(" / ")} — ${detail}.`;
    if (CHECK_RATES.some((r) => !flat[r].isFinite() || flat[r].lessThanOrEqualTo(0))) return label("not a positive value at every check rate");
    const flatCheck = evaluateVerdictCheck({ price, baseAt: flat });
    const cells = CHECK_RATES.flatMap((r) => UNCERTAINTY_LEVELS.map((u) => flatCheck.grid[r][u]));
    const level = basis === "YOUR UNCERTAINTY ANSWER" ? judgements.uncertainty?.answer : undefined;
    const buys =
      basis === "ALL NINE CHECKS AGREE"
        ? cells.every((z) => z === "BUY")
        : level !== undefined && level !== NOT_SURE
          ? CHECK_RATES.every((r) => flatCheck.grid[r][level] === "BUY")
          : cells.includes("BUY");
    return buys ? null : label(`${checkLine(price, flatCheck, flat, rates)}, which is not BUY read the same way`);
  }

  // 5 — HOLD and SELL issue; a BUY zone needs D4's bar.
  function resolveZone(zone: V1Zone, basis: VerdictBasis, why: string): VerdictResult {
    if (zone !== "BUY") return { status: zone, state: "ISSUED", reason: `${zone} — ${why}`, ...EMPTY, ...common, basis };
    const ramp = rampDependence(basis);
    const rampText = ramp === null ? "" : ` ${ramp}`;
    const rampField = ramp === null ? {} : { rampDependent: ramp };
    const bar = evaluateQualityBar({
      moatClass: d2?.moatClass ?? null,
      roicFloor: inputs?.roicFloor ?? null,
      judgements,
    });
    if (bar.status === "PASS") {
      return {
        status: "BUY",
        state: "ISSUED",
        reason: `BUY — ${why} The quality bar passes: ${bar.met.join("; ")}.${rampText}`,
        ...EMPTY,
        ...common,
        basis,
        qualityBar: bar,
        ...rampField,
      };
    }
    if (bar.status === "FAIL") {
      return {
        status: "HOLD",
        state: "ISSUED",
        reason: `HOLD — ${why} Valuation reaches the BUY band, but the quality bar for BUY is not met: ${bar.failed.join("; ")}. Cheap without the bar is HOLD, never BUY.`,
        ...EMPTY,
        ...common,
        basis,
        qualityBar: bar,
      };
    }
    return {
      status: "PENDING",
      state: "BUY CANDIDATE",
      reason: `${BUY_CANDIDATE_LABEL} — ${why} Still open: ${bar.open.join("; ")}.${rampText}`,
      ...EMPTY,
      ...common,
      basis,
      qualityBar: bar,
      ...rampField,
    };
  }
}

/** True for BUY / HOLD / SELL — the only statuses that are a verdict (product-decisions item 1). */
export function isIssuedVerdict(verdict: VerdictResult): verdict is VerdictResult & { status: "BUY" | "HOLD" | "SELL" } {
  return verdict.state === "ISSUED";
}
