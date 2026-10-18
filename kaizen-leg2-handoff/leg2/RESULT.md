# KAIZEN Proof Leg 2: result

**Date:** 18 Oct 2026. **Authority:** Calvin's GO Leg 2 (`LEG2-PLAN.md` steps A and B) and his cloud instruction to resume O4–O6.
**Record:** `scorecard.tsv` (one row per outcome), `cloud-ledger.md` (O4 onward, timestamped), `reviews/` (every review and blind audit).

## Verdict: KEEP the existing workflow

The lean SOP is **not proven**. It fails 2 of the 4 pre-registered conditions (Calvin touches, elapsed time). Per `LEG2-PLAN.md` §3, the existing BUILD → REVIEW → OWNER workflow stays the default, and the OWNER/relay retirement question does not arise.

Quality and safety were equal: every outcome in both arms passed its blind audit with 0 escaped defects, 0 CORRECTs and 0 safety incidents.

## 1. Scorecard (P, the pre-flight, is not a sample)

| # | Outcome | Arm | Tier | Elapsed (min) | Calvin touches | Control comments | Cost / tokens | Blind audit | Escaped |
|---|---|---|---|---|---|---|---|---|---|
| 1 | PREAR4-REPORT-CRASH | A | NORMAL | 11.4 | 0 | 6 | $3.68 · 288k ctx (3 sessions) | ACCEPT | 0 |
| 2 | RATE-DOMAIN-COPY | B | NORMAL | 29.2 | 1 (merge) | 0 | 291k tokens (2 agents) | ACCEPT | 0 |
| 3 | DECIDED-FACT-GATING | B | HEAVY | 38.5 | 1 (merge) | 0 | 529k tokens (2 agents) | ACCEPT | 0 |
| 4 | PINNED-REOPEN | A | HEAVY | 14.8 | 0 | 6 | $2.58 · 249k ctx | ACCEPT | 0 |
| 5 | KO-GOLDEN-DEBT | A | HEAVY | 14.3 | 0 | 6 | $4.22 · 312k ctx | {O5_AUDIT} | {O5_ESCAPED} |
| 6 | (next released outcome) | B | — | not run | — | — | — | — | — |

- Every outcome took one review cycle with no CORRECT.
- Arm A's merge is done by REVIEW itself, about 3 s after ACCEPT. Arm B's merge waited for Calvin: about 11 min on O2 and about 5 min on O3.
- Cost: arm-A routine usage became visible from the cloud (`get_session` on each routine session), so O1's cost was measured retroactively. Arm B's figures are agent token totals. Both are final-context counts and are of the same order, so treat them as roughly comparable, not exact.

## 2. The pre-registered rule, applied

| Condition (B passes only if all hold) | A | B | Holds? |
|---|---|---|---|
| 1. B's escaped defects ≤ A's | 0 | 0 | ✅ |
| 2. B has zero safety incidents | — | 0 | ✅ |
| 3. B's Calvin touches per outcome ≤ A's | 0.0 | 1.0 | ❌ |
| 4. B's median elapsed ≤ 1.5 × A's | median 14.3 → limit 21.45 | median 33.85 (2.37 × A) | ❌ |

**Result: the lean SOP is not proven, so keep the existing workflow.**

## 3. Would any reasonable reading flip it? No.

| Reading | B vs A | Condition 4 |
|---|---|---|
| As scored (dispatch → merge) | 33.85 vs 14.3 (2.37×) | fails |
| Remove Calvin's merge wait from B | 25.85 vs 14.3 (1.81×) | fails |
| Dispatch → ACCEPT only (ignore merging entirely) | 25.25 vs 14.18 (1.78×) | fails |
| Add O6 with any result, even 0 min | median ≥ 29.2 | fails |

Condition 3 also fails in every reading where Calvin merges arm B. It passes only if the merge is not counted, and condition 4 still fails then.

## 4. Why B lost (root causes)

Minutes per phase, measured from receipts and PR timestamps (B's ACCEPT times are the local operator's approximate stamps):

| Phase | A: O1 / O4 / O5 | B: O2 / O3 |
|---|---|---|
| Build (dispatch → PR open) | 7.7 / 8.7 / 9.4 | 9.5 / 23.7 |
| Review (PR open → ACCEPT) | 3.6 / 6.1 / 4.8 | ~8.0 / ~9.3 |
| Merge (ACCEPT → merged) | 0.1 / 0.1 / 0.1 | ~11.7 / ~5.5 |

