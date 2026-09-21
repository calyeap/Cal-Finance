import type { ReactNode } from "react";
import Decimal from "decimal.js";
import type { AnalysisResult, InterpretationStatement } from "@/lib/analyzer/types";
import type { VerdictResult } from "@/lib/analyzer/verdict";
import type { AiLayerReport } from "@/lib/analyzer/reportAnalysis";
import { DominantVerdictSlot } from "./DominantVerdictSlot";
import { PriceChartPanel } from "./PriceChartPanel";
import { ScenarioRangeStrip } from "./ScenarioRangeStrip";
import { AiLayerNote, humanizeCause, CHALLENGER_SELECTION_RULE_NOTE } from "./AnalyzerReport";
import { selectChallengerPoint } from "@/lib/analyzer/ai/challengerSelection";

// M9-DESKTOP-SHELL-01 — the Overview page's twelve-slot frame, per
// docs/design/m9-analyzer-design-contract.md §2.1, §3.
//
// #118's APPROVED OVERVIEW HIERARCHY, items 1-12, in fixed order,
// unconditionally (§2.1: "no slot is reordered, dropped, or rendered only
// in some states"). Slots 1-4 and 12 are M9-DESKTOP-SHELL-01's real
// content. Slots 6, 7, 9 and 10 render the interpretation call's page-one
// prose (M9-OVERVIEW-CONTENT-01); slot 8 restates Section E's price-implied
// figures in full. Slots 5 and 11 have no approved content source yet
// (issue #160 SCOPE item 7) and remain honest structural frames, exactly as
// runway item 3 left them.

const STRUCTURAL_SLOTS: { id: string; label: string }[] = [
  { id: "slot-5", label: "What the business does" },
  { id: "slot-11", label: "What would change the verdict" },
];

// design.md:464 — "a section is never absent... it renders its state."
// Slots 5 and 11 have no editorial content source (SCOPE item 7), so each
// renders as a real, labelled, present frame naming that honestly, the same
// "Not yet available" convention Sections I/I2 already use for content that
// has not been built yet (AnalyzerReport.tsx).
function StructuralSlot({ id, label }: { id: string; label: string }) {
  return (
    <div className="ovslot structural" id={id}>
      <h3>{label}</h3>
      <p className="note">Not yet available — editorial content for this slot is a later build item.</p>
    </div>
  );
}

