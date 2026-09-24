import Decimal from "decimal.js";
import { getPool } from "../../db";
import type { AnalystInputBundle } from "./analystInputs";
import type { ScenarioInputSet, ScenarioDriverInputs } from "../assemble";

// ---------------------------------------------------------------------------
// CF-ANALYST-INPUT-ENTRY-01 — the store behind the recorded, reusable entry
// path analystInputs.ts's own header says does not exist yet ("the screen
// where you enter scenarios is not built yet"). This file is that screen's
// persistence: one row per ticker in analyzer_recorded_analyst_bundles
// (migration 006), read back into exactly the AnalystInputBundle shape
// analystInputsFor already returns for MSFT and OKLO.
//
// One resolver, not two (SCOPE item 2): analystInputsFor is still the only
// function anything calls to obtain a bundle. This module has no exported
// function with "InputsFor" in its name and is never imported by
// acquiredRun.ts or calibrate-position.ts — only analystInputsFor imports
// it, as a second SOURCE for the one resolver to read.
//
// preRevenue and revalueBaseCaseAtRate are never stored here — see
// migration 006's header for why — so `profile` below is restricted to the
// two classifications that need neither: PRE_REVENUE_UNPROFITABLE is not
// offered, and ASSET_BASED is reachable only through the Gate 0 override on
// any run (design §5.3), never through a profile selector, recorded or
// fixture-carried alike.
// ---------------------------------------------------------------------------

export type RecordableProfile =
  | "MATURE_PROFITABLE_STABLE_FCF"
  | "HIGH_GROWTH_PROFITABLE_UNCERTAIN_DURABILITY";

export const RECORDABLE_PROFILES: readonly RecordableProfile[] = [
  "MATURE_PROFITABLE_STABLE_FCF",
  "HIGH_GROWTH_PROFITABLE_UNCERTAIN_DURABILITY",
];

export interface RecordedClassificationInputs {
  revenueScale: "zero" | "small" | "large";
  fcfCharacter: "negative" | "positive_volatile" | "positive_stable";
  revenueGrowthBand: ">30%" | "10-30%" | "<10%";
  /** Decimal, as text — e.g. "0.12" for 12% of revenue. */
  capitalIntensity: string;
  cyclicality: {
    /** Decimal, as text — points, e.g. "0.214" for 21.4pt. */
    tenYearMarginRange: string;
    worstSingleYearChange: string;
  };
  balanceSheetNature: "asset-light" | "asset-heavy";
}

/** A scenario's drivers, exactly as an analyst enters them: a required share
 * count and written anchor, and three drivers that may be left blank. Held as
 * text so the store round-trips the exact digits a human typed rather than a
 * float's rounding — the same reason every other Decimal in this codebase
 * arrives from a string, never a number literal. */
export interface RecordedScenarioDriverInput {
  /** Blank means "not authored" — recorded and returned as null, never 0. A
   * constant rate only (Decimal, as text); an explicit year-by-year path is
   * not offered by this entry surface. */
  revenueGrowthOrPath: string | null;
  operatingMargin: string | null;
  reinvestmentCapitalIntensity: string | null;
  shareCount: string;
  writtenAnchor: string;
}

export interface RecordedScenarios {
  bear: RecordedScenarioDriverInput;
  base: RecordedScenarioDriverInput;
  bull: RecordedScenarioDriverInput;
}

export interface RecordedScenarioValues {
  bear: string;
  base: string;
  bull: string;
}

/** The four §7.1 constants. Each independently blank-is-absent. */
export interface RecordedConfiguredConstants {
  nopatTaxRate: string | null;
  stressMarginLevel: string | null;
  preRevenueUnleveredRate: string | null;
  projectDebtCost: string | null;
}

export interface RecordedAnalystBundleInput {
  profile: RecordableProfile;
  classificationInputs: RecordedClassificationInputs;
  scenarios: RecordedScenarios;
  scenarioValues: RecordedScenarioValues;
  configuredConstants: RecordedConfiguredConstants;
}

export interface RecordedAnalystBundleMeta {
  recordedAt: string;
  updatedAt: string;
}

const SCENARIO_KEYS = ["bear", "base", "bull"] as const;
const NULLABLE_DRIVER_KEYS = [
  "revenueGrowthOrPath",
  "operatingMargin",
  "reinvestmentCapitalIntensity",
] as const;

function normalizeTicker(raw: string): string {
  const ticker = raw.trim().toUpperCase();
  if (ticker === "") throw new Error("A ticker is required");
  return ticker;
}

function requireDecimal(raw: string, label: string): Decimal {
  const trimmed = raw.trim();
  if (trimmed === "") throw new Error(`${label} is required`);
  return new Decimal(trimmed);
}

