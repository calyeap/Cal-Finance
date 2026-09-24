// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { AnalyzingState, ANALYZING_STAGES, isStageDone } from "./AnalyzingState";

// ANALYZER-V2-PREREPORT-01 — the Analyzing pre-report state. DOM-order pin
// for the four locked stages (design authority doc, "Pre-report states"),
// plus the honest-completion rule SCOPE item 4 requires: no stage claimed
// done on anything but real run state, and a stage whose completion cannot
// be observed here renders unclaimed rather than guessed.

afterEach(cleanup);

const IDENTITY = { ticker: "MSFT", companyName: "Microsoft Corporation" };

describe("AnalyzingState — the four locked stages, in the locked order", () => {
  it("renders exactly these four stages, in this order — reordering, renaming, adding or dropping one fails this test", () => {
    const { container } = render(<AnalyzingState identity={IDENTITY} />);
    const items = Array.from(container.querySelectorAll(".az-analyzing-stage")).map(
      (el) => el.textContent
    );
    expect(items).toEqual([
      "Gathering company information",
      "Checking financial data",
      "Running valuation",
      "Preparing analysis",
    ]);
    expect(ANALYZING_STAGES).toHaveLength(4);
  });

  it("renders company identity when it is known", () => {
    const { getByText } = render(<AnalyzingState identity={IDENTITY} />);
    expect(getByText(/Microsoft Corporation \(MSFT\)/)).toBeInTheDocument();
  });

  it("claims no identity before it is known, rather than guessing one", () => {
    const { container } = render(<AnalyzingState identity={null} />);
    expect(container.querySelector(".az-analyzing-company")!.textContent).not.toMatch(/MSFT/);
  });

  it("marks only the observable stage (identity known) done; the rest render unclaimed, never guessed", () => {
    const { container } = render(<AnalyzingState identity={IDENTITY} />);
    const stages = container.querySelectorAll(".az-analyzing-stage");
    expect(stages[0].getAttribute("data-state")).toBe("done");
    expect(stages[1].getAttribute("data-state")).toBe("pending");
    expect(stages[2].getAttribute("data-state")).toBe("pending");
    expect(stages[3].getAttribute("data-state")).toBe("pending");
  });

  it("claims nothing done before identity is known", () => {
    const { container } = render(<AnalyzingState identity={null} />);
    const stages = container.querySelectorAll(".az-analyzing-stage");
    expect(Array.from(stages).every((el) => el.getAttribute("data-state") === "pending")).toBe(
      true
    );
  });

  it("isStageDone is derived from identity alone — only stage 0, only once identity is known", () => {
    expect(isStageDone(0, null)).toBe(false);
    expect(isStageDone(0, IDENTITY)).toBe(true);
    expect(isStageDone(1, IDENTITY)).toBe(false);
    expect(isStageDone(2, IDENTITY)).toBe(false);
    expect(isStageDone(3, IDENTITY)).toBe(false);
  });

  it("renders no fake percentage, provider name, gate/trust enum or extra control", () => {
    const { container } = render(<AnalyzingState identity={IDENTITY} />);
    expect(container.textContent).not.toMatch(/%/);
    expect(container.textContent).not.toMatch(/provider/i);
    expect(container.querySelectorAll("[role='progressbar']")).toHaveLength(0);
    expect(container.querySelectorAll("button, input, select, a")).toHaveLength(0);
  });

  it("renders no report-tab, verdict-slot, scenario-tile or right-rail chrome", () => {
    const { container } = render(<AnalyzingState identity={IDENTITY} />);
    expect(container.querySelector(".az-tabs")).toBeNull();
    expect(container.querySelector(".az-hero")).toBeNull();
    expect(container.querySelector(".az-rightrail")).toBeNull();
  });
});
