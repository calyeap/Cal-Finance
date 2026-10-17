import type { ReactNode } from "react";
import type { VerdictResult } from "@/lib/analyzer/verdict";
import type { MoatClass } from "@/lib/analyzer/types";
import { NOT_SURE, PROCESS_ITEMS, type Recorded, type VerdictJudgementKey, type VerdictJudgements } from "@/lib/analyzer/verdictJudgements";
import { UNCERTAINTY_LEVELS } from "@/lib/analyzer/verdictSynthesisV1";
import type { UncertaintyProposalReport } from "@/lib/analyzer/uncertaintyProposalStore";
import { recordVerdictJudgementAction } from "@/app/actions/analyzer";

// ---------------------------------------------------------------------------
// CF-AR5-VERDICT-CONSOLIDATION-01 — where Calvin answers the verdict's
// judgements (Methodology v2.1 D3/D4). Each answer is one small form that
// records a new dated row (recordVerdictJudgementAction); nothing is edited
// in place. "Not sure" is always offered and is recorded as itself.
//
// Two modes:
// - "pending" (Overview): only what the verdict is waiting on right now —
//   the one uncertainty question, the close call, or the BUY candidate's
//   open quality items. Renders nothing when nothing is pending.
// - "all" (Risks & Thesis): every judgement, with its answer in force.
//
// This is not a verdict card: the verdict stays in the one verdict slot.
// The AI's uncertainty proposal is shown as evidence beside the question;
// Calvin's answer, not the proposal, sets the level (frozen spec §14.9
// Reading AR0-c).
// ---------------------------------------------------------------------------

function answered<T>(r: Recorded<T> | null): string | null {
  return r === null ? null : `Your answer: ${String(r.answer)} — recorded ${r.recordedAt.slice(0, 10)}, version ${r.version}`;
}

