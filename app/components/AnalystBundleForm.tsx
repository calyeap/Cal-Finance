"use client";

import { recordAnalystBundleAction } from "@/app/actions/analystInputs";
import type { RecordedAnalystBundleInput, RecordedScenarioDriverInput } from "@/lib/analyzer/acquisition/recordedBundles";

// ---------------------------------------------------------------------------
// CF-ANALYST-INPUT-ENTRY-01 — the entry form for app/analyzer/inputs/[ticker].
// Built from the existing legacy-screen vocabulary (`.cb-steps`/`.wrap`/
// `.sechead`/`.judgment`/`.fieldlabel`/`.inset`/`.act`, all from
// ProfileDecisionForm.tsx and globals.css) — no new CSS class, no new
// breakpoint, nothing added to the V2 shell or the seven-tab report (HARD
// BOUNDS: "Do not redesign Analyzer V2 or the accepted report UI").
// ---------------------------------------------------------------------------

const SCENARIOS = ["bear", "base", "bull"] as const;
const SCENARIO_LABELS: Record<(typeof SCENARIOS)[number], string> = {
  bear: "Bear",
  base: "Base",
  bull: "Bull",
};

function DriverFields({
  scenario,
  existing,
  existingScenarioValue,
}: {
  scenario: (typeof SCENARIOS)[number];
  existing?: RecordedScenarioDriverInput;
  existingScenarioValue?: string;
}) {
  return (
    <fieldset className="judgment" style={{ marginTop: 20 }}>
      <legend>{SCENARIO_LABELS[scenario]}</legend>

      <label className="fieldlabel" htmlFor={`${scenario}.writtenAnchor`}>
        Written anchor — required, cannot be empty (design §5.4)
      </label>
      <input
        className="inset"
        id={`${scenario}.writtenAnchor`}
        name={`${scenario}.writtenAnchor`}
        defaultValue={existing?.writtenAnchor ?? ""}
        required
      />

      <div style={{ height: 14 }} />
      <label className="fieldlabel" htmlFor={`${scenario}.shareCount`}>
        Share count — required
      </label>
      <input
        className="inset"
        id={`${scenario}.shareCount`}
        name={`${scenario}.shareCount`}
        defaultValue={existing?.shareCount ?? ""}
        inputMode="decimal"
        placeholder="e.g. 7.4255"
        required
      />

      <div style={{ height: 14 }} />
      <label className="fieldlabel" htmlFor={`${scenario}.revenueGrowthOrPath`}>
        Revenue growth (constant rate) — leave blank to record absent
      </label>
      <input
        className="inset"
        id={`${scenario}.revenueGrowthOrPath`}
        name={`${scenario}.revenueGrowthOrPath`}
        defaultValue={existing?.revenueGrowthOrPath ?? ""}
        inputMode="decimal"
        placeholder="e.g. 0.10, or leave blank"
      />

      <div style={{ height: 14 }} />
      <label className="fieldlabel" htmlFor={`${scenario}.operatingMargin`}>
        Operating margin — leave blank to record absent
      </label>
      <input
        className="inset"
        id={`${scenario}.operatingMargin`}
        name={`${scenario}.operatingMargin`}
        defaultValue={existing?.operatingMargin ?? ""}
        inputMode="decimal"
        placeholder="e.g. 0.418, or leave blank"
      />

      <div style={{ height: 14 }} />
      <label className="fieldlabel" htmlFor={`${scenario}.reinvestmentCapitalIntensity`}>
        Reinvestment capital intensity — leave blank to record absent
      </label>
      <input
        className="inset"
        id={`${scenario}.reinvestmentCapitalIntensity`}
        name={`${scenario}.reinvestmentCapitalIntensity`}
        defaultValue={existing?.reinvestmentCapitalIntensity ?? ""}
        inputMode="decimal"
        placeholder="e.g. 0.15, or leave blank"
      />

      <div style={{ height: 14 }} />
      <label className="fieldlabel" htmlFor={`scenarioValue.${scenario}`}>
        Scenario value — required
      </label>
      <input
        className="inset"
        id={`scenarioValue.${scenario}`}
        name={`scenarioValue.${scenario}`}
        defaultValue={existingScenarioValue ?? ""}
        inputMode="decimal"
        placeholder="e.g. 510"
        required
      />
    </fieldset>
  );
}

