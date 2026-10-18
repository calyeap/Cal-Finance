CORRECT: the terminal-ROIC plumbing works and the shipped MSFT per-share figures reproduce exactly, but there are five reproduced builder-fixable defects (with one lesser one) that the contract requires fixed on this PR: no domain validation on terminalRoic (it fails open to -Infinity or negative fair values), the authoring form silently erases terminalRoic, M14 sensitivity ignores it, the forecast/terminal incoherence is material yet left unfixed, and the RONIC explanation and Calvin gate are wrong or incomplete.

Review of PR head acd6da442bd478da020a6561bc309ca65aaab4c6 against issue #439 (HEAVY). Probes ran on the throwaway DB pr440b_test only. repo-b was left clean (`git status` is empty). My scripts are in work-b/ (zzProbeReview.test.ts, recompute.py, probe-out.txt).

## What checks out (verified independently)
- Shipped real-path values. I wrote my own Python (work-b/recompute.py) that does not use the PR's helpers. It uses the production bridge from the real run (EV 3,716,234,881,852.70 − market cap 3,722,537,881,852.70 = net cash 6.303B) and diluted shares 7,449,545,491. It gives bear 217.5355, base 268.0816 and bull 366.3075. These match the TypeScript run to the cent (probe P1: 217.535473…, 268.081558…, 366.307496…). Terminal shares are 51.66%, 68.82% and 78.70%, matching the doc. Market cap = 499.70 × 7,449,545,491, which is consistent.
- Backward compatibility holds. An absent or null terminalRoic gives the prior r+3pp result (PR tests plus my run). `npx tsc --noEmit` is clean.
- Full suite: 2439 passed, 3 failed. None of the 3 failures is caused by this PR:
  - The verdict.ts hash test fails because the checkout has CRLF line endings.
  - The nvda draft-reference test fails on Windows backslash paths.
  - analyzerSevenTabsOnRealRun is a timing failure under load; it passes when run alone.
- Safety boundaries hold. Nothing persists: the recordAnalystBundle("MSFT") rows live only in the test DB and are deleted. There are no changes to verdict, policy, frozen docs or CI/evaluators.
- Acquisitions really are untagged. The repo capture has no acquisitions tag. Live SEC companyfacts (data.sec.gov, read-only) shows that us-gaap:PaymentsToAcquireBusinessesNetOfCashAcquired stops at FY2011. So "missing, not zero" plus a sensitivity test is a defensible handling.

## Findings

### F1. terminalRoic has no domain validation, so a bad value produces nonsense fair values that are still reported as a valid range
- **Where:** recordedBundles.ts:170 and :268 (only `optionalDecimal`); scenarioOutputs.ts:71-72 (`1 - g/terminalRoic`, unguarded).
- **Root cause:** any finite decimal is accepted. When terminalRoic ≤ g (0.03), terminal FCF becomes zero, negative or −∞. When terminalRoic is negative, the value is inflated.
- **Reproduction (probe P2, real MSFT run, bull terminalRoic varied):** every value below was accepted by recordAnalystBundle and came back with `fairValueRange.kind = "range"`.

  | bull terminalRoic | bull per-share |
  |---|---|
  | "0" | **-Infinity** |
  | "0.02" | **-$110.52** |
  | "0.03" | $78.70 |
  | "-0.05" | **$684.19** (higher than at 12.5%) |

- **Why it matters:** DO 4 asks for validation tests and DO 5 for negative/fail-closed cases. The only negative test in the PR is the non-numeric string "not-a-number".
- **Smallest fix:** in recordAnalystBundle, reject terminalRoic ≤ POLICY.terminalGrowth (and non-finite values). In computeScenarioEnterpriseValue, guard terminalRoic > terminalGrowth so the stored-row path also fails closed. Add tests for 0, g, below g and negative.

### F2. The real authoring surface drops terminalRoic, and re-saving silently reverts a scenario to r+3pp
- **Where:**
  - app/actions/analystInputs.ts:43-51: `driverFromForm` builds only five fields.
  - app/components/AnalystBundleForm.tsx: no terminalRoic input.
  - AnalyzerReport.tsx:1195-1199: Section F shows only Growth, Margin and Reinvestment.
  - AnalyzerReport.tsx:437-442: Section J still states "Terminal ROIC = r + 3pp — assumed for every company".
- **Root cause:** the field was added to the TypeScript API only. DO 1 names "the normal recorded analyst path" and requires carrying the value "from authorable input to real scenario computation".
- **Reproduction (probe P3):**
  1. Record MSFT with terminalRoic 0.10/0.11/0.125. Base reads back as 0.11.
  2. Submit `recordAnalystBundleAction` with the same form fields, including `base.terminalRoic=0.11`.
  3. Read back again: base terminalRoic is **null**. The next run silently uses 13%.
