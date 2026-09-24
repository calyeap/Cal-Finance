// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import Decimal from "decimal.js";
import { PriceChartPanel } from "./PriceChartPanel";

afterEach(cleanup);

// M9-DESKTOP-SHELL-01 — Overview slot 3: restates the acquired price fact
// only, no target line, no advice-implying annotation.
//
// `priceState: null` below means "this run has a real price" (CF-PRICE-
// DISPLAY-HONESTY-RECON-01) — the same null-means-computed convention
// notComputed.ts's boundState() uses everywhere else in this codebase.

describe("PriceChartPanel", () => {
  it("renders the price and its as-of timestamp, restated verbatim", () => {
    render(<PriceChartPanel price={{ value: new Decimal("510.12"), timestamp: "2026-09-15 16:00 ET" }} priceState={null} />);
    expect(screen.getByText("$510.12")).not.toBeNull();
    expect(screen.getByText("2026-09-15 16:00 ET")).not.toBeNull();
  });

  it("renders a chart element with no target-price line or advice-implying annotation", () => {
    const { container } = render(
      <PriceChartPanel price={{ value: new Decimal("100.00"), timestamp: "t" }} priceState={null} />
    );
    expect(container.querySelector("svg.pricechartsvg")).not.toBeNull();
    expect(container.textContent).not.toMatch(/target|buy|sell|hold/i);
  });

  // M9-ACCESSIBILITY-01 — §16's "the accessible name is the visible text":
  // the SVG must not re-announce the price/timestamp already visible beside
  // it, and the one fact it alone carried (no price history) must become
  // real visible text rather than an aria-label-only state.
  it("hides the decorative svg from assistive tech and has no duplicated accessible name", () => {
    const { container } = render(
      <PriceChartPanel price={{ value: new Decimal("100.00"), timestamp: "t" }} priceState={null} />
    );
    const svg = container.querySelector("svg.pricechartsvg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.hasAttribute("role")).toBe(false);
    expect(svg?.hasAttribute("aria-label")).toBe(false);
  });

  it("renders the no-price-history fact as visible text", () => {
    render(<PriceChartPanel price={{ value: new Decimal("100.00"), timestamp: "t" }} priceState={null} />);
    expect(screen.getByText(/no price history is in this analysis/i)).not.toBeNull();
  });
});

// CF-PRICE-DISPLAY-HONESTY-RECON-01 — CONTEXT item 5. Before this outcome,
// this panel restated §3.4's $0/blank-timestamp sentinel as though it were
// a real quote, on a priceless run — the identical defect class CONTEXT
// items 1-4 name for the report's other price reads.
describe("PriceChartPanel — no price", () => {
  it("renders BoundStateBlock (the state name and cause) in place of the $0 figure, chart and caption", () => {
    const { container } = render(
      <PriceChartPanel
        price={{ value: new Decimal(0), timestamp: "" }}
        priceState={{ state: "INCOMPLETE", cause: "missing REQUIRED input: a price for this run" }}
      />
    );
    expect(screen.getByText("INCOMPLETE")).not.toBeNull();
    expect(screen.getByText(/missing REQUIRED input: a price for this run/)).not.toBeNull();
    expect(screen.queryByText("$0.00")).toBeNull();
    expect(container.querySelector("svg.pricechartsvg")).toBeNull();
    expect(screen.queryByText(/no price history/i)).toBeNull();
  });
});
