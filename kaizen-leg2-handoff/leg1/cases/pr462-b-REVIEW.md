CORRECT: The harness runs, but it misses the contract's RED list, golden facts and test-transition items. Several tests cannot fail against the engine, and the KO golden debt figure is understated by $1.551B against the presented balance sheet.

Reviewed: PR head 72a0206 (repo-b) against task contract #450 (HEAVY). Environment: `npx tsc --noEmit` is clean. `npx vitest run lib/analyzer/golden` gives 3 files and 69 tests passing, with TEST_DATABASE_URL set to the throwaway pr462b_test database. repo-b was left clean (`git status` is empty).

## Findings (material)

### F1. The expected RED list does not match the contract. Only 1 of the 8 named REDs is encoded.
- **Where:** `lib/analyzer/golden/valuationInvariants.test.ts`, and the PR draft `docs/superpowers/plans/ar2-golden-harness-pr-draft.md` lines 99-107.
- **What:** DO 3 and DONE WHEN ask for "RED list matches the defects above", with each RED run as an expected failure. The file has exactly three `it.fails`: Gordon equivalence, RONIC = r, and the terminal ratio at 8%. Of the eight named REDs:
  - Only "RONIC = r growth-invariance fails" is encoded.
  - "Runs not reproducible" is asserted **GREEN**, with a plain `it`.
  - "Profile band not applied", "end-of-year timing with no stub", "terminal share never computed" and "unconfirmed facts used" are marked "not independently investigated" and have no test.
  - "Non-MSFT r+3pp" and "reinvestment unlinked to growth" were judged by reading only `reverseDcf.ts`. Both were dismissed or left open, and neither has a test.
- **Root cause:** The builder scoped RED discovery to `reverseDcf.ts` only. The REDs live in the assembly, scenario and M15 paths, which the contract allows the harness to exercise. DO NOT forbids changing the engine, not testing it.
- **Reproduction:** `grep -n "it.fails(" lib/analyzer/golden/*.test.ts` finds 3 calls, none for the six REDs above. The PR draft's own table says "Not independently investigated by this outcome".
- **Smallest fix:** Add one `it.fails` per named RED, each asserting the correct behaviour against the module that has the defect, and confirm each fails for its stated reason:
  - profile band: the assembled discount rate against D1;
  - timing: a mid-year or stub discounting invariant;
  - terminal share: the scenario path's terminal share is present;
  - unconfirmed facts: an acquired run with an unconfirmed fact must not value;
  - reproducibility: two full runs from the same snapshot, sheet version and policy version give identical outputs;
  - non-MSFT r+3pp: an NVDA scenario run against the MSFT path;
  - reinvestment: the M15 scenario reinvestment equals g ÷ RONIC.

### F2. The "terminal ÷ year-10 FCF" invariant is computed by the test, not the engine. It can never flip.
- **Where:** `valuationInvariants.test.ts`, `terminalToYear10FcfRatio`.
- **What:** The test takes only `year10Revenue` from `projectReverseDcfValue`, and that value cancels out. It then re-implements both the terminal FCF (hardcoding `rate + POLICY.terminalRoicPremium`) and the year-10 FCF. The ratio is the closed form (1.03)(1 − 0.03/(r+0.03)) / (1 − 0.03/0.178), which no engine code affects. My own script gives r=8%: 0.9009, 10%: 0.9529, 12%: 0.9910, the same as the PR's numbers.
- **Reproduction:** I temporarily patched `reverseDcf.ts:346` to `const terminalRoic = ronic;`, simulating an AR3 fix of the terminal-ROIC mismatch, and re-ran the file. The Gordon `it.fails` correctly flipped (1 failed). The 8% terminal-ratio `it.fails` still "failed as expected", so the RED stayed red with the defect fixed. The patch was reverted with `git checkout -- .`.
- **Smallest fix:** Derive the terminal FCF from engine output: `terminalValuePV × (1+r)^10 × (r − g_T)`. Compute the year-10 FCF the same way the engine does, or take it from engine output. Then confirm the patched engine flips the 8% case.

### F3. The reproducibility invariant is tautological.
- **Where:** `valuationInvariants.test.ts`, the "same fact snapshot + policy + code" block.
- **What:** The contract's invariant is "same fact snapshot + sheet version + policy version + code SHA → identical outputs". The test calls a pure Decimal function twice with literal arguments, which no plausible defect can make fail. It is also shipped as a GREEN `it`, while the contract names "runs not reproducible" as an expected RED.
- **Smallest fix:** Run two full analyzer runs from the same recorded snapshot (offline mode), compare the persisted outputs, and mark it `it.fails` if it fails today.

