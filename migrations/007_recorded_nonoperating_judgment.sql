-- 007_recorded_nonoperating_judgment.sql
-- CF-ANALYZER-FINAL-CLOSEOUT-01 (issue #383) — a durable, per-ticker record
-- of a §4.4 judgment, so a decision already made once does not have to be
-- remade on every new run of the same company.
--
-- AUTHORITY. Calvin's live-use finding on issue #383 ("CALVIN LIVE-USE
-- RESULT — NOT ACCEPTED YET", 2026-09-29T13:12:13Z): a fresh MSFT run
-- reached the honest but unusable LEVERAGE UNSUPPORTED IN v1 / UNUSABLE
-- state that the already-proven MSFT path (lib/analyzer/
-- step4FinalRealRunProof.test.ts, docs/m9-real-company-validation-
-- findings.md §CF-S44-RECORD-01) only avoids because test-only helper code
-- replays Calvin's own already-made §4.4 ruling (issue #188, CALVIN
-- DECISION, 2026-09-21T08:19:14Z) before computing. Calvin's ruling: "the
-- smallest shared cause... make the smallest correction... Localize
-- missing-data states instead of global suppression where current
-- authority safely allows it."
--
-- WHAT THIS IS NOT. The software still does not choose (§4.4,
-- lib/analyzer/acquisition/nonOperatingJudgment.ts's own header): this
-- table stores no classification anything acquires or computes, only a
-- selection a human already made, keyed by ticker so it survives past the
-- one run it was first recorded on. Answering the judgment freshly, per
-- run, on the existing /analyzer/[runId]/facts screen remains exactly as
-- available as before this migration; this table is that screen's write
-- path made durable across runs of the same company, mirroring
-- analyzer_recorded_analyst_bundles (migration 006) for the SAME reason —
-- a decision already made should not have to be remade.
--
-- ADDITIVE ONLY, same discipline as 005/006: a wholly new table. No
-- existing column, CHECK constraint or resolution path on any other table
-- changes meaning. lib/analyzer/gate.ts's own per-run resolution
-- (analyzer_run_judgments, keyed by run_id) is untouched and still wins
-- when a run carries its own decision.
CREATE TABLE analyzer_recorded_judgments (
  ticker         TEXT NOT NULL,

  -- Same three keys §4.4 already defines (lib/analyzer/decisions.ts's
  -- JudgmentKey) — not a new vocabulary.
  judgment_key   TEXT NOT NULL
                   CHECK (judgment_key IN (
                     'ACCOUNTING-BASIS WINDOW',
                     'NON-OPERATING INVESTMENTS',
                     'MEDIAN-MARGIN NOPAT WINDOW'
                   )),

  -- The option label a human selected — the same value
  -- lib/analyzer/runStore.ts's recordJudgment already stores per run, now
  -- also kept per ticker.
  selection      TEXT NOT NULL,
  reason         TEXT,

  recorded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (ticker, judgment_key)
);

-- Calvin's own already-published §4.4 ruling for MSFT (issue #188 comment
-- 5757487226, 2026-09-21T08:19:14Z; reproduced verbatim by
-- lib/analyzer/step4FinalRealRunProof.test.ts, lib/analyzer/
-- automaticAnalysisOnRealRun.test.ts's MSFT_TAG, and docs/
-- m9-real-company-validation-findings.md §CF-S44-RECORD-01): the FY2026
-- us-gaap:LongTermInvestments aggregate alone is MSFT's non-operating
-- investment balance. Seeded here, not invented here — this is the one row
-- needed for a fresh MSFT run to reach the state Calvin's live-use gate
-- expects, without adding any new UI or re-litigating the classification.
INSERT INTO analyzer_recorded_judgments (ticker, judgment_key, selection, reason) VALUES (
  'MSFT',
  'NON-OPERATING INVESTMENTS',
  'us-gaap:LongTermInvestments',
  'Calvin''s §4.4 ruling, 2026-09-21T08:19:14Z, issue #188.'
);
