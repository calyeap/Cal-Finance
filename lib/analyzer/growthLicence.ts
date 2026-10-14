import type Decimal from "decimal.js";
import type { DiscountRate, Figure, GrowthLicenceResult, RonicLadderState } from "./types";

// ---------------------------------------------------------------------------
// CF-M8-VERDICT-ENGINEERING-UNBLOCK-01 — §10.6.2 Step 2 ("growth licence"),
// per `CALVIN RULING — C` (docs/verdict-methodology-reconciliation.md §9/§10):
//
//   "GROWTH LICENCE — determine whether going-forward / incremental returns
//   on new capital economically exceed their cost. If YES, growth-inclusive
//   value may count. If NO, use a conservative / no-growth value. If
//   UNKNOWN, compute both."
//
// This reads only two already-approved, already-computed facts: the RONIC
// ladder M5 already classifies per rate-grid cell
// (`reinvestmentRonic.ts:computeRonicLadder`) and the rate grid itself
// (`POLICY.rateGrid`, §7.1, not PROVISIONAL). It introduces no new threshold,
// band or cell choice of its own — §11 item 4 of the reconciliation doc
// (which single cell, or combination, governs Step 2) stays open, and this
// function deliberately never answers it: it reports YES/NO only where
// EVERY cell in the already-approved grid agrees, so the answer does not
// depend on which cell item 4 eventually rules should govern. Where the
// cells disagree (RONIC straddles the grid) or the ladder cannot be read at
// all (RONIC NOT MEANINGFUL, or the ladder's own REQUIRED inputs are
// missing), this returns UNKNOWN with the precise cause — never a default
// NO and never an invented tie-break.
// ---------------------------------------------------------------------------

type RonicCell = { rate: DiscountRate; state: RonicLadderState; value: Decimal | null };

const LICENSED_STATES: RonicLadderState[] = ["CLEAN", "RONIC CAPPED AT 200%"];
const UNLICENSED_STATES: RonicLadderState[] = ["LOW RONIC — VALUE-DESTROYING GROWTH"];

function formatRate(rate: DiscountRate): string {
  return `${(rate * 100).toFixed(0)}%`;
}

function formatPercent(value: Decimal | null): string {
  return value === null ? "unknown" : `${value.mul(100).toDecimalPlaces(4).toString()}%`;
}

export function evaluateGrowthLicence(ronic: Figure<{ cells: RonicCell[] }>): GrowthLicenceResult {
  if (ronic.suppressed) {
    return {
      status: "UNKNOWN",
      reason:
        `Step 2 (§10.6.2) cannot read a growth licence — the RONIC ladder itself is unavailable: ${ronic.cause}.`,
    };
  }

  const cells = ronic.value.cells;
  const rateGridText = cells.map((c) => formatRate(c.rate)).join("/");

  if (cells.length === 0) {
    return {
      status: "UNKNOWN",
      reason: "Step 2 (§10.6.2) cannot read a growth licence — the RONIC ladder has no rate-grid cells.",
    };
  }

  if (cells.every((c) => c.state === "RONIC NOT MEANINGFUL")) {
    return {
      status: "UNKNOWN",
      reason:
        "Step 2 (§10.6.2) reads RONIC NOT MEANINGFUL on every cell of the approved rate grid (§7.2 M5 ladder) — " +
        "the trailing five-year return on new capital cannot be computed at all, so no rate-grid comparison is " +
        "possible. Whether an uncomputable ladder counts as Step 2 UNKNOWN or should instead fail Step 1 is an " +
        "open house-policy decision (§11 item 2, docs/verdict-methodology-reconciliation.md); this function takes " +
        "neither side and reports UNKNOWN either way.",
    };
  }

  if (cells.every((c) => LICENSED_STATES.includes(c.state))) {
    const sample = cells.find((c) => c.value !== null)?.value ?? null;
    return {
      status: "YES",
      reason:
        `Step 2 (§10.6.2): RONIC (${formatPercent(sample)}) exceeds every rate in the approved §7.1 rate grid ` +
        `(${rateGridText}) — all ${cells.length} cells agree, so the growth-inclusive value may be underwritten ` +
        "at Step 3.",
    };
  }

  if (cells.every((c) => UNLICENSED_STATES.includes(c.state))) {
    const sample = cells.find((c) => c.value !== null)?.value ?? null;
    return {
      status: "NO",
      reason:
        `Step 2 (§10.6.2): RONIC (${formatPercent(sample)}) is below every rate in the approved §7.1 rate grid ` +
        `(${rateGridText}) — all ${cells.length} cells agree, so growth is not licensed; only the conservative / ` +
        "no-growth value may be underwritten at Step 3.",
    };
  }

  return {
    status: "UNKNOWN",
    reason:
      `Step 2 (§10.6.2): the rate-grid cells (${rateGridText}) disagree — RONIC straddles the approved grid or ` +
      "mixes ladder states, so no single reading is unequivocal across every cell. Choosing one governing cell " +
      "(or a combination) is an open house-policy decision (§11 item 4, docs/verdict-methodology-reconciliation.md); " +
      "this function does not pick one and reports UNKNOWN.",
  };
}