### F4. The golden facts never meet the engine, so the OKLO and JPM requirements are asserted on the JSON's own flags.
- **Where:** `lib/analyzer/golden/goldenFacts.test.ts`.
- **What:** The file imports only `./cyclicalSic` and the eight JSON files. No acquisition, assembly or verdict code runs. "OKLO must return 'can't conclude'" is checked as `oklo.classification.preRevenue === true`, and "JPM must be refused" as `jpm.classification.refused === true`. Both values were written by the builder into the same JSON, so neither test can fail on engine behaviour. No golden value is compared with what the analyzer acquires either, so "unconfirmed facts used" and the acquisition gaps have no detector.
- **Reproduction:** See the imports at the top of the file. `grep -rln "golden/" --include=*.ts .` shows that no non-test code and no engine path consumes the golden set.
- **Smallest fix:** For each golden company, run the offline or recorded acquisition and assembly path. Assert that the acquired facts equal the golden facts, that OKLO yields "can't conclude" and that JPM is refused. Use `it.fails` where the engine is wrong today.

### F5. KO's golden `totalDebt` is understated by $1,551M against the presented balance sheet, and `totalDebt` is defined inconsistently across companies.
- **Where:** `lib/analyzer/golden/ko.json`, `facts.totalDebt`, value 43,941,000,000.
- **What:** This review re-captured KO blind from the presented statements. The FY2025 10-K is accession 0001628280-26-010047, and R5.htm is "CONSOLIDATED BALANCE SHEETS". It shows:
  - Loans and notes payable: 1,551
  - Current maturities of long-term debt: 1,822
  - Long-term debt: 42,119
  - Presented total debt: **45,492** ($M)

  The golden value (43,941) is long-term debt including current maturities only, so it drops the short-term loans and notes payable. The other companies use different scopes: NUE's `totalDebt` includes `ShortTermBorrowings`, and LLY uses `DebtLongtermAndShorttermCombinedAmount`. KO is the contract's leverage-gate case, so this understatement matters.
- **Root cause:** The figure was taken from XBRL tags rather than the presented statement. Short-term borrowings were dropped because KO's `ShortTermBorrowings` tag is dead (ko.json notes[0]).
- **Blind re-capture check:** MSFT (10-K 0001193125-26-323660, R2 and R4) matched all 8 golden facts exactly: revenue 331,839; operating income 155,237; pretax 165,934; tax 32,185; net income 133,749; debt 9,227 + 31,067 = 40,294; cash 20,935; diluted shares 7,453. KO's 7 income and cash facts also matched (47,941; 13,762; 15,998; 2,861; 13,107; 10,270; 4,313). Debt was the only mismatch.
- **Smallest fix:** Set KO `totalDebt` to 45,492,000,000 with the three presented line labels. Define `totalDebt` once in the README (short-term borrowings + current maturities + long-term debt, as presented) and re-check every company against it.

### F6. Golden facts are XBRL API values, not captures from the presented statements, and the capture tooling is missing.
- **Where:** All `lib/analyzer/golden/*.json`. `scripts/evidence/golden/*` does not exist (`ls` fails), although it is a contract "Expected file".
- **What:**
  - DO 1 requires each figure to come from the presented financial statements (line label, accession, page). Every fact instead carries an XBRL concept label from `data.sec.gov/companyfacts`, which is the same tag layer the engine reads.
  - Six of the eight captures were "supplied already-fetched … by the orchestrating session", and none is reproducible from committed code.
  - The escalation ("www.sec.gov blocked") describes the builder's sandbox, not "a presented statement cannot support a golden fact". From this review environment, `https://www.sec.gov/...` returned HTTP 200, and the presented statements (R pages) were retrieved and parsed for F5.
- **Smallest fix:** Commit `scripts/evidence/golden/capture.*`. It should fetch each filing's presented statements (R pages or the primary 10-K document) and record the line label, accession and statement/page reference per fact, then regenerate the JSON from that output.

### F7. The test-transition list is incomplete, and it misclassifies known output pins as "keep".
- **Where:** `docs/superpowers/plans/ar2-golden-harness-test-transition.md`.
- **Incomplete:** DO 4 says "Classify every existing test". The repo has 208 pre-existing test files (211 minus the 3 new ones), and the list covers 124. **84 files are unclassified**: all of `app/**` (including 22 analyzer UI and route tests), `lib/ledger`, `lib/marketdata`, `lib/wizard` and `scripts/analyzer/resolveNonOperatingSelection.test.ts`. One unclassified file pins a solved valuation: `app/analyzer/acceptanceGateOnRealRun.test.tsx:281-282` asserts `"Bear$214"` and `"Bull$403"`. (My file comparison is saved as `work-b/unclassified.txt`.)
- **Misclassified as "encodes a ruling — keep":**
  - `lib/analyzer/msftStage3VerdictOnRealRun.test.ts:89-91` pins bear `"214.26"`, bull `"402.73"` and base `"283.31"`.
  - `lib/analyzer/msftSensitivityCaptureOnRealRun.test.ts:84,92` pins `"0.48846512490800969627"` and `"0.24471297471512425894"`.
  - `lib/analyzer/step4FinalRealRunProof.test.ts:196,200,213` and `lib/analyzer/modules/sensitivity.test.ts:408,423` pin `"0.48598121081564411663"`.

  These are solved valuation outputs that AR3 and AR4 will move. The list tells the next milestone to keep them, which invites re-pinning, the outcome the doctrine forbids.
