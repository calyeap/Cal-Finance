// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import Decimal from "decimal.js";
import { PriceChartPanel } from "./PriceChartPanel";

afterEach(cleanup);

// M9-DESKTOP-SHELL-01 — Overview slot 3: restates the acquired price fact
// only, no target line, no advice-implying annotation.

describe("PriceChartPanel", () => {
  it("renders the price and its as-of timestamp, restated verbatim", () => {
    render(<PriceChartPanel price={{ value: new Decimal("510.12"), timestamp: "2026-09-15 16:00 ET" }} />);
    expect(screen.getByText("$510.12")).not.toBeNull();
    expect(screen.getByText("2026-09-15 16:00 ET")).not.toBeNull();
  });

  it("renders a chart element with no target-price line or advice-implying annotation", () => {
    const { container } = render(<PriceChartPanel price={{ value: new Decimal("100.00"), timestamp: "t" }} />);
    expect(container.querySelector("svg.pricechartsvg")).not.toBeNull();
    expect(container.textContent).not.toMatch(/target|buy|sell|hold/i);
  });

  // M9-ACCESSIBILITY-01 — §16's "the accessible name is the visible text":
  // the SVG must not re-announce the price/timestamp already visible beside
  // it, and the one fact it alone carried (no price history) must become
  // real visible text rather than an aria-label-only state.
  it("hides the decorative svg from assistive tech and has no duplicated accessible name", () => {
    const { container } = render(<PriceChartPanel price={{ value: new Decimal("100.00"), timestamp: "t" }} />);
    const svg = container.querySelector("svg.pricechartsvg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.hasAttribute("role")).toBe(false);
    expect(svg?.hasAttribute("aria-label")).toBe(false);
  });

  it("renders the no-price-history fact as visible text", () => {
    render(<PriceChartPanel price={{ value: new Decimal("100.00"), timestamp: "t" }} />);
    expect(screen.getByText(/no price history is in this analysis/i)).not.toBeNull();
  });
});
