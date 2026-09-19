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
});