export function AnalystBundleForm({
  ticker,
  existing,
}: {
  ticker: string;
  existing: RecordedAnalystBundleInput | null;
}) {
  return (
    <form action={recordAnalystBundleAction}>
      <input type="hidden" name="ticker" value={ticker} />

      <div className="sechead" style={{ marginTop: 32 }}>
        <h3>Profile</h3>
        <span className="screenlabel">Human · no default</span>
      </div>
      <p className="why">
        No classifier recommends a profile for a ticker with no committed fixture (none exists in
        this codebase for any company) — this is the analyst&rsquo;s own classification, the same
        status the scenarios below already have.
      </p>

      <label className="fieldlabel" htmlFor="profile">
        Profile — required
      </label>
      <select className="inset" id="profile" name="profile" defaultValue={existing?.profile ?? ""} required>
        <option value="" disabled>
          Select the profile that describes this company
        </option>
        <option value="MATURE_PROFITABLE_STABLE_FCF">Mature, profitable, stable FCF</option>
        <option value="HIGH_GROWTH_PROFITABLE_UNCERTAIN_DURABILITY">
          High-growth, profitable, uncertain durability
        </option>
      </select>
      <p className="note">
        Pre-revenue / unprofitable is not offered here: that profile needs the unit-economics and
        funding-stack surface this entry path does not carry — a distinct, larger Step 7 shape no
        ruling has authorised entering through this screen.
      </p>

      <div style={{ height: 14 }} />
      <label className="fieldlabel" htmlFor="revenueScale">
        Revenue scale — required
      </label>
      <select
        className="inset"
        id="revenueScale"
        name="revenueScale"
        defaultValue={existing?.classificationInputs.revenueScale ?? ""}
        required
      >
        <option value="" disabled>
          Select
        </option>
        <option value="zero">Zero</option>
        <option value="small">Small</option>
        <option value="large">Large</option>
      </select>

      <div style={{ height: 14 }} />
      <label className="fieldlabel" htmlFor="fcfCharacter">
        Free cash flow character — required
      </label>
      <select
        className="inset"
        id="fcfCharacter"
        name="fcfCharacter"
        defaultValue={existing?.classificationInputs.fcfCharacter ?? ""}
        required
      >
        <option value="" disabled>
          Select
        </option>
        <option value="negative">Negative</option>
        <option value="positive_volatile">Positive, volatile</option>
        <option value="positive_stable">Positive, stable</option>
      </select>

      <div style={{ height: 14 }} />
      <label className="fieldlabel" htmlFor="revenueGrowthBand">
        Revenue growth band — required
      </label>
      <select
        className="inset"
        id="revenueGrowthBand"
        name="revenueGrowthBand"
        defaultValue={existing?.classificationInputs.revenueGrowthBand ?? ""}
        required
      >
        <option value="" disabled>
          Select
        </option>
        <option value=">30%">&gt;30%</option>
        <option value="10-30%">10-30%</option>
        <option value="<10%">&lt;10%</option>
      </select>

      <div style={{ height: 14 }} />
      <label className="fieldlabel" htmlFor="capitalIntensity">
        Capital intensity (fraction of revenue) — required
      </label>
      <input
        className="inset"
        id="capitalIntensity"
        name="capitalIntensity"
        defaultValue={existing?.classificationInputs.capitalIntensity ?? ""}
        inputMode="decimal"
        placeholder="e.g. 0.12"
        required
      />

      <div style={{ height: 14 }} />
      <label className="fieldlabel" htmlFor="tenYearMarginRange">
        Ten-year operating-margin range (points, as a fraction) — required
      </label>
      <input
        className="inset"
        id="tenYearMarginRange"
        name="tenYearMarginRange"
        defaultValue={existing?.classificationInputs.cyclicality.tenYearMarginRange ?? ""}
        inputMode="decimal"
        placeholder="e.g. 0.214 for 21.4pt"
        required
      />

      <div style={{ height: 14 }} />
      <label className="fieldlabel" htmlFor="worstSingleYearChange">
        Worst single-year margin change (points, as a fraction) — required
      </label>
      <input
        className="inset"
        id="worstSingleYearChange"
        name="worstSingleYearChange"
        defaultValue={existing?.classificationInputs.cyclicality.worstSingleYearChange ?? ""}
        inputMode="decimal"
        placeholder="e.g. 0.041 for 4.1pt"
        required
      />

      <div style={{ height: 14 }} />
      <label className="fieldlabel" htmlFor="balanceSheetNature">
        Balance-sheet nature — required, ASSUMPTION not FACT (§6.3)
      </label>
      <select
        className="inset"
        id="balanceSheetNature"
        name="balanceSheetNature"
        defaultValue={existing?.classificationInputs.balanceSheetNature ?? ""}
        required
      >
        <option value="" disabled>
          Select
        </option>
        <option value="asset-light">Asset-light</option>
        <option value="asset-heavy">Asset-heavy</option>
      </select>

      <div className="sechead" style={{ marginTop: 32 }}>
        <h3>Scenarios</h3>
        <span className="screenlabel">Human · every driver may be left absent</span>
      </div>
      <p className="why">
        A driver left blank is recorded and returned as absent — never a zero, never a default —
        and reports INCOMPLETE at exactly that field, the same treatment OKLO&rsquo;s committed
        bundle already gives its own unauthored drivers.
      </p>
      {SCENARIOS.map((s) => (
        <DriverFields
          key={s}
          scenario={s}
          existing={existing?.scenarios[s]}
          existingScenarioValue={existing?.scenarioValues[s]}
        />
      ))}

      <div className="sechead" style={{ marginTop: 32 }}>
        <h3>§7.1 constants</h3>
        <span className="screenlabel">Human · for this run only, not a policy definition</span>
      </div>
      <p className="why">
        These four constants are unset in policy.ts (UNDEFINED_POLICY_CONSTANTS) and stay that way
        — recording a value here supplies it for {ticker}&rsquo;s runs only, not for the product.
        Leave any of them blank to record it absent.
      </p>

      <label className="fieldlabel" htmlFor="nopatTaxRate">
        NOPAT tax rate — leave blank to record absent
      </label>
      <input
        className="inset"
        id="nopatTaxRate"
        name="nopatTaxRate"
        defaultValue={existing?.configuredConstants.nopatTaxRate ?? ""}
        inputMode="decimal"
        placeholder="e.g. 0.2, or leave blank"
      />

      <div style={{ height: 14 }} />
      <label className="fieldlabel" htmlFor="stressMarginLevel">
        Stress margin level — leave blank to record absent
      </label>
      <input
        className="inset"
        id="stressMarginLevel"
        name="stressMarginLevel"
        defaultValue={existing?.configuredConstants.stressMarginLevel ?? ""}
        inputMode="decimal"
        placeholder="e.g. 0.38, or leave blank"
      />

      <div style={{ height: 14 }} />
      <label className="fieldlabel" htmlFor="preRevenueUnleveredRate">
        Pre-revenue unlevered rate — leave blank to record absent
      </label>
      <input
        className="inset"
        id="preRevenueUnleveredRate"
        name="preRevenueUnleveredRate"
        defaultValue={existing?.configuredConstants.preRevenueUnleveredRate ?? ""}
        inputMode="decimal"
        placeholder="leave blank"
      />

      <div style={{ height: 14 }} />
      <label className="fieldlabel" htmlFor="projectDebtCost">
        Project debt cost — leave blank to record absent
      </label>
      <input
        className="inset"
        id="projectDebtCost"
        name="projectDebtCost"
        defaultValue={existing?.configuredConstants.projectDebtCost ?? ""}
        inputMode="decimal"
        placeholder="leave blank"
      />

      <div className="continue" style={{ marginTop: 32 }}>
        <button className="act" type="submit">
          Record and save
        </button>
      </div>
    </form>
  );
}
