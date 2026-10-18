CORRECT: the D4 return-on-capital floor is only proven on the golden set through the test's own derivation. The production derivation the verdict actually reads cannot compute the floor for NUE or LLY, and gives OKLO UNAVAILABLE instead of FAIL. In production, BUY can never be reached for two of the six companies the contract says must pass.

Reviewed: PR #465 (issue #453, CF-AR5-VERDICT-CONSOLIDATION-01) at a25edf635ae1d3296ccbd4d9ef9e55e08fb66ef7. Tier: HEAVY.

## Finding 1 (material): production D4 floor diverges from the golden-set result the contract requires

**Where**
- `lib/analyzer/acquisition/companyInputs.ts` `roicHistoryFrom` (diff hunk @@ -779): the production inputs.
- `lib/analyzer/assemble.ts` (verdictInputs.roicFloor, about line 1457): maps `roicHistory == null` to UNAVAILABLE.
- `lib/analyzer/roicFloor.test.ts:114-134`: the golden check.

**Contract line**
VERIFY says: "the D4 bar evaluates as expected on the golden set (5-yr average ROIC incl. goodwill above the rate passes MSFT, COST, NVDA, NUE, KO, LLY and fails OKLO — re-derived, not imported)". DO 2 makes the floor a condition for BUY.

**Root cause**
The golden test calls the shared `evaluateRoicFloor` on inputs that its own `rederive()` builds from `golden/roicFloor.json`. Where `OperatingIncomeLoss` is untagged, `rederive()` substitutes EBIT = pre-tax income + interest expense. It uses each year's effective tax rate. It counts "filed" years only where the curated capture has an Oklo operating result, because the capture nulls the AltC SPAC years.

The production path has none of this. `roicHistoryFrom` reads only the single-tag `operating-income` series (`tagMap.ts:284-289`, candidates `[OperatingIncomeLoss]` only), and returns null when that series is null. It counts `filedHistoryYears` as every fiscal year in that series, including predecessor-shell years. A filer with no debt tag gets invested capital = null. The production derivation is never run against golden data, so the test passes while production does not give the stated outcome.

**Reproduction** (offline, this commit; temporary probe test, since removed)
- NUE and LLY companyfacts from data.sec.gov (CIK 0000073309, 0000059478), read with production `annualSeries(doc, operating-income candidates)`:
  - `nue: operating-income annualSeries = null`
  - `lly: operating-income annualSeries = null`
  - For comparison, COST gives FY2008–FY2026 and KO gives FY2007–FY2025.
- `assembleAnalysisResult({...withStatedD2Inputs(MSFT_FIXTURE), scenarioValues: null, roicHistory: null})` gives `floor UNAVAILABLE: no return-on-capital history was acquired for this run`.
- `deriveVerdict` on a BUY zone (ratio 0.5 at all nine points) with a wide moat, a cited mechanism, management "not poor" and process items adopted gives `PENDING / BUY CANDIDATE … Still open: the five-year return-on-capital floor cannot be computed`. So for NUE and LLY no recorded answer can ever produce BUY. The contract says both pass the floor.
- The real OKLO capture through the production gate (`createRun("OKLO")`, then `loadGateState`, then `assembleAnalysisResult(withStatedD2Inputs(fixture))`) gives:
  - `OKLO nopatTaxRate=0.21 filed=5`
  - FY2021–FY2025 NOPAT present, with FY2021/FY2022 being AltC SPAC losses (−0.93M, −1.43M)
  - invested capital `undefined` in every year
  - `floor=UNAVAILABLE :: FY2025 is missing invested capital`
  - The contract requires FAIL. The PR's own rule ("filed record shorter than five years → FAIL") is defeated because the shell company's 10-K years are counted as Oklo's.
