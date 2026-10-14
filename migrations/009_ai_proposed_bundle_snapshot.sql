-- 009_ai_proposed_bundle_snapshot.sql
-- CF-ANALYZER-INTEGRITY-PHASE-A-01, item A5 — reproducibility of an
-- AI-proposed analyst-input bundle.
--
-- THE DEFECT. aiProposedBundle.ts's own cache is in-memory, TICKER-keyed,
-- and expires after 15 minutes ("in-process only... NOT a durable second
-- control plane"). That is the right choice for de-duplicating the AI call
-- WITHIN one request, which is all it was built for — but it means a run
-- that successfully opened on a proposed bundle has nothing durable behind
-- it: reopening the SAME run after the cache expires, or after a process
-- restart, calls the model again and can silently recompute the run on a
-- DIFFERENT proposal (growth/margin/reinvestment/scenario drivers an LLM
-- call is not guaranteed to repeat), because the cache's only key is the
-- ticker, not the run.
--
-- THE FIX. One row per run, written once, on this run's own first
-- successful resolution of a proposed bundle — immutable from then on
-- (acquisition/aiProposedBundleSnapshot.ts's save path is INSERT ... ON
-- CONFLICT DO NOTHING; never an UPDATE). analystInputsFor reads this AFTER
-- the committed and recorded sources (preserving their existing
-- precedence over a proposal, unchanged) and BEFORE calling the model
-- again — so a run pins the exact bundle it opened with, while a ticker
-- that later gains a committed or recorded bundle still resolves to that,
-- not to this run's older pin (CF-ANALYST-INPUT-ENTRY-01's resolution
-- order is untouched).
--
-- ADDITIVE ONLY, same discipline as 005/006/007: a wholly new table. No
-- existing column, CHECK constraint or value on any other table changes
-- meaning, and analystInputsFor remains the one resolver — this is a
-- fourth SOURCE it reads, never a second resolver.
--
-- Held as one JSONB blob using the SAME `__decimal__` round-trip tagging
-- snapshotStore.ts already uses for AnalysisResult (toStorable/
-- fromStorable, exported from there for this reuse) — not a second,
-- differently-shaped serialization scheme for the same kind of value. A
-- proposed bundle's own shape (ScenarioInputSet, UndefinedPolicyConstants)
-- is Decimal-heavy throughout, unlike the flatter per-field columns
-- migration 006 uses for a human-entered bundle's simpler text inputs.
CREATE TABLE analyzer_run_ai_proposed_bundles (
  -- Run-keyed, not ticker-keyed — the whole point is that this pin belongs
  -- to the one run that first resolved it, not to the ticker in general.
  run_id     UUID PRIMARY KEY REFERENCES analyzer_runs(run_id) ON DELETE CASCADE,

  -- AnalystInputBundle, exactly as aiProposedAnalystInputBundle resolved
  -- it for this run: { inputs: {...}, note: string }, Decimal-tagged.
  bundle     JSONB NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
