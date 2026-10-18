# Proof Leg 2: execution plan

**Decision asked of Calvin: GO / NO-GO.**
- **Recommendation: GO.**
- A reply of "GO Leg 2" authorises exactly steps A and B below, nothing more.
- Any other reply is NO-GO, and nothing happens.

Verified read-only on 18 Oct 2026 against master a2e9ae2. Leg 1 is final: both rubrics PASS, and rubric B is selected (REPORT.md §0).

## 1. Verified state

| Item | Finding | Evidence |
|---|---|---|
| Active workers | **None.** No Actions run is in progress or queued. Every START receipt since 17 Oct 21:00Z has a terminal. The last activity was #469 COMPLETE at 10:08Z. | Actions runs API; repo-wide comments |
| Held work | PR #466 (AR6) is held by CALVIN RULING NO (04:32Z). #454 is open. #455–#458 are gated. This plan does not touch them. | — |
| Authorisation hole (permanent) | **Confirmed in code.** All four routing workflows act on comment *text* and labels, with no commenter check:<br>• a "CORRECT:" on an open PR that has an OUTCOME-ID admits a BUILD worker;<br>• a non-bot first-line "CALVIN RULING" wakes OWNER whenever a gate is open;<br>• any comment can page Slack. | `cc-auto-fire.yml` job `if:` lines 20/277/511; `calvin-ruling-lib.sh:120` (checks bot status only) |
| Current mitigation | Repo-wide interaction limit, **collaborators only** (calyeap, Calv-bot). Set 18 Oct about 11:38Z; **expires 18 Apr 2027**. It is temporary (GitHub's maximum is 6 months), and the code still trusts any commenter. | `GET /interaction-limits` |
| Residual risk | [Withheld from this public branch; recorded in Calvin's local notes.] | — |
| #474 genuine-alert regression | **Confirmed by running the shipped classifier.** Any `BLOCKED: ACTIONABLE` line containing "egress" is classed AI-owned and gets **no `<!channel>` ping**, even for genuine human gates:<br>• "refresh BUILD_FIRE_TOKEN … egress is not the cause";<br>• a leaked egress-proxy credential to rotate;<br>• a spend/consent decision on paid data egress;<br>• "reapply the `needs-owner-wake` label …".<br>CALVIN REQUIRED is unaffected. | `runtime-lib.sh` `runtime_blocker_owner`/`runtime_slack_kind`; five samples run |
| Arm interference | `owner-on-merge.yml` fires OWNER on **every** merged PR, with no filter. A lean-arm merge would wake OWNER, which can CONTINUE into the next routine BUILD. Typed comments on lean items would also admit routine workers. | `owner-on-merge.yml:14` |

## 2. What must change before the experiment

One PR through the **existing** workflow, at TIER NORMAL.

**Issue contract (posted only after GO):** `CF-LEG2-PREFLIGHT-01`

- **DO**
  1. **Arm isolation.** Every job in `cc-auto-fire.yml`, `owner-on-merge.yml` and `calvin-slack-alert.yml` skips an issue or PR labelled `lean-sop`. The check is a label, not text, so it is deterministic.
  2. **Commenter allow-list.** Comment- and label-triggered jobs act only when `comment.user.login`/`sender.login` is `calyeap`. GITHUB_TOKEN actions never trigger events, so nothing legitimate is lost. This turns the outsider block into a permanent one before the April expiry.
  3. **Fix #474.** An explicit human marker wins over "egress": `refresh <SECRET>`, ``reapply the `…` label``, credential, security, payment or consent. "egress" makes a line AI-owned only when it asks to allow, enable or grant egress or network access, cites CONNECT 403, or asks for source text to be supplied. The Nucor class keeps today's result.
- **VERIFY**
  - The five genuine-gate samples above now page.
  - Every existing Nucor regression in `runtime-lib.test.sh` stays AI-owned.
  - A wiring test shows a `lean-sop` merge or comment fires no BUILD, REVIEW or OWNER.
  - A non-allow-listed commenter is skipped.
  - CI is green.
- **DO NOT:** change BUILD/REVIEW/OWNER prompts, finance code, `ci.yml`, tiers, gates or `FROZEN_HASHES`.

**Nothing else changes before the experiment.**

## 3. The experiment

**Identical in both arms (finance correctness preserved):**
- the issue contract (OUTCOME-ID, TIER, DO / DO NOT / VERIFY / DONE WHEN);
- required CI on the exact head;
- RED → GREEN;
- the protected evaluator and golden harness;
- an independent fresh-context HEAVY review before merge;
- every Calvin-reserved gate;
- no production or local DB writes.

**Arm A (existing):** `needs-build-wake` → BUILD → REVIEW → OWNER, unchanged.

**Arm B (lean SOP):**
1. The issue and PR are labelled `lean-sop`.
2. One Claude Code worker session per outcome implements the change and opens the PR. The PR body counts as evidence, not proof.
3. One fresh-context Opus reviewer runs rubric B on the exact head, with its own test DB, and must reproduce every finding. It returns ACCEPT or CORRECT.
4. At most two correction cycles.
5. On ACCEPT with green CI, the worker merges.
6. No OWNER, no relay, no wake labels.

**Frozen sample.** Outcomes run strictly one at a time, in this order. Items 1–5 are defects Leg 1 found that are verified present on master; none touches #466's PR.

| # | Outcome | Tier | Arm |
|---|---|---|---|
| 1 | Pre-AR4 stored outputs crash the report (`AnalyzerReport.tsx:767`, `pct(c.rate)`) | NORMAL | A |
| 2 | "Outside its validated domain" sentence shown when leverage was never measured (`discountRate.ts:70`) | NORMAL | B |
| 3 | AR3 gating: a decided price fact is carried as CLEAN (`companyInputs.ts:414/466`); re-check the margin path after AR4 | HEAVY | B |
| 4 | A5: a pinned run's support check ignores the pin, calls the model and fails offline (`gate.ts:375`) | HEAVY | A |
| 5 | KO golden `totalDebt` leaves out $1.551B of loans and notes payable; golden debt components must sum to the presented lines (an evaluator change, called out) | HEAVY | A |
| 6 | The next roadmap outcome Calvin releases (AR6 follow-up or AR7 #455) | per contract | B |

Optional outcomes 7 and 8, if released inside the window, continue the alternation.

**Measurement.** No dashboard: one TSV row per outcome in the notes folder.
- **Escaped material defects (primary).** Every merged experiment PR in both arms gets one blind Leg-1 replay review: exact merged head, diff and contract, no arm label. I reproduce each finding before it counts.
- **Calvin touches.** Comments, labels or rulings he had to author, excluding contract-reserved gates.
- **Elapsed time** from dispatch to merge.
- **Control-plane comments** per outcome.
- **Tokens** per outcome.
- **Safety incidents:** a gate bypass, an unapproved merge, a silenced genuine gate, or a fire in the wrong arm.

**Pre-registered rule.** The lean SOP is proven only if all four hold:
1. B's escaped defects are no more than A's.
2. B has zero safety incidents.
3. B's Calvin touches per outcome are no more than A's.
4. B's median elapsed time is at most 1.5× A's.

If proven, Calvin then decides, separately, whether to retire OWNER and the relay; the existing workflow stays the default until then. If any condition fails, keep the existing workflow.

**Stop rules:**
- A finance defect merged in either arm: stop and fix it first.
- Any cross-arm fire: stop and fix the guard.
- Any genuine gate that is not paged: stop.

## 4. Autonomy

**After "GO Leg 2", I run these steps without further check-ins:**
- **A.** Post the CF-LEG2-PREFLIGHT-01 issue and apply `needs-build-wake`. The existing workflow builds, reviews and merges it. Then I re-run its new tests in a scratch clone to confirm the guards (read-only).
- **B.** Then, one outcome at a time:
  - post the task issue (with `lean-sop` for arm B);
  - arm A: dispatch via `needs-build-wake`;
  - arm B: run one worker session and one fresh reviewer;
  - after merge: run the blind audit and post one short receipt per outcome;
  - at the end: the Leg 2 result with the rule applied.

**I stop for Calvin only at:**
- a contract-reserved CALVIN REQUIRED;
- a stop rule;
- the final retirement decision.

**Never:**
- touch #466, #454 or the AR7/AR8 gates;
- migrate Calvin's DB;
- edit workflows beyond the pre-flight PR;
- write to Notion;
- run outcomes concurrently;
- start or interrupt any routine except through its normal wake label.

**Expected size:** about 1–2 days sequential. Roughly 1.2M tokens for the blind audits plus about 1M for the arm-B reviewers, plus the worker sessions.