// M9-OVERVIEW-CONTENT-01 — slots 6, 7, 9, 10. Each renders one of the
// interpretation call's four page-one sentences (§10.7 rule 2), verbatim —
// this component adds no prose of its own (contract §3, `EditorialProseBlock`
// boundary). `pageOne` is null until the interpretation call has run, or
// where the AI layer's all-or-nothing failure policy refused its output
// (lib/analyzer/reportAnalysis.ts); that null path reuses Section I's own
// "not yet available" note and `AiLayerNote`'s cause line (issue #160 SCOPE
// item 6) rather than a second vocabulary for the same three causes.
function EditorialProseSlot({
  id,
  label,
  statement,
  aiLayer,
  extra,
}: {
  id: string;
  label: string;
  statement: InterpretationStatement | null;
  aiLayer: AiLayerReport | undefined;
  extra?: ReactNode;
}) {
  return (
    <div className="ovslot editorial" id={id}>
      <h3>{label}</h3>
      {statement === null ? (
        <>
          <p className="note">Not yet available — the interpretation call has not run for this analysis.</p>
          <AiLayerNote aiLayer={aiLayer} />
        </>
      ) : (
        <>
          <p>{statement.statement}</p>
          {extra}
        </>
      )}
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
// are the same figures ScenarioRangeStrip (slot 4) already restates
// condensed; implied growth is the same r = 8%, current-margin cell
// AnalyzerReport's Section H right column restates. "One figure, one
// computation" — nothing here is computed, only read from the
// AnalysisResult and formatted.
function PriceAssumptionSlot({ result }: { result: AnalysisResult }) {
  const { priceImplied } = result;
  const baseRateCell = priceImplied.reverseDcfGrid.find((c) => c.marginLevel === "current" && c.rate === 0.08);

  return (
    <div className="ovslot" id="slot-8">
      <h3>What today&apos;s price assumes</h3>
      <p className="sub2">Restated in full from Section E — the same figures, no second computation.</p>
      {priceImplied.steadyStateEv.suppressed ? (
        <div className="state">
          <span className="name">{priceImplied.steadyStateEv.state}</span>
          <span className="cause">{humanizeCause(priceImplied.steadyStateEv.cause)}</span>
        </div>
      ) : (
        <div className="pi">
          <span className="lbl">Steady-state EV</span>
          <b>${num(priceImplied.steadyStateEv.value, 0)}</b>
        </div>
      )}
      {priceImplied.pvgoShareOfEv.suppressed ? (
        <div className="state">
          <span className="name">{priceImplied.pvgoShareOfEv.state}</span>
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
            <span className="name">{baseRateCell.fiveYearGrowth.state}</span>
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

export function AnalyzerOverview({
  result,
  verdict,
  profileNotConfirmed,
  fullAnalysisHref,
  aiLayer,
}: {
  result: AnalysisResult;
  verdict: VerdictResult;
  profileNotConfirmed: boolean;
  fullAnalysisHref: string;
  aiLayer?: AiLayerReport;
}) {
  const pageOne = result.interpretation.pageOne;

  // §17.7.1 — the same deterministic selection Section I's "Challenger
  // point" line and Section I2's headline already share (issue #160 SCOPE
  // item 2). Computed here, independently, from the same AnalysisResult
  // field and the same selection function — not a second selection rule.
  const challengerSelection = result.challenger === null ? null : selectChallengerPoint(result.challenger.findings);

  return (
    <div className="layout overview">
      <main>
        {/* Slot 1 — company header. Identity only (design.md:906): no
            verdict, figure or finding-block content, so no price value
            here — the price itself is slot 3's. */}
        <div className="ovslot head" id="slot-1">
          <h1>{result.companyName}</h1>
          <p className="tick">{result.ticker}</p>
          <p className="tick">as of {result.price.timestamp}</p>
        </div>

        {/* Slot 2 — the dominant verdict. */}
        <div className="ovslot" id="slot-2">
          <DominantVerdictSlot verdict={verdict} trustStatus={result.trust.status} />
        </div>

        {/* Slot 3 — current price and its chart. */}
        <div className="ovslot" id="slot-3">
          <PriceChartPanel price={result.price} />
        </div>

        {/* Slot 4 — the valuation-evidence layer. */}
        <div className="ovslot" id="slot-4">
          <ScenarioRangeStrip result={result} profileNotConfirmed={profileNotConfirmed} />
        </div>

        {/* Slot 5 — no approved content source (issue #160 SCOPE item 7). */}
        <StructuralSlot {...STRUCTURAL_SLOTS[0]} />

        {/* Slot 6 — "Why invest." */}
        <EditorialProseSlot
          id="slot-6"
          label="Why invest"
          statement={pageOne === null ? null : pageOne.whatSupportsTheCase}
          aiLayer={aiLayer}
        />

        {/* Slot 7 — "Why be cautious," symmetric to slot 6. May surface the
            selected challenger point (§2.1 row 7, §17.7.1); the full
            challenger finding set is Full Analysis → Risks & Thesis'
            Section I2, so this never surfaces a state only here. */}
        <EditorialProseSlot
          id="slot-7"
          label="Why be cautious"
          statement={pageOne === null ? null : pageOne.whatWorriesCalboard}
          aiLayer={aiLayer}
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
          aiLayer={aiLayer}
        />

        {/* Slot 10 — "Biggest risk." */}
        <EditorialProseSlot
          id="slot-10"
          label="Biggest risk"
          statement={pageOne === null ? null : pageOne.biggestUncertainty}
          aiLayer={aiLayer}
        />

        {/* Slot 11 — no approved content source (issue #160 SCOPE item 7). */}
        <StructuralSlot {...STRUCTURAL_SLOTS[1]} />

        {/* Slot 12 — the single, clearly primary link into Full Analysis. */}
        <div className="ovslot" id="slot-12">
          <a className="act" href={fullAnalysisHref}>
            View full analysis
          </a>
        </div>
      </main>
    </div>
  );
}
