import type { SlotCatalogue } from "./traceability";
import { overviewTextViolations } from "../overviewCopy";

// ---------------------------------------------------------------------------
// CF-ANALYZER-V1-SETTLE-01 — the four page-one sentences are quoted verbatim
// on the normal Overview (slots 6, 7, 9, 10), and CALVIN RULING — REJECT
// CURRENT PRODUCT SURFACE (PR #399, comment 5952716764) forbids technical
// state codes there. The real live runs show how they arrived: a page-one
// sentence referenced a SUPPRESSED slot, and a suppressed slot renders as its
// state name (slots.ts) — MSFT's "the check that would size that effect is
// INCOMPLETE", NVDA's "the independent fair-value range, which reads LEVERAGE
// UNSUPPORTED IN v1" (docs/proof/, 1 Oct 2026).
//
// So page one — and only page one; Section I's five statements remain the
// technical record and may still name a state — must not reference a
// suppressed slot, and its rendered text must carry none of the Overview's
// forbidden vocabulary (overviewCopy.ts, the same list the live proof checks).
// A defect refuses the output with a diagnostic, which the existing single
// regeneration (analystCall.ts) feeds back to the model — no new retry path.
// ---------------------------------------------------------------------------

const SLOT_REFERENCE = /\{\{\s*([A-Za-z0-9_.@\-/]+)\s*\}\}/g;

export interface PageOneVocabularyDefect {
  kind: "SUPPRESSED SLOT ON PAGE ONE" | "TECHNICAL VOCABULARY ON PAGE ONE";
  detail: string;
}

export class PageOneVocabularyError extends Error {
  readonly defects: PageOneVocabularyDefect[];
  readonly diagnostic: string;

  constructor(where: string, defects: PageOneVocabularyDefect[]) {
    super(
      `${where}: page-one copy carries ${defects.length} technical reference(s) the normal Overview may not show. ` +
        `The whole output was refused; no part of it was kept.`
    );
    this.name = "PageOneVocabularyError";
    this.defects = defects;
    this.diagnostic =
      `${where}: ` +
      defects.map((d) => `${d.kind} (${d.detail})`).join("; ") +
      ". Page one is read by someone who does not know this model's vocabulary: reference no SUPPRESSED slot, " +
      'and where something is not computed for this run, say so in plain words ("is not computed for this run") ' +
      "without naming a state, gate, module or section.";
  }
}

/** Every page-one vocabulary defect in one raw sentence and its rendered form. */
export function pageOneVocabularyDefects(
  rawText: string,
  renderedText: string,
  catalogue: SlotCatalogue
): PageOneVocabularyDefect[] {
  const defects: PageOneVocabularyDefect[] = [];
  for (const match of rawText.matchAll(SLOT_REFERENCE)) {
    const slot = catalogue.get(match[1]);
    if (slot?.suppressed) {
      defects.push({ kind: "SUPPRESSED SLOT ON PAGE ONE", detail: `{{${slot.id}}} renders as "${slot.formatted}"` });
    }
  }
  for (const violation of overviewTextViolations(renderedText)) {
    defects.push({ kind: "TECHNICAL VOCABULARY ON PAGE ONE", detail: `${violation.label}: "${violation.context}"` });
  }
  return defects;
}
