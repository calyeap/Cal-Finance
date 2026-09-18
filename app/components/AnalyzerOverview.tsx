import type { AnalysisResult } from "@/lib/analyzer/types";
import type { VerdictResult } from "@/lib/analyzer/verdict";
import { DominantVerdictSlot } from "./DominantVerdictSlot";
import { PriceChartPanel } from "./PriceChartPanel";
import { ScenarioRangeStrip } from "./ScenarioRangeStrip";

// M9-DESKTOP-SHELL-01 — the Overview page's twelve-slot frame, per
// docs/design/m9-analyzer-design-contract.md §2.1, §3.
//
// #118's APPROVED OVERVIEW HIERARCHY, items 1-12, in fixed order,
// unconditionally (§2.1: "no slot is reordered, dropped, or rendered only
// in some states"). Slots 1-4 and 12 are this outcome's real content;
// slots 5-11 render as structural slots showing their state, never with
// invented editorial content — that content is runway item 4 (#118
// BOUNDED RUNWAY), out of this outcome's HARD BOUNDS.

const STRUCTURAL_SLOTS: { id: string; label: string }[] = [
  { id: "slot-5", label: "What the business does" },
  { id: "slot-6", label: "Why invest" },
  { id: "slot-7", label: "Why be cautious" },
  { id: "slot-8", label: "What today's price assumes" },
  { id: "slot-9", label: "What matters most" },
  { id: "slot-10", label: "Biggest risk" },
  { id: "slot-11", label: "What would change the verdict" },
];

// design.md:464 — "a section is never absent... it renders its state."
// Slots 5-11 have no editorial content in this outcome (SCOPE item 1), so
// each renders as a real, labelled, present frame naming that honestly,
// the same "Not yet available" convention Sections I/I2 already use for
// content that has not been built yet (AnalyzerReport.tsx).
function StructuralSlot({ id, label }: { id: string; label: string }) {
  return (
    <div className="ovslot structural" id={id}>
      <h3>{label}</h3>
      <p className="note">Not yet available — editorial content for this slot is a later build item.</p>
    </div>
  );
}

export function AnalyzerOverview({
  result,
  verdict,
  profileNotConfirmed,
  fullAnalysisHref,
}: {
  result: AnalysisResult;
  verdict: VerdictResult;
  profileNotConfirmed: boolean;
  fullAnalysisHref: string;
}) {
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
          <DominantVerdictSlot verdict={verdict} />
        </div>

        {/* Slot 3 — current price and its chart. */}
        <div className="ovslot" id="slot-3">
          <PriceChartPanel price={result.price} />
        </div>

        {/* Slot 4 — the valuation-evidence layer. */}
        <div className="ovslot" id="slot-4">
          <ScenarioRangeStrip result={result} profileNotConfirmed={profileNotConfirmed} />
        </div>

        {STRUCTURAL_SLOTS.map((s) => (
          <StructuralSlot key={s.id} id={s.id} label={s.label} />
        ))}

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