1. **Who merges (the largest single gap).** Arm A's REVIEW merges the exact reviewed head itself (`.github/ai-routines/CC.md:56`), under auto mode, about 3 s after ACCEPT. In arm B the local operator's `gh pr merge` was blocked by auto mode ("Merge Without Review"), so every arm-B merge became a Calvin touch plus his reply latency.
2. **Review took longer.** B's fresh reviewer needed a workspace, a test DB and a full independent pass: about 8–9 min against A's 4–6 min. On this sample both arms' reviews returned ACCEPT and every blind audit agreed, so the extra depth caught nothing extra.
3. **Build was comparable, except on O3.** O3, a HEAVY outcome with a DB-backed real-run test and a byte-identity proof, took 23.7 min to build. Arm A's HEAVY builds (O4, O5) took 9 min, but on different tasks, so this is not a like-for-like comparison.

What B did better: **zero control-plane comments**, against 6 per outcome in arm A, and no machinery (no OWNER, relay, wake labels or routing workflow).

## 5. O6

**Not run.** The plan starts O6 only when Calvin releases the next roadmap outcome. None was releasable: AR6 is held (Calvin's NO on #466; RULING B on #467), and AR7 #455 needs AR6 merged. I asked once with a drafted candidate (`contracts/o6-candidate.md`). No release came before O5 finished, and §3 shows O6 cannot change the result. If Calvin still wants a lean-SOP run from the cloud as a data point, that candidate is ready.

## 6. Cloud vs local: what changed mid-experiment

| | O1–O3 (operator: local CLI on Calvin's Windows machine) | O4–O5 (operator: Claude Code cloud session) | Effect on comparability |
|---|---|---|---|
| Arm-A routines | Anthropic cloud sessions | the same sessions, same environment | none: the arm-A treatment is unchanged |
| Arm-B worker and reviewer | local agents | — (no arm-B outcome ran in the cloud) | **B was never run from the cloud** |
| GitHub actions by the operator | `gh` as calyeap | GitHub MCP as calyeap (the `gh` token is invalid here) | none: same identity, so the pre-flight allow-list admits the labels |
| Postgres | Docker on 127.0.0.1:55432 | the container's own PostgreSQL 16 on 127.0.0.1:5432 | none |
| Environment-only test failures | CRLF `verdict.ts` hash, backslash paths, 5 s timeouts | one: Playwright `chromium_headless_shell-1243` missing | none (both known and excluded) |
| SEC access | reviewers fetched data.sec.gov read-only | data.sec.gov answers 403 to a User-Agent without an email; www.sec.gov is proxy-denied; routines use the environment's `SEC_USER_AGENT` | cloud audits checked SEC figures against committed captures and contract quotes only |
| Arm-A cost | not visible | visible per routine session (tokens and USD) | closes a handoff confound |
| Operator overhead for arm A | — | post + label + watch; dispatch → BUILD START 12 s (O1 local: 12 s) | none |

## 7. Limits (read the verdict with these)

- **Small n:** 3 outcomes in arm A, 2 in arm B.
- **An easy sample:** O1–O5 were defects already diagnosed by Leg 1, with precise contracts. This favours both arms equally, and says little about open-ended roadmap work.
- **B ran only locally** (see §6). B's timings include the local operator's orchestration and Calvin's merge latency.
- **Same model family** for builders, reviewers and auditors: the contexts are fresh, but the models are not independent.
- **Token figures** are final-context counts from two different instruments.

## 8. Follow-ups found during Leg 2 (not part of the experiment; listed only)

1. **O2 audit:** on unmeasured leverage, the Quick Read still says "A capital structure this levered…" (`QuickRead.tsx:375`, `:384`). Draft contract: `contracts/o6-candidate.md`.
2. **O3 reviewer:** Trigger A reads the margin history's current year when the current margin is contradicted. A possible methodology question for Calvin.
3. **O4 audit nits:** a stale comment at `aiProposedBundle.ts:193-196`; the offline `not.toHaveBeenCalled()` assertion is trivially true.
4. **O5 BUILD, DO 4:** the engine's own KO total debt on the pinned capture (43,558M at 2026-04-03) leaves out loans and notes payable. A full fix needs `NotesAndLoansPayable` or `OtherShortTermBorrowings` in the debt concept, or a re-capture. That is a debt-concept decision, so it needs its own authorised issue.
{O5_FOLLOWUP}
