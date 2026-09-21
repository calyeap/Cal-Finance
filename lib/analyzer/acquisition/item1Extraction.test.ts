import { describe, it, expect } from "vitest";
import { extractItem1, ITEM1_EXTRACTION_RULE_VERSION } from "./item1Extraction";

// M9-ITEM5-CONTENT-01 SCOPE item 5 — network-free tests of the fixed
// extraction rule against fixture filing documents, including a shape the
// rule must REFUSE rather than guess at.

const LONG_PARAGRAPH =
  "We design, develop and sell a wide range of products and services. " .repeat(10);

function wellFormedFiling(): string {
  return `
    <html><body>
      <div>Table of contents</div>
      <p>Item 1.  Business ..................... 4</p>
      <p>Item 1A.  Risk Factors ..................... 22</p>
      <p>Item 1. Business</p>
      <p>${LONG_PARAGRAPH}</p>
      <p>Item 1A. Risk Factors</p>
      <p>Our business is subject to a number of risks.</p>
    </body></html>
  `;
}

describe("extractItem1 — the fixed, versioned rule", () => {
  it("extracts the excerpt between the standalone Item 1 and Item 1A headings, tagged with the rule version", () => {
    const result = extractItem1(wellFormedFiling());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.ruleVersion).toBe(ITEM1_EXTRACTION_RULE_VERSION);
    expect(result.text).toContain("We design, develop and sell");
    // Neither heading itself, nor the table-of-contents entries (which carry
    // a page number / dot leader and so never match the standalone-line
    // boundary), leak into the excerpt.
    expect(result.text).not.toContain("Item 1.");
    expect(result.text).not.toContain("Item 1A");
    expect(result.text).not.toContain(".....");
  });

  it("is tolerant of a dash between the item number and its title", () => {
    const html = wellFormedFiling().replace("Item 1. Business</p>", "Item 1 - Business</p>");
    const result = extractItem1(html);
    expect(result.ok).toBe(true);
  });

  it("REFUSES — the filing shape it must not guess at — when the heading appears more than once as a standalone line", () => {
    // A malformed/duplicated filing: the real Item 1 heading appears twice
    // as a standalone line (not the table-of-contents shape, which never
    // matches the standalone pattern).
    const html = `
      <p>Item 1. Business</p>
      <p>${LONG_PARAGRAPH}</p>
      <p>Item 1. Business</p>
      <p>${LONG_PARAGRAPH}</p>
      <p>Item 1A. Risk Factors</p>
    `;
    const result = extractItem1(html);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected refusal");
    expect(result.reason).toContain("expected exactly one");
    expect(result.ruleVersion).toBe(ITEM1_EXTRACTION_RULE_VERSION);
  });

  it("refuses when no Item 1A boundary exists at all", () => {
    const html = `<p>Item 1. Business</p><p>${LONG_PARAGRAPH}</p>`;
    const result = extractItem1(html);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected refusal");
    expect(result.reason).toContain("Item 1A");
  });

  it("refuses when no Item 1 boundary exists at all", () => {
    const html = `<p>Some unrelated document with no Item headings at all.</p>`;
    const result = extractItem1(html);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected refusal");
    expect(result.reason).toContain("Item 1. Business");
  });

  it("refuses rather than extracting a near-empty span between two adjacent headings (a table-of-contents artefact, not a real body)", () => {
    const html = `<p>Item 1. Business</p><p>Item 1A. Risk Factors</p>`;
    const result = extractItem1(html);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected refusal");
    expect(result.reason).toContain("too short");
  });
});
