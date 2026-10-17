-- 011_analyzer_run_outputs.sql
-- CF-AR3-REPRODUCIBLE-RUNS-01 — reproducible, dated runs (Analyzer Reset AR3;
-- frozen spec §14.9 AR0-5; Methodology v2.1 D2; product-decisions item 28).
--
-- THE DEFECT. Every report view recomputed the run from live inputs: it
-- re-fetched the price, re-read the filings and re-ran the engine, so the same
-- run could show different numbers on two views, and nothing recorded which
-- facts, price, sheet, policy or code had produced what was on screen.
--
-- THE FIX, in two additive parts.
--
-- 1. analyzer_run_outputs — the computed output of a run, stored once per
--    state of its recorded judgements, with the snapshot it was computed
--    from. The report reads this row; viewing never recomputes. A new row is
--    written only when the run's recorded decisions or judgements change (a
--    different judgements_fingerprint), and it is computed on the SAME market
--    data as the run's first row (price_snapshot), so a run stays valued at
--    its own price date. Rows are write-once (INSERT ... ON CONFLICT DO
--    NOTHING; never UPDATE), so each is an immutable record of one
--    computation. Same R7 property as 002/003/004/009: reachable only by a
--    run_id the caller already holds; no listing query exists or may be added.
--
-- 2. analyzer_run_snapshots (migration 004) gains the same snapshot columns,
--    so a saved version records the tuple it was computed under. Nullable:
--    a version saved before this migration has no tuple to report, and is
--    left as it was.
--
-- ADDITIVE AND IDEMPOTENT: a new table and new nullable columns, all guarded
-- with IF NOT EXISTS. Nothing existing changes meaning, and leaving this
-- applied after a code revert is safe — the old code neither reads nor writes
-- any of it.
--
-- Decimal values inside the JSONB columns use the `__decimal__` tagging of
-- lib/analyzer/storable.ts, as 004 and 009 already do.

CREATE TABLE IF NOT EXISTS analyzer_run_outputs (
  run_id                 UUID NOT NULL REFERENCES analyzer_runs(run_id) ON DELETE CASCADE,

  -- Fingerprint of the run's recorded fact decisions, judgements and profile
  -- decision as they stood when this output was computed
  -- (lib/analyzer/runStore.ts getRecordedJudgementState). The report serves the row matching the
  -- run's current recorded state.
  judgements_fingerprint TEXT NOT NULL,

  schema_version         TEXT NOT NULL,

  -- The deterministic AnalysisResult, exactly as assembled. The AI layer's
  -- prose is not here: it lives in analyzer_run_ai_outputs (003) and is
  -- merged on read, as before.
  analysis_result        JSONB NOT NULL,

  -- The complete engine input (CompanyFixture) the result was assembled
  -- from: re-assembling it reproduces analysis_result exactly. JSON, not
  -- JSONB: JSONB reorders object keys, and the engine reads some inputs in
  -- key order (e.g. the order unset constants are named in a cause), so only
  -- the text exactly as written re-assembles to the identical result.
  engine_input           JSON NOT NULL,

  -- The snapshot tuple (AR0-5). fact_snapshot: the facts with the
  -- verification state this run gave each. price_snapshot: the market data
  -- the run is valued on (price, 52-week range, EPS) — the run's first row's,
  -- reused by every later row of the same run; null fields where none was
  -- available. sheet_version / policy_version / code_version: fingerprints and
  -- the git SHA from AnalysisResult.runIdentity. judgement_snapshot: the
  -- recorded decisions and judgements, with the slots AR5 fills (uncertainty,
  -- moat class, management rating, thesis state) present and null until then.
  fact_snapshot          JSONB NOT NULL,
  price_snapshot         JSONB NOT NULL,
  sheet_version          TEXT NOT NULL,
  policy_version         TEXT NOT NULL,
  code_version           TEXT NOT NULL,
  judgement_snapshot     JSONB NOT NULL,
  inputs_fingerprint     TEXT NOT NULL,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (run_id, judgements_fingerprint)
);

ALTER TABLE analyzer_run_snapshots ADD COLUMN IF NOT EXISTS fact_snapshot      JSONB;
ALTER TABLE analyzer_run_snapshots ADD COLUMN IF NOT EXISTS price_snapshot     JSONB;
ALTER TABLE analyzer_run_snapshots ADD COLUMN IF NOT EXISTS sheet_version      TEXT;
ALTER TABLE analyzer_run_snapshots ADD COLUMN IF NOT EXISTS policy_version     TEXT;
ALTER TABLE analyzer_run_snapshots ADD COLUMN IF NOT EXISTS code_version       TEXT;
ALTER TABLE analyzer_run_snapshots ADD COLUMN IF NOT EXISTS judgement_snapshot JSONB;
ALTER TABLE analyzer_run_snapshots ADD COLUMN IF NOT EXISTS inputs_fingerprint TEXT;
