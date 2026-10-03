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
//
// CF-ANALYZER-V1-SETTLE-01 — CALVIN RULING — A (PR #399): §4's "verbatim in
// every case" rule is narrowed for V1 — `verdict.reason` renders verbatim
// only on the Evidence tab (`isEvidenceTab={true}`); every other tab gets
// the plain local marker. Tests below pass `isEvidenceTab` explicitly on
// both sides of that split rather than relying on the prop's default.

describe("DominantVerdictSlot — completed path", () => {
  it("renders the verdict word, a confidence indicator carrying the evidence-status label, and the rationale line — never the .state/.name/.cause markup", () => {
    const { container } = render(
      <DominantVerdictSlot
        verdict={{ status: "BUY", reason: "The evidence supports it." }}
        trustStatus="CLEAN"
        isEvidenceTab
      />
    );
    expect(screen.getByText("BUY")).not.toBeNull();
    expect(screen.getByText("The evidence supports it.")).not.toBeNull();
    expect(container.querySelector(".confidence")).not.toBeNull();
    expect(container.querySelector(".confidence")?.textContent).not.toBe("");
    expect(container.querySelector(".state")).toBeNull();
    expect(container.querySelector(".name")).toBeNull();
  });

  it("renders HOLD and SELL through the same completed path", () => {
    const hold = render(
      <DominantVerdictSlot
        verdict={{ status: "HOLD", reason: "Mixed evidence." }}
        trustStatus="PARTIAL"
        isEvidenceTab
      />
    );
    expect(hold.getByText("HOLD")).not.toBeNull();
    cleanup();
    const sell = render(
      <DominantVerdictSlot
        verdict={{ status: "SELL", reason: "The case has weakened." }}
        trustStatus="UNUSABLE"
        isEvidenceTab
      />
    );
    expect(sell.getByText("SELL")).not.toBeNull();
  });

  it("outside the Evidence tab, renders the plain marker instead of the verbatim rationale", () => {
    const { container } = render(
      <DominantVerdictSlot verdict={{ status: "BUY", reason: "The evidence supports it." }} trustStatus="CLEAN" />
    );
    expect(screen.getByText("BUY")).not.toBeNull();
    expect(screen.queryByText("The evidence supports it.")).toBeNull();
    expect(container.querySelector(".rationale")?.textContent).toBe("Unavailable — see Evidence");
  });
});

// M9-CONFIDENCE-LABEL-01 (issue #201) — the ConfidenceIndicator label is a
// pure mapping from AnalysisResult.trust.status, exercised for all three
// TrustStatus values on the completed path, and against the copy bounds
// Calvin's ruling stated as this outcome's real risk.
describe("DominantVerdictSlot — evidence-status label (M9-CONFIDENCE-LABEL-01)", () => {
  const FORBIDDEN_WORDS = /\b(confidence|probability|probabilities|certainty|certain|score)\b/i;
  const PERCENTAGE = /\d+(\.\d+)?\s*%/;

  it.each(["CLEAN", "PARTIAL", "UNUSABLE"] as const)(
    "renders a non-empty evidence-status label for trust status %s",
    (trustStatus) => {
      const { container } = render(
        <DominantVerdictSlot verdict={{ status: "BUY", reason: "The evidence supports it." }} trustStatus={trustStatus} />
      );
      const label = container.querySelector(".confidence")?.textContent ?? "";
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toMatch(FORBIDDEN_WORDS);
      expect(label).not.toMatch(PERCENTAGE);
    }
  );

  it("never lets UNUSABLE read as a judgement about the company", () => {
    const { container } = render(
      <DominantVerdictSlot verdict={{ status: "HOLD", reason: "Mixed evidence." }} trustStatus="UNUSABLE" />
    );
    const label = container.querySelector(".confidence")?.textContent ?? "";
    expect(label).not.toMatch(/\b(bad|avoid|overvalued|risky|poor)\b/i);
    expect(label).toMatch(/this run|the analysis/i);
  });
});

describe("DominantVerdictSlot — INCOMPLETE path", () => {
  it("renders the state name and cause line through .state/.name/.cause, left-aligned, no confidence indicator", () => {
    const { container } = render(
      <DominantVerdictSlot
        verdict={{ status: "INCOMPLETE", reason: "Decision-critical analysis is incomplete — the range is not usable." }}
        trustStatus="CLEAN"
        isEvidenceTab
      />
    );
    expect(screen.getByText("INCOMPLETE")).not.toBeNull();
    expect(
      screen.getByText("Decision-critical analysis is incomplete — the range is not usable.")
    ).not.toBeNull();
    expect(container.querySelector(".confidence")).toBeNull();
    expect(container.querySelector(".verdictword")).toBeNull();
  });

  it("renders verdict.reason verbatim, including an embedded recovery clause, without splitting it into a separate element — on the Evidence tab", () => {
    const reason =
      "Decision-critical analysis is incomplete — a fair-value range alone cannot determine BUY / HOLD / SELL. " +
      "Recovery: this verdict becomes available once M8 delivers the comparator fact.";
    render(<DominantVerdictSlot verdict={{ status: "INCOMPLETE", reason }} trustStatus="PARTIAL" isEvidenceTab />);
    expect(screen.getByText(reason)).not.toBeNull();
  });

  it("CF-ANALYZER-V1-SETTLE-01 — outside the Evidence tab, never renders the raw reason; renders the plain marker instead", () => {
    const reason = "Decision-critical analysis is incomplete — LEVERAGE UNSUPPORTED IN v1";
    const { container } = render(<DominantVerdictSlot verdict={{ status: "INCOMPLETE", reason }} trustStatus="PARTIAL" />);
    expect(screen.getByText("INCOMPLETE")).not.toBeNull();
    expect(screen.queryByText(reason)).toBeNull();
    expect(screen.queryByText(/LEVERAGE UNSUPPORTED/)).toBeNull();
    expect(container.querySelector(".cause")?.textContent).toBe("Unavailable — see Evidence");
  });

  it("isEvidenceTab defaults to false — omitting the prop still suppresses the raw reason", () => {
    const reason = "Decision-critical analysis is incomplete — PROFILE NOT CONFIRMED is active.";
    render(<DominantVerdictSlot verdict={{ status: "INCOMPLETE", reason }} trustStatus="CLEAN" />);
    expect(screen.queryByText(reason)).toBeNull();
    expect(screen.getByText("Unavailable — see Evidence")).not.toBeNull();
  });

  it("never renders anything confidence-like on the INCOMPLETE path, whatever the trust status", () => {
    for (const trustStatus of ["CLEAN", "PARTIAL", "UNUSABLE"] as const) {
      const { container } = render(
        <DominantVerdictSlot verdict={{ status: "INCOMPLETE", reason: "Incomplete." }} trustStatus={trustStatus} />
      );
      expect(container.querySelector(".confidence")).toBeNull();
      cleanup();
    }
  });
});