function JudgementForm({
  runId,
  judgementKey,
  title,
  why,
  options,
  current,
  noteLabel,
  boundTo,
  children,
}: {
  runId: string;
  judgementKey: VerdictJudgementKey;
  title: string;
  why: string;
  options: string[];
  current: string | null;
  noteLabel?: string;
  boundTo?: string;
  children?: ReactNode;
}) {
  return (
    <form action={recordVerdictJudgementAction} className="judgment" data-judgement={judgementKey}>
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="judgementKey" value={judgementKey} />
      {boundTo !== undefined && <input type="hidden" name="boundTo" value={boundTo} />}
      <h3>{title}</h3>
      <p className="why">{why}</p>
      {current !== null && <p className="note">{current}</p>}
      {children}
      <fieldset className="decision">
        <legend className="fieldlabel">Your answer</legend>
        <div className="options">
          {[...options, NOT_SURE].map((option) => (
            <label key={option} className="option">
              <input type="radio" name="answer" value={option} required /> <span className="lab">{option}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {noteLabel !== undefined && (
        <>
          <label className="fieldlabel" htmlFor={`note-${judgementKey}`}>
            {noteLabel}
          </label>
          <textarea id={`note-${judgementKey}`} name="note" className="inset" rows={2} />
        </>
      )}
      <div className="continue">
        <button className="act" type="submit">
          Record answer
        </button>
      </div>
    </form>
  );
}

function ProposalEvidence({ report }: { report: UncertaintyProposalReport | null }) {
  if (report === null) return null;
  if (report.status !== "COMPLETED") return <p className="note">{report.detail}</p>;
  return (
    <div className="note" data-role="uncertainty-proposal">
      <p>
        AI proposal (evidence for your answer, not the answer): <b>{report.proposal.level} uncertainty</b>
      </p>
      <ul>
        {report.proposal.evidence.map((e) => (
          <li key={e.fact.key}>
            {e.statement} <span className="lab">({e.fact.label}: {e.fact.value})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VerdictJudgementPanel({
  runId,
  verdict,
  judgements,
  moatClass,
  proposal = null,
  mode,
}: {
  runId: string;
  verdict: VerdictResult;
  judgements: VerdictJudgements;
  moatClass: MoatClass | null;
  proposal?: UncertaintyProposalReport | null;
  mode: "pending" | "all";
}) {
  const all = mode === "all";
  const question = verdict.state === "UNCERTAINTY QUESTION";
  const closeCall = verdict.state === "CLOSE CALL" && verdict.check?.routing.kind === "CLOSE CALL" && verdict.closeCallBinding !== null;
  const buyCandidate = verdict.state === "BUY CANDIDATE";
  if (!all && !question && !closeCall && !buyCandidate) return null;

  const forms: ReactNode[] = [];

  if (all || question) {
    forms.push(
      <JudgementForm
        key="uncertainty"
        runId={runId}
        judgementKey="UNCERTAINTY LEVEL"
        title="How uncertain is this company's value?"
        why="How reliably can intrinsic value be bounded — leverage, cyclicality, disclosure quality, binary regulatory or litigation exposure, the bear-to-bull spread. Your level sets the verdict where only the level matters."
        options={[...UNCERTAINTY_LEVELS]}
        current={answered(judgements.uncertainty)}
        noteLabel="Your reasoning (optional)"
      >
        {question && <ProposalEvidence report={proposal} />}
      </JudgementForm>
    );
  }

  if (closeCall && verdict.check?.routing.kind === "CLOSE CALL") {
    forms.push(
      <JudgementForm
        key="close-call"
        runId={runId}
        judgementKey="CLOSE CALL"
        title="Close call: the verdict changes across the rate band"
        why="At the rate in use and ±0.5pp the verdict is not the same. Your call applies to exactly these numbers; a new price or sheet asks again."
        options={verdict.check.routing.zones}
        current={null}
        noteLabel="Your reasoning (optional)"
        boundTo={verdict.closeCallBinding!}
      />
    );
  }

  const quality = all || buyCandidate;
  if (quality) {
    forms.push(
      <JudgementForm
        key="moat"
        runId={runId}
        judgementKey="MOAT MECHANISM"
        title="Moat mechanism"
        why={
          moatClass === null
            ? "The assumption sheet carries no moat class yet. A BUY needs at least a narrow moat with its mechanism cited."
            : `The adopted sheet rates the moat ${moatClass}. A BUY needs at least a narrow moat with its mechanism cited — switching costs, pricing power, cost advantage, network effects, scarcity, brand.`
        }
        options={["cited"]}
        current={answered(judgements.moatMechanism) && `${answered(judgements.moatMechanism)}${judgements.moatMechanism?.note ? ` — "${judgements.moatMechanism.note}"` : ""}`}
        noteLabel="The mechanism, in your words (required for “cited”)"
      />,
      <JudgementForm
        key="management"
        runId={runId}
        judgementKey="MANAGEMENT RATING"
        title="Management"
        why="A BUY needs management you do not rate poor — execution, capital allocation, dilution, value per share."
        options={["not poor", "poor"]}
        current={answered(judgements.management)}
        noteLabel="Your reasoning (optional)"
      />,
      <JudgementForm
        key="process"
        runId={runId}
        judgementKey="PROCESS ITEMS"
        title="The five process items before a new BUY"
        why="Written thesis, valuation, key risks, invalidation criteria and the strongest bear case. “adopted” needs all five written."
        options={["adopted"]}
        current={answered(judgements.processItems)}
      >
        {PROCESS_ITEMS.map((p) => (
          <div key={p.key}>
            <label className="fieldlabel" htmlFor={`item-${p.key}`}>
              {p.label}
            </label>
            <textarea id={`item-${p.key}`} name={`item:${p.key}`} className="inset" rows={2} defaultValue={judgements.processItems?.items?.[p.key] ?? ""} />
          </div>
        ))}
      </JudgementForm>
    );
  }

  if (all) {
    forms.push(
      <JudgementForm
        key="thesis"
        runId={runId}
        judgementKey="THESIS STATE"
        title="Is the investment thesis intact?"
        why="A fully invalidated thesis produces SELL. If a materially new thesis can be supported, rebuild the analysis under it and record the thesis as intact."
        options={["intact", "broken"]}
        current={answered(judgements.thesis)}
        noteLabel="What changed (optional)"
      />
    );
  }

  return (
    // `cb-steps` reuses the existing judgment-form styling (the §4.4 JudgmentSelector) — no new design.
    <section className="az-judgements cb-steps" aria-label="Your verdict judgements">
      {forms}
    </section>
  );
}
