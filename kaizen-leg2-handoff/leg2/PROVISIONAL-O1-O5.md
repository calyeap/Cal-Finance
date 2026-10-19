# KAIZEN Leg 2: provisional comparison after O1–O5

**Status: PROVISIONAL.** This covers five of the six pre-registered outcomes. Per `LEG2-PLAN.md` §3, the final verdict is taken after O6, which waits on Calvin's release.
**As of:** 19 Oct 2026, 00:45Z. **Sources:** `scorecard.tsv` rows 1–5, `reviews/`, `cloud-ledger.md` and live GitHub receipts (re-read 19 Oct).

## 1. Results so far

| # | Arm | Tier | Elapsed (min) | Calvin touches | Control comments | Review cycles / CORRECTs | Tokens / cost | Blind audit | Escaped | Safety |
|---|---|---|---|---|---|---|---|---|---|---|
| O1 | A | NORMAL | 11.4 | 0 | 6 | 1 / 0 | $3.68 · 288k ctx (measured from the cloud on 18 Oct) | ACCEPT | 0 | 0 |
| O2 | B | NORMAL | 29.2 | 1 (merge) | 0 | 1 / 0 | 291k agent tokens | ACCEPT | 0 | 0 |
| O3 | B | HEAVY | 38.5 | 1 (merge) | 0 | 1 / 0 | 529k agent tokens | ACCEPT | 0 | 0 |
| O4 | A | HEAVY | 14.8 | 0 | 6 | 1 / 0 | $2.58 · 249k ctx | ACCEPT | 0 | 0 |
| O5 | A | HEAVY | 14.3 | 0 | 6 | 1 / 0 | $4.22 · 312k ctx | CORRECT (reproduced) | 1 (contested) | 0 |

