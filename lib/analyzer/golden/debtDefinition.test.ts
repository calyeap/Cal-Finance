import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import msft from "./msft.json";
import cost from "./cost.json";
import nvda from "./nvda.json";
import nue from "./nue.json";
import ko from "./ko.json";
import oklo from "./oklo.json";
import lly from "./lly.json";
import jpm from "./jpm.json";

// CF-LEG2-KO-GOLDEN-DEBT-01 (issue #485) — one written definition of golden
// total debt (README.md, "Total debt"), asserted for every golden company:
//
//   total debt = short-term borrowings + current maturities of long-term debt
//              + long-term debt + finance leases presented as debt
//
// Each non-null totalDebt carries the presented debt lines it is the sum of
// ("presentedLines", each saying which of the four terms it covers) and, for
// any term with no line, the reason ("notPresented"). The value must equal the
// sum of those lines, every term must be accounted for, and no short-term
// borrowing the filer tagged at the golden instant may be missing — checked
// against the pinned AR6 capture, which is independent of the golden file.

type Term = "shortTermBorrowings" | "currentMaturities" | "longTermDebt" | "financeLeases";
const TERMS: Term[] = ["shortTermBorrowings", "currentMaturities", "longTermDebt", "financeLeases"];

interface PresentedLine {
  covers: Term[];
  conceptLabel: string;
  xbrlConcept: string;
  value: number;
}

interface TotalDebt {
  value: number;
  periodEnd: string;
  accessionNumber: string;
  presentedLines?: PresentedLine[];
  notPresented?: Partial<Record<Term, string>>;
}

const ALL: [string, { facts: { totalDebt: unknown } }][] = [
  ["MSFT", msft],
  ["COST", cost],
  ["NVDA", nvda],
  ["NUE", nue],
  ["KO", ko],
  ["OKLO", oklo],
  ["LLY", lly],
  ["JPM", jpm],
];

const WITH_DEBT = ALL.filter(([, c]) => c.facts.totalDebt !== null).map(
  ([ticker, c]) => [ticker, c.facts.totalDebt as TotalDebt] as const
);

// Short-term-borrowing elements: each is a short-term borrowing (or a sum of
// them) on its own. DebtCurrent is checked separately below, since it also
// carries current maturities.
const SHORT_TERM_ELEMENTS = ["CommercialPaper", "ShortTermBorrowings", "OtherShortTermBorrowings", "NotesAndLoansPayable"];

function capturedAt(ticker: string, tag: string, end: string, accn: string): number | null {
  const doc = JSON.parse(
    readFileSync(
      join(__dirname, "..", "acquisition", "captures", "ar6-2026-10-18", `${ticker.toLowerCase()}-companyfacts.json`),
      "utf8"
    )
  ) as { facts: { "us-gaap"?: Record<string, { units: { USD?: { end: string; val: number; accn: string; start?: string }[] } }> } };
  const rows = doc.facts["us-gaap"]?.[tag]?.units.USD ?? [];
  const row = rows.find((r) => r.end === end && r.accn === accn && r.start === undefined);
  return row === undefined ? null : row.val;
}

function covered(debt: TotalDebt, terms: Term[]): number {
  return (debt.presentedLines ?? []).filter((l) => l.covers.some((t) => terms.includes(t))).reduce((s, l) => s + l.value, 0);
}

describe("golden total debt — one written definition (CF-LEG2-KO-GOLDEN-DEBT-01)", () => {
  it("JPM and OKLO are the only golden companies without a total-debt fact, each with its stated reason", () => {
    expect(WITH_DEBT.map(([t]) => t)).toEqual(["MSFT", "COST", "NVDA", "NUE", "KO", "LLY"]);
  });

  it.each(WITH_DEBT)("%s: every presented line is a us-gaap element covering only the defined terms", (_ticker, debt) => {
    expect(debt.presentedLines?.length ?? 0).toBeGreaterThan(0);
    for (const line of debt.presentedLines!) {
      expect(line.xbrlConcept).toMatch(/^us-gaap:\w+$/);
      expect(line.conceptLabel.length).toBeGreaterThan(0);
      expect(line.covers.length).toBeGreaterThan(0);
      for (const t of line.covers) expect(TERMS).toContain(t);
    }
  });

  it.each(WITH_DEBT)("%s: every term is either covered by a presented line or not presented with a reason, never both", (_ticker, debt) => {
    for (const t of TERMS) {
      const byLine = debt.presentedLines!.some((l) => l.covers.includes(t));
      const reason = debt.notPresented?.[t];
      expect(byLine !== (reason !== undefined), `term ${t}`).toBe(true);
      if (reason !== undefined) expect(reason.length).toBeGreaterThan(20);
    }
  });

  it.each(WITH_DEBT)("%s: total debt equals the sum of its presented debt lines", (_ticker, debt) => {
    const sum = debt.presentedLines!.reduce((s, l) => s + l.value, 0);
    expect(debt.value).toBe(sum);
  });

  it.each(WITH_DEBT)(
    "%s: no short-term borrowing tagged at the golden instant in the pinned capture is left out",
    (ticker, debt) => {
      for (const tag of SHORT_TERM_ELEMENTS) {
        const v = capturedAt(ticker, tag, debt.periodEnd, debt.accessionNumber);
        if (v === null || v === 0) continue;
        expect(covered(debt, ["shortTermBorrowings"]), `${tag} ${v}`).toBeGreaterThanOrEqual(v);
      }
      const current = capturedAt(ticker, "DebtCurrent", debt.periodEnd, debt.accessionNumber);
      if (current !== null && current !== 0) {
        expect(covered(debt, ["shortTermBorrowings", "currentMaturities"]), `DebtCurrent ${current}`).toBe(current);
      }
    }
  );
});
