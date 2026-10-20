import Decimal from "decimal.js";
import type { AnalystInputBundle } from "../acquisition/analystInputs";
import type { ScenarioDriverInputs, ScenarioInputSet } from "../assemble";
import type { AssumptionSheetReference, MoatClass, Profile } from "../types";

// ---------------------------------------------------------------------------
// CF-AR6-ANY-TICKER-DRAFTS-01 — the assumption sheet (product-decisions items
// 19 and 30, D5; frozen spec §14.9 AR0-6).
//
// One sheet per version per ticker, stored append-only (migration 014,
// sheetStore.ts). A sheet carries every assumption Step 7 needs — the three
// scenarios' drivers, the moat class and the policy constants — and, beside
// each driver, its anchor: the reasoning and the ids of the research sources
// it rests on. The sources themselves travel inside the sheet, so a sheet
// read back years later still shows exactly what each driver cited.
//
// A sheet is DRAFT or ADOPTED. A DRAFT values automatically and shows its
// verdict zone; the final verdict waits for Calvin's adoption, which is his
// authorship of the scenarios (item 19). Adopting appends a new ADOPTED row —
// as drafted, or with his adjustments — and never edits the draft.
//
// Decimals are held as text end to end, exactly as typed or proposed, so no
// float rounding enters a stored assumption.
// ---------------------------------------------------------------------------

export type SheetStatus = "DRAFT" | "ADOPTED";

export type SheetOrigin =
  | "AI DRAFT"
  | "CANNOT CONCLUDE"
  | "MIGRATED BUNDLE"
  | "ADOPTED AS DRAFTED"
  | "ADOPTED WITH ADJUSTMENTS";

export const SCENARIO_KEYS = ["bear", "base", "bull"] as const;
export type ScenarioKey = (typeof SCENARIO_KEYS)[number];

/** The drivers a scenario carries, each of which must cite its anchor. */
export const DRIVER_KEYS = [
  "revenueGrowthOrPath",
  "operatingMargin",
  "returnOnNewInvestment",
  "reinvestmentCapitalIntensity",
  "shareCount",
] as const;
export type DriverKey = (typeof DRIVER_KEYS)[number];

export const DRIVER_LABELS: Record<DriverKey, string> = {
  revenueGrowthOrPath: "revenue growth",
  operatingMargin: "operating margin",
  returnOnNewInvestment: "return on new investment",
  reinvestmentCapitalIntensity: "reinvestment (share of revenue)",
  shareCount: "share count",
};

/** Where a cited fact or passage came from. Every anchor cites these ids. */
export interface SheetSource {
  /** Stable within the sheet: "F1" (filing text), "E1" (earnings release), "H:revenue" (history). */
  id: string;
  kind: "FILING TEXT" | "EARNINGS RELEASE" | "HISTORY" | "REFERENCE";
  label: string;
  form: string | null;
  accession: string | null;
  filed: string | null;
  url: string | null;
  /** The passage or the series as the drafting call saw it. */
  excerpt: string;
}

export interface DriverAnchor {
  text: string;
  cites: string[];
}

export interface SheetScenario {
  /** A constant annual rate, as decimal text. Null: not authored. */
  revenueGrowthOrPath: string | null;
  operatingMargin: string | null;
  reinvestmentCapitalIntensity: string | null;
  /** Methodology v2.1 D2. Null: not authored — the sheet then cannot be valued under D2. */
  returnOnNewInvestment?: string | null;
  /** The absolute diluted share count this scenario is valued on. */
  shareCount: string;
  /** The scenario's story, in one paragraph. Required. */
  writtenAnchor: string;
  /** One anchor per driver. Absent only on a sheet migrated from a recorded bundle. */
  anchors?: Partial<Record<DriverKey, DriverAnchor>>;
}

export interface SheetClassificationInputs {
  revenueScale: "zero" | "small" | "large";
  fcfCharacter: "negative" | "positive_volatile" | "positive_stable";
  revenueGrowthBand: ">30%" | "10-30%" | "<10%";
  capitalIntensity: string;
  cyclicality: { tenYearMarginRange: string; worstSingleYearChange: string };
  balanceSheetNature: "asset-light" | "asset-heavy";
}