How the columns are measured:
- **Elapsed:** dispatch to merge.
  - Arm A's dispatch is the `needs-build-wake` labeled event, on GitHub's clock.
  - Arm B's dispatch is the local operator's worker launch, as recorded in the scorecard. Each arm-B issue was posted 1–2 min earlier (#479 at 14:10:49Z; #481 at 14:43:02Z), so measuring from the post would only lengthen B.
- **Tokens / cost:** for arm A, the sum of the three routine sessions' `get_session` usage; for arm B, the worker's and reviewer's agent token totals. They are the same order of magnitude but different instruments, and arm B has no USD figure.

## 2. The four pre-registered conditions, provisionally

| Condition (B passes only if all hold) | A: O1, O4, O5 | B: O2, O3 | Now | Can O6 change it? |
|---|---|---|---|---|
| 1. B's escaped defects ≤ A's | 1 (contested; 0 if F1 is not counted) | 0 | holds | Only for the worse: an O6 escaped defect fails it if F1 is not counted |
| 2. B has zero safety incidents | — | 0 | holds | Only for the worse: an O6 incident fails it |
| 3. B's Calvin touches per outcome ≤ A's | 0.0 | 1.0 | **fails** | **No.** B is at least 0.67 even if O6 had no touch, and in arm B Calvin merges, so B stays at 1.0 |
| 4. B's median elapsed ≤ 1.5 × A's | 14.3 → limit 21.45 | 33.85 (2.37×) | **fails** | **No.** B's median over three outcomes is at least 29.2 whatever O6 takes |

**Provisional reading.** Under the recorded scoring, the lean SOP cannot be proven: conditions 3 and 4 are already decided. Unless the scoring itself changes, the six-outcome verdict will be "not proven → keep the existing workflow" (**KEEP**). O6 still completes the pre-registered sample. It is also the only lean-arm run from the cloud, and it can only confirm or worsen conditions 1 and 2.

## 3. Provisional findings (five outcomes)

1. **Quality did not separate the arms.**
   - There were no in-arm CORRECTs and every outcome took one review cycle.
   - Blind audits passed 4 of 5. The fifth, O5 in arm A, held one reproduced contract miss (§4) that arm A's REVIEW accepted and only the blind audit caught.
2. **Arm A is faster and needs no Calvin touch**, because its REVIEW merges the exact reviewed head itself (`CC.md:56`).

   | Phase (min) | A: O1 / O4 / O5 | B: O2 / O3 |
   |---|---|---|
   | Build (dispatch → PR) | 7.7 / 8.7 / 9.4 | 9.5 / 23.7 |
   | Review (PR → ACCEPT) | 3.6 / 6.1 / 4.8 | ~8.0 / ~9.3 |
   | Merge (ACCEPT → merged) | 0.1 / 0.1 / 0.1 | ~11.7 / ~5.5 (Calvin) |

3. **Arm B carries no machinery:** 0 control-plane comments per outcome, against 6 in arm A.
4. **Cost is of the same order.** Arm A's routine cost is $2.58–$4.22 per outcome, visible for the first time from the cloud.
5. **Cloud vs local.**
   - **Arm A:** its routines always ran in the cloud, so its treatment did not change when the operator moved from Calvin's machine (O1–O3) to a cloud session (O4–O5).
   - **Arm B:** both arm-B outcomes ran locally.
   - **SEC access in the cloud:** data.sec.gov answers 403 to a request without an email, and the proxy blocks www.sec.gov. Cloud audits therefore verify SEC figures against committed captures and contract quotes only.

## 4. O5 adjudication (reproduced at PR head `e8016aa`)

- **F1: counted as 1 escaped material defect for arm A; contested and low impact.**
  - **The miss:** DO 4 said to fix the engine's KO total debt "here with a RED test" if the fix is a tag inside the approved short-term-borrowings family. `CommercialPaper` is in that family and is captured for KO. Adding it moves KO from 43,558M to 43,808M and moves no other company's value. The BUILD stopped and reported instead.
  - **What REVIEW checked:** it justified the stop only for the two out-of-family tags.
  - **Why it is contested:** the full 1.551B also needs out-of-family tags, and the PR body disclosed the stop.
  - **Impact:** none on valuation outputs, because KO's EV is already suppressed for a missing finance-lease input.
  - **Stop rule:** not fired. Nothing wrong was merged, and the gap predates Leg 2.
- **F2: minor and not counted.** LLY's golden finance-lease note contradicts the repo's own cited 10-K record. No value changes.

## 5. O6: eligibility and recommendation

**Is any AR milestone eligible? No, not without a Calvin decision.**
- **AR6** (#454, PR #466) is held by Calvin's NO ruling (18 Oct) and by RULING B on #467: NVDA stays INCOMPLETE, and AR6 stays held "until you separately change its golden set or acceptance". The Product repair that the NO ruling authorised (#467 → #468/#469) has merged.
- **AR7** #455 "needs AR6 (#454) merged", and #456 follows #455. **AR8** (#457/#458) follows AR7.

**What is genuinely eligible now:** one AR6 input follow-up, `CF-LEG2-KO-COMMERCIAL-PAPER-01` (`contracts/o6-proposed.md`).
- It fixes O5's reproduced F1 in the #467/#468 bridge-input lineage.
- Its dependencies are met on `c2db01a`, and it is testable offline from the cloud: no paid calls, no sec.gov.
- It does not overlap PR #466, which touches neither `tagMap.ts`, the bridge test nor the golden files.
- It is the same class of work as O1–O5, so the sample stays comparable.

**Recommendation:** Calvin releases `CF-LEG2-KO-COMMERCIAL-PAPER-01` as O6, run under the lean SOP. That costs him one reply now and one merge later.
**If not released:** the final verdict is written on five outcomes. Per §2, the result is the same.

## 6. Superseded

A five-outcome write-up (`RESULT.md`) and a Cloud-first SOP drafted on 18 Oct on `claude/optimistic-turing-fkla3u` are superseded by this file. Calvin's 19 Oct instruction is that the final verdict waits for O6.
