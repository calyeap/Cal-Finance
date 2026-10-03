-- 007_company_judgment_overrides.sql
-- CF-ANALYZER-V1-SETTLE-01 — Calvin ruling 2 (issue #392): "durable
-- company-level Calvin overrides may win when present" for §4.4's three
-- judgments. `analyzer_run_judgments` (migration 002) already lets an
-- analyst record a judgment for one run; nothing durable carries an
-- already-ruled answer forward to the NEXT run for the same company, so a
-- settled classification (e.g. MSFT's NON-OPERATING INVESTMENTS ruling,
-- issue #188 `CALVIN DECISION`) had to be re-supplied per run. This is a
-- second, company-keyed SOURCE `selectionToNonOperatingInvestments`'s
-- caller (gate.ts) may fall back to when no per-run judgment exists — it
-- does not change what a per-run judgment means, does not add a third
-- resolver, and never overrides an analyst's own choice for a specific run.
--
-- ADDITIVE ONLY, same discipline as 005/006: a wholly new table. No
-- existing column, CHECK constraint or value on any other table changes
-- meaning.
CREATE TABLE analyzer_company_judgment_overrides (
  -- Company-keyed, not run-keyed — the whole point is that this answer
  -- outlives any one run. Not a foreign key into analyzer_runs: the
  -- override can exist before this company's first run does.
  ticker       TEXT NOT NULL,

  -- Same fixed vocabulary as analyzer_run_judgments.judgment_key — this is
  -- a second source for the same three §4.4 inputs, never a parallel
  -- contract with its own keys.
  judgment_key TEXT NOT NULL CHECK (judgment_key IN (
    'ACCOUNTING-BASIS WINDOW',
    'NON-OPERATING INVESTMENTS',
    'MEDIAN-MARGIN NOPAT WINDOW'
  )),

  -- Same free-text shape and the same reason analyzer_run_judgments uses —
  -- the option set differs per judgment, so constraining it here would
  -- invent vocabulary the contract does not define.
  selection    TEXT NOT NULL,

  -- §4.4: "the confirmation is recorded with its reason". A durable
  -- override is exactly the kind of answer that needs one on the record —
  -- required here (unlike the per-run table's nullable column) because a
  -- durable classification applied to every future run without a stated
  -- reason is not a disclosure, it is an unexplained default.
  reason       TEXT NOT NULL,

  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (ticker, judgment_key)
);

-- MSFT's §4.4 NON-OPERATING INVESTMENTS classification is already settled,
-- not invented here: Calvin's CALVIN DECISION on issue #188 (2026-09-21
-- 08:19:14Z), applied to the real MSFT run per
-- docs/m9-real-company-validation-findings.md §1 — the FY2026
-- `us-gaap:LongTermInvestments` aggregate ($36.348B) alone is MSFT's
-- non-operating investment balance; `EquityMethodInvestments` and
-- `EquitySecuritiesWithoutReadilyDeterminableFairValueAmount` are
-- components of it, not additional amounts. Seeding it here durably is
-- carrying an already-ruled answer forward, exactly what Calvin ruling 2
-- (issue #392) authorises — not a new classification.
INSERT INTO analyzer_company_judgment_overrides (ticker, judgment_key, selection, reason)
VALUES (
  'MSFT',
  'NON-OPERATING INVESTMENTS',
  'us-gaap:LongTermInvestments',
  'CALVIN DECISION, issue #188, 2026-09-21T08:19:14Z: the FY2026 LongTermInvestments ' ||
    'aggregate alone is the non-operating balance; EquityMethodInvestments and ' ||
    'EquitySecuritiesWithoutReadilyDeterminableFairValueAmount are components of it, ' ||
    'not additional amounts, per the primary-source 10-K addendum on #188.'
)
ON CONFLICT (ticker, judgment_key) DO NOTHING;
