-- 008_nvda_recorded_bundle_seed.sql
-- CF-ANALYZER-V1-SETTLE-01 — Calvin ruling 3 (issue #392): "when no durable
-- Calvin scenario exists, the strong model may propose labelled scenario
-- drivers; deterministic code computes the actual values." For NVDA a
-- durable Calvin scenario already DOES exist — it just was never durably
-- recorded. `CF-NVDA-RUN-OBSERVE-01` (issue #296) already proved the whole
-- pipeline end to end: an AI-authored, source-cited draft
-- (docs/analyst-drafts/nvda-step7-draft.md, prepared under CALVIN RULING —
-- AMEND A) was reviewed and its scenario values approved verbatim under
-- `CALVIN RULING — APPROVE AS DRAFTED` (PR #295, merged 0753051 — Bear
-- $28.08, Base $102.38, Bull $296.44), then transcribed byte-faithful
-- through `recordAnalystBundle` (the same write path `/analyzer/inputs/
-- NVDA` uses) and run through the real gated pipeline
-- (`lib/analyzer/nvdaRealRunObservation.test.ts`, `docs/nvda-realrun-
-- observation.md`). That prior outcome's own HARD BOUNDS deliberately left
-- nothing durably recorded ("NVDA still has no BUNDLES entry... it becomes
-- reachable only through the recorded store, by the same act a human
-- performs") — every fresh NVDA run since has needed that human act
-- repeated. This migration performs that one recording durably, once,
-- carrying the already-approved answer forward exactly as migration 007
-- does for MSFT's §4.4 ruling — not a new judgment, drivers or figure.
--
-- WHAT THIS DOES NOT FIX. NVDA's enterprise value stays honestly
-- INCOMPLETE regardless — `docs/nvda-realrun-observation.md`'s own table:
-- three missing REQUIRED inputs (`treasuryMethodDilution`,
-- `financeLeaseLiabilities`, `nonOperatingEquityInvestmentsAtBook`), only
-- the third answerable by a §4.4 judgment, and Calvin's classification for
-- NVDA's own §4.4 candidates was never ruled (unlike MSFT's issue #188) —
-- so no company-level override is seeded for NVDA in migration 007 or
-- here. The first two are pre-existing tag-mapping gaps on this filer's
-- capture, explicitly named as outside prior HARD BOUNDS to fix by adding
-- acquisition machinery — unchanged, and not attempted here. Leverage,
-- the fair-value range and trust therefore stay suppressed for NVDA
-- exactly as they already are for OKLO (LEVERAGE UNSUPPORTED IN v1) — an
-- honest, local degradation of the valuation/scenario section specifically
-- (per #392's MISSING-DATA RULE), not a cascade that blocks the rest of
-- the report: identity, price/key-stats (where the live market-data
-- provider resolves them — offline test captures carry no NVDA price row,
-- per the observation document), business/model narrative, financials and
-- Evidence all render on this seeded bundle alone.
--
-- ADDITIVE ONLY: one row in the existing analyzer_recorded_analyst_bundles
-- table (migration 006). No schema change.
INSERT INTO analyzer_recorded_analyst_bundles
  (ticker, profile, classification_inputs, scenarios, scenario_values, configured_constants)
VALUES (
  'NVDA',
  'HIGH_GROWTH_PROFITABLE_UNCERTAIN_DURABILITY',
  '{
    "revenueScale": "large",
    "fcfCharacter": "positive_volatile",
    "revenueGrowthBand": ">30%",
    "capitalIntensity": "0.028",
    "cyclicality": { "tenYearMarginRange": "0.4751", "worstSingleYearChange": "0.2165" },
    "balanceSheetNature": "asset-light"
  }'::jsonb,
  '{
    "bear": {
      "revenueGrowthOrPath": "0.05",
      "operatingMargin": "0.30",
      "reinvestmentCapitalIntensity": "0.02",
      "shareCount": "24.1",
      "writtenAnchor": "AI/datacenter capex cycle corrects and operating margin reverts toward its ten-year median, echoing the FY2023 correction (margin fell to 15.7% that year on inventory and export-control effects); growth slows sharply but stays positive, not a revenue contraction."
    },
    "base": {
      "revenueGrowthOrPath": "0.20",
      "operatingMargin": "0.50",
      "reinvestmentCapitalIntensity": "0.04",
      "shareCount": "24.1",
      "writtenAnchor": "AI-driven datacenter demand continues but decelerates materially off the FY2026 base as the hyperscaler capex cycle normalizes; margin gives back some of its recent expansion but stays well above the historical median."
    },
    "bull": {
      "revenueGrowthOrPath": "0.35",
      "operatingMargin": "0.60",
      "reinvestmentCapitalIntensity": "0.05",
      "shareCount": "24.1",
      "writtenAnchor": "AI/accelerated-computing demand sustains at a high level, operating margin holds near its current elevated level, and NVIDIA continues investing aggressively in capacity."
    }
  }'::jsonb,
  '{ "bear": "28.08", "base": "102.38", "bull": "296.44" }'::jsonb,
  '{
    "nopatTaxRate": "0.21",
    "stressMarginLevel": "0.15",
    "preRevenueUnleveredRate": null,
    "projectDebtCost": null
  }'::jsonb
)
ON CONFLICT (ticker) DO NOTHING;
