# KAIZEN Proof Leg 2: cloud handoff

> **Leg 2 complete (19 Oct 2026):** all six outcomes are scored (`leg2/scorecard.tsv`). **Final result: `leg2/FINAL-RESULT.md`. The lean SOP is not proven (conditions 3 and 4 fail), so KEEP the existing workflow.** The cloud operator log is `leg2/cloud-ledger.md`.

**Branch `kaizen/leg2-handoff`.** It is evidence only and must **never be merged**. It holds the full scorecard, every review, the contracts and the briefs.

**Authority:** Calvin's "GO Leg 2" (18 Oct 2026), applying exactly to `leg2/LEG2-PLAN.md` steps A and B.
**Calvin's later instructions:**
- He merges arm-B PRs himself when told "reviewer ACCEPT + CI green on exact head <sha>".
- O4 was **not** started locally. O4 and O5 then ran from the cloud session on 18 Oct.

## 1. State at handoff (verify first: §4)

| # | Outcome | Arm | Issue / PR | Head → merge | Status |
|---|---|---|---|---|---|
| P | CF-LEG2-PREFLIGHT-01 (guards) | pre-flight via the existing workflow | #475 / #476 | 358b46e → f7498c4 | Merged. Guards verified live: every routing job skips `lean-sop` items, including `owner-on-merge` |
| 1 | CF-LEG2-PREAR4-REPORT-CRASH-01 | A | #477 / #478 | 239579d → db83c04 | Merged; blind audit ACCEPT |
| 2 | CF-LEG2-RATE-DOMAIN-COPY-01 | B | #479 / #480 | 2ae096d → e5d8933 | Merged (by Calvin); blind audit ACCEPT |
| 3 | CF-LEG2-DECIDED-FACT-GATING-01 | B | #481 / #482 | 1b8d9bb → a8058b7 | Merged (by Calvin); blind audit: see the scorecard row |
| 4 | CF-LEG2-PINNED-REOPEN-01 | A | #483 / #484 | ad9da6b → 2d7f38e | Merged (by the REVIEW routine); blind audit ACCEPT |
| 5 | CF-LEG2-KO-GOLDEN-DEBT-01 | A | #485 / #486 | e8016aa → c2db01a | Merged (by the REVIEW routine); blind audit CORRECT: 1 escaped (contested; see PROVISIONAL-O1-O5.md §4) |
| 6 | CF-LEG2-KO-COMMERCIAL-PAPER-01 (released by Calvin, 19 Oct) | B | #487 / #488 | ad11789 → 62c22df | Merged (by Calvin, exact reviewed head); reviewer ACCEPT; blind audit ACCEPT |

The authoritative per-outcome record is `leg2/scorecard.tsv`. Append one row per outcome using the same columns.

## 2. What to do next, strictly one outcome at a time

**O4 and O5 (arm A, existing workflow)**
1. Re-check that nothing is active:
   - no Actions run is `in_progress` or `queued`;
   - every recent START receipt has a terminal.
2. Post the issue. The body is in `leg2/contracts.md` §O4 (or §O5); use the same format as `leg2/contracts/o1-issue.md`, starting with the `OUTCOME-ID:` and `TIER:` lines.
3. Apply `needs-build-wake`. Do not add `lean-sop`.
4. Watch the receipts: BUILD START → DONE → REVIEW START → ACCEPT/CORRECT → OWNER → COMPLETE.
   - Do not intervene.
   - Record any CORRECT, BLOCKED or CALVIN REQUIRED exactly as it appears.
5. After the merge, run a **blind audit**: a fresh reviewer using `rubrics/heavy-slim.md`, given the exact PR head, the diff against base and the issue contract. Give it **no PR body and no arm label**. Count a finding only after you reproduce it.
6. Record the scorecard row:
   - dispatch time = when the label was applied;
   - merge time;
   - elapsed minutes;
   - worker sessions;
   - review cycles and CORRECTs;
   - Calvin touches;
   - control-plane comments (count on the issue and the PR);
   - the audit result;
   - escaped defects;
   - safety incidents.