- **Report side:** the test comment claims "§10 F display … carried through". It is carried only on the result object; the report never shows it and discloses r+3pp instead.
- **Smallest fix:**
  - Add `terminalRoic: nullableField(formData, \`${scenario}.terminalRoic\`)` to driverFromForm.
  - Add a prefilled optional input per scenario to AnalystBundleForm.
  - Show the per-scenario terminal ROIC in the Section F table, and qualify the Section J r+3pp row when a scenario overrides it.

### F3. The M14 sensitivity is still computed at r+3pp, so it no longer shares the base scenario's model
- **Where:** assemble.ts:564-572. `scenarioValueAt` calls computeScenarioEnterpriseValue without `sensitivityBaseScenario.terminalRoic`.
- **Root cause:** only `dynamicScenarioValue` (line 664) was updated. MSFT has captured sensitivity ranges, so this path runs for MSFT.
- **Reproduction (probe P1):** M15 base EV at 11% is 1,990,782,762,468. The tornado/table base case at 13% is 2,069,829,939,515, which is **+3.97%**. The tornado growth row (2,035B mid) and the growth×margin cells are all built on the 13% model. The Step-4 dispersion reading (0.4886, HIGH) is read from them. This breaks sensitivity.ts's own invariant ("one model … one base case").
- **Smallest fix:** pass `undefined, sensitivityBaseScenario.terminalRoic` as the last two arguments in `scenarioValueAt`, and add a test that the tornado base case equals the base scenario EV.

### F4. The forecast/terminal boundary stays incoherent, the fix is material, and the PR declares it unnecessary (DO 1, DO 3, direction (d))
- **Where:** proof doc §1, §2, §4 and §9; the candidate keeps constant 7/20/26% intensity "carried forward unchanged".
- **What the PR's own oracle shows:** year-10 lagged RONIC is 5.47% (base) and 4.37% (bull). That is below the 10% cost of capital, against terminal ROIC of 11% and 12.5%. Terminal FCF ÷ year-10 FCF is ×1.66 and ×2.49.
- **Why that is incoherent:** a constant 20% intensity at 3% year-10 growth is inconsistent with any terminal ROIC above about 5.5%. This violates "Terminal growth, reinvestment and sustainable returns on capital must be economically consistent" and DO 3's "coherent year-10/terminal transition", and it is the "do not rubber-stamp" case DO 3 names.
- **Materiality (work-b/recompute.py, my own code):** I faded intensity linearly over years 6-10 to the terminal-consistent level (g/ROIC × margin × (1−t)), holding each scenario's growth, margin and terminal ROIC fixed.

  | Scenario | Change in per-share value | Boundary jump after fade | Terminal share after fade |
  |---|---|---|---|
  | Bear | −1.5% | ×1.03 | — |
  | Base | **+5.7%** | ×1.03 | — |
  | Bull | **+9.9%** | ×1.03 | 71.6% (was 78.7%, which removes the §3.5 caution) |

  By comparison, the lever the PR did build (bull terminal ROIC 12.5% versus 13%) moves bull by only −0.95%. The ten-year path was therefore "materially necessary".
- **A false scoping claim:** the doc says "issue #439 scopes this correction to reinvestment basis, fcfCharacter, and terminal ROIC, not growth/margin". DO 3 and direction (d) explicitly require proposing growth/margin/net-reinvestment trajectories.
- **Smallest fix:** carry an optional ten-entry reinvestment-intensity path through RecordedScenarioDriverInput → driverFromStorage → dynamicScenarioValue. computeScenarioEnterpriseValue already accepts arrays. Then propose MSFT paths whose year-10 reinvestment matches g/terminal ROIC, or explicitly defend a terminal ROIC equal to the year-10 implied return. Re-run the proof.

### F5. The required item-(d) explanation of the reversed RONIC ranking is mechanically wrong
- **Where:** proof doc §4.
- **The PR's claim:** the reversal is caused by "holding reinvestment intensity constant while growth fades toward the 3% terminal rate".
- **What the figure actually is:** the "explicit-period RONIC" in the oracle (`(nopats[1]-nopats[0])/reinvests[0]`) is year-1 RONIC, which equals g·m·(1−t)/intensity. That is before any fade, since years 1-5 have constant growth.
- **Reproduction:**

  | Scenario | Year-1 RONIC | Growth ÷ intensity |
  |---|---|---|
  | Bear | 0.08×0.4168×0.81/0.07 = 38.58% | 1.14 |
  | Base | 0.14×0.45×0.81/0.20 = 25.52% | 0.70 |
  | Bull | 0.20×0.4678×0.81/0.26 = 29.15% | 0.77 |

  The reversal comes entirely from bear assuming the most capital-efficient growth of the three. That is a coherence issue inside the bear case, and the doc's explanation hides it.
