# UPDATE lane — re-look real-run observation (MSFT, OKLO)

`CF-UPDATE-REALRUN-PROOF-01` (issue #345). This document reports the
observed real-run document `docs/acceptance-matrix.md` row 17's own
REAL-COMPANY VALIDATION cell says does not exist for the UPDATE lane: what a
re-look's own report actually reads for a real company, at the same head as
its first run, against the real store and the real committed MSFT/OKLO
captures — the same shape `docs/nvda-realrun-observation.md`
(`CF-NVDA-RUN-OBSERVE-01`) already established for Analyzer V2.

**This document reports. It rules nothing.** It grants no acceptance,
changes no capability, semantic, threshold or policy, and marks no
acceptance-matrix row satisfied. The lane-level acceptance question (whether
Calvin accepts the UPDATE outcome, what lane opens next) is reserved to a
later OWNER run and is not raised here.

**Verified at `origin/master` = `e298822`** (2026-09-26,
`CF-UPDATE-ACCEPTANCE-RECORD-01`, #342 — the head this outcome was opened
against). The reproducing test is `lib/analyzer/updateRealRunObservation.test.ts`.

## What was done

For **both MSFT and OKLO** (OKLO reachable at no additional capture, source
or access — its capture is already committed, same as MSFT's):

1. A first run was opened through the same gated path the existing real-run
   suites use: `createRun(ticker, companyName)` →
   `advanceRunAutomatically(runId)` → `computeAnalysisForRun(runId)`.
2. A re-look was opened the way `beginUpdateRunAction` opens one
   (`app/actions/analyzer.ts:134-141`): the identity taken **only** from the
   first run's own server-held ticker via `getRun`, then the same
   post-identity body `commitAndRunAnalysis` runs for any run —
   `createRun` → `advanceRunAutomatically` → `computeAnalysisForRun` — run
   again, independently, against the freshly re-resolved identity.
3. The re-look's own `AnalysisResult` and `deriveVerdict` output were
   compared, field for field, against the first run's, and every figure
   this document quotes was asserted directly off that comparison by
   `lib/analyzer/updateRealRunObservation.test.ts`.

This file extends `lib/analyzer/updateRunOnRealRun.test.ts` rather than
restating it: that file already proves, structurally, that a re-look gets
its own distinct database `runId`, that the prior run's row/decisions/report
stay untouched, that no fact or judgment is copied forward, and that the new
run is gated shut until its own automatic pass completes it. None of those
four assertions is repeated in the new file or in this document.

## (a) Figure-for-figure comparison

**Zero cells differ.** A full field-by-field comparison of the re-look's
`AnalysisResult` against the first run's, at the same head, for both MSFT
and OKLO, found no difference anywhere — not in price, facts, decisions,
gates, diagnostics, trust, fair-value range, or the derived verdict. Every
figure below is quoted directly off that comparison, not inferred:

| Figure | MSFT | OKLO |
|---|---|---|
| `price.value` / `price.timestamp` | `499.7` / `2026-09-04` | `41.27` / `2026-09-04` |
| `trust.status` | `UNUSABLE` | `UNUSABLE` |
| `gates.leverage.result` | `LEVERAGE UNSUPPORTED IN v1` | `LEVERAGE UNSUPPORTED IN v1` |
| `fairValueRange.kind` | `suppressed` | `suppressed` |
| `diagnostics.enterpriseValue.cause` | `missing REQUIRED input(s): nonOperatingEquityInvestmentsAtBook` | `missing REQUIRED input(s): treasuryMethodDilution, nonOperatingEquityInvestmentsAtBook` |
| Fact queue (both runs, both AUTOMATIC) | `current-operating-margin`, `price` | `price` |

Identical on the first run and the re-look alike, for each company. This is
the expected consequence of the pipeline being deterministic and offline
(the same committed captures, no live price fetch, no §4.4 judgment made on
either run): with no changed input, a re-look and a first run compute the
same output.

**One figure named in the issue's own SCOPE text as an example of an
expected difference does not, in fact, differ, and the reason is worth
naming plainly rather than smoothing over.** SCOPE item 4(a) lists `runId`
as an example cause a differing cell might carry. `AnalysisResult.runId`
does **not** differ between the first run and the re-look, on either
company:

- MSFT: `acquired-msft` on both runs.
- OKLO: `acquired-oklo` on both runs.

The reason is `AnalysisResult.runId`'s own source
(`lib/analyzer/acquisition/companyInputs.ts:342`): for an acquired real run
it is set to `` `acquired-${ticker.toLowerCase()}` `` — a value derived only
from the ticker, not from the database `runId` (the UUID `createRun`
issues). The two runs **are** genuinely distinct at the database level —
`lib/analyzer/updateRunOnRealRun.test.ts` already proves this structurally,
and `updateRealRunObservation.test.ts` confirms the two database `runId`
values differ on every pass — but that distinguishing id is a different
field from the one embedded inside the computed report. A consumer reading
only `AnalysisResult.runId` cannot tell a re-look's report apart from its
prior run's report for the same company, because the field was never
designed to be a per-run identifier. This is reported as an observed fact
about the current build's output, not a defect this outcome diagnoses or
fixes (HARD BOUNDS 1: observe only, no change to `app/actions/analyzer.ts`
or any UPDATE capability).

## (b) The verdict actually returned

Both MSFT and OKLO's re-look reach `verdict.status === "INCOMPLETE"`, cause
`"Decision-critical analysis is incomplete — LEVERAGE UNSUPPORTED IN v1 —
inputs missing — the ratio could not be computed, so the precondition fails
closed"` — the same cause the first run reaches, and the same cause
`lib/analyzer/automaticAnalysisOnRealRun.test.ts` already established for
both companies' *first* runs under the identical automatic pipeline. This is
the expected, already-settled consequence of `deriveVerdict` returning
`INCOMPLETE` unconditionally on every branch, for every company, until M8
lands (`docs/acceptance-matrix.md` row 13; FINAL OWNER RULING #205) — it is
reported here, not re-raised as a defect or a gate.

## (c) The anti-momentum property, observed on this pass

On both companies, the re-look's own automatic pass recorded its own fact
decisions from scratch — every decision on the re-look carries origin
`AUTOMATIC` and the same fact ids the first run's own queue carried, decided
independently rather than copied — and, before that pass ran, the re-look
was gated shut exactly as a first run is (a bare `createRun` cannot reach
`computeAnalysisForRun` until `advanceRunAutomatically` completes it). This
is the same property `lib/analyzer/updateRunOnRealRun.test.ts` already
proves structurally (a distinct `runId`, an untouched prior run, no fact or
judgment copied forward, gated shut until the new run's own pass); this
document only records that the property held on this observation pass too,
rather than re-deriving it.

## (d) What this document does not do

This document reports. It rules nothing. It grants no acceptance, changes no
capability, semantic, threshold, or policy, and marks no acceptance-matrix
row satisfied. It answers no open item in
`docs/verdict-methodology-reconciliation.md` §11, resolves no open question
in `docs/product-roadmap.md` §3, and does not reopen FINAL OWNER RULING #205
or any other settled ruling named in this outcome's HARD BOUNDS. The
lane-level acceptance question and the per-tab rendering observation
(SCOPE item 7, `docs/acceptance-matrix.md` row 17's own closing note) are
left exactly where they are — a later OWNER run's to raise, not this
outcome's.

## Coverage boundary — what was observed directly, and what was not

The half observed directly, by both the reproducing test and this document:
`createRun` → `advanceRunAutomatically` → `computeAnalysisForRun`, run twice
independently against the real store and the real committed MSFT/OKLO
captures, with the second run's identity taken from the first run's own
stored ticker via `getRun` — the same post-identity body
`beginUpdateRunAction` and `beginAnalysisAction` both share
(`commitAndRunAnalysis`, `app/actions/analyzer.ts:71-98`).

The half **not** observed directly: `commitAndRunAnalysis` itself ends in
Next.js `redirect()`, and `beginUpdateRunAction` additionally calls
`resolveAnalyzerIdentity`, a network identity resolution the offline suite
(`ANALYZER_OFFLINE=1`, `vitest.setup.ts:51`) does not exercise. That half is
already covered as a mocked unit test in `app/actions/analyzer.test.ts`,
which proves the action's own control flow — that the identity comes only
from the prior run's stored ticker, never from anything the client posts,
and that the refusal path is shared with `beginAnalysisAction` — in
isolation from the real pipeline. This document does not claim, and no test
here performs, an end-to-end server-action run. No second offline switch and
no Next-runtime harness was added to close that gap (HARD BOUNDS 2).
