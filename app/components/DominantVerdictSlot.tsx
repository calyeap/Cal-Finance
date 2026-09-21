import type { VerdictResult } from "@/lib/analyzer/verdict";
import type { TrustStatus } from "@/lib/analyzer/types";
import { evidenceStatusLabel } from "@/lib/analyzer/trustCopy";

// M9-DESKTOP-SHELL-01 — Overview slot 2, per docs/design/m9-analyzer-design-
// contract.md §3, §4.
//
// Two distinct render paths, not one path with a colour swap (§4): a
// completed BUY/HOLD/SELL verdict in the dominant right-aligned tabular
// register, or the INCOMPLETE state through the frozen artefact's existing
// suppressing-state mechanism (design.md §6) — state name, cause line,
// left-aligned, no glyph, reusing the same `.state`/`.name`/`.cause` markup
// report/page.tsx already uses for every other suppressing state in the
// product.
//
// verdict.reason is rendered verbatim as the cause line in every case
// (contract §4). It is also the only textual field VerdictResult carries at
// all — for a completed verdict there is no separate "rationale" field in
// the type, so the same reason string is what RationaleLine renders too.
// This is not an invented substitute: it is literally the one sentence
// deriveVerdict's caller has to explain the verdict, whichever status it
// carries. Three of VerdictResult's four INCOMPLETE branches state a cause
// only, one (COMPARATOR_NOT_YET_AVAILABLE) embeds its own recovery clause
// inside that same string (lib/analyzer/verdict.ts) — rendering the string
// verbatim, unsplit, already satisfies "render a recovery statement only
// where the derivation supplies one" without this component parsing it.
//
// deriveVerdict returns INCOMPLETE on every run today (the M8 comparator
// gap recorded in docs/design/m9-contract-reconciliation.md §5-§6). The
// completed-verdict path below is nonetheless a first-class, independently
// exercised render path — not a hypothetical — per the M9 outcome's
// instruction not to build or test only the INCOMPLETE-always world.

export function DominantVerdictSlot({
  verdict,
  trustStatus,
}: {
  verdict: VerdictResult;
  trustStatus: TrustStatus;
}) {
  if (verdict.status === "INCOMPLETE") {
    return (
      <div className="verdictslot state incomplete">
        <span className="name">INCOMPLETE</span>
        <span className="cause">{verdict.reason}</span>
      </div>
    );
  }

  return (
    <div className="verdictslot completed">
      <span className="verdictword">{verdict.status}</span>
      <ConfidenceIndicator status={trustStatus} />
      <RationaleLine text={verdict.reason} />
    </div>
  );
}

// contract §3, §8 item 1 — RESOLVED, 21 Sep 2026 (Calvin's ruling on #196,
// 11:01:20Z, Option B; see design contract §8 item 1). No numeric
// verdict-level confidence figure is or may be computed (that question stays
// open per m9-contract-reconciliation.md §4); this instead reuses the
// already-computed §9.6 `TrustStatus` — a qualitative statement of evidence
// completeness, not a certainty claim — as the slot's content. Present only
// on the completed path (§2.1 slot 2's settled render condition, unchanged),
// via `evidenceStatusLabel`, whose copy bounds (no "confidence" / probability
// / certainty / score / percentage; UNUSABLE read as a fact about the run,
// never the company) are the ruling's stated risk for this outcome.
function ConfidenceIndicator({ status }: { status: TrustStatus }) {
  return (
    <span className="confidence" data-role="confidence-indicator">
      {evidenceStatusLabel(status)}
    </span>
  );
}

// The one-sentence rationale beside a completed verdict (contract §3,
// slot 2). Template- or [C]-sourced per spec.md §10.7 in the methodology
// this component reads from, never assembled here.
function RationaleLine({ text }: { text: string }) {
  return <p className="rationale">{text}</p>;
}
