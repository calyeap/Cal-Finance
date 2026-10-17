-- 014_assumption_sheets.sql
-- CF-AR6-ANY-TICKER-DRAFTS-01 — Analyzer Reset AR6, product-decisions item 30
-- (D5, adopt-to-finalize), frozen spec §14.9 AR0-6.
--
-- WHY A NEW TABLE. Migration 006 keeps one row per ticker and corrects it in
-- place (ON CONFLICT DO UPDATE), so an assumption sheet cannot be versioned
-- there: adopting a sheet would overwrite the draft it was adopted from, and
-- a run could not say which version it was valued on. This table is
-- append-only — a draft, an adoption and a redraft are each a new row; the
-- trigger below refuses UPDATE and DELETE, so no version is ever rewritten.
--
-- THE SHEET IN FORCE for a ticker is its latest ADOPTED row, or, where none
-- has been adopted, its latest DRAFT row. A draft values automatically; the
-- final verdict waits for adoption (product-decisions item 30).
--
-- ADDITIVE, FORWARD-ONLY AND IDEMPOTENT. One new table, one new function and
-- trigger, and one INSERT that copies each ticker's recorded bundle (MSFT and
-- NVDA, and anything else recorded locally) in as its version 1 DRAFT —
-- origin MIGRATED BUNDLE — only where that ticker has no sheet yet, so a
-- second run inserts nothing. Migrated sheets are DRAFT whatever they carry:
-- each needs one re-adoption (product-decisions items 27 and 30). The old
-- analyzer_recorded_analyst_bundles table and its rows are left exactly as
-- they are (no destructive migration); code no longer reads them.
CREATE TABLE IF NOT EXISTS analyzer_assumption_sheets (
  id           BIGSERIAL PRIMARY KEY,
  ticker       TEXT NOT NULL,
  -- 1, 2, 3 … per ticker, in the order the rows were written.
  version      INTEGER NOT NULL CHECK (version >= 1),
  -- DRAFT: valued automatically, final verdict pending adoption.
  -- ADOPTED: Calvin's authorship of the scenarios (product-decisions item 19).
  status       TEXT NOT NULL CHECK (status IN ('DRAFT', 'ADOPTED')),
  origin       TEXT NOT NULL CHECK (origin IN ('AI DRAFT', 'CANNOT CONCLUDE', 'MIGRATED BUNDLE', 'ADOPTED AS DRAFTED', 'ADOPTED WITH ADJUSTMENTS')),
  -- The sheet itself: drivers as decimal text, an anchor and citations per
  -- driver, the moat class, the policy constants and the research sources
  -- every citation points at (lib/analyzer/sheets/sheet.ts SheetContent).
  content      JSONB NOT NULL,
  -- For an adoption: the draft row it adopts.
  adopted_from BIGINT NULL REFERENCES analyzer_assumption_sheets (id),
  -- The model that wrote an AI draft; null otherwise.
  model        TEXT NULL,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticker, version),
  CHECK ((status = 'ADOPTED') = (origin IN ('ADOPTED AS DRAFTED', 'ADOPTED WITH ADJUSTMENTS'))),
  CHECK ((status = 'ADOPTED') = (adopted_from IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS analyzer_assumption_sheets_ticker_version
  ON analyzer_assumption_sheets (ticker, version);

CREATE OR REPLACE FUNCTION analyzer_assumption_sheets_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'analyzer_assumption_sheets is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS analyzer_assumption_sheets_append_only ON analyzer_assumption_sheets;
CREATE TRIGGER analyzer_assumption_sheets_append_only
  BEFORE UPDATE OR DELETE ON analyzer_assumption_sheets
  FOR EACH ROW EXECUTE FUNCTION analyzer_assumption_sheets_append_only();

INSERT INTO analyzer_assumption_sheets (ticker, version, status, origin, content)
SELECT
  b.ticker,
  1,
  'DRAFT',
  'MIGRATED BUNDLE',
  jsonb_build_object(
    'profile', b.profile,
    'classificationInputs', b.classification_inputs,
    'scenarios', b.scenarios,
    'moatClass', b.moat_class,
    'configuredConstants', b.configured_constants,
    'legacyScenarioValues', b.scenario_values,
    'migratedFrom', jsonb_build_object(
      'table', 'analyzer_recorded_analyst_bundles',
      'recordedAt', b.recorded_at,
      'updatedAt', b.updated_at
    )
  )
FROM analyzer_recorded_analyst_bundles b
WHERE NOT EXISTS (SELECT 1 FROM analyzer_assumption_sheets s WHERE s.ticker = b.ticker);