- My own re-derivation from `golden/roicFloor.json` (work-b/roic.py, written without the PR's helpers) agrees with the contract's expected outcomes:
  - Pass: MSFT 38.6%, COST 35.8%, NVDA 87.6%, NUE 25.5%, KO 16.6%, LLY 26.0%, against 9%/11% rates.
  - Fail: OKLO, with only FY2023–FY2025 operating years and FY2023 invested capital negative.
  - So the expected result is right; it is the production path that does not reach it.
- Supporting evidence that production is unchecked against golden: production NVDA invested capital is FY2026 155.2B / FY2025 79.2B / FY2024 45.4B. The independent capture is 123.9B / 44.6B / 26.7B. The differences equal NVDA's marketable securities, so `investedCapitalAt`'s cash series drops them. This gives an average ROIC of 47.7% in production against 87.6% re-derived. NVDA still passes, so the outcome does not change; I note it only as evidence.

**Smallest fix**
1. In `roicHistoryFrom`, use the substitute the golden capture uses where `OperatingIncomeLoss` is untagged: EBIT = pre-tax income + interest expense. This needs those two annual series acquired. It is an AI DEFAULT with a receipt; it does not change a rule.
2. Count `filedHistoryYears` from the filer's own operating record, not predecessor-shell years. Alternatively, have OKLO's short-record FAIL come from the same evidence the golden capture uses.
3. Decide, and record as an AI DEFAULT, whether a filer that tags no debt at all reads as zero debt or as UNAVAILABLE.
4. Add a production-path golden test that runs the acquisition derivation (`buildCompanyInputs` / `roicHistoryFrom`) on companyfacts for all seven golden companies, and asserts PASS×6 and FAIL for OKLO against the independently re-derived averages.

If acquiring the substitute series is judged out of this milestone, the PR must not claim this VERIFY line as met.

## DONE WHEN / DO table

| Item | Status | Evidence |
|---|---|---|
| DO 1: 3 rates × 3 levels; automatic / one question / close call; "can't bound value" | MET | `verdictSynthesisV1.ts:71-96`; `verdict.ts:127-131,155-156,187-243`; check rates = D1 ± 0.005 (`discountRate.ts:69`, `policy.ts:40`); Base revalued with terminal = r + moat credit (`assemble.ts` hunk @@ -848), consistent with M14's rate row. AI proposal is price-blind, cited and digit-free (`ai/uncertaintyProposal.ts`), and fetched only in the UNCERTAINTY QUESTION state (`page.tsx`). |
| DO 2: D4 bar; "BUY candidate — needs your quality call"; cheap without moat never BUY | PARTIAL | Bar logic is correct (`qualityBar.ts`; 432-combination test `verdict.test.ts:244-274`). The computed-floor input is wrong or unavailable for NUE, LLY and OKLO in production (Finding 1). |
| DO 3: thesis broken → SELL; dated, versioned answers; "not sure" never agreement and never a verdict | MET | `verdict.ts:162-172`; migration 013 is append-only with CHECKs; `verdictJudgementStore.ts` versions via ROW_NUMBER; the not-sure subset sweep is at `verdict.test.ts:282-311`. |
| DO 4: templated "why" reasons | MET | `verdict.ts` reason templates; `trustCopy.ts verdictExplanation`; no AI text reaches `reason`. |
| DO 5: Ruling-C code and C/F/E position removed; Uncertainty badge fixed; AR1 caveat removed | MET | flipTest, growthLicence and verdictBlockers (and their tests) deleted; `Step5Position` gone; badge now `uncertaintyBadge(verdict, judgements)` (`AnalyzerReportFrame.tsx`); no "rate convention under review" text in app/lib (asserted absent in `DominantVerdictSlot.test.tsx:103`). |
| Truth table GREEN | MET | `verdictSynthesisV1.test.ts`: 13³ = 2,197 combinations against an oracle written from the Methodology, not imported; passes. |
| Verdict rules proven in tests | PARTIAL | All routing, judgement and bar rules are proven; the golden-set floor is proven only on the test's own derivation (Finding 1). |
| "Pending adoption" in the real app for un-adopted sheets | MET | `acceptanceGateOnRealRun.test.tsx` (route render: `data-state="PENDING ADOPTION"`, "No verdict until you adopt"); `msftStage3VerdictOnRealRun.test.ts:88-99`. |
| VERIFY: `npx tsc --noEmit` | MET | exit 0 |
| VERIFY: `npm test` | MET (environment caveat) | 2623/2625 pass. The two failures are Windows-checkout artefacts only: the verdict.ts hash guard reads the CRLF working copy (`git show HEAD:lib/analyzer/verdict.ts | sha256sum` = 2b17017a…, exactly the pinned value), and the NVDA draft guard sees backslash paths. Neither is caused by the PR. |
| VERIFY: Morningstar humility check | Not judged | Not in committed files; the PR body was not provided. |

## Evaluator changes (checked)
- `m9RealCompanyValidationGuards.test.ts`: the hash is re-pinned to the new verdict.ts. This is justified because verdict.ts is a contract-expected file; the new pin equals the committed blob, and the bands are separately asserted against Methodology numbers (`verdictSynthesisV1.test.ts:44-61`).
- Real-run tests (acceptanceGate, analyzerSurfaces, automaticAnalysis, step4Final, runOutputs, snapshot*): the `INCOMPLETE` pins are replaced by the pending-adoption state, or by an invariant ("not BUY/HOLD/SELL; state consistent with reason"). This is justified by the contract's pending-adoption requirement.
- No V1 band or threshold change: `policy.ts` is not in the diff.

## Nits (not counted)
- Several real-run tests accept either PENDING ADOPTION or CANNOT BOUND VALUE for MSFT, depending on whether another file deleted the recorded sheet first. This is pre-existing order dependence, now encoded as a disjunction; seeding migration 010 in those files would let them pin one state.
- Thesis-broken → SELL is evaluated after the pending-adoption and Base-positivity checks, so a broken thesis on an un-adopted or unboundable company shows that state rather than SELL. This is defensible under Option A, but it is not stated in the PR.
- The production NVDA invested capital omits marketable securities in FY2024–FY2026, through the pre-existing `investedCapitalAt` shared with RONIC (see Finding 1). It does not change the outcome.
