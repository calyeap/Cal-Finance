import type { CompanyFactsDocument, XbrlFactUnitRow, XbrlTagFacts } from "./secClient";
import type { TagRef } from "./tagMap";

// ---------------------------------------------------------------------------
// CF-METHODOLOGY-V3-IMPLEMENT-01 (issue #499) — operating income for filers
// that tag none (Methodology v3: "LLY margin proxy (operating income
// untagged)" and "NUE return-on-capital input", routed as build defects).
//
// Some filers present no operating-income line at all: Eli Lilly's income
// statement runs from revenue through costs and "other–net" straight to
// pre-tax income, and Nucor's carries interest inside its costs. Their
// operating income is still exactly determined by lines they DO tag, so it is
// constructed here, once, as an explicitly named derived element that the tag
// mapping lists as a later `operating-income` candidate — never as a second
// reading of a document, and never where any component is missing.
//
//   cf-derived:OperatingIncomeLossFromPretaxLessNonoperating
//     = pre-tax income − non-operating income (expense)
//     Reproduces MSFT's and NVDA's tagged OperatingIncomeLoss exactly in
//     FY2023–FY2026 (issue #496 evidence).
//   cf-derived:OperatingIncomeLossFromPretaxAddBackNetInterest
//     = pre-tax income + interest expense − interest income
//     For filers with no non-operating total (Nucor). Equity-method earnings
//     stay in: those stakes stay in operating capital unless the §4.4
//     judgment bridges them as non-operating.
//
// A derived row exists only where EVERY component is filed for the same
// period in the same filing (accession), so it carries that filing's
// provenance and foots to it. Nothing here is a model or an estimate.
//
// CF-AR8-CORRECTIONS-01 (issue #504) adds two balance-sheet (instant) elements:
//   cf-derived:LiabilitiesFromLiabilitiesAndEquityLessEquity
//     = total liabilities and equity − total equity (including noncontrolling
//     interest; the parent-only total where that is all the filer tags, which
//     can only overstate liabilities). Calvin's ruling on #504: Methodology
//     D7's "filed total liabilities" may be this identity of two filed
//     same-date lines where a filer tags no us-gaap:Liabilities (KO). Formed
//     only where Liabilities is not tagged for that date.
//   cf-derived:CashAndMarketableSecuritiesWhereNoShortTermInvestments
//     = cash and equivalents + the balance-sheet marketable-securities line,
//     for filers that tag that line as MarketableSecuritiesCurrent or
//     DebtSecuritiesCurrent instead of ShortTermInvestments (NVDA). Formed only
//     where ShortTermInvestments is not tagged for that date, so a filer that
//     tags it keeps resolving exactly as before.
// ---------------------------------------------------------------------------

export const DERIVED_NS = "cf-derived" as const;

const PRETAX: TagRef = { ns: "us-gaap", tag: "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest" };

interface Derivation {
  tag: string;
  label: string;
  /** A flow over a period (the default) or a balance-sheet position. */
  period?: "duration" | "instant";
  /** Each component is one of the listed tags (first present wins), times its sign. */
  components: { refs: TagRef[]; sign: 1 | -1 }[];
  /** No row is formed for a period where any of these is tagged. */
  unlessTagged?: TagRef[];
}

const usGaapRef = (tag: string): TagRef => ({ ns: "us-gaap", tag });

export const DERIVATIONS: readonly Derivation[] = [
  {
    tag: "OperatingIncomeLossFromPretaxLessNonoperating",
    label: "Operating income, constructed",
    components: [
      { refs: [PRETAX], sign: 1 },
      { refs: [{ ns: "us-gaap", tag: "NonoperatingIncomeExpense" }], sign: -1 },
    ],
  },
  {
    tag: "OperatingIncomeLossFromPretaxAddBackNetInterest",
    label: "Operating income, constructed",
    components: [
      { refs: [PRETAX], sign: 1 },
      { refs: [{ ns: "us-gaap", tag: "InterestExpense" }, { ns: "us-gaap", tag: "InterestExpenseNonoperating" }], sign: 1 },
      { refs: [{ ns: "us-gaap", tag: "InvestmentIncomeInterest" }], sign: -1 },
    ],
  },
  {
    tag: "LiabilitiesFromLiabilitiesAndEquityLessEquity",
    label: "Total liabilities, constructed (total liabilities and equity − total equity)",
    period: "instant",
    components: [
      { refs: [usGaapRef("LiabilitiesAndStockholdersEquity")], sign: 1 },
      {
        refs: [usGaapRef("StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"), usGaapRef("StockholdersEquity")],
        sign: -1,
      },
    ],
    unlessTagged: [usGaapRef("Liabilities")],
  },
  {
    tag: "CashAndMarketableSecuritiesWhereNoShortTermInvestments",
    label: "Cash and marketable debt securities, constructed (cash + the marketable-securities line)",
    period: "instant",
    components: [
      { refs: [usGaapRef("CashAndCashEquivalentsAtCarryingValue")], sign: 1 },
      { refs: [usGaapRef("MarketableSecuritiesCurrent"), usGaapRef("DebtSecuritiesCurrent")], sign: 1 },
    ],
    unlessTagged: [usGaapRef("ShortTermInvestments")],
  },
];

/** Every us-gaap tag a derivation reads — the capture keeps them. */
export const DERIVATION_INPUT_TAGS: readonly TagRef[] = DERIVATIONS.flatMap((d) => [
  ...d.components.flatMap((c) => c.refs),
  ...(d.unlessTagged ?? []),
]);

function usdRows(doc: CompanyFactsDocument, ref: TagRef): XbrlFactUnitRow[] {
  return doc.facts?.[ref.ns]?.[ref.tag]?.units?.USD ?? [];
}

const periodKey = (r: XbrlFactUnitRow) => `${r.accn ?? ""}|${r.start ?? ""}|${r.end}`;

/**
 * The document with the derived elements added under
 * `cf-derived`. The filer's own facts are untouched; a document that already
 * carries derived rows is returned as is.
 */
export function withDerivedFacts(doc: CompanyFactsDocument): CompanyFactsDocument {
  if (doc.facts?.[DERIVED_NS] !== undefined) return doc;
  const derived: Record<string, XbrlTagFacts> = {};
  for (const d of DERIVATIONS) {
    const lookups = d.components.map((c) => {
      const byKey = new Map<string, number>();
      for (const ref of [...c.refs].reverse()) for (const r of usdRows(doc, ref)) byKey.set(periodKey(r), r.val);
      return { byKey, sign: c.sign };
    });
    const instant = d.period === "instant";
    const excluded = new Set((d.unlessTagged ?? []).flatMap((ref) => usdRows(doc, ref).map((r) => r.end)));
    const rows: XbrlFactUnitRow[] = [];
    for (const primary of usdRows(doc, d.components[0].refs[0])) {
      if ((primary.start === undefined) !== instant) continue;
      if (excluded.has(primary.end)) continue;
      const key = periodKey(primary);
      let total = 0;
      let complete = true;
      for (const { byKey, sign } of lookups) {
        const v = byKey.get(key);
        if (v === undefined) {
          complete = false;
          break;
        }
        total += sign * v;
      }
      if (complete) rows.push({ ...primary, val: total });
    }
    if (rows.length > 0) {
      derived[d.tag] = {
        label: `${d.label} (${d.tag})`,
        description: "Derived by Cal Finance from the filer's own tagged lines in the same filing; see derivedFacts.ts.",
        units: { USD: rows },
      };
    }
  }
  if (Object.keys(derived).length === 0) return doc;
  return { ...doc, facts: { ...doc.facts, [DERIVED_NS]: derived } };
}
