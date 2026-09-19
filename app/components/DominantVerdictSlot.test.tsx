// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { DominantVerdictSlot } from "./DominantVerdictSlot";

afterEach(cleanup);

// M9-DESKTOP-SHELL-01 — the contract's two distinct render paths (§4),
// exercised directly against VerdictResult literals rather than through
// deriveVerdict: every real fixture today returns INCOMPLETE (the M8
// comparator gap), so the completed path has no live code path to render
// it through yet. The contract's own instruction is not to build or test
// only the INCOMPLETE-always world (issue #158's "one tension" note), so
// this file exercises both paths as first-class, independently.

describe("DominantVerdictSlot — completed path", () => {
  it("renders the verdict word, a structurally-present confidence indicator, and the rationale line — never the .state/.name/.cause markup", () => {
    const { container } = render(
      <DominantVerdictSlot verdict={{ status: "BUY", reason: "The evidence supports it." }} />
    );
    expect(screen.getByText("BUY")).not.toBeNull();
    expect(screen.getByText("The evidence supports it.")).not.toBeNull();
    expect(container.querySelector(".confidence")).not.toBeNull();
    expect(container.querySelector(".state")).toBeNull();
    expect(container.querySelector(".name")).toBeNull();
  });

  it("renders HOLD and SELL through the same completed path", () => {
    const hold = render(<DominantVerdictSlot verdict={{ status: "HOLD", reason: "Mixed evidence." }} />);
    expect(hold.getByText("HOLD")).not.toBeNull();
    cleanup();
    const sell = render(<DominantVerdictSlot verdict={{ status: "SELL", reason: "The case has weakened." }} />);
    expect(sell.getByText("SELL")).not.toBeNull();
  });
});

describe("DominantVerdictSlot — INCOMPLETE path", () => {
  it("renders the state name and cause line through .state/.name/.cause, left-aligned, no confidence indicator", () => {
    const { container } = render(
      <DominantVerdictSlot
        verdict={{ status: "INCOMPLETE", reason: "Decision-critical analysis is incomplete — the range is not usable." }}
      />
    );
    expect(screen.getByText("INCOMPLETE")).not.toBeNull();
    expect(
      screen.getByText("Decision-critical analysis is incomplete — the range is not usable.")
    ).not.toBeNull();
    expect(container.querySelector(".confidence")).toBeNull();
    expect(container.querySelector(".verdictword")).toBeNull();
  });

  it("renders verdict.reason verbatim, including an embedded recovery clause, without splitting it into a separate element", () => {
    const reason =
      "Decision-critical analysis is incomplete — a fair-value range alone cannot determine BUY / HOLD / SELL. " +
      "Recovery: this verdict becomes available once M8 delivers the comparator fact.";
    render(<DominantVerdictSlot verdict={{ status: "INCOMPLETE", reason }} />);
    expect(screen.getByText(reason)).not.toBeNull();
  });
});
