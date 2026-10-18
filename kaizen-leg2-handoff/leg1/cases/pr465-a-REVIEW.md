CORRECT: head a25edf6 — the shipped D4 computed floor (companyInputs.ts `roicHistoryFrom` → roicFloor.ts) does not give the contract's golden-set outcome: on the real SEC facts it gives MSFT/COST/NVDA PASS, but LLY, NUE, KO and OKLO all come out UNAVAILABLE. The committed golden test passes only because it builds its own inputs with a derivation the product does not use. Smallest fix: run the golden D4 check through the production derivation, and fix the derivation until it gives PASS for MSFT, COST, NVDA, NUE, KO and LLY and FAIL for OKLO.

TIER: HEAVY (from the task contract, #453 CF-AR5-VERDICT-CONSOLIDATION-01). Reviewed exact head a25edf635ae1d3296ccbd4d9ef9e55e08fb66ef7 only.

## Finding 1 (blocking): the golden D4-floor proof never runs the shipped code, and the shipped code misses the expected result on 4 of 7 golden companies

**Where:** `lib/analyzer/acquisition/companyInputs.ts` `roicHistoryFrom` (new; it feeds `assemble.ts` `verdictInputs.roicFloor`) and `lib/analyzer/roicFloor.test.ts` (the "D4 computed floor on the golden set" block).

**Root cause:** the golden test builds each year's inputs with a test-local `rederive()`:
- EBIT falls back to pre-tax income + interest expense when operating income is not tagged;
- tax uses the effective tax rate;
- debt comes from the capture's alternative concepts (latest-filed), with "no debt tagged" read as zero;
- filed years are counted from 10-K years that have an operating result.

The test then calls only the pure `evaluateRoicFloor`. The product's inputs come from `roicHistoryFrom`, which does none of this:
- it reads only `us-gaap:OperatingIncomeLoss` (the only operating-income candidate in TAG_MAP);
- it needs a year-end total-debt observation from the single-tag `instantAnnualSeries`;
- it sets `filedHistoryYears` to the number of fiscal years one tag covers.

So VERIFY's "the D4 bar evaluates as expected on the golden set" is shown for the test's own derivation, not for the bar the app runs.

**Reproduction:** `work-a/scripts/prodRoic.mts` and `prodRoicLive.mts` repeat `roicHistoryFrom` line for line, using the exported `annualSeries`, `instantAnnualSeries`, `TAG_MAP` and `evaluateRoicFloor`. They run on the repo captures, plus data.sec.gov companyfacts fetched read-only on 18 Oct 2026.

| Ticker | Production result | Contract expects |
|---|---|---|
| MSFT | PASS (37.7%) | PASS |
| NVDA | PASS (47.7%) | PASS |
| COST | PASS (39.6%) | PASS |
| LLY | UNAVAILABLE: no `OperatingIncomeLoss` facts at all, so `roicHistory` is null | PASS |
| NUE | UNAVAILABLE: same cause | PASS |
| KO | UNAVAILABLE: "FY2025 is missing invested capital" | PASS |
| OKLO | UNAVAILABLE: no debt tag, so invested capital is null every year | FAIL |

- **KO:** the production `total-debt` series is `us-gaap:LongTermDebt` and stops at FY2023. KO moved to `LongTermDebtAndCapitalLeaseObligations` from FY2023, which the golden capture uses.
- **OKLO:** production counts `filedHistoryYears` = 5. Two of those years, FY2021 and FY2022, are the AltC SPAC shell's 10-K operating losses (−$1.18M and −$1.81M). So the short-history FAIL the golden test relies on never fires in the product.

**Consequence:** this fails closed rather than issuing a wrong BUY. But in the real app LLY, NUE and KO can never reach BUY. Any BUY zone stays "BUY candidate — needs your quality call" with "the five-year return-on-capital floor cannot be computed". That is the representative/golden evidence a HEAVY review must check, and it is not met.

**Related silent-error risk, same function:** `filedHistoryYears` counts the fiscal years one tag covers, not the company's filing history. A filer whose `OperatingIncomeLoss` tagging is shorter than five years gets a definitive FAIL, which issues HOLD. That is a FAIL invented from missing data, which roicFloor.ts's own header rules out.

**Smallest fix (inside existing authority; a technical choice inside D4):**
1. Export the production derivation (or a pure equivalent over a `CompanyFactsDocument`).
2. Point the golden D4 check at it for the seven golden companies' companyfacts.
3. Fix what that exposes:
   - EBIT fallback = pre-tax income + interest expense where `OperatingIncomeLoss` is untagged;
   - year-end debt resolved across tag drift (alternative concepts, latest-filed);
   - filing history counted from 10-K fiscal years with any income-statement result. A tag-coverage gap must give UNAVAILABLE, never FAIL.

   Keep the floor's "untagged debt = zero" reading separate from RONIC's REQUIRED-debt cascade (#298) unless that is ruled otherwise.

## Verified OK at this head

- **`npx tsc --noEmit`:** exit 0.
- **`npm test` (`npx vitest run`, 220 files / 2625 tests):** 2623 pass, 2 fail. Both failures come from the Windows checkout, not the PR:
  - `m9RealCompanyValidationGuards` hashes CRLF text. The committed blob `git show HEAD:lib/analyzer/verdict.ts` hashes to the pinned 2b17017a…, and the LF-normalised working file matches too.
  - `nvdaAnalystDraftValidation` compares backslash `relative()` paths against a forward-slash allow-list; it fails on exactly the 2 allow-listed files.
- **Migration 013:** `npm run migrate` applies 013 cleanly on a fresh DB. It is additive (`IF NOT EXISTS`), append-only, CHECK-constrained per key, and stated as recoverable by revert.
- **D3 nine-point check (`verdictSynthesisV1.ts`):** the exhaustive 13³ = 2197 truth table is GREEN against an oracle written from the Methodology numbers. V1 bands are unchanged and asserted equal to the Methodology text. "Rate matters at any level → close call" is a literal, documented reading; I am not escalating it.
- **`deriveVerdict` order:**
  1. "Can't bound value" / INCOMPLETE prerequisites (adoption-only causes are not double-counted);
  2. PENDING ADOPTION;
  3. Base must be positive;
  4. thesis broken → SELL;
  5. automatic, one question, or close call (close call bound to `inputsFingerprint`, which excludes judgements — tested);
  6. BUY zone → D4 bar: PASS → BUY, FAIL → HOLD, OPEN → "BUY candidate — needs your quality call".

  Pending states are status PENDING and never show a verdict word. They are saved as INCOMPLETE plus `verdict_state`.
- **Judgement tests:** "not sure" never yields a verdict (every subset × every route, tested). BUY is reachable. The D4 combination table (432 cases) passes.
- **Judgements as versioned inputs:** dated, versioned, append-only rows; they feed the run's judgement fingerprint, so recording one produces a new stored output (tested end to end).
- **Ruling-C dead code removed:** growthLicence, flipTest and verdictBlockers plus their tests are gone, as is the CHEAP/FAIR/EXPENSIVE position. The Overview Uncertainty badge no longer relabels TrustStatus; it shows Calvin's level or whether the level matters. The AR1 caveat was already replaced in AR4; nothing remains.
- **Real-app "pending adoption":** MSFT's un-adopted recorded sheet shows `data-state="PENDING ADOPTION"` in the hero and on Evidence (acceptanceGateOnRealRun, analyzerRoutesOnRealRun).
- **AI uncertainty proposal:** price-blind and cited, with digits and verdict words refused, cached per run, and evidence only — never a verdict input.

## Notes (non-blocking)

- **Morningstar check:** VERIFY's Morningstar humility check has no committed evidence. Any record would sit in the PR body, which I cannot see, so this is not a reason for CORRECT.
- **Evaluator changes in the same commit:** several are labelled "reviewed evaluator change". Two are worth a second look:
  - automaticAnalysisOnRealRun and step4FinalRealRunProof now derive the expected state from the result's own reason text (PENDING ADOPTION vs CANNOT BOUND VALUE, depending on test order);
  - analyzerSurfacesOnRealRun dropped its price-vs-range headline assertion.

  Neither weakens a BUY/HOLD/SELL guard.
- **Migration 013 header** says "one new table and one new nullable column", but it creates two tables (`analyzer_uncertainty_proposals` too).
- **`incompleteVerdictExplanation`'s last fallback** now always blames the ±0.5pp check, including for a result stored before the check existed.
