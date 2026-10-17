// CF-AR2-GOLDEN-HARNESS-01, DO item 2 — a SIC-prefix → classification table.
//
// HARNESS-ONLY. This module is deliberately NOT wired into
// `lib/analyzer/modules/*`, `assemble.ts`, or any discount-rate selection —
// production SIC-based cyclical classification (frozen spec §14.9 AR0-1 /
// Cal Finance Methodology v2.1 D1) is explicitly AR4's job. Importing this
// file from anywhere under `lib/analyzer/modules` or from `assemble.ts`
// would be an engine change this outcome's DO NOT forbids.
//
// SCOPE — what is genuinely confirmed vs what is not.
//
// The frozen spec (§14.9, amendment AR0-1) and `docs/product-decisions.md`
// item 26 both say a SIC-code-based cyclical class exists in Cal Finance
// Methodology v2.1 D1 ("cyclical industries (SEC SIC industry code, or
// trigger B of §6.4)... Finance semantics... Methodology v2.1, D1 — not
// here"). Neither document states the actual SIC-prefix table — that detail
// lives only in the external Notion methodology page, which this sandbox
// cannot reach (see CLAUDE.md boundary: "do not invent methodology; ...
// treat it as unavailable and note the gap rather than guessing a number").
//
// What IS confirmed, from the orchestrating session's brief for this task
// (independently plausible and consistent with standard SIC structure, and
// explicitly called "confirmed" there): steel (SIC 331x), semiconductors
// (SIC 367x), autos (SIC 371x), chemicals excluding pharmaceuticals (SIC
// 28xx EXCLUDING 283x, pharmaceutical preparations). This table encodes
// exactly those four confirmed classes, nothing wider. Validating it on a
// "wider company set" per DO item 2, beyond the eight golden companies
// below, would need either (a) the external Methodology v2.1 D1 text this
// sandbox cannot reach, or (b) a fresh CALVIN RULING naming more SIC
// prefixes — see the PR draft's CALVIN REQUIRED section. This file does not
// guess either way.
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
}

// Confirmed classes only (see module doc comment above). Order matters:
// first matching entry wins, and exclusions are checked before the
// containing range is applied.
const SIC_TABLE: SicRange[] = [
  { prefix: "331", cyclical: true, label: "Steel Works, Blast Furnaces & Rolling/Finishing Mills" },
  { prefix: "367", cyclical: true, label: "Electronic Components & Accessories (incl. semiconductors)" },
  { prefix: "371", cyclical: true, label: "Motor Vehicles & Motor Vehicle Equipment" },
  {
    prefix: "28",
    cyclical: true,
    label: "Chemicals & Allied Products, excluding pharmaceutical preparations",
    excludePrefixes: ["283"],
  },
];

// Default direction — DELIBERATE, documented here because it is the one
// genuinely debatable design call in this file. D1's own rule (frozen spec
// §14.9 AR0-1) is a two-band split: "stable businesses at the market's
// expected return; cyclical industries ... at market + 2pp" — i.e. in
// production there is no third "unclassified, rate undetermined" bucket for
// an ordinary non-financial, revenue-generating company; every such company
// is either confirmed cyclical or defaults to stable. This function
// therefore returns "stable" for any non-empty SIC that does NOT match the
// confirmed-cyclical table above, and reserves "unclassified" for a missing/
// empty SIC only (nothing to classify at all). THE RISK this creates: a
// genuinely cyclical industry this table has not yet confirmed (airlines,
// homebuilders, oil & gas E&P, mining, shipping — none examined here) would
// default to "stable" and get the wrong discount-rate band once this
// classification is ever wired into production (AR4, not this outcome).
// This is exactly the gap DO item 2's "validate on a wider company set" is
// asking about; this harness validates only the four confirmed classes
// above against the eight golden companies and flags the remainder as a
// CALVIN REQUIRED open question in the PR draft rather than guessing which
// other industries belong on the cyclical side of this default.
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

export const CONFIRMED_SIC_CLASSES: ReadonlyArray<{ prefix: string; label: string }> = SIC_TABLE.map((e) => ({
  prefix: e.prefix,
  label: e.label,
}));
