// CF-AR2-GOLDEN-HARNESS-01, DO item 5 — a SIC-prefix → classification table.
//
// HARNESS-ONLY. This module is deliberately NOT wired into
// `lib/analyzer/modules/*`, `assemble.ts`, or any discount-rate selection —
// production SIC-based cyclical classification (frozen spec §14.9 AR0-1 /
// Cal Finance Methodology v2.1 D1) is explicitly AR4's job. Importing this
// file from anywhere under `lib/analyzer/modules` or from `assemble.ts`
// would be an engine change this outcome's DO NOT forbids.
//
// SCOPE — the full D1 list, fixed here as an AI DEFAULT.
//
// Cal Finance Methodology v2.1 D1: "The full list of cyclical industry codes
// is fixed and validated against a wider company set in implementation
// (AR2); steel, semiconductors, autos and chemicals ex-pharma are confirmed
// members." The methodology hands the list to this outcome; there is no
// longer list held elsewhere. The four confirmed members are encoded as
// given. Every other entry below is an AI DEFAULT (a technical choice inside
// the D1 rule, not a new rule) whose receipt is in the PR body, chosen on one
// test: does the industry's revenue and margin move with the economic,
// commodity or capital-spending cycle rather than with the company's own
// execution? Commodity producers (mining, oil and gas, refining, metals,
// paper, lumber, building materials), construction and homebuilding, capital
// goods (industrial machinery ex computers, aircraft, rail equipment, tyres),
// freight and passenger transport (trucking, shipping, airlines) and hotels
// pass; consumer staples, healthcare, software, utilities, telecoms, retail
// and railroads do not.
//
// Validated against the eight golden companies AND a wider 50-company set of
// real SEC SIC codes (`sicValidationSet.json`, captured by
// `scripts/evidence/golden/captureSicValidationSet.ts`); `goldenFacts.test.ts`
// asserts both, including the one documented miss (see that test).
//
// Direction of error: SIC is the filer's own primary code, so a company that
// files under a non-cyclical code (e.g. a paint maker that files as a
// building-materials retailer) reads "stable" here. D1's second route,
// trigger B of §6.4, is the backstop for exactly that case.
export type CyclicalityClass = "cyclical" | "stable" | "unclassified";

interface SicRange {
  // Inclusive 2-digit or 3-digit SIC prefix match, e.g. "331" matches any
  // 4-digit SIC starting "331" (3310-3319); "28" matches any SIC starting
  // "28" (2800-2899), with the exclusions list taking precedence.
  prefix: string;
  cyclical: boolean;
  label: string;
  // 3-digit (or longer) prefixes that would otherwise match `prefix` but are
  // carved out — e.g. pharmaceutical preparations (283x) is NOT cyclical
  // even though it falls inside the broader chemicals 28xx band.
  excludePrefixes?: string[];
  // One of the four D1 members the methodology itself names.
  confirmed?: boolean;
}

// First matching entry wins; exclusions are checked before the containing
// range is applied. `confirmed` marks the four D1 members named in the
// methodology; every other entry is this outcome's AI DEFAULT.
const SIC_TABLE: SicRange[] = [
  { prefix: "10", cyclical: true, label: "Metal Mining" },
  { prefix: "12", cyclical: true, label: "Coal Mining" },
  { prefix: "13", cyclical: true, label: "Oil & Gas Extraction (incl. field services)" },
  { prefix: "14", cyclical: true, label: "Mining & Quarrying of Nonmetallic Minerals" },
  { prefix: "15", cyclical: true, label: "Building Construction (incl. homebuilders)" },
  { prefix: "16", cyclical: true, label: "Heavy Construction" },
  { prefix: "17", cyclical: true, label: "Construction Special Trade Contractors" },
  { prefix: "24", cyclical: true, label: "Lumber & Wood Products" },
  { prefix: "26", cyclical: true, label: "Paper & Allied Products" },
  {
    prefix: "28",
    cyclical: true,
    confirmed: true,
    label: "Chemicals & Allied Products, excluding pharmaceuticals (283x) and soaps/cleaners/cosmetics (284x)",
    excludePrefixes: ["283", "284"],
  },
  { prefix: "29", cyclical: true, label: "Petroleum Refining & Related Industries" },
  { prefix: "301", cyclical: true, label: "Tires & Inner Tubes" },
  { prefix: "32", cyclical: true, label: "Stone, Clay, Glass & Concrete Products" },
  { prefix: "331", cyclical: true, confirmed: true, label: "Steel Works, Blast Furnaces & Rolling/Finishing Mills" },
  { prefix: "33", cyclical: true, label: "Primary Metal Industries (non-steel)" },
  { prefix: "351", cyclical: true, label: "Engines & Turbines" },
  { prefix: "352", cyclical: true, label: "Farm & Garden Machinery" },
  { prefix: "353", cyclical: true, label: "Construction, Mining & Materials Handling Machinery" },
  { prefix: "354", cyclical: true, label: "Metalworking Machinery" },
  { prefix: "355", cyclical: true, label: "Special Industry Machinery" },
  { prefix: "356", cyclical: true, label: "General Industrial Machinery" },
  { prefix: "367", cyclical: true, confirmed: true, label: "Electronic Components & Accessories (incl. semiconductors)" },
  { prefix: "371", cyclical: true, confirmed: true, label: "Motor Vehicles & Motor Vehicle Equipment" },
  { prefix: "372", cyclical: true, label: "Aircraft & Parts" },
  { prefix: "374", cyclical: true, label: "Railroad Equipment" },
  { prefix: "42", cyclical: true, label: "Motor Freight Transportation & Warehousing" },
  { prefix: "44", cyclical: true, label: "Water Transportation" },
  { prefix: "451", cyclical: true, label: "Air Transportation, Scheduled & Air Courier" },
  { prefix: "701", cyclical: true, label: "Hotels & Motels" },
];

// Default direction: D1 is a two-band split ("stable businesses at the
// market's expected return; cyclical industries ... at market + 2pp"), so a
// non-empty SIC that matches no cyclical entry above is "stable".
// "unclassified" is reserved for a missing/empty SIC (nothing to classify).
export function classifyCyclicality(sic: string | null | undefined): CyclicalityClass {
  if (!sic) return "unclassified";
  const normalized = sic.trim();
  if (normalized.length === 0) return "unclassified";

  for (const entry of SIC_TABLE) {
    if (!normalized.startsWith(entry.prefix)) continue;
    const excluded = (entry.excludePrefixes ?? []).some((ex) => normalized.startsWith(ex));
    if (excluded) continue;
    if (entry.cyclical) return "cyclical";
  }
  return "stable";
}

// Explicit SIC → textual description lookup for the entries this table
// actually classifies, so a caller (or test) can show WHY a SIC matched,
// not just the verdict. Returns null for anything `classifyCyclicality`
// returns "unclassified" for.
export function cyclicalSicLabel(sic: string | null | undefined): string | null {
  if (!sic) return null;
  const normalized = sic.trim();
  for (const entry of SIC_TABLE) {
    if (!normalized.startsWith(entry.prefix)) continue;
    const excluded = (entry.excludePrefixes ?? []).some((ex) => normalized.startsWith(ex));
    if (excluded) continue;
    return entry.label;
  }
  return null;
}

export const CYCLICAL_SIC_CLASSES: ReadonlyArray<{ prefix: string; label: string; confirmed: boolean }> = SIC_TABLE.map((e) => ({
  prefix: e.prefix,
  label: e.label,
  confirmed: e.confirmed === true,
}));