- **Smallest fix:** correct the explanation in §4. Either justify bear's growth-per-reinvestment ratio or adjust the bear growth/intensity pairing.

### F6. The one consolidated Calvin gate omits inputs the contract reserves to him
- **Where:** proof doc §9 asks Calvin to approve only "four Stage-2 choices" (reinvestment, fcfCharacter, terminal ROIC, acquisitions/ΔNWC).
- **What is left out:**
  - **Growth 8/14/20% and margins 41.68/45/46.78%.** These are taken from **unapproved, unmerged PR #436**, described as "reviewed, SEC-anchored" and placed outside the question.
  - **The §4.4 equity-bridge treatment.** The safety clause requires Calvin's explicit approval of "the exact numeric MSFT bundle and §4.4 equity-bridge treatment" before anything is recorded.
- **Consequence:** a "yes" to §9 would not cover the full bundle.
- **Smallest fix:** restate the single question so it covers the exact full numeric bundle, including growth, margin and the classification inputs, plus the §4.4 treatment, with growth and margin labelled as unapproved #436 carry-overs.

### F7 (lesser). The oracle does not independently verify the shipped per-share figures, bridge or diluted shares (DO 5 partial)
- **The oracle's gaps:**
  - It uses raw shares and a simplified net-debt figure (+30.045B), so its per-share outputs differ from what ships ($213.34/264.05/362.60 versus $217.54/268.08/366.31).
  - It never prints the year-by-year NOPAT, reinvestment, FCFF and discount table that DO 5 lists.
- **The TypeScript test's gap:** its "independent recomputation" calls the same production function, so it proves forwarding, not arithmetic.
- My own recompute confirms the shipped numbers are correct, so this is an evidence gap, not a wrong result.
- **Smallest fix:** extend the oracle with the §4.4 LongTermInvestments term and diluted shares (raw + treasury-method). Have it print the year-by-year table and reconcile to $217.54/$268.08/$366.31.

## DONE WHEN / DO table
| Item | Status | Evidence |
|---|---|---|
| DO 1: trace the chain; carry ten-year intensity **and** terminal ROIC from authorable input to computation | PARTIAL | terminalRoic: types.ts:355, recordedBundles.ts:69/170/268, assemble.ts:664. Not in the form (F2) or in sensitivity (F3). Intensity path not carried (F4). |
| DO 2: sourced choices; fcfCharacter; acquisitions/ΔNWC missing plus sensitivity; explicit §4.4 | PARTIAL | `positive_volatile` and a missing-not-zero ±1/2pp sensitivity are MET (verified untagged). §4.4 is reused explicitly but left out of the gate (F6). |
| DO 3: coherent growth/margin/net-reinvestment trajectories with a year-10/terminal transition; no rubber-stamping | NOT MET | F4, F5. |
| DO 4: minimal plumbing; source/readback/legacy defaults; validation tests; preserve other companies | PARTIAL | Legacy default and round-trip are MET. No domain validation (F1). Sensitivity not forwarded (F3). |
| DO 5: prove on the real pathway plus an independent oracle; bridge; share count; negative/fail-closed cases | PARTIAL | Real path runs and the values reproduce exactly (my recompute). The oracle does not cover the bridge or shares (F7). Fail-closed cases are missing (F1). |
| DO 6 / DONE WHEN: one reviewable PR plus one consolidated Calvin gate | PARTIAL | One PR, but the gate is incomplete (F6). |
| Safety: no persistent MSFT bundle, no verdict/policy/frozen edits, #436 untouched | MET | Diff file list; the test DB rows are deleted. |
| Evaluator changes | None | No CI, config, frozen-hash or threshold edits. |

## Nits (not counted)
- The proof doc's §7 table labels the universal-13% column "+4.95%". That figure is the candidate's −4.95% relative to 13%. 13% relative to the candidate is +5.21% for bear (224.45/213.34), and likewise for base.
- The msftStage2ValuationProof.test.ts header cites `docs/proof/msft-stage2-valuation-proof.md`. The actual file is `cf-msft-stage2-real-valuation-proof-01.md`.
- The header comment at scenarioOutputs.ts:13-16 still says terminal ROIC = rate + 3pp is a policy-wide constant.
- The `0.01` scenarioValues placeholders are required by the recorder. They are ignored on the fully-driven path, but they remain in the stored row.