**O5 note:** the KO evidence comes from SEC companyfacts in the KO FY2025 10-K (accession 0001628280-26-010047). It is quoted in `leg2/contracts.md`. The PR is an evaluator (golden-data) change and must be called out as one.

**O6 (arm B, lean SOP)** starts only when Calvin releases the next roadmap outcome.
- The issue and PR carry the `lean-sop` label.
- One worker implements and opens the PR. It never merges.
- A fresh reviewer (`rubrics/heavy-slim.md`) gets the exact head, the diff, the contract and the PR body as evidence.
- At most 2 correction cycles. The worker briefs are in `leg2/briefs.md`; adapt the paths to the cloud workspace.
- On ACCEPT with CI green on the exact head, tell Calvin, who merges.

**Finally:** apply the pre-registered rule in `leg2/LEG2-PLAN.md` §3 and report the Leg 2 result. B passes only if all four hold:
1. B's escaped defects are no more than A's.
2. B has zero safety incidents.
3. B's Calvin touches per outcome are no more than A's.
4. B's median elapsed time is at most 1.5× A's.

## 3. Hard rules and known traps

**Never**
- Never merge an experiment PR yourself. Auto mode blocks `gh pr merge` ("Merge Without Review"), and Calvin merges arm B.
- Never apply wake labels on `lean-sop` items.
- Never post a comment whose first line starts with `CORRECT`, `DONE:`, `BLOCKED:`, `STOP:`, `CALVIN RULING` or `CALVIN REQUIRED:`. Routing reads calyeap-authored comments.
- Never touch PR #466, #454 or the AR7/AR8 gates (#455–#458).
- Never touch Calvin's local or production database, Notion or Drive.
- Never run outcomes concurrently.
- Never merge this branch.

**Git and data**
- Pass any git identity per command; never set global config.
- Never put an email address in a request.

**Comparability confounds** (record them in the final result)
- Arm-B outcomes O2 and O3 ran on Calvin's Windows machine, with a local Docker Postgres and sec.gov access. O6 will run in the cloud, so the environment changes mid-experiment.
- Arm-A routine token usage is not visible; only session counts are.
- Arm B's elapsed times include Calvin's manual-merge wait: about 11 min on O2 and about 5 min on O3.

**Cloud environment checks before O6 and the blind audits**
- Postgres for `npm run migrate` and `npm test`.
- Node 20+.
- Outbound sec.gov access is known to be blocked for cloud workers.

**Follow-ups found during Leg 2 (not part of the experiment; listed only)**
- **O2 audit:** on unmeasured leverage, the Quick read still says "A capital structure this levered…".
- **O3 reviewer:** Trigger A still reads the current year of the margin history when the current margin is contradicted. That is a possible methodology question for Calvin.

## 4. Verify this handoff (read-only, cloud side)

- `git fetch origin kaizen/leg2-handoff && git show origin/kaizen/leg2-handoff:kaizen-leg2-handoff/HANDOFF.md`
- `gh pr view 482 --json mergeCommit`: it should be `a8058b7`.
- `gh api repos/calyeap/Cal-Finance/actions/runs?status=in_progress`: it should report 0.
- `gh issue list --label lean-sop --state all`: it should list #479 and #481, both closed.

## 5. Bundle contents

- **`leg1/`**: the Leg 1 report (final verdict in §0), per-run results, and all 20 replay reviews.
- **`leg2/`**:
  - the plan;
  - the contracts (O1–O5 plus the posted issue bodies);
  - the worker, reviewer and audit briefs;
  - `mkreview.sh`, a workspace builder written for Windows paths that needs adapting;
  - the scorecard;
  - every arm-B review and blind audit.
- **`rubrics/`**: `CC.md` at master a2e9ae2, the replay header, and the slim HEAVY rubric.
