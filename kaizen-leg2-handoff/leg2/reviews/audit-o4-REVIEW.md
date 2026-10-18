ACCEPT: at ad9da6b the gate's support check reads the run's own pin, so a pinned run reopens offline and online with no AI-proposal call. A run with no pin and no bundle still fails closed. The RED test fails on base for the stated reason. tsc is clean and the full suite is green apart from the known Playwright environment failure.

## Findings (material)

None reproduced.

What I checked, and how:

1. **RED on base, GREEN on head.** I reverse-applied only the `lib/analyzer/gate.ts` hunk and kept the new test.
   - Base: `opens a pinned run offline…` fails with `RunNotFoundError: No run <id>` at `gate.ts:378` (the old `isSupportedTicker(run.ticker)` branch). This is the contract's defect.
   - Head: 2/2 pass.
   - The test's `vi.mock` of `recordedBundles` (it hides NVDA's migration-008 bundle) does take effect. Without it, base would have passed, because NVDA has a recorded bundle.
2. **The online path, which the PR's test does not cover.** I wrote a scratch test (`scratch/onlineReopen.scratch.test.ts`, run as an untracked copy and then deleted). It sets `ANALYZER_OFFLINE=0` and a dummy `ANTHROPIC_API_KEY`, and forces the committed capture for acquisition because sec.gov is blocked. The AI proposal is a spy that returns `null`, standing in for an empty reply or a refusal.
   - Head: the pinned run opens, the spy is never called, and the pin stays unchanged. With no pin, the run still throws `RunNotFoundError` and no pin gets written.
   - Base: the pinned run throws `RunNotFoundError`. That is the contract's "empty reply → unopenable although the pin exists".
3. **Fail-closed.** `analystInputsFor(ticker, runId)` (`acquisition/analystInputs.ts:251-306`) returns null when there is no recorded, committed or pinned bundle and offline mode or a null model result applies, so `gate.ts:381` still throws. The PR test (case 2) covers offline and my scratch test covers online.
4. **DO NOT items.** The precedence (recorded > committed > pin > model), the cache, `aiProposedBundle.ts` and the valuation code are all untouched; the diff changes only `gate.ts:375-381` and adds one test file.
   - Side effect: on a run's first online open, the pin is now written by the gate's support call instead of by `buildAcquiredRun` a few lines later in the same request.
   - The pinned bundle is the same object either way: the same in-process cache entry, and the write is `ON CONFLICT DO NOTHING`. So *what* gets pinned does not change.
   - The model is still called at most once per request.
5. **Other reopen paths.** Every route that reopens by runId goes through `loadGateState`: the facts and profile pages, `autoRun.ts`, and `computeAnalysisForRun` via `verdictDisplay` and the report. The only other support check, `fixtureForTicker` in `app/actions/analyzer.ts:87`, runs before `createRun`, so there is no pin yet and no runId to pass. No other caller needed changing.
6. **Evaluators.** No CI, test config, golden-file or threshold changes, and no skip, only or loosened assertions. The source-text lock in `recordedAnalystInputEntryOnRealRun.test.tsx:299` still matches, because `isSupportedTicker` is kept.
7. **Numbers.** The PR produces no headline number and no valuation, so there was nothing to recompute.

Commands, run on a fresh `leg2c_audit_o4_test` database. The supplied `leg2c_audit_o4` is refused by the repo's own `vitest.setup.ts` guard, which requires a `*_test` name, so I created that database rather than editing the guard.
- `npm run migrate`: all migrations applied.
- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 224/225 files and 2680/2681 tests pass. The one failure is `scripts/evidence/selfTest.test.ts`, which cannot find `chromium_headless_shell-1243`. That is the known environment-only failure.
- The working tree is clean afterwards.

## DONE WHEN / VERIFY

| Item | Status | Evidence |
|---|---|---|
| DO 1: RED test, pinned run, no committed/recorded bundle, offline, AI resolver not called | MET | `lib/analyzer/gatePinnedReopen.test.ts:98-108`; fails on base with RunNotFoundError (`gate.ts:378`), passes on head |
| DO 2: support check run-aware | MET | `lib/analyzer/gate.ts:381` `analystInputsFor(run.ticker, runId)` |
| DO 3: "no bundle at all" still fails closed | MET | `gate.ts:381-385`; test `:110-115` (offline) and scratch test (online) |
| VERIFY: RED → GREEN | MET | see Finding 1 |
| VERIFY: no pin + no bundle fails closed | MET | see Finding 3 |
| VERIFY: existing pinning tests green | MET | `analystInputsPinning.test.ts`, `aiProposedBundleSnapshot.test.ts` pass in the full run |
| VERIFY: `npx tsc --noEmit` clean | MET | exit 0 |
| VERIFY: `npm test` green on exact head | MET (local) | 2680/2681; only the known Playwright environment failure |
| DO NOT: no change to what is pinned, the cache, the AI proposal or any valuation; #466/#454 untouched | MET | diff limited to `gate.ts` hunk + new test |
| DONE WHEN: one PR open | Not checkable here | no GitHub access |
| DONE WHEN: fresh HEAVY REVIEW ACCEPT on exact head, CI green | ACCEPT given here; CI not checkable here | local tsc and test runs are green |
| DONE WHEN: PR merged | Pending | done after review |

## Nits (not counted)

- `lib/analyzer/acquisition/aiProposedBundle.ts:193-196`: this comment still says `isSupportedTicker` is how `loadGateState` checks support. After this PR it is `analystInputsFor(ticker, runId)`.
- In the PR's test, the `not.toHaveBeenCalled()` assertion is trivially true offline, because `analystInputsFor` returns before reaching the model. RED rests on the `RunNotFoundError`. That matches DO 1, but an online case like my scratch test would also pin "no model call when online".