export interface SheetConstants {
  nopatTaxRate: string | null;
  stressMarginLevel: string | null;
  preRevenueUnleveredRate: string | null;
  projectDebtCost: string | null;
}

/**
 * What the draft was built on — for the stale-assumption check and the
 * share-count unit. Absent on a migrated sheet.
 */
export interface SheetBasis {
  /** The latest fiscal year in the history the draft saw. */
  latestFiscalYear: string | null;
  /** The latest discrete quarter end the draft saw. */
  latestQuarterEnd: string | null;
  /** Trailing-twelve-month revenue at that quarter, as decimal text. */
  ttmRevenue: string | null;
  /** Diluted share count the share-count multiples were applied to. */
  dilutedShares: string | null;
}

export interface SheetContent {
  profile: Profile;
  classificationInputs: SheetClassificationInputs;
  scenarios: Record<ScenarioKey, SheetScenario>;
  moatClass: MoatClass | null;
  moatAnchor?: DriverAnchor | null;
  configuredConstants: SheetConstants;
  /**
   * CF-METHODOLOGY-V3-IMPLEMENT-01 — the NOPAT tax rate Calvin set at
   * adoption, as decimal text. Absent or null: the engine uses the filed
   * 3-yr average effective rate (Methodology v3 D5), whatever
   * `configuredConstants.nopatTaxRate` the draft proposed.
   */
  taxRateOverride?: string | null;
  constantsAnchor?: DriverAnchor | null;
  sources?: SheetSource[];
  basis?: SheetBasis | null;
  /** Set where no sheet can be drafted from history (e.g. pre-revenue): the valuation cannot be concluded. */
  cannotConclude?: string | null;
  /** How an AI-drafted sheet was formed from its independent drafts (CALVIN RULING — A on #454). */
  drafting?: string | null;
  /** A migrated recorded bundle's typed dollar values — never presented once D2 applies (assemble.ts). */
  legacyScenarioValues?: Record<ScenarioKey, string> | null;
  migratedFrom?: { table: string; recordedAt: string; updatedAt: string } | null;
}

export interface AssumptionSheet {
  id: number;
  ticker: string;
  version: number;
  status: SheetStatus;
  origin: SheetOrigin;
  content: SheetContent;
  adoptedFrom: number | null;
  model: string | null;
  recordedAt: string;
}

/** The sheet a run is valued on, as the result carries it. */
export type SheetReference = AssumptionSheetReference;

export function sheetReference(sheet: AssumptionSheet): SheetReference {
  return {
    id: sheet.id,
    version: sheet.version,
    status: sheet.status,
    origin: sheet.origin,
    recordedAt: sheet.recordedAt,
    cannotConclude: sheet.content.cannotConclude ?? null,
  };
}

function decimalOrNull(raw: string | null | undefined): Decimal | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : new Decimal(trimmed);
}

function driverInputs(s: SheetScenario): ScenarioDriverInputs {
  return {
    revenueGrowthOrPath: decimalOrNull(s.revenueGrowthOrPath),
    operatingMargin: decimalOrNull(s.operatingMargin),
    reinvestmentCapitalIntensity: decimalOrNull(s.reinvestmentCapitalIntensity),
    shareCount: new Decimal(s.shareCount),
    writtenAnchor: s.writtenAnchor,
    returnOnNewInvestment: decimalOrNull(s.returnOnNewInvestment),
  };
}

