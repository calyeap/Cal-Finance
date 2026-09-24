-- 006_recorded_analyst_bundles.sql
-- CF-ANALYST-INPUT-ENTRY-01 — a recorded, reusable entry path for the
-- analyst-side inputs lib/analyzer/acquisition/analystInputs.ts states are
-- NOT facts and were never acquired: the three Step 7 scenarios with their
-- drivers and written anchors, the three scenario values, and the four
-- §7.1 constants a human may supply for one company's run.
--
-- AUTHORITY. Calvin's CALVIN RULING — B, 24 Sep 2026 10:48:27Z (issue #286,
-- PR #285 comment 5812636426): authorises "the minimum reusable path
-- needed to supply an otherwise unsupported real company with the existing
-- analyst-input shape required by the current methodology ... use the
-- existing analyst-input contract rather than creating a parallel one."
--
-- ADDITIVE ONLY, same discipline as 005: a wholly new table. No existing
-- column, CHECK constraint or value on any other table changes meaning.
-- analystInputsFor (lib/analyzer/acquisition/analystInputs.ts) remains the
-- one resolver; this table is a second SOURCE it reads, never a second
-- resolver or a parallel contract.
--
-- WHAT IS NOT STORED HERE, and why. `revalueBaseCaseAtRate` — a solver
-- function, not a number — has no column: SCOPE item 6 keeps it out of the
-- entry surface, and an entered bundle always carries the same honest null
-- OKLO's committed bundle already carries there. `preRevenue` likewise has
-- no column: SCOPE item 1 bounds this outcome to exactly the three
-- categories analystInputs.ts's own header calls "the not-acquired
-- surface" (scenarios/drivers/anchors, scenario values, the four §7.1
-- constants) — the pre-revenue profile's unit-economics/funding-stack
-- shape is a distinct, larger Step-7 surface no ruling has authorised
-- entering here, so `profile` below excludes PRE_REVENUE_UNPROFITABLE.
CREATE TABLE analyzer_recorded_analyst_bundles (
  -- One recorded bundle per ticker, matching analystInputsFor's own
  -- per-ticker keying (BUNDLES in analystInputs.ts) — not a second,
  -- differently-keyed store.
  ticker                 TEXT PRIMARY KEY,

  -- §6's profile classification. Not one of the three enumerated
  -- categories above, but CompanyFixture.profile is a required field with
  -- no classifier anywhere in this codebase (assemble.ts's own header:
  -- "PROFILE CLASSIFICATION is taken directly from the fixture, not
  -- computed by a general classifier — none exists in this codebase") —
  -- exactly the same "carried from a human because no classifier exists"
  -- status the three scenarios already have. Restricted to the two
  -- profiles that need no further authored surface of their own: the
  -- pre-revenue profile needs preRevenue, which this table does not carry,
  -- and the asset-based profile is reachable only through the Gate 0
  -- override (never the profile selector, design §5.3) on any run,
  -- recorded or fixture-carried alike.
  profile                TEXT NOT NULL
                           CHECK (profile IN (
                             'MATURE_PROFITABLE_STABLE_FCF',
                             'HIGH_GROWTH_PROFITABLE_UNCERTAIN_DURABILITY'
                           )),

  -- ProfileClassificationInputs (lib/analyzer/types.ts) — the evidence
  -- Screen 3 shows beside the recommendation. Held as JSONB: the fields
  -- are fixed by the frozen AnalystInputs contract, not by this migration,
  -- so there is one place (TypeScript) that defines their shape rather
  -- than two independently-maintained ones.
  classification_inputs  JSONB NOT NULL,

  -- The three Step 7 scenarios (ScenarioInputSet) — drivers, and each
  -- scenario's required written anchor. A driver a human leaves unsupplied
  -- is stored JSON null and returned to analystInputsFor as TypeScript
  -- null — exactly the absence OKLO's committed bundle already carries
  -- for the same three fields (analystInputs.ts's okloBundle), never a
  -- zero and never silently omitted.
  scenarios               JSONB NOT NULL,

  -- The three scenario values. Unlike the drivers above, CompanyFixture's
  -- own type carries no null case for these three — recordedBundles.ts's
  -- write path requires all three before a bundle can be saved.
  scenario_values         JSONB NOT NULL,

  -- The four §7.1 constants (nopatTaxRate, stressMarginLevel,
  -- preRevenueUnleveredRate, projectDebtCost) — each independently
  -- nullable, matching UndefinedPolicyConstants exactly. Recording a value
  -- here is a human supplying it for ONE company's run, never Command
  -- Center defining the constant: policy.ts's UNDEFINED_POLICY_CONSTANTS
  -- is untouched by this migration and stays all-null.
  configured_constants    JSONB NOT NULL,

  -- §12 / the disclosure. Two moments a rendered report and the store both
  -- need: when a bundle was first entered, and when it was last corrected.
  -- Neither is overwritten by the other, so "authored on <date>" in the
  -- disclosure always names the ORIGINAL authoring moment even after a
  -- later correction.
  recorded_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