function optionalDecimal(raw: string | null, label: string): Decimal | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  // Validated eagerly so a malformed entry fails on write, not on the next
  // read — new Decimal throws on non-numeric text.
  try {
    return new Decimal(trimmed);
  } catch {
    throw new Error(`${label} is not a number`);
  }
}

function requireWrittenAnchor(raw: string, label: string): string {
  const trimmed = raw.trim();
  // §5.4 / ScenarioDriverSet.writtenAnchor: "Required, free text, cannot be
  // empty" — the same rule the fixture-carried bundles already satisfy.
  if (trimmed === "") throw new Error(`${label} written anchor cannot be empty (design §5.4)`);
  return trimmed;
}

/**
 * Validates and upserts one ticker's recorded bundle.
 *
 * Every Decimal-shaped field is parsed here, eagerly, so a malformed entry
 * is refused on write rather than surfacing later as a broken report. The
 * scenario values and each scenario's share count / written anchor are
 * required; every driver and every §7.1 constant may be left absent.
 */
export async function recordAnalystBundle(
  rawTicker: string,
  input: RecordedAnalystBundleInput
): Promise<void> {
  const ticker = normalizeTicker(rawTicker);

  if (!RECORDABLE_PROFILES.includes(input.profile)) {
    throw new Error(`Unsupported profile for a recorded bundle: ${input.profile}`);
  }

  for (const key of SCENARIO_KEYS) {
    const scenario = input.scenarios[key];
    requireWrittenAnchor(scenario.writtenAnchor, key);
    requireDecimal(scenario.shareCount, `${key} share count`);
    for (const driverKey of NULLABLE_DRIVER_KEYS) {
      optionalDecimal(scenario[driverKey], `${key} ${driverKey}`);
    }
    requireDecimal(input.scenarioValues[key], `${key} scenario value`);
  }

  optionalDecimal(input.configuredConstants.nopatTaxRate, "nopatTaxRate");
  optionalDecimal(input.configuredConstants.stressMarginLevel, "stressMarginLevel");
  optionalDecimal(input.configuredConstants.preRevenueUnleveredRate, "preRevenueUnleveredRate");
  optionalDecimal(input.configuredConstants.projectDebtCost, "projectDebtCost");

  requireDecimal(input.classificationInputs.capitalIntensity, "capital intensity");
  requireDecimal(input.classificationInputs.cyclicality.tenYearMarginRange, "ten-year margin range");
  requireDecimal(
    input.classificationInputs.cyclicality.worstSingleYearChange,
    "worst single-year change"
  );

  await getPool().query(
    `INSERT INTO analyzer_recorded_analyst_bundles
       (ticker, profile, classification_inputs, scenarios, scenario_values, configured_constants)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (ticker) DO UPDATE SET
       profile = EXCLUDED.profile,
       classification_inputs = EXCLUDED.classification_inputs,
       scenarios = EXCLUDED.scenarios,
       scenario_values = EXCLUDED.scenario_values,
       configured_constants = EXCLUDED.configured_constants,
       updated_at = now()`,
    [
      ticker,
      input.profile,
      JSON.stringify(input.classificationInputs),
      JSON.stringify(input.scenarios),
      JSON.stringify(input.scenarioValues),
      JSON.stringify(input.configuredConstants),
    ]
  );
}

interface StoredRow {
  profile: RecordableProfile;
  classification_inputs: RecordedClassificationInputs;
  scenarios: RecordedScenarios;
  scenario_values: RecordedScenarioValues;
  configured_constants: RecordedConfiguredConstants;
  recorded_at: string;
  updated_at: string;
}

async function fetchRow(rawTicker: string): Promise<StoredRow | null> {
  const ticker = rawTicker.trim().toUpperCase();
  if (ticker === "") return null;
  const { rows } = await getPool().query(
    `SELECT profile, classification_inputs, scenarios, scenario_values, configured_constants,
            recorded_at, updated_at
       FROM analyzer_recorded_analyst_bundles
      WHERE ticker = $1`,
    [ticker]
  );
  return rows.length === 0 ? null : (rows[0] as StoredRow);
}

/** Whether a ticker has a recorded bundle — analystInputsFor's second source. */
export async function hasRecordedAnalystBundle(ticker: string): Promise<boolean> {
  return (await fetchRow(ticker)) !== null;
}

/** The raw, editable form of a recorded bundle — for the entry screen to
 * prefill on review/correction. Never used by the resolution path. */
