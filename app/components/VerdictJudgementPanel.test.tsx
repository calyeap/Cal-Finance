// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import Decimal from "decimal.js";
import type { VerdictResult } from "@/lib/analyzer/verdict";
import { NO_VERDICT_JUDGEMENTS } from "@/lib/analyzer/verdictJudgements";

vi.mock("@/app/actions/analyzer", () => ({ recordVerdictJudgementAction: vi.fn() }));
const { VerdictJudgementPanel } = await import("./VerdictJudgementPanel");

afterEach(cleanup);

// CF-AR5-VERDICT-CONSOLIDATION-01 — the judgement component: only what the
// verdict waits on (Overview), or every judgement (Risks & Thesis). Every
// form offers "not sure".

const base = { reason: "r", check: null, rates: null, basis: null, qualityBar: null, closeCallBinding: null } as const;
const issued: VerdictResult = { ...base, status: "HOLD", state: "ISSUED" };
const question: VerdictResult = { ...base, status: "PENDING", state: "UNCERTAINTY QUESTION" };
const one = new Decimal(1);
const closeCall: VerdictResult = {
  ...base,
  status: "PENDING",
  state: "CLOSE CALL",
  closeCallBinding: "inputs-sha256:abc",
  check: {
    ratios: { lower: one, rate: one, upper: one },
    grid: {} as never,
    routing: { kind: "CLOSE CALL", zones: ["HOLD", "SELL"] },
  },
};

const keysOf = (container: HTMLElement) => Array.from(container.querySelectorAll("form")).map((f) => f.getAttribute("data-judgement"));
const answersOf = (form: Element) => Array.from(form.querySelectorAll("input[name=answer]")).map((i) => i.getAttribute("value"));

describe("VerdictJudgementPanel", () => {
  it("renders nothing on Overview when no judgement is pending", () => {
    const { container } = render(<VerdictJudgementPanel runId="r" verdict={issued} judgements={NO_VERDICT_JUDGEMENTS} moatClass="narrow" mode="pending" />);
    expect(container.innerHTML).toBe("");
  });

  it("the uncertainty question: Low / Medium / High / not sure, with the AI proposal as evidence", () => {
    const { container } = render(
      <VerdictJudgementPanel
        runId="r"
        verdict={question}
        judgements={NO_VERDICT_JUDGEMENTS}
        moatClass="narrow"
        mode="pending"
        proposal={{ status: "COMPLETED", model: "m", proposal: { level: "Medium", evidence: [{ fact: { key: "leverage", label: "Net-debt gate", value: "PASS" }, statement: "Leverage is low." }] } }}
      />
    );
    expect(keysOf(container)).toEqual(["UNCERTAINTY LEVEL"]);
    expect(answersOf(container.querySelector("form")!)).toEqual(["Low", "Medium", "High", "not sure"]);
    expect(container.textContent).toContain("AI proposal (evidence for your answer, not the answer)");
    expect(container.textContent).toContain("Leverage is low. (Net-debt gate: PASS)");
  });

  it("the close call: only the zones the check offers, bound to the run inputs", () => {
    const { container } = render(<VerdictJudgementPanel runId="r" verdict={closeCall} judgements={NO_VERDICT_JUDGEMENTS} moatClass="narrow" mode="pending" />);
    expect(keysOf(container)).toEqual(["CLOSE CALL"]);
    expect(answersOf(container.querySelector("form")!)).toEqual(["HOLD", "SELL", "not sure"]);
    expect(container.querySelector("input[name=boundTo]")?.getAttribute("value")).toBe("inputs-sha256:abc");
  });

  it("Risks & Thesis shows every judgement, thesis state included", () => {
    const { container } = render(<VerdictJudgementPanel runId="r" verdict={issued} judgements={NO_VERDICT_JUDGEMENTS} moatClass="wide" mode="all" />);
    expect(keysOf(container)).toEqual(["UNCERTAINTY LEVEL", "MOAT MECHANISM", "MANAGEMENT RATING", "PROCESS ITEMS", "THESIS STATE"]);
    for (const form of Array.from(container.querySelectorAll("form"))) expect(answersOf(form)).toContain("not sure");
  });
});
