import Decimal from "decimal.js";
import { acquireCompany, type AcquiredCompany } from "../acquisition/provider";
import { draftRate } from "../acquisition/aiProposedBundle";
import type { MoatClass } from "../types";
import { historyFrom } from "./research";
import { errorsIn, staleFindings, validateSheet, type ValidationContext, type ValidatorFinding } from "./validators";
import { DRIVER_KEYS, DRIVER_LABELS, SCENARIO_KEYS, type AssumptionSheet, type DriverKey, type ScenarioKey, type SheetContent } from "./sheet";
import { appendSheet, getSheet, normalizeTicker } from "./sheetStore";

// ---------------------------------------------------------------------------
// CF-AR6-ANY-TICKER-DRAFTS-01 — adopt / adjust (product-decisions item 30,
// D5; item 19: adoption is Calvin's authorship of the scenarios).
//
// Adopting appends a new ADOPTED version built from one version, as
// drafted or with Calvin's adjustments to any driver, the moat class or the
// two policy constants. The draft row is never edited (the table refuses
// it). Every adjusted driver keeps the draft's anchor and records what was
// changed, from what, and Calvin's note.
//
// The validators run on the adopted sheet. Structural errors (an incomplete
// sheet, drivers out of order, a share count in the wrong unit) block the
// adoption; the history-range checks are warnings here, because a driver
// Calvin sets outside the filed range is his call, not the software's.
// ---------------------------------------------------------------------------

export interface SheetAdjustments {
  /** New values by scenario and driver, as decimal text. Absent or equal to the draft: kept as drafted. */
  scenarios?: Partial<Record<ScenarioKey, Partial<Record<DriverKey, string>>>>;
  moatClass?: MoatClass | null;
  nopatTaxRate?: string | null;
  stressMarginLevel?: string | null;
  /** Calvin's reason for the adjustments, recorded on each one. */
  note?: string | null;
}

export class AdoptionRefusedError extends Error {
  readonly findings: ValidatorFinding[];
  constructor(message: string, findings: ValidatorFinding[] = []) {
    super(message);
    this.name = "AdoptionRefusedError";
    this.findings = findings;
  }
}

function same(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a === null || a === undefined || a.trim() === "") return b === null || b === undefined || b.trim() === "";
  if (b === null || b === undefined || b.trim() === "") return false;
  try {
    return new Decimal(a.trim()).equals(new Decimal(b.trim()));
  } catch {
    return a.trim() === b.trim();
  }
}

function requireDecimalText(raw: string, label: string): string {
  const trimmed = raw.trim();
  try {
    const d = new Decimal(trimmed);
    if (!d.isFinite()) throw new Error();
  } catch {
    throw new AdoptionRefusedError(`${label} is not a number: "${raw}"`);
  }
  return trimmed;
}