export async function getRecordedAnalystBundleInput(
  ticker: string
): Promise<{ input: RecordedAnalystBundleInput; meta: RecordedAnalystBundleMeta } | null> {
  const row = await fetchRow(ticker);
  if (row === null) return null;
  return {
    input: {
      profile: row.profile,
      classificationInputs: row.classification_inputs,
      scenarios: row.scenarios,
      scenarioValues: row.scenario_values,
      configuredConstants: row.configured_constants,
    },
    meta: { recordedAt: row.recorded_at, updatedAt: row.updated_at },
  };
}

function driverFromStorage(d: RecordedScenarioDriverInput): ScenarioDriverInputs {
  return {
    revenueGrowthOrPath: optionalDecimal(d.revenueGrowthOrPath, "revenueGrowthOrPath"),
    operatingMargin: optionalDecimal(d.operatingMargin, "operatingMargin"),
    reinvestmentCapitalIntensity: optionalDecimal(
      d.reinvestmentCapitalIntensity,
      "reinvestmentCapitalIntensity"
    ),
    shareCount: requireDecimal(d.shareCount, "shareCount"),
    writtenAnchor: d.writtenAnchor,
  };
}

function isoDateOnly(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function disclosureFor(ticker: string, meta: RecordedAnalystBundleMeta): string {
  const recordedOn = isoDateOnly(meta.recordedAt);
  const updatedOn = isoDateOnly(meta.updatedAt);
  const correction = updatedOn !== recordedOn ? ` Last corrected ${updatedOn}.` : "";
  return (
    `The three scenarios, the values they produce and any of the four unset policy ` +
    `constants recorded for ${ticker} were entered by an analyst on this system on ` +
    `${recordedOn}, through the recorded analyst-input entry path.${correction} They are NOT ` +
    `acquired from filings, and this is not the validation-set carry-over MSFT and OKLO's ` +
    `committed bundles disclose — this bundle was authored for ${ticker} specifically. Every ` +
    `fact, gate and margin figure on this run still comes from SEC filings.`
  );
}

/**
 * Builds the AnalystInputBundle analystInputsFor returns for a recorded
 * ticker — the second source it reads, in addition to the two committed
 * fixture bundles. Returns null where nothing has been recorded.
 *
 * revalueBaseCaseAtRate and preRevenue are always null here (SCOPE item 6 /
 * migration 006's header) — never synthesised, and never read from storage
 * because no column carries them.
 */
export async function recordedAnalystInputBundle(ticker: string): Promise<AnalystInputBundle | null> {
  const row = await fetchRow(ticker);
  if (row === null) return null;

  const scenarios: ScenarioInputSet = {
    bear: driverFromStorage(row.scenarios.bear),
    base: driverFromStorage(row.scenarios.base),
    bull: driverFromStorage(row.scenarios.bull),
  };

  const normalizedTicker = ticker.trim().toUpperCase();

  return {
    inputs: {
      profile: {
        recommended: row.profile,
        confirmedOrOverridden: row.profile,
        override: null,
        classificationInputs: {
          revenueScale: row.classification_inputs.revenueScale,
          fcfCharacter: row.classification_inputs.fcfCharacter,
          revenueGrowthBand: row.classification_inputs.revenueGrowthBand,
          capitalIntensity: requireDecimal(row.classification_inputs.capitalIntensity, "capitalIntensity"),
          cyclicality: {
            tenYearMarginRange: requireDecimal(
              row.classification_inputs.cyclicality.tenYearMarginRange,
              "tenYearMarginRange"
            ),
            worstSingleYearChange: requireDecimal(
              row.classification_inputs.cyclicality.worstSingleYearChange,
              "worstSingleYearChange"
            ),
          },
          balanceSheetNature: row.classification_inputs.balanceSheetNature,
        },
      },
      scenarios,
      scenarioValues: {
        bear: requireDecimal(row.scenario_values.bear, "bear scenario value"),
        base: requireDecimal(row.scenario_values.base, "base scenario value"),
        bull: requireDecimal(row.scenario_values.bull, "bull scenario value"),
      },
      revalueBaseCaseAtRate: null,
      configuredConstants: {
        nopatTaxRate: optionalDecimal(row.configured_constants.nopatTaxRate, "nopatTaxRate"),
        stressMarginLevel: optionalDecimal(row.configured_constants.stressMarginLevel, "stressMarginLevel"),
        preRevenueUnleveredRate: optionalDecimal(
          row.configured_constants.preRevenueUnleveredRate,
          "preRevenueUnleveredRate"
        ),
        projectDebtCost: optionalDecimal(row.configured_constants.projectDebtCost, "projectDebtCost"),
      },
      preRevenue: null,
    },
    note: disclosureFor(normalizedTicker, { recordedAt: row.recorded_at, updatedAt: row.updated_at }),
  };
}
