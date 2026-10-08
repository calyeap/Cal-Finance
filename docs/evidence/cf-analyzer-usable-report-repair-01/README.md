# CF-ANALYZER-USABLE-REPORT-REPAIR-01 — correction evidence (REVIEW-37786725513-1)

Real browser (Chromium via Playwright, `/opt/pw-browsers`) and real wall-clock
evidence for the two defects REVIEW-37786725513-1 found in head `1f94aba`:
(1) a non-blocking generation that fails never told the reader the truth, and
(2) the prior `DONE:` claimed screenshots and timings that were not attached.
This correction (head `dbb6410` at capture time) fixes (1) in
`lib/analyzer/reportAnalysis.ts`; this folder is the evidence for both.

## Defect 1 — truthful FAILED/PENDING, live in the real app

Captured against the real `/analyzer/{runId}` route (local Postgres,
`ANALYZER_OFFLINE=1`, a seeded MSFT run), with `ANTHROPIC_API_KEY` pointed at
a throwaway local HTTP server (`scripts/_scratch_mock_anthropic.mjs`, not
part of this PR's diff) standing in for the real Anthropic API via
`ANTHROPIC_BASE_URL` — the SDK's own documented override seam
(`client.d.ts`: "Defaults to `process.env['ANTHROPIC_BASE_URL']`"). The mock
returns a `stop_reason: "refusal"` response, optionally after a delay, so the
real `anthropicAnalystCall`/`AnalystCallUnavailableError` path runs
unmodified — nothing in `lib/analyzer` is stubbed.

| File | Scenario | What it shows |
|---|---|---|
| `fast-refusal-overview.png` | Mock refuses near-instantly (no delay) | First view shows **"Interpretation refused"** with the real reason, truthfully, on the same request — the fix for defect 1's fast-settle case. |
| `slow-refusal-overview.png` | Mock refuses after 300ms (slower than the 50ms settle window) | First view falls back to **"Interpretation pending"** with the corrected copy — it no longer promises "reload... to see them"; it now says a later reload "starts a fresh one rather than repeating the same failure." |
| `slow-refusal-overview-reload.png` | Same run, reloaded after the failed generation settled | Still **"Interpretation pending"** — a fresh attempt, exactly what the copy above told the reader to expect; it is not stuck, and it does not lie about a stored result that doesn't exist. |

Measured load times for these three (`Date.now()` around `page.goto(...,
{waitUntil: "networkidle"})`): 1055ms, 1169ms, 1209ms respectively — all
real-request round trips through Next's dev-independent `next start`
production server, local Postgres, and the mock, not down to the `next
start` baseline shown below.

## Defect 2 — the timing table and screenshots the prior `DONE:` promised but omitted

### Baseline vs. head, full app, NOT CONFIGURED path

`baseline-desktop-overview.png` / `baseline-desktop-financials.png` are
`master@90961e4` (this whole outcome's base, pre-#421); `head-desktop-*.png`
are this PR's head. Both ran with no `ANTHROPIC_API_KEY` configured (this
sandbox has none), full `next build` + `next start` against local Postgres,
`ANALYZER_OFFLINE=1`, a freshly seeded MSFT run per server.

| | Overview first load | 7-tab walk (ms/tab) | Reload |
|---|---|---|---|
| baseline (`90961e4`) | 1259ms | business 911, financials 1216, valuation 896, risks 1112, market 882, evidence 1177 | 1168ms |
| head (`dbb6410`) | 1097ms | business 1166, financials 1191, valuation 1131, risks 1134, market 885, evidence 1177 | 1158ms |

**Disclosed honestly: these two rows are not meaningfully different**, and
that is expected, not a failure to measure. #418's ~171s regression — and
this PR's fix for it — is specifically the AI-interpretation/challenger call
path. With no `ANTHROPIC_API_KEY` configured, `call === null` on both
baseline and head, so `analysisForReport` returns `NOT CONFIGURED`
immediately on every tab on both revisions — the defect this PR fixes simply
cannot be reproduced through the full app in this sandbox, exactly the
residual the original PR and both prior corrections already disclosed. What
this comparison *does* show: the full app, including the
`loadGateState`/acquisition-cache changes, renders identically and without
regression on both revisions (screenshots are visually the same report).

### The actual regression and fix, measured directly (stubbed call, as the review accepted)

Run directly against `lib/analyzer/reportAnalysis.ts` (no browser, no HTTP —
`analysisForReport` called the same way `app/analyzer/[runId]/page.tsx`
calls it), `Date.now()` around each call:

| Call | Elapsed | `aiLayer.status` |
|---|---|---|
| `block: true` (pre-#421 behaviour), stub takes 2000ms then fails | **2333ms** | `FAILED` (after the fact) |
| `block: false` (this PR), same 2000ms stub | **328ms** | `PENDING` (truthful fallback — the stub is slower than the 50ms settle window) |
| `block: false`, a stub that fails in ~0ms | **248ms** | `FAILED` (truthful, same request — this correction's fix) |

This is the measured before/after: the blocking path takes at least the
call's own duration (2333ms here; ~171s against the real model per #418);
the non-blocking path returns in a small fraction of that regardless of how
the call ends, and a call that fails fast is now reported as `FAILED` rather
than a generic `PENDING`.

## Reproducing this capture

Every script referenced above is a throwaway (`scripts/_scratch_*`, not part
of this PR's diff — created, used, and deleted within this session, same as
the northstar evidence folder's own preview route). To reproduce: seed an
MSFT run (`createRun` + `advanceRunAutomatically`), start `next build && next
start` against local Postgres with `ANALYZER_OFFLINE=1`, and for the refusal
screenshots additionally set `ANTHROPIC_API_KEY` to any non-empty value and
`ANTHROPIC_BASE_URL` to a local server returning `{"stop_reason": "refusal",
...}` from `POST /v1/messages`.