/** The draft with the adjustments applied, and a plain list of what changed. */
export function applyAdjustments(draft: SheetContent, adj: SheetAdjustments): { content: SheetContent; changes: string[] } {
  const changes: string[] = [];
  const note = adj.note?.trim() ? ` — "${adj.note.trim()}"` : "";
  const scenarios = {} as SheetContent["scenarios"];
  for (const key of SCENARIO_KEYS) {
    const s = { ...draft.scenarios[key], anchors: { ...(draft.scenarios[key].anchors ?? {}) } };
    for (const d of DRIVER_KEYS) {
      const next = adj.scenarios?.[key]?.[d];
      if (next === undefined) continue;
      const before = (s[d] ?? null) as string | null;
      if (same(next, before)) continue;
      const value = requireDecimalText(next, `${key} ${DRIVER_LABELS[d]}`);
      (s as Record<string, unknown>)[d] = value;
      changes.push(`${key} ${DRIVER_LABELS[d]} ${before ?? "unset"} → ${value}`);
      const anchor = s.anchors[d];
      s.anchors[d] = {
        text: `Adjusted by Calvin from ${before ?? "unset"} to ${value}${note}.${anchor ? ` Draft anchor: ${anchor.text}` : ""}`,
        cites: anchor?.cites ?? [],
      };
    }
    scenarios[key] = s;
  }
  let moatClass = draft.moatClass;
  let moatAnchor = draft.moatAnchor ?? null;
  if (adj.moatClass !== undefined && adj.moatClass !== draft.moatClass) {
    changes.push(`moat class ${draft.moatClass ?? "unset"} → ${adj.moatClass ?? "unset"}`);
    moatClass = adj.moatClass;
    moatAnchor = {
      text: `Set by Calvin to ${adj.moatClass ?? "unset"}${note}.${draft.moatAnchor ? ` Draft mechanism: ${draft.moatAnchor.text}` : ""}`,
      cites: draft.moatAnchor?.cites ?? [],
    };
  }
  const constants = { ...draft.configuredConstants };
  for (const k of ["nopatTaxRate", "stressMarginLevel"] as const) {
    const next = adj[k];
    if (next === undefined || same(next, constants[k])) continue;
    const value = next === null || next.trim() === "" ? null : requireDecimalText(next, k);
    changes.push(`${k} ${constants[k] ?? "unset"} → ${value ?? "unset"}`);
    constants[k] = value;
  }
  return {
    content: {
      ...draft,
      scenarios,
      moatClass,
      moatAnchor,
      configuredConstants: constants,
      // Adoption values from the drivers under the approved rules; a migrated
      // bundle's typed dollar figures never travel past it.
      legacyScenarioValues: null,
    },
    changes,
  };
}

/** The validation context for a ticker's sheet: its filed history now, and the D1 rate. */
export async function validationContextFor(
  ticker: string,
  content: SheetContent,
  acquire: (ticker: string) => Promise<AcquiredCompany> = (t) =>
    acquireCompany(t, { price: null, source: process.env.ANALYZER_OFFLINE === "1" ? "CAPTURE" : undefined })
): Promise<ValidationContext & { stale: ValidatorFinding[] }> {
  const acquired = await acquire(normalizeTicker(ticker));
  const { measures } = historyFrom(acquired.companyFacts);
  const rate = draftRate(acquired, measures, content.profile, new Date().toISOString().slice(0, 10)).rate;
  return { measures, rate, requireAnchors: false, forAdoption: true, stale: staleFindings(content, measures) };
}

/**
 * Adopts one version — a draft, or an adopted sheet Calvin adjusts again:
 * appends the ticker's next version as ADOPTED. Refuses a version that is
 * not this ticker's, records that no sheet can be concluded, or would fail a
 * structural check.
 */
export async function adoptSheet(
  ticker: string,
  draftId: number,
  adj: SheetAdjustments,
  context: ValidationContext
): Promise<{ sheet: AssumptionSheet; changes: string[]; warnings: ValidatorFinding[] }> {
  const symbol = normalizeTicker(ticker);
  const draft = await getSheet(draftId);
  if (draft === null || draft.ticker !== symbol) throw new AdoptionRefusedError(`no assumption sheet ${draftId} for ${symbol}`);
  if (draft.content.cannotConclude) {
    throw new AdoptionRefusedError(`version ${draft.version} records that no sheet can be drafted: ${draft.content.cannotConclude}`);
  }

  const { content, changes } = applyAdjustments(draft.content, adj);
  const findings = validateSheet(content, { ...context, requireAnchors: false, forAdoption: true });
  const errors = errorsIn(findings);
  if (errors.length > 0) {
    throw new AdoptionRefusedError(`the sheet cannot be adopted: ${errors.map((e) => e.message).join("; ")}`, errors);
  }

  const sheet = await appendSheet({
    ticker: symbol,
    status: "ADOPTED",
    origin: changes.length === 0 ? "ADOPTED AS DRAFTED" : "ADOPTED WITH ADJUSTMENTS",
    content,
    adoptedFrom: draft.id,
    model: draft.model,
  });
  return { sheet, changes, warnings: findings.filter((f) => f.severity === "WARNING") };
}
