// ---------------------------------------------------------------------------
// The fixed, versioned Item 1 extraction rule. M9-ITEM5-CONTENT-01.
//
// Modelled on tagMap.ts's discipline (§3.8.1): the rule names exactly what is
// read from a 10-K filing document, and its version travels with every
// excerpt it produces. There is no "search the document for something that
// looks like the business description" path — that would be extraction
// behaving like a model, the same distinction tagMap.ts draws for numeric
// tags. Where the filing's shape does not match what the rule expects, this
// REFUSES rather than guesses: a wrong figure looks plausible and is worse
// than none (secClient.ts's own fail-closed reasoning), and the same holds
// for a wrong or truncated excerpt of prose.
//
// THE RULE, stated in full because §3.8.1's discipline requires it be
// findable by a later reader:
//
//   1. The filing document is reduced to plain text (HTML tags stripped,
//      entities decoded, horizontal whitespace collapsed per line).
//   2. A START boundary is a line, and nothing else on that line, reading
//      "Item 1", optionally followed by a period and/or a dash, followed by
//      "Business" and an optional trailing period.
//   3. An END boundary is the same shape for "Item 1A" / "Risk Factors".
//   4. Exactly one START and exactly one END must exist in the document, the
//      END after the START, with at least MIN_EXCERPT_LENGTH characters of
//      text between them. Any other count — zero, or more than one, at
//      either boundary — or too little text between the one candidate pair,
//      is a refusal, not a best-effort pick. Most real 10-Ks also carry the
//      same words in a table of contents; there they sit beside a page
//      number or dot leader on the same line and so do not match the
//      STANDALONE-line shape this rule requires, which is what keeps a
//      well-formed filing's real section headings unambiguous under it.
// ---------------------------------------------------------------------------

/** Bump whenever the boundary patterns, the standalone-line requirement, or
 * MIN_EXCERPT_LENGTH change. Recorded on every excerpt this rule produces. */
export const ITEM1_EXTRACTION_RULE_VERSION = "item1-2026-09-1";

const MIN_EXCERPT_LENGTH = 200;

const ITEM1_START_LINE_RE = /^item\s+1\.?\s*[-–—]?\s*business\.?$/gim;
const ITEM1A_END_LINE_RE = /^item\s+1a\.?\s*[-–—]?\s*risk\s+factors\.?$/gim;

const BLOCK_TAG_RE = /<\/?(p|div|br|tr|td|th|li|h[1-6]|table|section|title)\b[^>]*>/gi;

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * HTML to plain text, for this rule's own use only. Deliberately small: it
 * turns block-level boundaries into line breaks and strips everything else —
 * enough to make the standalone-line boundary check meaningful, not a general
 * HTML renderer. No dependency is added for it (SCOPE item 1).
 */
function htmlToPlainText(html: string): string {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const withLineBreaks = withoutScripts.replace(BLOCK_TAG_RE, "\n");
  const withoutTags = withLineBreaks.replace(/<[^>]+>/g, " ");
  const decoded = decodeEntities(withoutTags);

  const lines = decoded.split("\n").map((line) => line.replace(/[ \t ]+/g, " ").trim());
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

export interface Item1ExtractionSuccess {
  ok: true;
  text: string;
  ruleVersion: string;
}

export interface Item1ExtractionRefusal {
  ok: false;
  reason: string;
  ruleVersion: string;
}

export type Item1Extraction = Item1ExtractionSuccess | Item1ExtractionRefusal;

function refuse(reason: string): Item1ExtractionRefusal {
  return { ok: false, reason, ruleVersion: ITEM1_EXTRACTION_RULE_VERSION };
}

/**
 * Applies the rule above to one filing document's raw HTML (or, harmlessly,
 * plain text — the strip step is then a no-op). Never throws; an
 * unparseable or unexpected shape is a refusal, per the rule's own point 4.
 */
export function extractItem1(filingDocument: string): Item1Extraction {
  const text = htmlToPlainText(filingDocument);

  const starts = [...text.matchAll(ITEM1_START_LINE_RE)];
  const ends = [...text.matchAll(ITEM1A_END_LINE_RE)];

  if (starts.length === 0) return refuse('no standalone "Item 1. Business" heading line was found');
  if (starts.length > 1) {
    return refuse(`found ${starts.length} standalone "Item 1. Business" heading lines — expected exactly one`);
  }
  if (ends.length === 0) return refuse('no standalone "Item 1A. Risk Factors" heading line was found');
  if (ends.length > 1) {
    return refuse(`found ${ends.length} standalone "Item 1A. Risk Factors" heading lines — expected exactly one`);
  }

  const start = starts[0];
  const end = ends[0];
  // matchAll's results always carry a defined `index` (they come from a
  // global-flagged exec loop); the `!` reflects that, not an assumption.
  const contentStart = start.index! + start[0].length;

  if (end.index! <= contentStart) {
    return refuse('the "Item 1A" heading appears at or before the "Item 1" heading');
  }

  const excerpt = text.slice(contentStart, end.index!).trim();
  if (excerpt.length < MIN_EXCERPT_LENGTH) {
    return refuse(
      `only ${excerpt.length} characters lie between the two headings — too short to be the section body rather than a table-of-contents artefact`
    );
  }

  return { ok: true, text: excerpt, ruleVersion: ITEM1_EXTRACTION_RULE_VERSION };
}
