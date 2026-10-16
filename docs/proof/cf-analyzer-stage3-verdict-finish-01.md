# CF-ANALYZER-STAGE3-VERDICT-FINISH-01 — real, defensible BUY/HOLD/SELL

**This is evidence and reconciliation for independent REVIEW — not Calvin's
final acceptance, not a claim that `docs/acceptance-matrix.md` row 11 or row
13 is satisfied.** Those rows stay Calvin's / OWNER's to close.

## 0. Authority

Issue [#444](https://github.com/calyeap/Cal-Finance/issues/444)
(`CF-ANALYZER-STAGE3-VERDICT-FINISH-01`, TIER HEAVY), authorised by Calvin's
"so whats next lets keep moving stop stopping" after merged Stage-2 PRs #440
and #443. Governed by Calvin's `CALVIN RULING — NO` on PR #430
([comment 6167808992](https://github.com/calyeap/Cal-Finance/pull/430#issuecomment-6167808992)):
*"Do not retire the 22 Sep V1 bands yet. They are explicitly marked APPROVED
in Methodology... I want the fastest bounded path to a finished Analyzer.
Reuse the existing DCF evidence, Ruling C and V1 policy where valid."*

## 1. The reconciliation this outcome had to make precisely before changing behaviour

Two independent, non-conflicting mechanisms exist for the same output
vocabulary (BUY/HOLD/SELL, settled by the Methodology's 18 Sep 2026 FINAL
OWNER RULING):

- **`CALVIN RULING — C`'s seven-step derivation** (`docs/verdict-methodology-reconciliation.md`
  §10, applied to `docs/frozen/calboard-stock-analyzer-v1-spec.md` §10.6.2):
  licenses *which* value (growth-inclusive vs. conservative) is compared
  against price, via the RONIC-vs-rate reading (`growthLicence.ts`). Steps
  2 and 6 (`growthLicence.ts`, `flipTest.ts`) are built and tested, per
  `CF-M8-VERDICT-ENGINEERING-UNBLOCK-01`. Steps 3, 4 and 5 are not: §11
  items 1 (Step 4's margin-of-safety measure), 3 (Step 3's conservative-value
  shape) and 5 (Step 5's numeric band) remain open house policy, confirmed
  unanswerable from current evidence by `docs/verdict-decision-pack.md`.

- **The live Cal Finance Methodology's own "Verdict synthesis policy v1"**
  (Notion, "Cal Finance — Methodology" page, APPROVED 22 Sep 2026): price
  versus the Base scenario value, banded by an uncertainty bucket
  (Low/Medium/High), with exact numbers —
  BUY ≤ 0.90×/0.80×/0.70×, SELL ≥ 1.20×/1.30×/1.45× — explicitly **"now
  APPROVED V1 POLICY ... changed only by a later explicit Cal Finance
  methodology ruling."**

`docs/decision-packs/cf-analyzer-final-method-decision-01.md` (PR #430)
proposed treating V1 as superseded/retirable Notion wording and Ruling C as
the sole governing mechanism. **Calvin's ruling on that pack is NO**: V1 is
still approved, and whether Ruling C actually superseded it needed
reconciling, not assuming. Reconciled here: Ruling C's own text and ruling
only ever addressed the frozen spec's §10.6.2 subsection (an internal
CHEAP/FAIR/EXPENSIVE diagnostic derivation) and was never promoted to, or
reconciled against, the Methodology page's own later-dated, independently
complete V1 policy. Per `docs/technical-specs.md`'s own conflict rule, the
Methodology is finance-semantic authority over a repo-only implementation
ruling on semantic conflicts — and V1 needs no further ruling to be
implementable: every number it specifies is already approved; Ruling C's
structure, by contrast, still has three open house-policy items standing
between it and a single supported company (`docs/verdict-decision-pack.md`
§8's own table). This outcome therefore implements V1 — the mechanism that
is actually complete today — and leaves Ruling C's own structure exactly as
it was (`growthLicence.ts`, `flipTest.ts` untouched, no Step 3/4/5 code
added, §11 items 1/3/4/5/6/7 still open and unanswered by this outcome).

## 2. What V1 needs, and what remains genuinely open

V1's global prerequisite (identified security, trustworthy financials, a
defensible Base value) is exactly `deriveVerdict`'s existing Step-1-
equivalent gates (trust not UNUSABLE, range not suppressed, not
pre-revenue, profile confirmed) — reused unchanged, not duplicated. Its
valuation anchor (price ÷ Base) is two facts `AnalysisResult` already
carries (`price.value`, `scenarioOutputs.values.base`). Its six band
numbers are the Methodology's own, transcribed verbatim into
`lib/analyzer/policy.ts` (`verdictSynthesisV1Buy`/`verdictSynthesisV1Sell`,
not `PROVISIONAL` — they carry no `POLICY_THRESHOLD_PROVENANCE` entry).

**What is not resolved, and is not invented here:** the Methodology names the
uncertainty-bucket (Low/Medium/High) factors — "operating/financial
leverage, cyclicality, disclosure quality/history, binary regulatory or
litigation exposure, and Bear–Bull dispersion" — without a formula for
combining them, and no such formula exists anywhere in this tree
(confirmed: `git grep` for any such combination finds nothing).
`lib/analyzer/verdictSynthesisV1.ts` does not guess one. Instead it issues
BUY or SELL only where the answer is **identical under all three buckets at
once** — true exactly when the ratio clears the strictest threshold in that
direction (SELL: ratio ≥ 1.45×; BUY-eligible-on-valuation: ratio ≤ 0.70×),
which by construction also clears the two looser thresholds. Where the
bucket choice would actually change the answer, or where BUY's own
additional business-quality/thesis-invalidation judgement (human-owned,
`docs/product-decisions.md` items 3/9) is not recorded, the function returns
`INCOMPLETE` with the specific named cause — never a default, never a
guessed bucket, never a fabricated BUY.

## 3. The real proof

`lib/analyzer/msftStage3VerdictOnRealRun.test.ts` drives MSFT through the
real `createRun` → `computeAnalysisForRun` → `deriveVerdict` path, reading
`migrations/010_msft_recorded_bundle_seed.sql`'s durably recorded,
Calvin-approved Stage-2 candidate (PR #440 `CALVIN RULING — YES, APPROVED`):

| Fact | Value | Source |
|---|---|---|
| Price | $499.70 | `lib/analyzer/acquisition/captures/prices.json`, real captured close |
| Base fair value | $283.31 | Real recomputation from the recorded Stage-2 drivers against the pinned SEC capture |
| Ratio | 1.7638× | price ÷ Base |
| Trust | PARTIAL | Leverage PASS; no REQUIRED input missing |
| Verdict | **SELL** | ratio ≥ 1.45× (the High-uncertainty threshold) — true under Low (1.20×) and Medium (1.30×) too |

This SELL is invariant to the one open house-policy item (the
uncertainty-bucket formula): every bucket reading agrees. OKLO and NVDA are
unaffected and unexercised by this change — both are blocked upstream of
any synthesis, OKLO by `LEVERAGE UNSUPPORTED IN v1` (pre-revenue), NVDA by
the same plus a missing price — exactly as before this outcome
(`lib/analyzer/nvdaDurableBundleSeed.test.ts`, re-verified passing).

## 4. Verification

- `npx tsc --noEmit`: clean.
- `npx vitest run`: 2457/2458 passing. The one failure is the same
  pre-existing, environment-only Playwright browser-binary gap
  (`scripts/evidence/selfTest.test.ts`) every prior PR in this repo names —
  unrelated to any file this outcome touches.
- `git diff --stat` against `master`: no `docs/frozen/` byte, no
  `FROZEN_HASHES` entry, no `docs/product-decisions.md`,
  `docs/acceptance-matrix.md`, or Notion write touched. `lib/analyzer/verdict.ts`
  changed with this outcome's own explicit authority (issue #444); the pin
  in `lib/analyzer/m9RealCompanyValidationGuards.test.ts` is updated to the
  new hash, with the exact authorisation named inline.
- Several already-passing tests asserted the old, permanent
  `COMPARATOR_NOT_YET_AVAILABLE` INCOMPLETE as MSFT's only possible verdict;
  each is updated to the new, real SELL (or, where the test's own fixture
  sits inside V1's invariant HOLD zone, the real HOLD) with the same
  underlying property re-asserted — never weakened to make the suite pass.
  One pre-existing test-isolation gap (two sibling real-run test files
  delete migration 010's durable MSFT row without restoring it,
  `msftStage2DurableBundleSeed.test.ts`'s own header already documents this)
  is hardened in the two files whose expectations this outcome's own new
  file exposed it against, by re-applying the migration directly rather
  than assuming another file's cleanup ran first — the same discipline
  `msftStage2DurableBundleSeed.test.ts` already uses.

## 5. What this outcome did not do

Did not touch `growthLicence.ts`, `flipTest.ts`, or add any Step 3/4/5 code
toward Ruling C's own structure; did not answer `docs/verdict-methodology-reconciliation.md`
§11 items 1, 2, 3, 4, 5, 6 or 7; did not touch `docs/frozen/`,
`FROZEN_HASHES`, `docs/product-decisions.md`, `docs/acceptance-matrix.md`,
or the Notion Methodology page; did not record a production/local DB write
(this proof runs against `*_test` only); did not claim Calvin's final
acceptance or mark any acceptance-matrix row satisfied; did not invent a
numeric threshold anywhere — every number in `verdictSynthesisV1Buy`/`Sell`
is the Methodology's own, transcribed verbatim.
