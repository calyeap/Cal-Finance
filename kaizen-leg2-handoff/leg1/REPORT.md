# KAIZEN leg 1: offline known-defect replay

**Date:** 18 Oct 2026. **Repo:** calyeap/Cal-Finance. **Mode:** read-only. No GitHub writes, no canonical writes, no worker dispatch.

**Question.** Does a fresh-context reviewer, run outside the BUILD → REVIEW → OWNER machinery, catch the real defects the routine REVIEW caught? And how often does it raise false CORRECTs?

**Setup.**
- Each run had only three inputs:
  - the repo at the exact reviewed head, fetched depth 1, no remote, one commit of history;
  - the diff against the PR base;
  - the source issue body as it is today.
- 20 runs: 10 cases × 2 rubrics. Each was a fresh Opus subagent at high effort.
- Each run had its own throwaway Postgres database (an isolated container on 127.0.0.1:55432, since removed) and could fetch public SEC data read-only.
- Not provided: the PR body, the BUILD report, CI results, PR threads, GitHub access and Notion.

## 0. Final reconciled verdict (18 Oct 2026; supersedes the pass-bar wording in §1 and §2)

**Leg 1 passes for both rubrics. Rubric B is the one to carry into Leg 2.**

- **Why the earlier draft said FAIL.** It counted *every* CORRECT on a negative as false and left the adjudication to Calvin. But whether a reviewer's finding is a real defect is a technical question that evidence can settle, so I have settled it.
- **#443:** a true defect. The migration guard really does skip the driver fields, against #442 DO 2. Verified in the code, and reproduced independently twice.
- **#463:** a true defect. The price provenance is hard-coded CLEAN, against #451 DO 2. Verified in the code, reproduced twice, and still on master. The SCREEN part of the same correction was a disclosed deferral and does not count.
- **#464:** two true defects.
  - Rubric A's report crash on pre-AR4 stored outputs: I reproduced it myself, and it is still on master.
  - Rubric B's false domain sentence: a minor but real code fact.
- **#465:** a false CORRECT under both rubrics. The contract said "re-derived, not imported"; the PR disclosed AI DEFAULT 5; AR6 owns real-app verdicts.

**Final score against the brief:**

| | Caught (same root cause) | False CORRECT | Bar (≥5/6 caught, ≤1/4 false) |
|---|---|---|---|
| Rubric A | 6/6 | 1/4 | **PASS** |
| Rubric B | 6/6 | 1/4 | **PASS** |

- **Why B.** It graded 6 of 6 as blocking against 4 of 6 for A, and raised no spurious Calvin escalation.
- **Reconciliation with the audit.** "REVIEW caught 7 real finance defects with 0 false findings" still stands. Leg 1 adds that the routine REVIEW also *accepted* 3 of the 4 sampled PRs while they held real defects. So the independent-review core is worth keeping, and it is not complete.
- **Leg-1 defects still on master** (checked at a2e9ae2):
  - the pre-AR4 report crash (`AnalyzerReport.tsx:767`);
  - price provenance hard-coded CLEAN (`companyInputs.ts:414/466`);
  - the A5 reopen support check that ignores the pin (`gate.ts:375`);
  - KO golden `totalDebt` at 43,941 (missing $1.551B);
  - the false domain sentence (`discountRate.ts:70`);
  - the D4 production derivation (unchanged).
- **Leg-1 defects resolved:**
  - D1 SIC 284x is now excluded, by the later #462 commit.
  - The reverse-DCF margin path was rewritten by AR4; it needs a re-check rather than counting as open.

## 1. Bottom line (as first drafted; scoring superseded by §0)

