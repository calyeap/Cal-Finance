// ---------------------------------------------------------------------------
// CF-ANALYZER-V1-SETTLE-01 — which SEC filing forms count as a "material
// development" for the Overview's "Latest material development" slot
// (CALVIN RULING — REJECT CURRENT PRODUCT SURFACE, comment 5952716764,
// REQUIRED OVERVIEW CONTENT item 9).
//
// The live proof on 7 Oct 2026 (run 37566908890) showed why "the most recent
// filing of ANY form" was the wrong reading: MSFT's latest filing was a
// Form 4 — an insider's own share transaction — which the Overview then
// presented as the company's latest development. Periodic reports and
// current reports are the filer's own disclosures of developments; insider,
// ownership and registration forms are not.
//
// One list, read by both the acquisition (provider.ts picks the latest
// filing in it) and the Overview copy (the plain-English label), so the two
// cannot disagree about what counts.
// ---------------------------------------------------------------------------

const MATERIAL_FILING_LABELS: Record<string, string> = {
  "8-K": "current report (8-K)",
  "8-K/A": "amended current report (8-K/A)",
  "10-Q": "quarterly report (10-Q)",
  "10-Q/A": "amended quarterly report (10-Q/A)",
  "10-K": "annual report (10-K)",
  "10-K/A": "amended annual report (10-K/A)",
  "20-F": "annual report (20-F)",
  "20-F/A": "amended annual report (20-F/A)",
  "40-F": "annual report (40-F)",
  "6-K": "current report (6-K)",
};

export const MATERIAL_FILING_FORMS: readonly string[] = Object.keys(MATERIAL_FILING_LABELS);

export function isMaterialFilingForm(form: string): boolean {
  return Object.prototype.hasOwnProperty.call(MATERIAL_FILING_LABELS, form.trim().toUpperCase());
}

/** "quarterly report (10-Q)" — the form named in plain words, the code kept beside it. */
export function materialFilingLabel(form: string): string {
  const key = form.trim().toUpperCase();
  return MATERIAL_FILING_LABELS[key] ?? `filing (${form})`;
}
