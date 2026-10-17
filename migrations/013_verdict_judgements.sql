-- 013_verdict_judgements.sql
-- CF-AR5-VERDICT-CONSOLIDATION-01 — Cal Finance Methodology v2.1 D3/D4,
-- frozen spec §14.9 AR0-5: Calvin's verdict judgements are dated, versioned
-- inputs, never a per-company override, and "not sure" is recorded as such.
--
-- ADDITIVE, FORWARD-ONLY AND IDEMPOTENT: one new table and one new nullable
-- column. Nothing existing changes meaning, and both are safe to leave
-- applied if the code that reads them is reverted.

-- Append-only: a new answer is a new row; nothing is updated or deleted.
-- The latest row for (ticker, judgement_key) — and, for a close call, for
-- the run inputs it is bound to — is the one in force; its position in that
-- sequence is its version.
CREATE TABLE IF NOT EXISTS analyzer_verdict_judgements (
  id            BIGSERIAL PRIMARY KEY,
  ticker        TEXT NOT NULL,
  judgement_key TEXT NOT NULL CHECK (judgement_key IN (
    'UNCERTAINTY LEVEL',
    'CLOSE CALL',
    'THESIS STATE',
    'MANAGEMENT RATING',
    'MOAT MECHANISM',
    'PROCESS ITEMS'
  )),
  -- The answer, "not sure" included. Each key's own vocabulary is checked
  -- here so no row can carry an answer the verdict cannot read.
  answer        TEXT NOT NULL CHECK (
    (judgement_key = 'UNCERTAINTY LEVEL' AND answer IN ('Low', 'Medium', 'High', 'not sure')) OR
    (judgement_key = 'CLOSE CALL'        AND answer IN ('BUY', 'HOLD', 'SELL', 'not sure')) OR
    (judgement_key = 'THESIS STATE'      AND answer IN ('intact', 'broken', 'not sure')) OR
    (judgement_key = 'MANAGEMENT RATING' AND answer IN ('not poor', 'poor', 'not sure')) OR
    (judgement_key = 'MOAT MECHANISM'    AND answer IN ('cited', 'not sure')) OR
    (judgement_key = 'PROCESS ITEMS'     AND answer IN ('adopted', 'not sure'))
  ),
  -- Calvin's own words: evidence, the cited moat mechanism, a reason.
  note          TEXT NULL,
  -- The five process-item texts, for PROCESS ITEMS.
  detail        JSONB NULL,
  -- For CLOSE CALL only: the run inputs fingerprint (runIdentity) it answers.
  bound_to      TEXT NULL,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((judgement_key = 'CLOSE CALL') = (bound_to IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS analyzer_verdict_judgements_ticker_key
  ON analyzer_verdict_judgements (ticker, judgement_key, id);

-- A saved version records the pending-judgement state the verdict was in
-- (pending adoption, one question, close call, BUY candidate). Those are not
-- verdicts, so verdict_status stays within its existing four values
-- (INCOMPLETE for them) and this column says which state it was.
ALTER TABLE analyzer_run_snapshots
  ADD COLUMN IF NOT EXISTS verdict_state TEXT NULL;

-- The AI's uncertainty proposal for a run whose verdict asks Calvin the one
-- uncertainty question (Methodology v2.1 D3). Generated once per run and
-- read back, like the run's other AI outputs (migration 003), so the
-- proposal Calvin sees does not change under him on a refresh. A proposal
-- is evidence for his answer, never an input to the verdict.
CREATE TABLE IF NOT EXISTS analyzer_uncertainty_proposals (
  run_id      UUID PRIMARY KEY REFERENCES analyzer_runs (run_id) ON DELETE CASCADE,
  level       TEXT NOT NULL CHECK (level IN ('Low', 'Medium', 'High')),
  evidence    JSONB NOT NULL,
  model       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
