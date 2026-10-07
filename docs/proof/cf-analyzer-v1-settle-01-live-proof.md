# CF-ANALYZER-V1-SETTLE-01 — fresh MSFT + NVDA live-proof

**Outcome:** `CF-ANALYZER-V1-SETTLE-01` ([issue #392](https://github.com/calyeap/Cal-Finance/issues/392), [PR #399](https://github.com/calyeap/Cal-Finance/pull/399)).

**What this document is.** REVIEW's `CORRECT:` on this PR found that the
ACCEPTANCE GATE bullet "model interpretation actually ran successfully in the
proof environment" (#392) was unproven — the Overview UI change hides the
interpretation-not-run state, it does not make interpretation run. This
records a run where it actually did.

## What ran and where

- **Workflow:** `.github/workflows/analyzer-live-proof.yml` (`workflow_dispatch`
  only; never wired into `ci.yml`; no recurring spend).
- **Run:** [Analyzer live proof #3](https://github.com/calyeap/Cal-Finance/actions/runs/36858779154),
  job `fresh live run proof`, conclusion `success`.
- **Head:** `c6470eb63aec9e52d2e5da7f36148e686787c994` (branch
  `claude/clever-hopper-w4uoq1`, this PR).
- **Commands:** `npm run ai-run -- MSFT --slots` and `npm run ai-run -- NVDA --slots`
  — the existing, already-reviewed CLI at `scripts/analyzer/ai-run.ts` that
  drives one real end-to-end run through the same functions the browser
  routes use (spot-check confirm → profile confirm → `analysisForReport`,
  including the live §8.2 interpretation call and the §8.5 blind-challenger
  call), then re-walks every figure cited in `[C]` prose back to the field it
  came from.
- **Raw output**, committed verbatim (only the leading per-line CI timestamps
  stripped): [`cf-analyzer-v1-settle-01-msft-live-proof.txt`](./cf-analyzer-v1-settle-01-msft-live-proof.txt),
  [`cf-analyzer-v1-settle-01-nvda-live-proof.txt`](./cf-analyzer-v1-settle-01-nvda-live-proof.txt).

## Why run #3 and not run #2

[Analyzer live proof #2](https://github.com/calyeap/Cal-Finance/actions/runs/36802624531)
(head `12fa20e`) reported `conclusion: success`, but its own job logs show
both `ai-run` invocations crashed at acquisition —
`SecUserAgentMissingError: SEC_USER_AGENT is not set` — before ever reaching
the ANTHROPIC_API_KEY-gated interpretation call. The step still exited `0`
because `cmd | tee file` under the default `bash -e` shell reports `tee`'s
exit status, not the piped command's, so the failure was masked. That run's
"proof" artifact (1,028 bytes) contained only the two stack traces.

This PR's head `c6470eb` fixes both problems in the workflow file: sets
`SEC_USER_AGENT` (not a secret — EDGAR's required identifying contact
string) for the job, and switches the job's run shell to
`bash --noprofile --norc -eo pipefail {0}` so a failing `ai-run` fails the
step instead of being silently swallowed. Run #3, on that fixed head,
produced a 15,801-byte artifact of real output and completed with
`conclusion: success` for real this time.

## What the fresh run actually shows

### MSFT (run `a0ab90ea-b0af-4b05-a826-6544a01e56d0`)

```
AI layer — COMPLETED
model: claude-opus-5
model calls:   2
  challenger      1 call(s) — 33.1s
  interpretation  1 call(s) — 71.5s
wall time:     72.0s
  spent on regenerations  0.0s
...
74 figure reference(s) in [C] prose; 0 without a field behind them.
```

Real interpretation prose (Section I) and real blind-challenger findings
(Section I2, "bears on: ... / evidence: ... / what would have to be true:
...") are present, each citing specific filed figures. No error anywhere in
the run.

### NVDA (run `f8b8288b-5def-4f96-afc6-ff49dbc1f52b`)

```
AI layer — COMPLETED
model: claude-opus-5
model calls:   2
  challenger      1 call(s) — 57.6s
  interpretation  1 call(s) — 76.3s
wall time:     76.5s
  spent on regenerations  0.0s
...
69 figure reference(s) in [C] prose; 0 without a field behind them.
```

Same shape: real interpretation + real challenger output, zero untraceable
`[C]` figures, no error. NVDA's own enterprise-value / leverage / fair-value
range still read `LEVERAGE UNSUPPORTED IN v1` — that is the pre-existing,
separately-scoped `treasuryMethodDilution` / `financeLeaseLiabilities`
tag-mapping gap this PR's own body already names as out of scope, not a new
failure. The scenario range itself (bear $28.08 / base $142.30 / bull
$296.44, price at 75% of span) renders from the durably-recorded,
Calvin-approved Step-7 bundle (migration 008), independent of the suppressed
leverage diagnostics.

## What this does and does not close

This closes the one ACCEPTANCE GATE bullet REVIEW's `CORRECT:` identified as
unproven: a real model interpretation call, on a fresh run, for both
required tickers, with zero untraceable cited figures and no error. It does
not re-litigate the other ACCEPTANCE GATE bullets (Overview marker count,
raw state codes confined to Evidence, `UPDATE` independence, key-stat
population) — those are UI/data-path behaviors already in this PR's diff,
unaffected by this workflow-only change, and remain REVIEW's to check.
