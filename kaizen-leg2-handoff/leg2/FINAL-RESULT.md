# KAIZEN Leg 2: final result (six outcomes)

**Date:** 19 Oct 2026. **Authority:** Calvin's GO Leg 2 (`LEG2-PLAN.md` steps A and B), his 19 Oct instruction to resume, and his release of O6.
**Record:** `scorecard.tsv` rows 1–6, `reviews/` (every review and blind audit), `cloud-ledger.md` (O4 onward, timestamped).
**Supersedes:** `PROVISIONAL-O1-O5.md`, which covered five outcomes.

## Verdict: KEEP the existing workflow

The lean SOP is **not proven**. It fails 2 of the 4 pre-registered conditions: Calvin touches and elapsed time. Per `LEG2-PLAN.md` §3, the existing BUILD → REVIEW → OWNER workflow stays the default, and the question of retiring OWNER and the relay does not arise.

## 1. Scorecard

| # | Arm | Tier | Elapsed (min) | Calvin touches | Control comments | Review cycles / CORRECTs | Tokens / cost | Blind audit | Escaped | Safety |
|---|---|---|---|---|---|---|---|---|---|---|
| O1 | A | NORMAL | 11.4 | 0 | 6 | 1 / 0 | $3.68 · 288k ctx | ACCEPT | 0 | 0 |
| O2 | B | NORMAL | 29.2 | 1 (merge) | 0 | 1 / 0 | 291k agent tokens | ACCEPT | 0 | 0 |
| O3 | B | HEAVY | 38.5 | 1 (merge) | 0 | 1 / 0 | 529k agent tokens | ACCEPT | 0 | 0 |
| O4 | A | HEAVY | 14.8 | 0 | 6 | 1 / 0 | $2.58 · 249k ctx | ACCEPT | 0 | 0 |
| O5 | A | HEAVY | 14.3 | 0 | 6 | 1 / 0 | $4.22 · 312k ctx | CORRECT (reproduced) | 1 (contested) | 0 |
| O6 | B | HEAVY | 117.2 | 1 (merge) | 0 | 1 / 0 | 307k agent tokens | ACCEPT | 0 | 0 |

## 2. The four pre-registered conditions

| Condition (B passes only if all hold) | A: O1, O4, O5 | B: O2, O3, O6 | Holds? |
|---|---|---|---|
| 1. B's escaped defects ≤ A's | 1 (contested; 0 if not counted) | 0 | ✅ either way |
| 2. B has zero safety incidents | — | 0 | ✅ |
| 3. B's Calvin touches per outcome ≤ A's | 0.0 | 1.0 | ❌ |
| 4. B's median elapsed ≤ 1.5 × A's | median 14.3, so the limit is 21.45 | median 38.5 (2.69 × A) | ❌ |

**Result: the lean SOP is not proven, so keep the existing workflow.**

## 3. What decided it: who merges

Minutes per phase, from receipts and PR timestamps. B's O2/O3 ACCEPT times are the local operator's approximate stamps.

| Phase | A: O1 / O4 / O5 | B: O2 / O3 / O6 |
|---|---|---|
| Build (dispatch → PR open) | 7.7 / 8.7 / 9.4 | 9.5 / 23.7 / 8.4 |
| Review (PR open → ACCEPT) | 3.6 / 6.1 / 4.8 | ~8.0 / ~9.3 / 5.5 |
| Merge (ACCEPT → merged) | 0.1 / 0.1 / 0.1 | ~11.7 / ~5.5 / 103.2 (Calvin) |

- **Both failed conditions trace to one design point.**
  - In arm A, REVIEW merges the exact reviewed head itself (`.github/ai-routines/CC.md:56`), 3–6 s after ACCEPT.
  - In arm B, Calvin merges: auto mode blocks an operator merge, and the handoff reserves the merge to him.
  - So every arm-B outcome costs one Calvin touch plus his response time: 11.7, 5.5 and 103.2 min.
- **Sensitivity only, not the scored measure:** from dispatch to ACCEPT, the medians are A 14.2 and B 17.5 (1.23×), inside the 1.5× bar. B's worker-and-reviewer pair is roughly as fast as A's routines; the gap is the merge. The verdict stands as scored.

## 4. Quality, safety and cost

- **Quality:**
  - No in-arm CORRECT anywhere; all six outcomes took one review cycle.
  - The blind audits gave 5 ACCEPTs and 1 CORRECT. The CORRECT was O5 (arm A): a contract miss, contested and low impact, that arm A's REVIEW accepted and only the blind audit caught. O6 then fixed it.
- **Safety:** 0 incidents in both arms. The guards held:
  - every `lean-sop` item skipped both routing and owner-on-merge;
  - no wake label was applied to a lean item;
  - every merge was the exact reviewed head.
- **Cost:** arm A spent $2.58–$4.22 per outcome in routine usage, measured from the cloud. Arm B used 291k–529k agent tokens, with no USD figure. The two are of the same order.
- **Control-plane comments:** 6 per outcome in arm A; 0 in arm B.

## 5. Cloud vs local

- **Arm A:** ran unchanged. Its routines are cloud sessions, so the operator's move from Calvin's machine (O1–O3) to a cloud session (O4–O6) did not change the arm-A treatment.
- **Arm B:** O2 and O3 ran locally; O6 ran in the cloud.
  - O6 had the fastest arm-B machine time: 14.0 min from dispatch to ACCEPT.
  - It also had the longest merge wait (103.2 min). That wait reflects Calvin's availability, not the environment.
- **Cloud environment:**
  - no `gh`, so GitHub writes went through the MCP as calyeap;
  - Postgres runs in the container;
  - one environment-only Playwright test failure;
  - data.sec.gov returns 403 to a User-Agent without an email, and www.sec.gov is denied by the proxy;
  - routine usage (tokens and USD) is visible.

## 6. Limits

- **Small n:** 3 outcomes per arm.
- **The sample:** defect fixes already diagnosed by Leg 1 or Leg 2, with precise contracts. It says little about open-ended roadmap work.
- **Merge latency:** B's elapsed time depends heavily on Calvin's merge latency (5.5–103 min).
- **O5's escaped defect is contested.** Not counting it does not change the verdict.
- **Models:** builders, reviewers and auditors were the same model family. Their contexts were fresh; the models are not independent.
- **Tokens:** the figures come from two different instruments.
- **Blindness:** O1's posted contract named "the existing workflow", so its audit was not fully arm-blind. O6's audit copy was redacted of arm words to keep it blind.

## 7. Follow-ups (not part of the experiment; listed only)

1. **O2 audit:** on unmeasured leverage, the Quick Read still says "A capital structure this levered…" (`QuickRead.tsx:375`, `:384`).
2. **O3 reviewer:** Trigger A reads the margin history's current year when the current margin is contradicted. A possible methodology question for Calvin.
3. **O4 audit nits:** a stale comment at `aiProposedBundle.ts:193-196`; the offline `not.toHaveBeenCalled()` assertion is trivially true.
4. **KO's remaining short-term borrowings stay unmapped by decision:** 56M at FY2025, and 82M at 2026-04-03 per O5's BUILD live read. Mapping them is a debt-concept decision for Calvin. Decide it together with the latent CommercialPaper + ShortTermBorrowings double-count pattern that O6's reviewer and auditor flagged; no current capture reaches that pattern.
5. **O5 audit F2:** LLY's golden finance-lease note contradicts its cited 10-K record (metadata only).
6. **O6 nit:** `docs/tag-mapping-version-review.md` §11.2 omits KO's `roicHistory` invested-capital move. No output changes.
