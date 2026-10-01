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
// verdict.reason was originally specified to render verbatim as the cause
// line in every case (contract §4). CF-ANALYZER-V1-SETTLE-01 — CALVIN
// RULING — A (PR #399, comment 5933170464): verdict.reason is deriveVerdict's
// one explanatory sentence, and several of its branches embed a raw
// trust/gate state code (lib/analyzer/verdict.ts — e.g. the UNUSABLE
// trust's `detail`, a suppressed range's `cause`, or the literal "PROFILE
// NOT CONFIRMED"). This hero is part of the shared shell and renders on
// every tab (design authority doc, shell invariants), so rendering it
// verbatim everywhere was exactly the raw-code-outside-Evidence leak #392's
// ACCEPTANCE GATE forbids. Calvin's ruling: outside Evidence, replace it
// with a plain local marker; keep the full verbatim reason on the Evidence
// tab only. deriveVerdict itself is unchanged — this is presentation-only.
// `isEvidenceTab` defaults to false so a call site that omits it fails
// toward the marker, never toward leaking the raw reason.
//
// It is also the only textual field VerdictResult carries at all — for a
// completed verdict there is no separate "rationale" field in the type, so
// the same reason string is what RationaleLine renders too. Three of
// VerdictResult's four INCOMPLETE branches state a cause only, one
// (COMPARATOR_NOT_YET_AVAILABLE) embeds its own recovery clause inside that
// same string — rendering the string verbatim, unsplit, on Evidence already
// satisfies "render a recovery statement only where the derivation supplies
// one" without this component parsing it.
//
// deriveVerdict returns INCOMPLETE on every run today (the M8 comparator
// gap recorded in docs/design/m9-contract-reconciliation.md §5-§6). The
// completed-verdict path below is nonetheless a first-class, independently
// exercised render path — not a hypothetical — per the M9 outcome's
// instruction not to build or test only the INCOMPLETE-always world.

const REASON_UNAVAILABLE_MARKER = "Unavailable — see Evidence";

export function DominantVerdictSlot({
  verdict,
  trustStatus,
  isEvidenceTab = false,
}: {
  verdict: VerdictResult;
  trustStatus: TrustStatus;
  isEvidenceTab?: boolean;
}) {
  const reason = isEvidenceTab ? verdict.reason : REASON_UNAVAILABLE_MARKER;

  if (verdict.status === "INCOMPLETE") {
    return (
      <div className="verdictslot state incomplete">
        <span className="name">INCOMPLETE</span>
        <span className="cause">{reason}</span>
      </div>
    );
  }

  return (
    <div className="verdictslot completed">
      <span className="verdictword">{verdict.status}</span>
      <ConfidenceIndicator status={trustStatus} />
      <RationaleLine text={reason} />
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