function dateOnly(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/** The disclosure a run on this sheet carries — who authored it, and when. */
export function sheetDisclosure(sheet: AssumptionSheet): string {
  const on = dateOnly(sheet.recordedAt);
  const v = `assumption sheet version ${sheet.version} for ${sheet.ticker}`;
  switch (sheet.origin) {
    case "AI DRAFT":
      return (
        `The three scenarios, the moat class and two policy constants on this run are ${v}, a price-blind AI draft ` +
        `written ${on} from this company's filings and filed history — every driver cites its anchor. It is not yet ` +
        `adopted: the report and valuation are computed from it, and the final verdict waits for Calvin's adoption. ` +
        `They are assumptions, NOT acquired from filings; every fact, gate and margin figure on this run comes from SEC filings.`
      );
    case "CANNOT CONCLUDE":
      return `No assumption sheet could be drafted for ${sheet.ticker} (${v}, ${on}): ${sheet.content.cannotConclude ?? "no reason recorded"}`;
    case "MIGRATED BUNDLE":
      return (
        `The scenarios on this run are ${v}, migrated ${on} from the analyst bundle recorded for ${sheet.ticker}` +
        `${sheet.content.migratedFrom ? ` on ${dateOnly(sheet.content.migratedFrom.recordedAt)}` : ""}. It awaits one ` +
        `re-adoption under the approved rules (return on new investment and moat class). They are assumptions, NOT ` +
        `acquired from filings; every fact, gate and margin figure on this run comes from SEC filings.`
      );
    case "ADOPTED AS DRAFTED":
    case "ADOPTED WITH ADJUSTMENTS":
      return (
        `The scenarios on this run are ${v}, adopted by Calvin on ${on}` +
        `${sheet.origin === "ADOPTED WITH ADJUSTMENTS" ? " with his adjustments" : " as drafted"}. They are assumptions, ` +
        `NOT acquired from filings; every fact, gate and margin figure on this run comes from SEC filings.`
      );
  }
}

/**
 * The sheet as the engine reads it — the one shape analystInputsFor returns.
 * A migrated sheet keeps its recorded bundle's typed dollar values and their
 * flag, so assembly treats it exactly as it treated the recorded bundle; any
 * other sheet is valued by the engine from its drivers.
 */
export function bundleFromSheet(sheet: AssumptionSheet): AnalystInputBundle {
  const c = sheet.content;
  const scenarios: ScenarioInputSet = {
    bear: driverInputs(c.scenarios.bear),
    base: driverInputs(c.scenarios.base),
    bull: driverInputs(c.scenarios.bull),
  };
  const legacy = c.legacyScenarioValues ?? null;
  return {
    inputs: {
      profile: {
        recommended: c.profile,
        confirmedOrOverridden: c.profile,
        override: null,
        classificationInputs: {
          revenueScale: c.classificationInputs.revenueScale,
          fcfCharacter: c.classificationInputs.fcfCharacter,
          revenueGrowthBand: c.classificationInputs.revenueGrowthBand,
          capitalIntensity: new Decimal(c.classificationInputs.capitalIntensity),
          cyclicality: {
            tenYearMarginRange: new Decimal(c.classificationInputs.cyclicality.tenYearMarginRange),
            worstSingleYearChange: new Decimal(c.classificationInputs.cyclicality.worstSingleYearChange),
          },
          balanceSheetNature: c.classificationInputs.balanceSheetNature,
        },
      },
      scenarios,
      moatClass: c.moatClass,
      scenarioValues:
        legacy === null
          ? null
          : { bear: new Decimal(legacy.bear), base: new Decimal(legacy.base), bull: new Decimal(legacy.bull) },
      scenarioValuesAreFixtureCarried: false,
      ...(legacy === null
        ? {}
        : {
            recordedScenarioValuesComputeFromDrivers: SCENARIO_KEYS.every(
              (k) => scenarios[k].revenueGrowthOrPath !== null && scenarios[k].operatingMargin !== null && scenarios[k].reinvestmentCapitalIntensity !== null
            ),
          }),
      revalueBaseCaseAtRate: null,
      configuredConstants: {
        nopatTaxRate: decimalOrNull(c.configuredConstants.nopatTaxRate),
        stressMarginLevel: decimalOrNull(c.configuredConstants.stressMarginLevel),
        preRevenueUnleveredRate: decimalOrNull(c.configuredConstants.preRevenueUnleveredRate),
        projectDebtCost: decimalOrNull(c.configuredConstants.projectDebtCost),
      },
      taxRateOverride: decimalOrNull(c.taxRateOverride ?? null),
      preRevenue: null,
      sheet: sheetReference(sheet),
    },
    note: sheetDisclosure(sheet),
  };
}
