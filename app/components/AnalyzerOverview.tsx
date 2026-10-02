import type { ReactNode } from "react";
import Decimal from "decimal.js";
import type { AnalysisResult, InterpretationStatement } from "@/lib/analyzer/types";
import type { AiLayerReport } from "@/lib/analyzer/reportAnalysis";
import { AiLayerNote, humanizeCause, CHALLENGER_SELECTION_RULE_NOTE } from "./AnalyzerReport";
import { selectChallengerPoint } from "@/lib/analyzer/ai/challengerSelection";
import { formatCompactUsd } from "@/lib/formatUsd";

// CF-DESIGN-AUTHORITY-CUTOVER-01 — the Overview tab's own body, below the
// shared AnalyzerReportFrame hero. Slots 1 (company header), 2 (dominant
// verdict), 3 (current price/chart), 4 (Bear/Base/Bull/Uncertainty) and 12
// (view full analysis) moved into AnalyzerReportFrame, which now renders
// them identically on every tab (design authority doc, "one shell, seven
// tabs") rather than once here as an Overview-only frame; slot 12's "View
// full analysis" link is superseded by the tab rail itself, which already
// reaches every one of those six destinations. What remains here (slots 5-
// 11) is exactly M9-DESKTOP-SHELL-01's own content for those slots,
// unchanged — this file still adds no prose of its own (EditorialProseBlock
// boundary, m9-analyzer-design-contract.md §3).

const STRUCTURAL_SLOTS: { id: string; label: string }[] = [
  { id: "slot-11", label: "What would change the verdict" },
];

// design.md:464 — "a section is never absent... it renders its state."
// Slot 11 has no editorial content source (SCOPE item 7), so it renders as
// a real, labelled, present frame naming that honestly, the same "Not yet
// available" convention Sections I/I2 already use for content that has not
// been built yet (AnalyzerReport.tsx).
function StructuralSlot({ id, label }: { id: string; label: string }) {
  return (
    <div className="ovslot structural" id={id}>
      <h3>{label}</h3>
      <p className="note">Not yet available — editorial content for this slot is a later build item.</p>
    </div>
  );
}

// First 2-3 sentences of an already-extracted, verbatim excerpt — a string
// cut, not a rewrite (EditorialProseBlock boundary, m9-analyzer-design-
// contract.md §3: no fact, ranking or portfolio-action language added).
// Falls back to the whole excerpt when it has 3 or fewer sentences.
function firstSentences(text: string, count: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)/g);
  if (sentences === null || sentences.length <= count) return text.trim();
  return sentences.slice(0, count).join("").trim();
}

// Slot 5 — "What the business does." CF-ANALYZER-V1-SETTLE-01 correction:
// the Business tab (AnalyzerReport.tsx's BusinessSection) already carries
// the filer's own 10-K Item 1 excerpt for this exact run; this slot restates
// its first 2-3 sentences rather than a second "not yet available" marker
// for content that, in fact, already exists. Mechanical restatement only —
// no new extraction, no second computation (same discipline as slot 8's
// PriceAssumptionSlot restating Section E).
function BusinessDescriptionSlot({ result }: { result: AnalysisResult }) {
  const narrative = result.business.narrative;
  return (
    <div className="ovslot" id="slot-5">
      <h3>What the business does</h3>
      {narrative === null ? (
        <p className="note">
          Not yet available — {result.business.unavailableReason ?? "Business section content has not been built for this analysis."}
        </p>
      ) : (
        <>
          <p>{firstSentences(narrative.text, 3)}</p>
          <p className="note">Full description on the Business tab.</p>
        </>
      )}
    </div>
  );
}

// M9-OVERVIEW-CONTENT-01 — slots 6, 7, 9, 10. Each renders one of the
// interpretation call's four page-one sentences (§10.7 rule 2), verbatim —
// this component adds no prose of its own (contract §3, `EditorialProseBlock`
// boundary). `pageOne` is null until the interpretation call has run, or
// where the AI layer's all-or-nothing failure policy refused its output
// (lib/analyzer/reportAnalysis.ts).
//
// CF-ANALYZER-V1-SETTLE-01 — the four slots share one underlying cause
// (`pageOne === null`), so they no longer each restate the full "not yet
// available" sentence plus the AI layer's cause line: that was up to four
// repeated failure-state markers for one fact. `AnalyzerOverview` now
// renders that explanation once, in `InterpretationUnavailableNote` below;
// each affected slot instead renders a plain "—" in place of its sentence,
// the same missing-value convention `ValuationStrip` already uses.
function EditorialProseSlot({
  id,
  label,
  statement,
  extra,
}: {
  id: string;
  label: string;
  statement: InterpretationStatement | null;
  extra?: ReactNode;
}) {
  return (
    <div className="ovslot editorial" id={id}>
      <h3>{label}</h3>
      {statement === null ? (
        <p className="note">—</p>
      ) : (
        <>
          <p>{statement.statement}</p>
          {extra}
        </>
      )}
    </div>
  );
}

// The one shared explanation for all four editorial slots' missing content
// — rendered once, not per-slot, so a run with no model interpretation
// shows one inline marker for this cause rather than four.
function InterpretationUnavailableNote({ aiLayer }: { aiLayer: AiLayerReport | undefined }) {
  return (
    <div className="ovnote" id="interpretation-unavailable">
      <p className="note">
        Not yet available — the interpretation call has not run for this analysis. Why invest, Why be cautious, What
        matters most and Biggest risk below show &ldquo;—&rdquo; until it does.
      </p>
      <AiLayerNote aiLayer={aiLayer} />
    </div>
  );
}

