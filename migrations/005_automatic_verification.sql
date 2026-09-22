-- 005_automatic_verification.sql
-- CF-ANALYZER-AUTORUN-01 — the normal path reaches a report on its own.
--
-- AUTHORITY. Calvin's CALVIN RULING, 22 Sep 2026 04:28:04Z (PR #216 comment
-- 5771211284): "After I enter/select a ticker and start analysis, I should not
-- be required to manually verify prices, margins, SEC facts, extraction
-- states, provenance, gates, or other routine inputs. Acquisition, validation,
-- calculation and routine verification should execute automatically behind the
-- scenes." That ruling amends WHO performs routine confirmation in the normal
-- path. It amends nothing about WHAT is verified, what evidence is recorded,
-- the §3.8.2 cross-checks, or the refusal-before-calculation chokepoint.
--
-- WHAT THIS MIGRATION IS FOR, AND WHAT IT IS NOT. Once the software may
-- perform a routine confirmation itself, the record has to say so. A run whose
-- facts were confirmed by nobody, stored in the same shape as one an analyst
-- worked through, would be the audit record making a claim about human review
-- that nothing behind it supports. So every column here exists to keep the two
-- distinguishable — never to make either of them easier to produce.
--
-- ADDITIVE ONLY. No existing column, CHECK constraint or value changes
-- meaning. Every row written before this migration is a human decision, which
-- is exactly what the DEFAULT below records for it.

-- 1. analyzer_run_fact_decisions.origin
--
-- WHO took this Step 2 decision. The decision vocabulary itself is untouched:
-- §3.8.3 still offers exactly two decisions, CONFIRMED and NOT CONFIRMED, and
-- §3.8.4's reason-code rule is unchanged and still enforced by the constraint
-- below it. Criterion A24 fixes the verification-state field at four values,
-- and no fifth is invented here — the origin travels BESIDE the decision, in
-- its own column, which is the shape the 8 September 2026 "record, do not
-- amend" ruling already established for this class of question.
--
-- DEFAULT 'HUMAN' is the fail-closed direction for the backfill only. Every
-- row that existed before this migration was written by an analyst through
-- Screen 2, so 'HUMAN' is the true value for all of them rather than a
-- convenient one. New automatic rows always name their origin explicitly;
-- lib/analyzer/runStore.ts never relies on this default to write one.
ALTER TABLE analyzer_run_fact_decisions
  ADD COLUMN origin TEXT NOT NULL DEFAULT 'HUMAN'
    CHECK (origin IN ('HUMAN', 'AUTOMATIC'));

-- 2. analyzer_runs — the automatic Step 6 resolution
--
-- DELIBERATELY NOT profile_decision. §6.3's three outcomes — CONFIRMED,
-- OVERRIDDEN, CANNOT JUDGE — are the outcomes available to A HUMAN, and
-- CANNOT JUDGE in particular means "the analyst cannot assess the question".
-- Writing any of those three for a determination no human made would state
-- something false in the one column the report reads to decide whether a human
-- confirmed the profile. So the automatic resolution gets its own column pair
-- and leaves profile_decision NULL, profile_human_confirmed FALSE, and every
-- existing CHECK on them satisfied untouched.
--
-- The consequence is the honest one and is load-bearing, not incidental: a run
-- resolved automatically still raises PROFILE NOT CONFIRMED, still drops trust
-- below CLEAN and still suppresses the §10.6 position (§9.4, §9.6, §10.6.3),
-- exactly as it did before this outcome. An analyst who wants a confirmed
-- profile still confirms it, on Screen 3, which is unchanged.
ALTER TABLE analyzer_runs
  -- The profile the acquired inputs themselves recommended, recorded as the
  -- one the run proceeds on when nobody has said otherwise. Never a second
  -- place a confirmed profile can live: profile (above) stays the human
  -- decision's column.
  ADD COLUMN profile_auto_resolved TEXT,
  ADD COLUMN profile_auto_resolved_at TIMESTAMPTZ;

-- All-or-nothing, matching profile_decision_is_complete's own shape: the
-- profile and the moment it was resolved arrive together or not at all.
ALTER TABLE analyzer_runs
  ADD CONSTRAINT profile_auto_resolution_is_complete CHECK (
    (profile_auto_resolved IS NULL     AND profile_auto_resolved_at IS NULL)
    OR
    (profile_auto_resolved IS NOT NULL AND profile_auto_resolved_at IS NOT NULL)
  );
