-- 012_assumption_sheet_moat_class.sql
-- CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — Cal Finance Methodology v2.1 D2
-- adds two drivers to the assumption sheet: a return on new investment per
-- scenario, and the company's moat class (none / narrow / wide), which sets
-- the terminal return on new capital (the rate plus the moat credit).
--
-- The per-scenario return on new investment needs no column: it is one more
-- key inside the existing `scenarios` JSONB, as every scenario driver is.
-- The moat class is one judgement per sheet, so it gets its own column.
--
-- WITHOUT VALUES (Calvin, 17 Oct 2026 — Option A on #447): no row is
-- written. A sheet whose moat class is NULL is "pending adoption" and the
-- engine computes no D2 value for it; no agent authors this input
-- (docs/product-decisions.md item 19).
--
-- ADDITIVE AND IDEMPOTENT: one nullable column, safe to leave applied if
-- the code that reads it is reverted.
ALTER TABLE analyzer_recorded_analyst_bundles
  ADD COLUMN IF NOT EXISTS moat_class TEXT NULL
    CHECK (moat_class IN ('none', 'narrow', 'wide'));
