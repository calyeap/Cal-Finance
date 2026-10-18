CORRECT: head acd6da4 does not yet meet #439 DONE WHEN. On the same PR: (1) carry an optional per-scenario ten-year reinvestment-intensity path from recorded input to dynamicScenarioValue, and re-propose base/bull paths that join up with g/terminalROIC at year 10; (2) refuse a terminalRoic that is <= terminal growth or in the wrong units, failing on write and on compute; (3) pass the base terminalRoic into the M14 sensitivity valuation; (4) add terminalRoic to the analyst form and server action; (5) make the oracle use the product's own bridge and diluted share count, compare against the product figures year by year, and add §4.4 and growth/margin to the one Calvin question.

Reviewed: exact head acd6da442bd478da020a6561bc309ca65aaab4c6 (repo-a), TIER: HEAVY (from issue #439). No PR body, BUILD report, CI or threads were available. Judged against task-contract.md as written.

## What I verified (passes)
- `npx tsc --noEmit`: clean.
- The PR's own tests pass: `msftStage2ValuationProof.test.ts` (2), `recordedBundles.test.ts` (12) and `scenarioOutputs.test.ts` (16) are green on throwaway DB pr440a_test.
- `npx vitest run lib/analyzer`: 1344/1346 pass. The 2 failures do not come from this PR. They are Windows checkout artefacts: the hash of the untouched `verdict.ts` fails under CRLF, and `nvdaAnalystDraftValidation` fails on a backslash-path allowlist. Neither file is in the diff.
- Backward compatibility holds. With terminalRoic absent or null, the result is identical to r+3pp, and NVDA/fixture rows read back null.
- The oracle runs (`python -I scripts/evidence/msft-stage2-valuation-proof/independent_oracle.py`) and reproduces the doc's §4/§5/§7 figures. Its EVs match the product: base EV is $1,990.78B in both.
- I reconciled the bridge by hand from the capture. The product's net position is -$6.303B and the oracle's is +$30.045B. The difference is exactly us-gaap:LongTermInvestments at 2026-06-30, which is $36.348B.
- No production DB write, no verdict, BUY/HOLD/SELL or frozen-doc change, and no edit to #436.

## Findings

### F1. The forecast/terminal boundary is still incoherent and the effect is material (DONE WHEN, item (d), DO 3)
- **Where:** the candidate in `msftStage2ValuationProof.test.ts` / `independent_oracle.py`, and doc §1 and §4, which rule out the ten-year intensity path.
- **Root cause:** reinvestment intensity stays constant (7/20/26% of revenue) through year 10 while growth fades to 3%, and terminal ROIC is then 10/11/12.5%.
  - The oracle's own output shows year-10 RONIC of 5.47% (base) and 4.37% (bull), below the 10% cost of capital.
  - Terminal FCF then jumps to x1.66 (base) and x2.49 (bull) of year-10 FCF.
  - The contract treats only the reversed cross-scenario RONIC *ordering* as a diagnostic to explain. It requires scenarios that are coherent "through the forecast/terminal boundary", says to use ten-year paths "if materially necessary", and names exactly these terminal-FCF jumps as something not to rubber-stamp.
  - The PR keeps Stage 1's 7/20/26% "carried forward unchanged" and relabels the jump as a diagnostic.
- **Evidence:** `work-a/boundary.py`. This is illustrative only, not a proposed number. It fades intensity linearly over years 6-10 to the terminal-consistent level, (g / terminal ROIC) x NOPAT margin, which is 10.13%, 9.94% and 9.09% of revenue for bear, base and bull.

  | Scenario | EV change | Boundary jump | Terminal share |
  |---|---|---|---|
  | Bear | -1.5% | x0.91 -> x1.03 | 51.7% -> 52.5% |
  | Base | +5.7% | x1.66 -> x1.03 | 68.8% -> 65.1% |
  | Bull | +10.0% | x2.49 -> x1.03 | 78.7% -> 71.6% |

  - This effect is larger than the acquisitions/ΔNWC gap the PR does disclose (2-4%).
  - The bull 12.5% terminal-ROIC rationale (the 78.7% ">75% caution") is itself an artefact of this incoherent boundary.
- **Smallest fix:**
  - Add an optional `reinvestmentCapitalIntensityPath` (10 decimals) to `RecordedScenarioDriverInput`, then to `ScenarioDriverInputs`/`ScenarioDriverSet`, then to `dynamicScenarioValue`. `computeScenarioEnterpriseValue` already accepts the array.
  - Validate length 10. When absent, keep the existing constant behaviour.
  - Re-propose base/bull paths so year-10 reinvestment reconciles with g/terminalROIC, and leave the numbers to Calvin's gate.
  - Alternatively, if BUILD shows the effect is immaterial, state the measured materiality instead of asserting a diagnostic. The figures above say it is material.

### F2. terminalRoic has no fail-closed validation, so a bad value silently produces a fair value (HEAVY silent-error, DO 4/5 negative cases)
- **Where:** `recordedBundles.ts:170` and `:268` (`optionalDecimal` only), and `scenarioOutputs.ts:71`.
- **Root cause:** any numeric value is accepted. The formula `1 - g/terminalRoic` breaks when terminalRoic <= g (3%) and is meaningless when terminalRoic <= 0. A value entered in percent units ("12.5") is also accepted.
- **Evidence:** a probe test (`work-a/zzReviewProbe.test.ts`) ran the real MSFT run with bear terminalRoic set to each value below. The run returned `fairValueRange.kind = "range"` in every case:

  | Bear terminalRoic | Bear value per share |
  |---|---|
  | "0" | -Infinity |
  | "0.02" | $25.64 |
  | "0.03" | $105.59 |
  | "-0.05" | $361.46 |
  | "12.5" (percent typed by mistake) | $265.13 (the intended 10% gives $217.54) |
  | "1e9" | $265.51 |

  The repo already guards share-count units for exactly this class of error (REVIEW-38680230521-1). The PR's only negative test is non-numeric text.
- **Smallest fix:**
  - In `recordAnalystBundle`, reject terminalRoic <= `POLICY.terminalGrowth` and > 1, with a unit message.
  - In `computeScenarioEnterpriseValue`, throw or fail closed for the same condition.
  - Add negative tests for 0, g, below g, negative and 12.5.

### F3. The PR makes M14 sensitivity disagree with the scenario valuation in the same report
- **Where:** `assemble.ts:563-571`. `scenarioValueAt` still calls `computeScenarioEnterpriseValue(..., terminalGrowth)` without the base scenario's terminalRoic.
- **Root cause:** only `dynamicScenarioValue` forwards the new field. The sensitivity block says it uses "the SAME M15 model this run's own scenario valuation uses", and MSFT does have sensitivity ranges.
- **Evidence:** in the probe on the real MSFT run with the candidate:

  | Quantity | Value |
  |---|---|
  | Base scenario EV (terminal ROIC 11%) | $1,990.78B |
  | Same drivers inside M14 (r+3pp) | $2,069.83B (+3.97%) |
  | Tornado growth row (as shipped) | [1,648.6B, 2,035.1B, 2,659.9B] |
  | Tornado growth row with 11% forwarded | [1,587.2B, 1,957.5B, 2,555.9B] |

  `forecastDispersion` is computed from the r+3pp rows. Before this PR the two paths agreed.
- **Smallest fix:** pass `sensitivityBaseScenario.terminalRoic` as the 8th argument in `scenarioValueAt`, and add an assertion that the tornado mid or base value equals the base scenario EV.

### F4. Terminal ROIC cannot be authored through the real input surface, and the published disclosure is now false (DO 1 "from authorable input", DO 4 "readback")
- **Where:** `app/actions/analystInputs.ts:44-51` (`driverFromForm`) and `app/components/AnalystBundleForm.tsx`. Neither carries `terminalRoic`.
- **Root cause:** the analyst form is the only non-test caller of `recordAnalystBundle`, and it writes with an UPSERT that replaces the whole bundle. A bundle recorded with terminalRoic, if re-saved through the form, silently loses it and reverts to r+3pp.
- **Related:** `AnalyzerReport.tsx:438-443` still publishes "Terminal ROIC = r + 3 percentage points — assumed for every company" for a run whose scenarios use 10/11/12.5%.
- **Smallest fix:**
  - Add a blank-is-null `{scenario}.terminalRoic` field to the form and action, with a readback test covering a re-save.
  - Label the provisional-register row so it applies only when no scenario overrides terminal ROIC, or name the override.

### F5. The proof is not fully independent and skips required checks (DO 5)
- **Where:** `msftStage2ValuationProof.test.ts`, `independent_oracle.py` and doc §6.
- **Root cause:**
  - The TS test's "independent recomputation" calls the same production `computeScenarioEnterpriseValue` and takes `netDebtBridge` from the result, so it is self-checking.
  - The Python oracle prints aggregates only. It does not output or compare year-by-year NOPAT, reinvestment, FCFF or discount factors.
  - The oracle uses a different bridge (it omits the §4.4 LongTermInvestments term) and the raw share count (7,425,545,491) instead of the product's diluted count (7,449,545,491).
  - No step compares oracle and product mechanically. Doc §6 attributes the per-share gap to the bridge formula only, which is incomplete because the share counts also differ.
  - The contract asks for the "EV→equity bridge including non-operating claims" to be verified by the oracle.
- **Smallest fix:**
  - Give the oracle the same bridge (debt + finance leases - cash - STI - LongTermInvestments = -$6.303B) and the diluted share count.
  - Emit a year-by-year table and per-scenario per-share figures.
  - Record the product's year-by-year and per-share outputs in the doc, and show agreement to a stated tolerance.

### F6. The consolidated Calvin gate is incomplete (SAFETY / DO 2-3)
- **Where:** doc §2 and §9.
- **Root cause, §4.4:** the contract makes Calvin's approval of the "§4.4 equity-bridge treatment" a precondition for any durable MSFT bundle, and DO 2 requires it to be handled "as a genuine decision, not a silent default". The PR reuses the #188 ruling and leaves it out of the question. It is worth $36.348B, about $4.9/share.
- **Root cause, growth/margin:** the PR says #439 scopes growth/margin out. DO 3 asks for growth/margin/net-reinvestment trajectories, and the #436 tables are explicitly not approved. The reused 8/14/20% growth and 41.68/45/46.78% margin are not in the question.
- **Smallest fix:** add §4.4 treatment and growth/margin as named items in the single §9 question. Keep it one question.

## Nits (not grounds for CORRECT alone)
- The `msftStage2ValuationProof.test.ts` header points to `docs/proof/msft-stage2-valuation-proof.md`. The real file is `docs/proof/cf-msft-stage2-real-valuation-proof-01.md`.
- The acquisitions/ΔNWC "+2pp is generous" claim has no evidence behind it. I checked the public SEC companyfacts API: MSFT reports no us-gaap acquisitions tag after FY2011, so it likely uses a custom tag the API omits. Sourcing it needs the 10-K cash-flow statement. Report that as the precise missing data rather than describing it only as "no tag mapping".
- `profile: MATURE_PROFITABLE_STABLE_FCF` alongside `fcfCharacter: positive_volatile` is argued in the doc but is not in the Calvin question.

## Repo state
repo-a has no modified tracked files. The probe test was copied in, run and removed. Scratch artefacts are in work-a: `zzReviewProbe.test.ts`, `boundary.py`, `tags.py`, `acq*.py`, and SEC data under `sec/`.