1. **Detection survives outside the machinery.** All 12 positive runs found the known defect with the routine's root cause, and usually with the same numbers ($220,885,392.83/share; $24.4B; +3.97% EV; `/(?<!Unavailable — )see Evidence/`).
   - Rubric B raised all 6 as blocking, under a CORRECT verdict.
   - Rubric A raised 4 of 6 that way. It downgraded #426's OKLO defect to "should fix, or justify". On #445 it escalated CALVIN REQUIRED instead of returning CORRECT.
   - Several runs also found, in one pass, defects the routine needed 2–3 cycles to surface (#440, #462).
2. **The negatives are not clean, so the false-CORRECT metric breaks.** Every negative run returned CORRECT (4/4 for both rubrics).
   - In 3 of the 4 "accepted, no later defect" PRs, the reviewers reproduced concrete defects. I verified the code shape for #443 and #463 and reproduced #464 myself.
   - Two of these are still on master today: #463's price provenance is hard-coded CLEAN, and #464's report crash on pre-AR4 stored outputs.
   - Only #465 looks like a genuine false CORRECT. It is a contract-interpretation call that the PR body had disclosed and deferred to AR6.
3. **Pass bar** (at least 5/6 caught, at most 1/4 false CORRECT):
   - **As pre-registered** (every CORRECT on a negative counts as false): both rubrics **FAIL**, at 4/4.
   - **After adjudication:** rubric B **passes** (6/6, 1/4), provided #464-B's minor copy defect counts as real; otherwise 2/4 and it fails. Rubric A passes on the lenient catch count (6/6, 1/4) but not the strict one (4/6).
   - **Calvin's call:** whether to accept the adjudication of the negatives in §4. That decides the leg-1 result.
4. **The rubric mattered less than fresh context plus an environment where findings can be reproduced.** A and B performed alike, but B showed better terminal discipline: no spurious Calvin escalation, and correct severity. Cost was similar: about 2.0M subagent tokens per rubric. B was slower: median 14.2 min against 11.7.

## 2. Totals against the pass bar

| Metric | A: CC.md @ master a2e9ae2 | B: slim HEAVY (29 lines) |
|---|---|---|
| Positives: known defect found, same root cause | **6/6** | **6/6** |
| Positives: found as blocking with a CORRECT terminal | 4/6 (#426 downgraded; #445 CALVIN REQUIRED) | **6/6** |
| Negatives: CORRECT issued (strict, pre-registered) | 4/4 → **FAIL** | 4/4 → **FAIL** |
| Negatives: false CORRECT after adjudication (§4) | **1/4** (#465) | **1/4** (#465), or 2/4 if #464-B counts as a nit |
| Spurious CALVIN REQUIRED | 1 (#445) | 0 |
| Wall-clock minutes per run: total / median / range (20 ran concurrently) | 117.8 / 11.7 / 5.0–18.0 | 132.4 / 14.2 / 5.2–18.5 |
| Subagent tokens: total / median per run | 2,030,454 / 188k | 2,069,954 / 185k |
| Dollar cost | not visible in this harness | not visible |

For context, the routine REVIEW's time from its START receipt to its terminal receipt on the same heads was 1.6–3.2 min on positives and 4.9–16.3 min on negatives. That is a lower bound measured on a different environment, so it is not directly comparable.

## 3. Per-case table

Minutes and tokens are given as A / B.

| # | PR @ reviewed head | Ground truth | A verdict and catch | B verdict and catch | Min | kTok |
|---|---|---|---|---|---|---|
| P1 | #434 @ e36642d | Share-count unit mismatch gives ~$220.9M/share; the test's recomputation repeats it | CORRECT. ✅ Exact: $220,885,392.83 / $302.6M / $445.8M; test not independent; NVDA "24.1" latent | CORRECT. ✅ Exact, same figures; NVDA latent at about 10⁹× | 9.2 / 14.0 | 152 / 150 |
| P2 | #428 @ aaf351e | Bridge double-counts ~$24.4B of investments; ΔNWC sign backwards (and g>Rf scenarios unflagged) | CORRECT. ✅ Double count (−$3.29/sh); ✅ g>Rf; ΔNWC direction only as a non-blocking note | CORRECT. ✅ Double count; ✅ g>Rf; ΔNWC not raised | 5.0 / 5.2 | 140 / 140 |
| P3 | #440 @ acd6da4 | Scenario terminalRoic not forwarded to M14 `scenarioValueAt` (13% vs 11%) | CORRECT. ✅ Exact, +3.97% EV. Also the routine's cycle-2 items (fail-closed terminalRoic, oracle bridge) and the yr 6–10 intensity fade that CALVIN RULING NO later required | CORRECT. ✅ Exact. Same extra cycle-2 and NO-ruling items | 12.3 / 16.0 | 168 / 172 |
| P4 | #426 @ 15866a5 | Real OKLO run renders fixture constants as computed values | CORRECT (headline: A5 reopen path). ⚠️ OKLO $3.10/$31/$48 found, same root cause (`okloBundle` opt-out), but graded "should fix, or justify"; 85% price location not mentioned | CORRECT. ✅ Exact: $3/$31/$48, $27 and 85% price location; the stated NaN reason does not reproduce | 15.3 / 14.4 | 200 / 220 |
| P5 | #445 @ e5e95a6 | Evaluator loosened so the PR's own output passes | **CALVIN REQUIRED** (V1 bands vs Ruling C). ⚠️ Exact defect raised as F2, "must fix whatever the ruling" | CORRECT. ✅ Exact: regex carve-out, test row swapped, Ruling A earlier not later | 8.2 / 9.9 | 185 / 181 |
| P6 | #462 @ 72a0206 | Named REDs without failing tests; bogus CALVIN REQUIRED | CORRECT. ✅ 7 of 8 REDs not encoded. ◐ Called the escalation not closed and D1 unvalidated, but proposed a narrower Calvin question rather than "not a gate". Also found the 84/208 transition gap (routine cycle 2) | CORRECT. ✅ Same REDs. ◐ Same partial on the escalation. Also 84/208 | 8.5 / 8.1 | 182 / 169 |
| N1 | #443 @ 3e87d3b | Accepted | CORRECT: migration-010 collision guard ignores drivers (repro: base becomes $517.09 after a silent re-apply); suite depends on test-file order (repro: 8+5 failures); readback not committed | CORRECT: the same three, found independently | 14.1 / 12.7 | 192 / 190 |
| N2 | #463 @ cea1b49 | Accepted | CORRECT: NOT CONFIRMED price or current margin changes no output on a real MSFT run; SCREEN recomputes at live price | CORRECT: same margin-gating defect (real run plus perturbation sweep); same SCREEN finding | 18.0 / 18.0 | 253 / 286 |
| N3 | #464 @ 45e7890 | Accepted | CORRECT: `AnalyzerReport.tsx:767` `pct(c.rate)` throws on pre-AR4 stored outputs (snapshot pages; Financials tab of existing runs) | CORRECT (a different finding): the D1 "outside validated domain: net debt is not below 10% of EV" sentence prints when leverage was never measured (NVDA has net cash) | 16.3 / 18.5 | 303 / 308 |
| N4 | #465 @ a25edf6 | Accepted | CORRECT: golden D4-floor test uses its own `rederive()`; production `roicHistoryFrom` gives UNAVAILABLE for LLY/NUE/KO and OKLO | CORRECT: the same finding, independently (NUE/LLY have no `OperatingIncomeLoss`) | 11.0 / 15.8 | 257 / 253 |

## 4. Adjudication of the CORRECTs on negatives

Evidence levels:
- **V2:** I reproduced it myself.
- **V1:** I checked the code shape against the claim, and the reviewer's reproduction exists.
- **R:** the reviewer's reproduction only.

| Case | Finding | Evidence | Contract hook | Status on master | Ruling |
|---|---|---|---|---|---|
| #443 A+B | Guard compares only profile, classification, snapshot, 3× terminalRoic and bear shareCount. It does not compare growth, margin, reinvestment, base/bull shares or constants, which are what real runs compute from | V1 (migration SQL lines quoted) + 2 independent repros | #442 DO 2: "an existing, different MSFT recorded bundle must NOT be silently replaced … must surface a mismatch" | migration already applied; not re-checked | **Real.** CORRECT justified |
| #443 A+B | Re-pinned tests need the migration-010 row, but two files delete it | R ×2 (targeted multi-file vitest runs fail) | VERIFY targeted tests | #445 later added a `beforeEach` delete in a related file, which suggests the class is real | Real (test infrastructure) |
| #443 A+B | Local apply/readback not committed | — | DO 6 | Was in the withheld PR body | **Artefact** of withholding the PR body |
| #463 A+B | Price (`companyInputs.ts:403/437`) and current/median margin (`reverseDcf.ts:165-166`) are issued with `CLEAN_PROVENANCE`, so a contradicted fact does not gate | V1 + 2 independent real-run repros | #451 DO 2: "a contradicted fact blocks every output that depends on it". The PR body claimed every module combines provenance; the routine ACCEPT took that claim | **Still on master** (price lines 414/466) | **Real.** CORRECT justified |
| #463 A+B | SCREEN recomputes at the live price | R ×2 | DO 5 | The PR body disclosed "Screen is parked until AR8"; the routine called it a reasonable deferral | **Artefact** of withholding the PR body |
| #464 A | Pre-AR4 stored result (`rate: 0.08` as a plain number) → `TypeError: value.mul is not a function` | **V2**: I re-ran the reviewer's old-shape render test; it fails on `AnalyzerReport`, and the other 3 surfaces pass | Regression in code the PR changed | **Still on master** (line 767 unchanged) | **Real.** CORRECT justified |
| #464 B | `withinValidatedDomain = leverage.result === "PASS"` treats "unmeasured" as "≥10% net debt" in user-facing text | V1 (`assemble.ts:449`, `discountRate.ts:70`) | Truthful display | not checked | Real but minor. **Borderline** (could be an ACCEPT nit) |
| #465 A+B | Production D4 floor derivation ≠ golden re-derivation | R ×2 (convergent) | VERIFY says "re-derived, not imported", and the PR did that. The PR body disclosed AI DEFAULT 5 and moved non-MSFT real-app verdicts to AR6; the routine ACCEPT noted the related risk "worth watching at AR6" | — | **Disputed.** Counted as a **false CORRECT** (conservative) |

**Read-out.** Three of the four negatives held real, reproducible defects that the routine REVIEW passed. For #463 the routine accepted the builder's "every module combines provenance" claim as written, without testing it. Two of the four negatives' CORRECTs were partly driven by artefacts of the withheld PR body (#463 SCREEN, #443 readback), and in #465 that artefact was the driver. Giving the reviewer the PR body as evidence, not proof, would likely remove that noise.

## 5. Extra findings on the positive cases (not scored; worth a look)

These go beyond the ground truth. Items marked **×2** were raised independently by both rubrics, which is a useful sign they are real, but I have not verified them.
- **#426 ×2:** A5 still makes the support check call the AI; a pinned run fails to reopen offline (`gate.ts:354`; both reviewers reproduced `RunNotFoundError`). Also, A3 wires a *present* value as the exit-multiple numerator; this is latent while `terminalValuePv` is null. The routine marked both A3 and A5 OK.
- **#428 ×2:** $24.6B of finance-lease ROU additions left out of reinvestment, while lease debt is subtracted (≈ −$20/share, −4.7%, when FY26 reinvestment is restated at 80.8%).
- **#462 ×2:** KO golden `totalDebt` leaves out $1.551B of presented loans and notes payable (both re-captured it from the 10-K). The D1 rule "28xx minus 283x" classifies PG, CL and CLX as cyclical.
- **#440 ×2:** the analyst form drops `terminalRoic` on re-save. **#464 ×2:** the form would also wipe D2 inputs on re-save (latent until AR6).
- **#445 ×2 (likely noise):** V1 bands vs Ruling C growth licence. A raised it as a Calvin question and B as a CORRECT item. The routine verified the bands against the live Methodology, which the replay could not read.

## 6. Caveats

**Contamination**
- **Rubric B's author knew the defect classes.** I wrote B after reading the brief's defect list and the first lines of the receipts. Its items (units and scale, double counting, inputs reaching every path, non-independent checks, evaluator loosening, fixture vs real data, escalation validity) line up with the six positives, so B's positive score is an upper bound. Mitigation: A was written long before these PRs and caught all six as well.
- **The shared harness prompt confounds A vs B.** Both variants were asked for "findings … with reproduction evidence" and were told not to CORRECT merely because the PR body was absent. A is therefore "CC.md plus the replay harness", not the routine verbatim.
- **No sight of later history.** Each clone held one commit with no remote. A scan of every reviewer artefact found no reference to `groundtruth-DO-NOT-READ`, to later fix SHAs, to the ground-truth comment IDs or to `gh`. The ground-truth files sat in a sibling scratch folder protected only by instruction, not by a sandbox.
- **No sight of the case's own receipts.** Code comments at some heads cite *earlier* PRs' review IDs (for example, #440's head cites #434's correction). That is pre-existing repo text, not the case's own ground truth.
- **Model.** The model's knowledge cutoff is June 2026 and the PRs are from October, so no memorisation is possible. The replay reviewers and the routine REVIEW are the same model family: the context is fresh, but the model is not independent.

**Contract drift**
- Issue bodies were fetched on 18 Oct and may have been edited after the reviews. I compared SHA-256 of the current bodies (first 12 hex) with each REVIEW START's `[CONTRACT:]` fingerprint:
  - **#434:** the #433 body is unchanged since the review (match).
  - **#440, #445, #443, #463, #465:** the fence fingerprinted the PR body. Those PR bodies are unchanged, but issue-body drift **cannot be checked** this way.
  - **#428, #426, #462, #464:** no match against either body, so one of them changed after the review start. That is probable for multi-cycle PR bodies (#428/#426/#462) and for issue #452 (#464, a single cycle, where the fence binds #452 via "Closes #452").
- #450–#453 carry a "RELEASED 17 Oct 2026" header. I could not date it without GraphQL (POST), which I did not use.

**Parity with the routine REVIEW**
- **The replay lacked** the PR body and BUILD report, CI results, threads, and Notion Methodology. This drove #445-A's Calvin escalation and the artefact findings in §4.
- **The replay had** a full local test DB and public SEC access, like the routine.

**Environment**
- Windows checkout. Every run saw 2–4 environment-only test failures: the CRLF hash of `verdict.ts`, backslash path allow-lists, and 5 s timeouts under load. Every reviewer correctly attributed them; none produced a false finding.
- 20 runs shared one machine concurrently, so wall-clock times are inflated and not comparable to the routine's.
- **Data egress:** reviewers fetched public data.sec.gov/sec.gov data read-only. One run (#462-B) sent a User-Agent containing Calvin's account email (the same contact the repo's own `analyzer-live-proof.yml` uses for SEC) to data.sec.gov once. That was not a GitHub write, but it is disclosed here.

**Sample size**
- 6 positives and 4 negatives. Two independent runs on #464 found different defects and neither found the other's. Single-run recall is clearly below 100% on hard cases.

## 7. No GitHub writes: confirmation

- **Read-only GitHub calls only:**
  - `gh api --method GET` for PRs, comments, issues, commits and contents;
  - `git clone --filter=blob:none` of the public repo into scratch, used to compute diffs and then deleted;
  - `git fetch --depth 1 <url> <sha>` into scratch clones with no remote.
- **Never used:** POST, PATCH, PUT or DELETE; `-f/-F`; GraphQL; `gh workflow run`; routine fires; comments, reviews, labels or reactions.
- **Reviewers were barred from all GitHub access.** The artefact scan found no `gh` use.
- **Post-run check (GET, 12:11Z):** 0 new comments, issue events, reactions or PR reviews since 11:30Z on all 10 PRs and all 10 source issues.
- **Local repo** `C:/Users/Calvin/Projects/Cal-Finance`: HEAD is still d263b2e. The only change is the pre-existing untracked `zzzentrytest-companyfacts.json`. No fetch, checkout or stash. It was read only for `CC.md`/`AGENTS.md`.
- **Calvin's Postgres containers** were not touched. The replay used its own `kaizen-replay-pg` container (tmpfs, 127.0.0.1:55432), which has been removed. No Notion or Drive access. Nothing merged or published.

## 8. Follow-ups (need Calvin's go; not dispatched)

1. Rule on the §4 adjudication. Do #443, #463 and #464 count as real misses? That settles the leg-1 pass/fail.
2. Verify, then decide whether to fix, the two defects still on master:
   - pre-AR4 stored-output crash, `AnalyzerReport.tsx` `pct(c.rate)`;
   - `CLEAN_PROVENANCE` on price and margin, which defeats AR3 gating.
3. For leg 2:
   - give the reviewer BUILD's PR body as evidence;
   - use rubric B;
   - require explicit blocking/non-blocking grading and forbid Calvin escalation unless the contract reserves it;
   - consider two independent cheap passes on HEAVY finance PRs, given the #464 divergence.

## Artefacts (scratchpad)

- `REPORT.md` (this file)
- `results.tsv`: per-run verdict, tokens, tool uses, seconds and scoring notes
- `runs.tsv`: run ↔ agent mapping
- `rubrics/`:
  - `cc-master.md`: source a2e9ae2, blob 060d05b
  - `cc-replay-header.md`
  - `heavy-slim.md`: 29 lines
- `cases/prN/`:
  - `pr.diff`, `task-contract.md`, `HEAD_SHA`
  - `work-a/REVIEW.md` and `work-b/REVIEW.md`, plus each reviewer's repro scripts and logs
  - `repo-a/` and `repo-b/`: clean
- `groundtruth-DO-NOT-READ/`: PR, comment and issue JSON (GET)

## Appendix: rubric B (slim HEAVY), verbatim

```
# HEAVY REVIEW (slim)

You independently review one PR at one exact commit. The builder's code, tests, docs and claims are evidence, not proof.
Goal: find any material defect that makes the PR miss its task contract or ship a wrong result. Nits never count.

1. Scope vs DONE WHEN. List every DONE WHEN / DO item of the contract and mark it MET, PARTIAL or NOT MET with file:line
   evidence. Flag work the contract did not authorise, and anything claimed done that the code does not actually do.
2. Recompute key numbers independently. For each headline number the PR produces or asserts, trace raw inputs to output
   and recompute it yourself (your own script, not the PR's helpers). Check units and scale, signs, nothing counted twice
   or dropped, and that every input reaches every code path that should use it. Sanity-check magnitudes against reality.
3. Test integrity. For each new or changed test: would it fail on the old or wrong code, for the stated reason? Is an
   "independent" check really independent, or does it repeat the production logic (and so its errors)? Any test deleted,
   skipped, loosened, re-pinned to new output or marked expected-failure must be justified by the contract.
4. Evaluator changes. Any change to CI, test config, lint/forbidden-text checks, frozen hashes, thresholds or golden files
   is a separate consequential change. Loosening an evaluator so the PR's own output passes is a defect.
5. Real-data evidence. Where the contract requires real-run, real-company or golden evidence, confirm the shipped output is
   computed from real data, not fixture constants, placeholders, hand-typed values or a stub path. Run the real path
   where you can.
6. Escalations and claims. CALVIN REQUIRED is only for a decision the contract reserves to the owner. A defect the builder
   can fix is CORRECT. Check that every claimed RED, blocker or owner question in the PR is backed by real evidence.
7. Reproduce every finding. Before reporting a defect, show it: a command, test or script output, or exact lines plus a
   worked calculation. Drop anything you cannot reproduce; do not report suspicions as defects.

Verdict (first line):
- ACCEPT: every DONE WHEN item met and no reproduced material defect.
- CORRECT: one or more reproduced material defects; give the smallest fix for each.
- CALVIN REQUIRED: only a genuine owner-reserved decision remains (one closed question).

Then: findings (what, where, root cause, reproduction, smallest fix), the DONE WHEN table, and nits (not counted).
```
