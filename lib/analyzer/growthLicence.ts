import type Decimal from "decimal.js";
import type { Figure, GrowthLicenceResult, RonicLadderCell, RonicLadderState } from "./types";

// ---------------------------------------------------------------------------
// CF-M8-VERDICT-ENGINEERING-UNBLOCK-01 — §10.6.2 Step 2 ("growth licence"),
// per `CALVIN RULING — C` (docs/verdict-methodology-reconciliation.md §9/§10):
//
//   "GROWTH LICENCE — determine whether going-forward / incremental returns
//   on new capital economically exceed their cost. If YES, growth-inclusive
//   value may count. If NO, use a conservative / no-growth value. If
//   UNKNOWN, compute both."
//
// This reads only the RONIC ladder M5 already classifies
// (`reinvestmentRonic.ts:computeRonicLadder`). Since
// CF-AR4-RATE-REINVESTMENT-TERMINAL-01 retired the 8/10/12% grid (frozen spec
// §14.9 AR0-2), the ladder has one cell, at the run's D1 rate, so the open
// question of which grid cell governs Step 2 (§11 item 4 of the
// reconciliation doc) no longer arises. It introduces no threshold of its
// own: YES/NO only where every ladder cell agrees, UNKNOWN with the precise
// cause where the ladder cannot be read (RONIC NOT MEANINGFUL, or its own
// REQUIRED inputs missing) — never a default NO.
// ---------------------------------------------------------------------------

type RonicCell = RonicLadderCell;

const LICENSED_STATES: RonicLadderState[] = ["CLEAN", "RONIC CAPPED AT 200%"];
const UNLICENSED_STATES: RonicLadderState[] = ["LOW RONIC — VALUE-DESTROYING GROWTH"];

function formatRate(rate: Decimal): string {
  return `${rate.mul(100).toFixed(1)}%`;
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
  const ratesText = cells.map((c) => formatRate(c.rate)).join(", ");

  if (cells.length === 0) {
    return {
      status: "UNKNOWN",
      reason: "Step 2 (§10.6.2) cannot read a growth licence — the RONIC ladder has no cell.",
    };
  }

  if (cells.every((c) => c.state === "RONIC NOT MEANINGFUL")) {
    return {
      status: "UNKNOWN",
      reason:
        "Step 2 (§10.6.2) reads RONIC NOT MEANINGFUL (§7.2 M5 ladder) — the trailing five-year return on new " +
        "capital cannot be computed at all, so no comparison with the rate is possible. Whether an uncomputable " +
        "ladder counts as Step 2 UNKNOWN or should instead fail Step 1 is an open house-policy decision (§11 item 2, " +
        "docs/verdict-methodology-reconciliation.md); this function takes neither side and reports UNKNOWN either way.",
    };
  }

  if (cells.every((c) => LICENSED_STATES.includes(c.state))) {
    const sample = cells.find((c) => c.value !== null)?.value ?? null;
    return {
      status: "YES",
      reason:
        `Step 2 (§10.6.2): RONIC (${formatPercent(sample)}) exceeds the D1 rate in use (${ratesText}), so the ` +
        "growth-inclusive value may be underwritten at Step 3.",
    };
  }

  if (cells.every((c) => UNLICENSED_STATES.includes(c.state))) {
    const sample = cells.find((c) => c.value !== null)?.value ?? null;
    return {
      status: "NO",
      reason:
        `Step 2 (§10.6.2): RONIC (${formatPercent(sample)}) is below the D1 rate in use (${ratesText}), so growth ` +
        "is not licensed; only the conservative / no-growth value may be underwritten at Step 3.",
    };
  }

  return {
    status: "UNKNOWN",
    reason:
      `Step 2 (§10.6.2): the ladder (${ratesText}) mixes states, so no single reading is unequivocal; this ` +
      "function does not pick one and reports UNKNOWN.",
  };
}