- **Root cause:** Rows were filled from directory-pattern boilerplate ("see file for specifics") rather than by reading each test.
- **Smallest fix:** Classify all 208 files at test level. Mark the pins above (and any others found) as "pins an output → replace with invariant".

### F8. D1 is neither "fixed" as the full list nor validated on a wider set, and the escalation is not a closed question.
- **Where:** `lib/analyzer/golden/cyclicalSic.ts` and PR draft lines 150-163.
- **What:** DO 5 requires validating the table on a wider company set. It was checked only against the eight golden companies. A wider check immediately shows that the `28` minus `283` rule classifies textbook stable staples as cyclical. I took real SICs from `data.sec.gov/submissions` and ran `classifyCyclicality` via `work-b/d1check.ts`:
  - PG (2840): cyclical
  - CL (2844): cyclical
  - EL (2844): cyclical
  - CLX (2842): cyclical

  Once wired in AR4, that means a +2pp rate band for these companies. The PR's CALVIN REQUIRED ("which other industries…?") is an open question, while the contract allows only one closed question. It proposes no list either.
- **Smallest fix:** Run the classifier over a wider real set: several companies per confirmed class, plus near-boundary SICs such as 284x, 285x and 3672-3679. Publish the resulting table. If a ruling is genuinely needed, ask one closed question, e.g. "Is SIC 284x (soaps/cosmetics: PG, CL, CLX, EL) inside 'chemicals ex-pharma' for D1? yes/no".

## DONE WHEN / DO table

| Item | Status | Evidence |
|---|---|---|
| DO 1: golden facts for 8 companies from the presented statements (label, accession, page), without tagMap | PARTIAL | 8 JSON files exist, built from XBRL API values with no page or presented label (F6). KO debt is wrong (F5). LLY finance-lease figure is absent: flagged, no substitute proposed. |
| DO 2: six invariants that can fail | PARTIAL | Zero-growth, Gordon, RONIC=r and round-trip run against the engine. Terminal ratio is disconnected from the engine (F2). Reproducibility is tautological (F3). Terminal ratio covers only MSFT, not "every golden company the engine values". |
| DO 3: known REDs as expected failures | NOT MET | 1 of 8 named REDs encoded (F1). |
| DO 4: classify every existing test | NOT MET | 124 of 208 files covered, with known pins marked "keep" (F7). |
| DO 5: D1 full SIC list plus wider validation | NOT MET | 4 classes, validated only on the golden 8. The wider check finds staples classed cyclical. Open-ended escalation (F8). |
| DO 6: fail loudly on SEC tag drift | PARTIAL | `tagDrift.ts` works on hand-transcribed KO and NVDA rows, but nothing outside its own test calls it (grep), so no acquired data is ever checked. |
| Expected files `scripts/evidence/golden/*` | NOT MET | Absent. |
| Harness in CI (`npm test`) | MET | The default vitest glob picks up `lib/analyzer/golden/*.test.ts`. 69 tests pass locally. |
| RED list matches defects | NOT MET | F1. |
| Test-transition and D1 lists in PR | PARTIAL | Committed, but incomplete or wrong (F7, F8). |
| DO NOT: no engine change; no test loosened or deleted | MET | Only new files under `lib/analyzer/golden/` and `docs/superpowers/plans/`. |
| DO NOT: no evaluator changes | MET | No CI, config or frozen-hash edits. |

## Nits (not counted)
- `tagDrift.ts` takes the `filed` date of the first-sorted row among rows sharing the latest `end`, rather than the latest filing.
- The OKLO "has a real price" assertion in `goldenFacts.test.ts` checks a value the builder copied from `captures/prices.json`.
- The PR draft says "DO item 2" in places where it means DO 5, and "DO item 4" where it means DO 2.
- Process note: one of my `data.sec.gov` submissions requests (for the F8 SIC lookups) was sent with a User-Agent containing the account email. All later requests used a generic UA.
