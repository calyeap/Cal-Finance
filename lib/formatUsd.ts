import Decimal from "decimal.js";
import { MONEY_DP, roundMoney } from "./money";

// Display-layer only. Never apply to a value bound to an editable input —
// Holdings' Quantity and Avg cost inputs stay raw so save-time Decimal
// parsing is unaffected by a thousands separator.
const usdFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: MONEY_DP,
  maximumFractionDigits: MONEY_DP,
});

// Rounds through Decimal, NOT through the binary float Intl would otherwise
// round for us. An exact half-cent like 20133.145 is not representable as a
// double — the nearest one sits just below it — so handing Intl a Number
// broke the tie downward by accident, in the opposite direction from
// lib/money.ts's stated ROUND_HALF_UP policy. Rounding first makes the value
// exact at 2dp, after which the Number conversion is lossless and Intl only
// has thousands separators left to add.
export function formatUsd(value: Decimal | number | string): string {
  const d = value instanceof Decimal ? value : new Decimal(value);
  return usdFormatter.format(Number(roundMoney(d).toFixed(MONEY_DP)));
}

// Matches DashboardHoldingsTable's signed P&L treatment exactly: −$ (U+2212
// minus, not a hyphen) for negative, +$ for positive.
export function formatSignedUsd(d: Decimal): string {
  return d.isNegative() ? `−$${formatUsd(d.abs())}` : `+$${formatUsd(d)}`;
}

// CF-ANALYZER-V1-SETTLE-01 — CALVIN RULING — REJECT CURRENT HEAD FOR ONE
// FINAL PRODUCT-COMPLETION PASS, item 3: company-scale dollar figures
// (market cap, enterprise value, steady-state EV) rendered through the
// plain `toFixed(0)` helpers scattered across the report came out as
// unreadable strings of digits (e.g. "$1104224240826"). This abbreviates
// to the nearest T/B/M, matching ordinary financial-site convention; below
// $1M it falls back to `formatUsd`'s comma-grouped, cents-precise form,
// which is already readable at that scale. Display-layer only, same as
// `formatUsd` above — never apply to an editable input.
export function formatCompactUsd(value: Decimal | number | string): string {
  const d = value instanceof Decimal ? value : new Decimal(value);
  const abs = d.abs();
  const sign = d.isNegative() ? "-" : "";
  if (abs.gte(1_000_000_000_000)) return `${sign}${abs.div(1_000_000_000_000).toFixed(2)}T`;
  if (abs.gte(1_000_000_000)) return `${sign}${abs.div(1_000_000_000).toFixed(1)}B`;
  if (abs.gte(1_000_000)) return `${sign}${abs.div(1_000_000).toFixed(1)}M`;
  return `${sign}${formatUsd(abs)}`;
}
