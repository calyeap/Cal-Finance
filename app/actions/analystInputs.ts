"use server";

import { redirect } from "next/navigation";
import {
  recordAnalystBundle,
  RECORDABLE_PROFILES,
  type RecordableProfile,
  type RecordedAnalystBundleInput,
  type RecordedScenarioDriverInput,
} from "@/lib/analyzer/acquisition/recordedBundles";

// ---------------------------------------------------------------------------
// CF-ANALYST-INPUT-ENTRY-01 — the write side of the entry surface
// (app/analyzer/inputs/[ticker]). A server action for the same reason every
// other analyzer write in app/actions/analyzer.ts is one: the store is
// server-side, and a value recorded only in client state would not be
// readable by analystInputsFor on the next run.
// ---------------------------------------------------------------------------

function parseEnum<T extends string>(
  value: FormDataEntryValue | null,
  allowed: readonly T[],
  label: string
): T {
  const raw = String(value ?? "");
  if (!(allowed as readonly string[]).includes(raw)) {
    throw new Error(`${label}: expected one of ${allowed.join(", ")}, got "${raw}"`);
  }
  return raw as T;
}

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

/** Blank is absent — the convention every nullable field in this form
 * shares, matching the honest-absence SCOPE requires downstream. */
function nullableField(formData: FormData, name: string): string | null {
  const raw = field(formData, name);
  return raw === "" ? null : raw;
}

function driverFromForm(formData: FormData, scenario: "bear" | "base" | "bull"): RecordedScenarioDriverInput {
  return {
    revenueGrowthOrPath: nullableField(formData, `${scenario}.revenueGrowthOrPath`),
    operatingMargin: nullableField(formData, `${scenario}.operatingMargin`),
    reinvestmentCapitalIntensity: nullableField(formData, `${scenario}.reinvestmentCapitalIntensity`),
    shareCount: field(formData, `${scenario}.shareCount`),
    writtenAnchor: field(formData, `${scenario}.writtenAnchor`),
  };
}

export async function recordAnalystBundleAction(formData: FormData): Promise<void> {
  const ticker = field(formData, "ticker").toUpperCase();
  if (ticker === "") throw new Error("A ticker is required");

  const profile: RecordableProfile = parseEnum(formData.get("profile"), RECORDABLE_PROFILES, "Profile");

  const input: RecordedAnalystBundleInput = {
    profile,
    classificationInputs: {
      revenueScale: parseEnum(formData.get("revenueScale"), ["zero", "small", "large"] as const, "Revenue scale"),
      fcfCharacter: parseEnum(
        formData.get("fcfCharacter"),
        ["negative", "positive_volatile", "positive_stable"] as const,
        "FCF character"
      ),
      revenueGrowthBand: parseEnum(
        formData.get("revenueGrowthBand"),
        [">30%", "10-30%", "<10%"] as const,
        "Revenue growth band"
      ),
      capitalIntensity: field(formData, "capitalIntensity"),
      cyclicality: {
        tenYearMarginRange: field(formData, "tenYearMarginRange"),
        worstSingleYearChange: field(formData, "worstSingleYearChange"),
      },
      balanceSheetNature: parseEnum(
        formData.get("balanceSheetNature"),
        ["asset-light", "asset-heavy"] as const,
        "Balance-sheet nature"
      ),
    },
    scenarios: {
      bear: driverFromForm(formData, "bear"),
      base: driverFromForm(formData, "base"),
      bull: driverFromForm(formData, "bull"),
    },
    scenarioValues: {
      bear: field(formData, "scenarioValue.bear"),
      base: field(formData, "scenarioValue.base"),
      bull: field(formData, "scenarioValue.bull"),
    },
    configuredConstants: {
      nopatTaxRate: nullableField(formData, "nopatTaxRate"),
      stressMarginLevel: nullableField(formData, "stressMarginLevel"),
      preRevenueUnleveredRate: nullableField(formData, "preRevenueUnleveredRate"),
      projectDebtCost: nullableField(formData, "projectDebtCost"),
    },
  };

  await recordAnalystBundle(ticker, input);

  redirect(`/analyzer/inputs/${ticker}?saved=1`);
}
