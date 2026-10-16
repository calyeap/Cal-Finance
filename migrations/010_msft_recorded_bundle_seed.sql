-- 010_msft_recorded_bundle_seed.sql
-- CF-MSFT-STAGE2-DURABLE-SEED-01 (issue #442) — the one remaining piece
-- Stage 2 left undone: durably RECORDING the already-approved MSFT
-- candidate. Stage-2 production code/proof (issue #439) merged in PR #440,
-- squash merge 8120b48dc0a82ca82a2a9413fbdb9c0c766968eb — its own proof doc
-- (docs/proof/cf-msft-stage2-real-valuation-proof-01.md §9) left the
-- exact candidate as "the one consolidated question for Calvin", never
-- recorded anywhere this repository's real Analyzer reads from. Calvin's
-- CALVIN RULING — YES, APPROVED (PR #440#issuecomment-6213272009, reviewed
-- head e64e9cc) approves that candidate's four Stage-2 choices verbatim,
-- on top of the prior REVIEW gate (#440#issuecomment-6196049850) and OWNER
-- confirmation (#440#issuecomment-6196081329). BUILD/OWNER then found no
-- mutation exists for a HEAVY-tier production DB write from CI
-- (#440#issuecomment-6213429994) — this migration is that one bounded,
-- reviewable, forward-only path instead: the SAME additive, idempotent
-- discipline migration 008 already used to durably record NVDA's own
-- previously-approved-but-unrecorded bundle, applied here to MSFT.
--
-- Every field below is reconstructed, never invented, from the exact
-- values this repository already carries:
--   - classification/profile/growth/margin/reinvestment-basis inputs and
--     the corrected classification (positive_volatile / asset-heavy) —
--     lib/analyzer/acquisition/msftStage2ValuationProof.test.ts's own
--     CANDIDATE_INPUT, unchanged.
--   - terminalRoic 0.10/0.11/0.125 and the approved snapshot
--     214.26/283.31/402.73 — proof doc §3/§9 and the CALVIN RULING comment
--     above, to the cent.
--   - diluted share count 7,449,545,491 — the reviewed §4.4 bridge
--     (proof doc §3: "7,425,545,491 + treasury-method dilution 24,000,000,
--     this run's own M1 figure").
--   - configuredConstants (nopatTaxRate 0.19, stressMarginLevel 0.3006) —
--     CANDIDATE_INPUT, unchanged from Stage 1/PR #436.
--
-- scenario_values deliberately carries the APPROVED DERIVED FIGURES
-- ($214.26/$283.31/$402.73), never the proof test's own dummy
-- "0.01"/"0.01"/"0.01" placeholders (those are expressly flagged dummy in
-- that test file and must never be persisted). Because every driver below
-- is authored for all three scenarios, recordedAnalystInputBundle's own
-- recordedScenarioValuesComputeFromDrivers resolves true for this row
-- (recordedBundles.ts) — so this stored snapshot is a durable RECORD of
-- what Calvin approved, not what a real run actually reads: the real
-- Analyzer recomputes the range dynamically from the drivers above against
-- current acquired SEC facts every time, and
-- msftStage2DurableSeedOnRealRun.test.ts (this outcome's own proof) shows
-- that recomputation reproducing this exact snapshot against the pinned
-- offline capture, not merely echoing it back.
--
-- ADDITIVE ONLY, same discipline as 006/007/008/009: one row in the
-- existing analyzer_recorded_analyst_bundles table (migration 006). No
-- schema change, no parallel store. recordedAnalystInputBundle /
-- analystInputsFor (CF-ANALYST-INPUT-ENTRY-01, CF-ANALYZER-REAL-VALUATION-
-- UNBLOCK-01) already resolve a recorded bundle BEFORE the committed
-- MSFT_FIXTURE carry-over — exactly the intended, already-authorised
-- effect of this migration: a real MSFT run now resolves this approved
-- Stage-2 candidate instead of the M5/M7 validation-fixture carry-over
-- (lib/analyzer/acquisition/analystInputs.ts's own header). No committed
-- fixture file is touched or removed; MSFT_FIXTURE stays exactly as it was
-- for anything that constructs a result from it directly (e.g.
-- assembleAnalysisResult(MSFT_FIXTURE) in component-level tests), since
-- that path never reads this table.
INSERT INTO analyzer_recorded_analyst_bundles
  (ticker, profile, classification_inputs, scenarios, scenario_values, configured_constants)
VALUES (
  'MSFT',
  'MATURE_PROFITABLE_STABLE_FCF',
  '{
    "revenueScale": "large",
    "fcfCharacter": "positive_volatile",
    "revenueGrowthBand": "10-30%",
    "capitalIntensity": "0.4236",
    "cyclicality": { "tenYearMarginRange": "0.1673", "worstSingleYearChange": "0.0028" },
    "balanceSheetNature": "asset-heavy"
  }'::jsonb,
  '{
    "bear": {
      "revenueGrowthOrPath": "0.08",
      "operatingMargin": "0.4168",
      "reinvestmentCapitalIntensity": "0.07",
      "shareCount": "7449545491",
      "terminalRoic": "0.10",
      "writtenAnchor": "Stage-2 candidate, net-of-D&A basis (issue #439 authority item (a); Stage 1 §2.1). Years 1-5: growth/margin unchanged from PR #436''s reviewed draft; reinvestment 7% net-of-D&A, just below the pre-AI-buildout (FY2017-23) net-of-D&A top of 8.37%. Years 6-10: reinvestment is NOT held flat at 7% — per Calvin''s 2026-10-15 ruling it fades toward this scenario''s own terminal-ROIC-implied level (~10.13%, the sustainable-growth identity margin x (1-tax) x growth / terminalRoic restated as a share of revenue), a model-derived path consistent with the terminal formula, not independently MSFT-validated economics. Terminal ROIC fades fully to the 10% cost of capital (POLICY.rateGrid[1]) — no durable excess-return claim is independently substantiated under this scenario''s assumed competitive/macro deterioration (item (c)); this is why this scenario''s reinvestment RISES toward its own fade target while bull''s falls toward a lower one. Acquisitions/ΔNWC are missing from this basis, not zero (proof doc §5 materiality, roughly -1% to -3% per scenario at +1pp/+2pp). The explicit-period (years 1-5) RONIC ranking is reversed relative to bull (a smaller reinvestment base looks more return-efficient holding margin constant) — disclosed as a diagnostic, not corrected. No valuation or recommendation is guaranteed by this scenario; it is an analyst judgement, not an SEC-established fact."
    },
    "base": {
      "revenueGrowthOrPath": "0.14",
      "operatingMargin": "0.45",
      "reinvestmentCapitalIntensity": "0.20",
      "shareCount": "7449545491",
      "terminalRoic": "0.11",
      "writtenAnchor": "Stage-2 candidate, net-of-D&A basis. Years 1-5: growth/margin unchanged from PR #436. Reinvestment 20% net-of-D&A, at the FY2025 observed net-of-D&A ratio. Years 6-10: reinvestment is NOT held flat at 20% — per Calvin''s 2026-10-15 ruling it fades toward this scenario''s own terminal-ROIC-implied level (~9.94%, the sustainable-growth identity restated as a share of revenue), a model-derived path, not independently MSFT-validated economics. Terminal ROIC 11% (r+1pp) — a modest, explicitly-argued durable-moat credit (Azure/M365 enterprise switching costs, recurring-subscription economics), deliberately HALF the diagnostic reverse-DCF''s own r+3pp convention (item (c)), not a universal default and not this scenario''s own much higher 25.5% explicit-period RONIC. Acquisitions/ΔNWC are missing from this basis, not zero (proof doc §5 materiality, roughly -1% to -3% per scenario at +1pp/+2pp). No valuation or recommendation is guaranteed by this scenario; it is an analyst judgement, not an SEC-established fact."
    },
    "bull": {
      "revenueGrowthOrPath": "0.20",
      "operatingMargin": "0.4678",
      "reinvestmentCapitalIntensity": "0.26",
      "shareCount": "7449545491",
      "terminalRoic": "0.125",
      "writtenAnchor": "Stage-2 candidate, net-of-D&A basis. Years 1-5: growth/margin unchanged from PR #436. Reinvestment 26% net-of-D&A, ~14% relatively below the FY2026 net-of-D&A peak (30.60%), mirroring the same relative discount the original cash-capex driver (30%) takes off its own FY2026 peak (34.94%). Years 6-10: reinvestment is NOT held flat at 26% — per Calvin''s 2026-10-15 ruling it fades toward this scenario''s own terminal-ROIC-implied level (~9.09%, the sustainable-growth identity restated as a share of revenue), a model-derived path, not independently MSFT-validated economics; this scenario''s reinvestment FALLS toward that lower fade target while bear''s rises toward a higher one. Terminal ROIC 12.5% (r+2.5pp) — a deliberately DIFFERENT number from both the diagnostic r+3pp convention and this scenario''s own unfaded 20% ask (item (c)): continuing AI-driven Azure capacity monetization could sustain some excess return, but 20% unfaded is not independently substantiated as a durable moat. The explicit-period (years 1-5) RONIC ranking is reversed relative to bear (29.15% vs bear''s 38.58%, holding margin constant against a larger reinvestment base) — disclosed as a diagnostic, not corrected. Acquisitions/ΔNWC are missing from this basis, not zero (proof doc §5 materiality). No valuation or recommendation is guaranteed by this scenario; it is an analyst judgement, not an SEC-established fact."
    }
  }'::jsonb,
  '{ "bear": "214.26", "base": "283.31", "bull": "402.73" }'::jsonb,
  '{
    "nopatTaxRate": "0.19",
    "stressMarginLevel": "0.3006",
    "preRevenueUnleveredRate": null,
    "projectDebtCost": null
  }'::jsonb
)
ON CONFLICT (ticker) DO NOTHING;

-- Collision/idempotency safety (issue #442 DO item 2): ON CONFLICT DO
-- NOTHING above never silently overwrites a different pre-existing MSFT
-- row — but silently leaving a DIFFERENT row in place while claiming this
-- migration "applied successfully" would be just as dishonest. Re-fetch
-- whatever is now in the table for MSFT and fail the migration loudly
-- (ROLLBACK, per scripts/migrate.ts's own per-file transaction) if it does
-- not match the Calvin-approved snapshot this file just tried to write —
-- surfacing the mismatch for a human to resolve, never calling it done.
DO $$
DECLARE
  row_profile TEXT;
  row_classification JSONB;
  row_scenario_values JSONB;
  row_bear_roic TEXT;
  row_base_roic TEXT;
  row_bull_roic TEXT;
  row_shares TEXT;
BEGIN
  SELECT profile, classification_inputs, scenario_values,
         scenarios->'bear'->>'terminalRoic',
         scenarios->'base'->>'terminalRoic',
         scenarios->'bull'->>'terminalRoic',
         scenarios->'bear'->>'shareCount'
    INTO row_profile, row_classification, row_scenario_values,
         row_bear_roic, row_base_roic, row_bull_roic, row_shares
    FROM analyzer_recorded_analyst_bundles
   WHERE ticker = 'MSFT';

  IF row_profile IS NULL THEN
    RAISE EXCEPTION 'migration 010: no MSFT row present after insert — unreachable unless analyzer_recorded_analyst_bundles was altered out from under this migration';
  END IF;

  IF row_profile <> 'MATURE_PROFITABLE_STABLE_FCF'
     OR row_classification <> '{
       "revenueScale": "large",
       "fcfCharacter": "positive_volatile",
       "revenueGrowthBand": "10-30%",
       "capitalIntensity": "0.4236",
       "cyclicality": { "tenYearMarginRange": "0.1673", "worstSingleYearChange": "0.0028" },
       "balanceSheetNature": "asset-heavy"
     }'::jsonb
     OR row_scenario_values <> '{ "bear": "214.26", "base": "283.31", "bull": "402.73" }'::jsonb
     OR row_bear_roic <> '0.10'
     OR row_base_roic <> '0.11'
     OR row_bull_roic <> '0.125'
     OR row_shares <> '7449545491'
  THEN
    RAISE EXCEPTION 'migration 010: an existing MSFT recorded bundle does not match the Calvin-approved Stage-2 snapshot (CF-MSFT-STAGE2-DURABLE-SEED-01) — profile=%, classification=%, scenario_values=%, terminalRoic bear/base/bull=%/%/%, bear shareCount=%. Refusing to silently treat a different bundle as this approved one; resolve the conflict by hand before re-running.',
      row_profile, row_classification, row_scenario_values, row_bear_roic, row_base_roic, row_bull_roic, row_shares;
  END IF;
END $$;
