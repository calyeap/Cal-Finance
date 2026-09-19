// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { FullAnalysisNav } from "./FullAnalysisNav";

afterEach(cleanup);

// M9-DESKTOP-SHELL-01 — the rail's anchor behaviour, per docs/design/m9-
// analyzer-design-contract.md §2.2, §3: one rail, over the six themed
// sections in contract order, plus a link back to Overview — carrying no
// counts, badges or completion indicators. jsdom has no
// IntersectionObserver; the component guards for its absence (so this
// exercises the anchors it renders regardless of scroll-tracking support),
// and scroll-tracking itself is exercised by construction — the observed
// ids match the six section ids Overview and Full Analysis both anchor to.

describe("FullAnalysisNav", () => {
  it("renders exactly the six themed sections, in contract order, each a real URL anchor", () => {
    render(<FullAnalysisNav overviewHref="/analyzer/x" />);
    const links = screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("#"));
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "#business",
      "#financials",
      "#valuation",
      "#risks-thesis",
      "#market-context",
      "#evidence",
    ]);
    expect(links.map((a) => a.textContent)).toEqual([
      "Business",
      "Financials",
      "Valuation",
      "Risks & Thesis",
      "Market Context",
      "Evidence",
    ]);
  });

  it("renders one link back to Overview, using the given href", () => {
    render(<FullAnalysisNav overviewHref="/analyzer/abc123" />);
    const overviewLink = screen.getByText("← Overview");
    expect(overviewLink.getAttribute("href")).toBe("/analyzer/abc123");
  });

  it("carries no counts, badges or completion indicators", () => {
    const { container } = render(<FullAnalysisNav overviewHref="/analyzer/x" />);
    expect(container.querySelectorAll(".badge, .count").length).toBe(0);
    expect(container.textContent).not.toMatch(/\d+\s*of\s*\d+/);
  });
});