function num(value: Decimal, dp = 2): string {
  return value.toFixed(dp);
}
function pct(value: Decimal, dp = 1): string {
  return `${value.mul(100).toFixed(dp)}%`;
}

// Slot 8 — the complete standalone treatment of Section E's price-implied
// content (issue #160 SCOPE item 5): steady-state EV and PVGO share of EV
// are the same figures ScenarioRangeStrip (AnalyzerReportFrame's hero)
// already restates condensed; implied growth is the same r = 8%,
// current-margin cell AnalyzerReport's Section H right column restates.
// "One figure, one computation" — nothing here is computed, only read from
// the AnalysisResult and formatted.
function PriceAssumptionSlot({ result }: { result: AnalysisResult }) {
  const { priceImplied } = result;
  const baseRateCell = priceImplied.reverseDcfGrid.find((c) => c.marginLevel === "current" && c.rate === 0.08);

  return (
    <div className="ovslot" id="slot-8">
      <h3>What today&apos;s price assumes</h3>
      <p className="sub2">Restated in full from Section E — the same figures, no second computation.</p>
      {/* CF-ANALYZER-V1-SETTLE-01 correction — #392's ACCEPTANCE GATE
          forbids raw gate/trust state codes (e.g. "LEVERAGE UNSUPPORTED IN
          v1") outside Evidence; Overview is a non-Evidence tab. The raw
          code still reaches Evidence via `states.suppressing`
          (assemble.ts) — this is the same state, restated as a local
          marker, not a new computation. */}
      {priceImplied.steadyStateEv.suppressed ? (
        <div className="state">
          <span className="name">Unavailable — see Evidence</span>
          <span className="cause">{humanizeCause(priceImplied.steadyStateEv.cause)}</span>
        </div>
      ) : (
        <div className="pi">
          <span className="lbl">Steady-state EV</span>
          <b>${formatCompactUsd(priceImplied.steadyStateEv.value)}</b>
        </div>
      )}
      {priceImplied.pvgoShareOfEv.suppressed ? (
        <div className="state">
          <span className="name">Unavailable — see Evidence</span>
          <span className="cause">{humanizeCause(priceImplied.pvgoShareOfEv.cause)}</span>
        </div>
      ) : (
        <div className="pi">
          <span className="lbl">PVGO share of EV</span>
          <b>{pct(priceImplied.pvgoShareOfEv.value)}</b>
        </div>
      )}
      {baseRateCell &&
        (baseRateCell.fiveYearGrowth.suppressed ? (
          <div className="state">
            <span className="name">Unavailable — see Evidence</span>
            <span className="cause">{humanizeCause(baseRateCell.fiveYearGrowth.cause)}</span>
          </div>
        ) : (
          <div className="pi" style={{ borderBottom: 0 }}>
            <span className="lbl">Implied growth, yrs 1-5 at r = 8%</span>
            <b>{pct(baseRateCell.fiveYearGrowth.value)}</b>
          </div>
        ))}
    </div>
  );
}

export function AnalyzerOverview({ result, aiLayer }: { result: AnalysisResult; aiLayer?: AiLayerReport }) {
  const pageOne = result.interpretation.pageOne;

  // §17.7.1 — the same deterministic selection Section I's "Challenger
  // point" line and Section I2's headline already share (issue #160 SCOPE
  // item 2). Computed here, independently, from the same AnalysisResult
  // field and the same selection function — not a second selection rule.
  const challengerSelection = result.challenger === null ? null : selectChallengerPoint(result.challenger.findings);

  return (
    <div className="ovtab overview">
      {/* Slot 5 — restated from the Business tab's own excerpt. */}
      <BusinessDescriptionSlot result={result} />

      {/* One shared explanation for slots 6, 7, 9, 10's missing content —
          CF-ANALYZER-V1-SETTLE-01, replacing four repeated markers with
          one. */}
      {pageOne === null && <InterpretationUnavailableNote aiLayer={aiLayer} />}

      {/* Slot 6 — "Why invest." */}
      <EditorialProseSlot
        id="slot-6"
        label="Why invest"
        statement={pageOne === null ? null : pageOne.whatSupportsTheCase}
      />

      {/* Slot 7 — "Why be cautious," symmetric to slot 6. May surface the
          selected challenger point (§2.1 row 7, §17.7.1); the full
          challenger finding set is the Risks & Thesis tab's Section I2, so
          this never surfaces a state only here. */}
      <EditorialProseSlot
        id="slot-7"
        label="Why be cautious"
        statement={pageOne === null ? null : pageOne.whatWorriesCalboard}
        extra={
          challengerSelection === null ? null : (
            <>
              <p className="note">Challenger point — {challengerSelection.selected.evidence}</p>
              <span className="selrule">{CHALLENGER_SELECTION_RULE_NOTE}</span>
            </>
          )
        }
      />

      {/* Slot 8 — the price-implied read, restated in full. */}
      <PriceAssumptionSlot result={result} />

      {/* Slot 9 — "What matters most." */}
      <EditorialProseSlot
        id="slot-9"
        label="What matters most"
        statement={pageOne === null ? null : pageOne.mainFinding}
      />

      {/* Slot 10 — "Biggest risk." */}
      <EditorialProseSlot
        id="slot-10"
        label="Biggest risk"
        statement={pageOne === null ? null : pageOne.biggestUncertainty}
      />

      {/* Slot 11 — no approved content source (issue #160 SCOPE item 7). */}
      <StructuralSlot {...STRUCTURAL_SLOTS[0]} />
    </div>
  );
}
