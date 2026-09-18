-- 004_analyzer_run_snapshots.sql
-- CF-V2-PROOF-01 — the bounded DEEP + versioned-snapshot proof (Calvin,
-- 17 Sep 2026: "the temporary hold on new Cal Finance product/architecture
-- dispatch is lifted... produce and persist one complete versioned DEEP
-- analysis snapshot; reopen it faithfully").
--
-- R7 IS UNCHANGED. Reachable only by (run_id, version), which the caller
-- must already hold — the same "runId in the URL, no index" property
-- runStore.ts states for analyzer_runs. This table adds no listing surface:
-- there is no query in this codebase, and none may be added, that returns
-- snapshots without being given the run_id they belong to.
--
-- WHAT THIS STORES that 002/003 deliberately do not: a full, immutable copy
-- of one computed AnalysisResult (facts, provenance, gates, scenarios,
-- fairValueRange, trust — every §10.0.1 member), plus the verdict derived
-- from it. Everything else the analyzer computes is recomputed on every
-- request BY DESIGN (gate.ts, reportAnalysis.ts) because it is a pure
-- function of its inputs; a snapshot exists to prove that a SPECIFIC
-- computation, once produced, can be reopened byte-for-byte later without
-- re-deriving it from (possibly since-changed) live inputs.
--
-- versions are per run_id, starting at 1, assigned by the application
-- inside one transaction (lib/analyzer/snapshotStore.ts) rather than by a
-- shared sequence — this app is single-user and local (§1.5), so there is
-- no concurrent writer to race against, and the UNIQUE constraint below is
-- the backstop if that ever stops being true.

CREATE TABLE analyzer_run_snapshots (
  run_id          UUID NOT NULL REFERENCES analyzer_runs(run_id) ON DELETE CASCADE,
  version         INTEGER NOT NULL CHECK (version > 0),

  -- AnalysisResult.schemaVersion, carried alongside the payload so a later
  -- reader can tell what shape it is looking at without parsing the JSON
  -- first (§10.0.2 rule 5).
  schema_version  TEXT NOT NULL,

  -- The full, merged AnalysisResult (deterministic result plus any AI
  -- interpretation/challenger already merged into it) exactly as one
  -- request of analysisForReport returned it. Decimal values are stored
  -- tagged ({"__decimal__": "265"}) by lib/analyzer/snapshotStore.ts so
  -- they round-trip as Decimal instances, not floats, on the way back out.
  analysis_result JSONB NOT NULL,

  -- What the AI layer did on the request that produced this snapshot —
  -- ReportAnalysis.aiLayer, verbatim. Kept beside the result rather than
  -- re-read from analyzer_run_ai_outputs so a snapshot remains a complete,
  -- self-contained record even if that row is later overwritten by a
  -- fresh generation on the live (non-snapshotted) run.
  ai_layer_status TEXT NOT NULL CHECK (ai_layer_status IN ('COMPLETED', 'NOT CONFIGURED', 'FAILED')),
  ai_layer_model  TEXT,
  ai_layer_detail TEXT,

  -- CF-V2-PROOF-01's verdict boundary (lib/analyzer/verdict.ts). The
  -- verdict is never determined by a single diagnostic; where
  -- decision-critical evidence is insufficient the column holds INCOMPLETE
  -- with its cause in verdict_reason. Never a fifth value — a manufactured
  -- verdict is exactly what this outcome's SCOPE forbids.
  verdict_status  TEXT NOT NULL CHECK (verdict_status IN ('BUY', 'HOLD', 'SELL', 'INCOMPLETE')),
  verdict_reason  TEXT NOT NULL,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (run_id, version)
);
