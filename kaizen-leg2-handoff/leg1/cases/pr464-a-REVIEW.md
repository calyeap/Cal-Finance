CORRECT: head 45e7890 — the RONIC-ladder row in app/components/AnalyzerReport.tsx:767 calls `pct(c.rate)`, which throws `TypeError: value.mul is not a function` when it renders any output stored before AR4. Those outputs include every saved version (snapshot page) and the stored output of any existing run (Financials tab). Smallest fix: `pct(new Decimal(c.rate))` at line 767, plus one regression test that renders a pre-AR4 stored result through AnalyzerReport.

TIER: HEAVY (from the task contract, #452). Reviewed: exact head 45e78906088b410e3ac95d546fae43ad6b1e5dbc, against CASE/pr.diff and CASE/task-contract.md.

## Verdict basis

Everything the contract asks for checks out, except one defect:
- the engine work (D1, D2, the single reverse-DCF solve, expected return, sensitivity, R5 bridge flags);
- the deletions;
- the AR2 harness;
- the Part 4.4 table.

The defect is a regression in code this PR changed. It is bounded and mechanical, so the verdict is CORRECT rather than ACCEPT. The PR's own code shows the intent: guards for "a snapshot stored before AR4" appear in AnalyzerReport, AnalyzerOverview, QuickRead and trustCopy. This one site was missed.

## Finding 1 (blocking): pre-AR4 stored outputs crash the report

- **Where:** `app/components/AnalyzerReport.tsx:765-767`. The `FinancialsSections` row "Reinvestment, RONIC (5yr)" maps `diagnostics.reinvestmentRonic.ronic.value.cells` and renders `r={pct(c.rate)}`.
- **Root cause:**
  - The PR changed `RonicLadderCell.rate` from the numeric literal type `DiscountRate` (0.08 | 0.1 | 0.12) to `Decimal`. At the same time it changed the render from `pct(new Decimal(c.rate), 0)` to `pct(c.rate)`.
  - Stored results are rehydrated by `fromStorable` (lib/analyzer/storable.ts). It turns only `__decimal__`-tagged values back into Decimals, so a result stored before AR4 brings back `rate: 0.08` as a plain number.
  - `pct` calls `value.mul(...)` and throws.
- **Who reads these results:**
  - `app/analyzer/[runId]/snapshot/[version]/page.tsx` renders the full `AnalyzerReport` from `reopenDeepSnapshot`. That covers every saved version — the dated decision record in product-decisions item 31.
  - The live run page reads the run's stored output "exactly as stored — never recomputed" (`reportAnalysis.ts` `storedRunOutput` → `getRunOutput`). So the Financials tab of any run first viewed before this deploy also crashes.
  - Any run whose RONIC ladder was computed is affected. Real MSFT and real NVDA both have one (NVDA is CLEAN at 75.24%).
- **Reproduction:**
  1. Built a base tree by reverse-applying pr.diff (work-a/base).
  2. Ran `work-a/scripts/dumpOld.ts`, which calls `assembleAnalysisResult(MSFT_FIXTURE)` with the base code and writes `toStorable(result)`. The ladder rates come out as `[0.08, 0.1, 0.12]`.
  3. In repo-a at head, ran a temporary jsdom test (copy kept at `work-a/scripts/zzReviewOldSnapshot.test.tsx`; removed from repo-a afterwards). It renders `fromStorable(json)` through `AnalyzerReport`, `AnalyzerOverview` and `QuickRead`, and calls `deriveVerdict`.
  4. Result: `AnalyzerReport` fails with `TypeError: value.mul is not a function` at `app/components/AnalyzerReport.tsx:767:30`. The other three pass.
  5. Patched line 767 to `pct(new Decimal(c.rate))` and reran: all 4 pass, and no other part of a pre-AR4 result breaks the page. The patch was then reverted; repo-a is clean.
- **Smallest fix:**
  - `r={pct(new Decimal(c.rate))}` at line 767. `key={c.rate.toString()}` already works for both shapes.
  - Add a regression test that renders a pre-AR4 stored result (old-shape JSON through `fromStorable`) through `AnalyzerReport`, like the repro above.

## What was verified

**Commands and test results**
- `npx tsc --noEmit`: exit 0.
- `npm run migrate` on pr464a_test: 001–012 applied. Migration 012 adds one nullable `moat_class` column with a CHECK, uses `IF NOT EXISTS`, writes no rows, and is additive and idempotent.
- `npx vitest run`, full suite: 2590 passed, 2 failed out of 2592. Both failures come from this Windows checkout, not from the PR:
  - `m9RealCompanyValidationGuards` hashes `verdict.ts`, which the PR does not touch. The checkout has CRLF line endings; the file's sha256 with CR stripped is exactly the expected `3221c6ac…`.
  - `nvdaAnalystDraftValidation` compares backslash paths against an allowlist that uses forward slashes.
- AR4 test files all pass: `golden/ar4Engine` (31), `valuationInvariants` (16), `knownReds` (12), `goldenFacts` (58), `reverseDcf` (11), `reverseDcf.independentVerification` (4), `scenarioOutputs` (14), `sensitivity` (21), `policy` (13), `msftStage3VerdictOnRealRun` (2), `reverseDcfOnRealRun` (2).
- No `it.fails` remains in the AR2 harness, and no skips were added.

**Part 4.4, reproduced independently**
I wrote my own floating-point oracle (`work-a/scripts/oracle.js`), sharing no code with the PR, using the master plan's stated 16 Oct 2026 inputs:
- FY26 revenue $331.839B, 45% margin, 19% tax, 14% growth.
- 21.5% return on new investment, narrow moat (terminal = r + 1pp), net cash $6.303B, 7,449,545,491 shares.
- Stub from 30 Jun to 16 Oct; mid-year flows, terminal value at 9.5 years.

| Check | Expected (Part 4.4) | Oracle result |
|---|---|---|
| Base value at 8.0% | $411 | $411.35 |
| Base value at 8.5% | $378 | $377.58 |
| Base value at 9.0% | $348 | $348.45 |
| Base value at 10% | $301 | $300.71 |
| Price ÷ base at 8.0 / 8.5 / 9.0 / 10% | 1.29 / 1.40 / 1.52 / 1.76 | 1.286 / 1.401 / 1.518 / 1.759 |
| Moat lever at 9% | $335 / $348 / $373 / $389 / $411 | $335.2 / $348.4 / $372.7 / $389.3 / $410.7 |
| Return-on-new-investment lever at 9% | $283 / $329 / $348 / $374 | $282.8 / $328.9 / $348.4 / $373.5 |
| Implied growth at $529.05 | 24% at 9%, 22% at 8.5% | 24.07% / 21.93% |
| Expected return | ~7% | 7.14% |

The engine's own Part 4.4 tests assert the same numbers.

**D1 — the discount rate**
- Rates come from a dated table with provenance in `policy.ts`: 9.0% stable, 11.0% cyclical or pre-revenue, effective 17 Oct 2026.
- The yearly-reset measurement convention is stored as provenance and labelled AI DEFAULT, not as a rule value.
- Banding: cyclical by the SIC list (AR2's list, moved to `lib/analyzer/cyclicalSic.ts` unchanged) or by trigger B; pre-revenue gets +2pp; growth is never read.
- Check points at ±0.5pp are recorded in `checkRates` for AR5.
- Outside the net-debt gate the rate is marked `withinValidatedDomain: false`.
- The rate in use is shown in Section E (`ValuationBasisView`) and in the verdict slot (`rateInUseLine`).

**D2 — reinvestment and terminal return**
- Reinvestment is NOPAT × next-year growth ÷ return on new investment. That return fades over years 6–10 to the terminal return, which is the rate plus the moat credit: +0 / +1 / +3pp, bear +0, bull = base + 1.5pp.
- M7, M8, M9, M14, M15 and the expected return all go through one engine: `computeScenarioValuation`, via `valueScenario`.
- Terminal FCF ÷ year-10 FCF is exactly 1.03 (inside 0.95–1.10). The Gordon and zero-growth closed forms hold to 1e-6.

**Inputs before adoption**
- A sheet without a return on new investment for every scenario and a moat class is PENDING ADOPTION. The engine computes no D2 value for it.
- Recorded sheets do not fall back to their typed dollar figures, which were entered under the old conventions.
- The report says so in plain language (`overviewCopy.plainReason`). Real MSFT is INCOMPLETE with a "Pending adoption" reason, not the old SELL.
- `fixtures/statedD2Inputs.ts` is test-only; nothing in `lib/`, `app/` or `scripts/` imports it.

**R5 — bridge flags**
- Minority interest and preferred stock are added to the bridge when tagged at the bridge date. Untagged they show as NOT TAGGED; tagged at another date they show as NOT CURRENT and are not added.
- Convertibles are shown as already inside total debt.
- A disclosed fair value for strategic stakes is shown beside the book figure. Contingent items are listed and never deducted.
- LLY's finance leases are counted once, inside total debt. This is keyed by CIK `0000059478` to a cited 10-K quote that is present in `docs/filing-text-evidence-routes.md`.

**Deletions and kept modules**
- Deleted:
  - the 8/10/12% × three-margin grid;
  - the `r + 3pp` convention (`terminalRoicPremium`) and `buildFadingReinvestmentIntensityPath`;
  - the Step-4 dispersion tier;
  - the `terminalValuePv` placeholder (M9 now reads the base scenario's own terminal value);
  - `golden/endOfYearEquivalent.ts`.
- Kept, as the contract requires: M9, M10 (its ±1% input path is unchanged), M11, M13, and the required-versus-achieved comparator.
- The challenger's forbidden-key list still covers `reverseDcf`.

**Rule values and verdict logic**
- No approved rule value changed.
- `verdict.ts` is untouched; its hash matches once CRLF is stripped.
- The growth licence now reads a one-cell ladder at the D1 rate. That is what AR0-2 asks for: every reference to the grid now means the single solve.

## Non-blocking notes (no action needed for ACCEPT)

1. **Evaluator changes.**
   - The AR2 test "RONIC = r ⇒ value independent of growth" is now stated as EV = NOPAT₁ ÷ r × (1+r)^0.5. Under D2's approved timing (this year's investment funds next year's growth) that is the exact form of the invariant. It is tighter (1e-15) and includes a test of paths that share year 1. I accept it.
   - The output-pinning tests for the superseded Stage-2 values are rewritten as pending-adoption and stated-input tests.
   - Each rewrite is marked "reviewed evaluator change" in the file. The PR is a single commit, though, so these changes are not separate from the fix. The PR body was not available to confirm they were listed there.
2. **Return-on-new-investment fade shape.** The fade (constant years 1–5, linear over 6–10) was picked because it reproduces Part 4.4; growthPath.ts notes a year-1 linear fade is $16 lower at 9%. It is consistent with Part 4.3 and D2 ("fading to terminal by year 10"), and it is a technical choice inside the rule. It needs an AI DEFAULT receipt in the PR.
3. **Growth and margin sensitivity are MSFT-only.** These rows only exist where `sensitivityRangesFor` supplies ranges, which is MSFT only under CALVIN RULING A. For every other adopted sheet they are unavailable, while the rate, return-on-new-investment and moat rows are computed. MSFT's margin range is exactly its three margin levels, so AR0-2's "margin levels move to sensitivity" holds only for MSFT. Widening this touches Ruling A's scope, which is not a REVIEW call. QuickRead's new text, "the margin sensitivity shows by how much", points at a row most tickers will not have.
4. **The assumption-sheet form has no D2 fields.** `AnalystBundleForm` and `app/actions/analystInputs.ts` neither show nor keep `returnOnNewInvestment` and `moatClass`. `recordAnalystBundle` sets `moat_class = EXCLUDED.moat_class`, so re-saving the form would wipe an adopted moat class and the per-scenario returns. Nothing is recorded yet, so this is latent; the adoption flow (AR6, #454) should carry these fields.
5. **Run outputs are keyed by run and judgements, not code version.** An existing run therefore keeps showing its pre-AR4 stored output (10% rate, old conventions) until something new is recorded on it; new runs get AR4 values. This is AR3's design, but Calvin should expect it.

## Recovery

- Revert the code.
- Migration 012 is additive: one nullable column, no rows. Leaving it applied after a revert is safe.
