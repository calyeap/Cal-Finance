CORRECT: head 72a0206 — the harness runs in CI, but four things are short of the contract. (1) It encodes only one of the eight named REDs, and its terminal÷FCF RED would not flip when the engine is fixed. (2) The test-transition list skips 84 of the 208 existing test files and marks at least 6 files that pin MSFT fair values as "keep". (3) KO's golden total debt leaves out $1.551B of presented loans and notes payable. (4) D1 was not checked on any company outside the eight-company golden set. Smallest fix: items A–E below, in this PR.

Reviewed: exact head 72a0206de699634f2a0f1899b926ffbee0832348 (repo-a), pr.diff, contract #450 (TIER: HEAVY, kept as written).

## What holds (decisive positive evidence)
- `npx vitest run lib/analyzer/golden`: 3 files, 69 tests pass. `npx tsc --noEmit`: no errors. Only new files under `lib/analyzer/golden/` and `docs/superpowers/plans/` were added. No engine change, and no existing test was edited or loosened. The new files are picked up by the default `vitest run` glob, so they run under `npm test`. I did not re-run the full ~2400-test suite: nothing existing was touched.
- **Blind re-capture of two companies from the statements as presented** (www.sec.gov R-pages, which this reviewer could reach). I captured these before opening `cost.json` and `nue.json`:
  - COST FY2026 (10-K, accession 0000909832-26-000093) matches exactly: revenue 303,154; operating income 11,685; pretax income 12,251; tax 3,025; net income 9,226; diluted shares 444,427k; cash 20,207; debt 2,248 + 3,914 = 6,162 ($M).
  - NUE FY2025 (10-K, accession 0001193125-26-071575) matches exactly: net sales 32,494; pretax income 2,568; tax 530; net income attributable 1,744; cash 2,260; debt 122 + 90 + 6,909 = 7,121. No operating-income line is presented, which agrees with the PR's null plus note.
- The Gordon-equivalence `it.fails` is a real RED that tracks the engine. I applied a probe in a scratch edit (`terminalRoic = ronic` in `reverseDcf.ts:346`) and that test flipped to failing, as the contract intends. The scratch edit has been reverted.
- LLY has no `us-gaap:FinanceLease*` tag (checked against live companyfacts). The PR flagged this honestly.

## Findings

### A. RED list does not match the contract (DO 3 / DONE WHEN "RED list matches the defects above")
- **Where:** `lib/analyzer/golden/valuationInvariants.test.ts`; `ar2-golden-harness-pr-draft.md` §"Issue's own named RED list".
- **Root cause:** Of the eight named REDs, only "RONIC = r growth-invariance fails" is encoded as an expected failure. The other seven are left as prose: profile band not applied; end-of-year timing with no stub; terminal share never computed; unconfirmed facts used; runs not reproducible; non-MSFT tickers use the reverse-DCF-only r+3pp terminal; reinvestment unlinked to growth. The draft says outright that they were "not independently investigated". The reproducibility test only shows that a pure Decimal function returns the same value twice. That passes trivially and does not test the named "snapshot + sheet version + policy version + code SHA" run-level property.
- **Evidence:** grep of the file: there are three `it.fails` tests (Gordon, RONIC=r, terminal÷FCF at 8%), and none targets the other seven.
- **Smallest fix:** For each of the seven, add one `it.fails` written as the desired assertion against the real code path that owns the defect: assemble/gates/scenario path, run store, recorded runs. Each must fail for its stated reason. Where a RED really cannot be reached without an engine change, say so per item with file:line. Do not leave it uninvestigated.

### B. The terminal ÷ year-10 FCF invariant re-implements the formula and cannot detect a fix
- **Where:** `valuationInvariants.test.ts`, `terminalToYear10FcfRatio`.
- **Root cause:** The helper recomputes `fcff10`, `terminalRoic = rate + POLICY.terminalRoicPremium` and `terminalFcf` inside the test. It takes only `year10Revenue` from the engine. So the ratio is independent of the engine, which contradicts the file header ("never a second, re-implemented copy of the formula").
- **Reproduction:** With the scratch fix `terminalRoic = ronic`, the Gordon `it.fails` flips to failing, but the "rate=8%" `it.fails` still passes (verbose run: 1 failed / 9 passed). This RED would never flip when AR3/AR4 fixes the terminal. The check also runs only on MSFT, with RONIC 0.178 and margin 0.468 reused from the existing fixture, not taken from golden facts.
- **Smallest fix:** Derive terminal FCF and year-10 FCF from the engine's own output, for example from `terminalValuePV × (1+r)^10 × (r − g)`. Do not recompute them in the test. Then extend the check to every golden company the engine values, or record per company why it cannot be valued.

### C. Test-transition list incomplete and misclassified (DO 4 "classify every existing test")
- **Where:** `docs/superpowers/plans/ar2-golden-harness-test-transition.md`.
- **Root cause:** Only 124 files are classified, all under `lib/analyzer/**` and `scripts/evidence/**`. The repo tracks 208 pre-existing test files, so 84 are unclassified. Of those, 25 are analyzer-related, for example:
  - `app/analyzer/*OnRealRun.test.tsx`
  - `app/components/Analyzer*.test.tsx`
  - `app/components/analyzerSurfacesOnRealRun.test.tsx`
  - `app/actions/analyzer.test.ts`
  - `scripts/analyzer/resolveNonOperatingSelection.test.ts`
  
  Most of the 124 rows carry a boilerplate reason ("see file for specifics"). Several rows marked "encodes a ruling — keep … not a solved valuation number" do pin solved outputs:
  - `msftStage3VerdictOnRealRun.test.ts:89-91` (bear 214.26 / bull 402.73 / base 283.31)
  - `nonOperatingJudgmentRecordedOnRealRun.test.ts:115-118`
  - `acquisition/msftStage2DurableBundleSeed.test.ts:177-179`
  - `step4SignalObservationOnRealRun.test.ts:237-239` (28.08 / 102.38 / 296.44)
  - `step4FinalRealRunProof.test.ts:196-213` and `msftSensitivityCaptureOnRealRun.test.ts:84-92` (solved `fullRangeValueImpact` strings)
  - probably `modules/sensitivity.test.ts:408-440` too
- **Why it matters:** AR3/AR4 value changes will break these "keep" tests. That invites the very loosening that BOUNDARIES forbids.
- **Smallest fix:** Classify all 208 files. Give each row a reason specific to that file, and reclassify every file that pins a solved valuation output as "pins an output". Reproduction used `git ls-files '*.test.ts*'` compared with the table, plus a grep for `fairValueRange|scenarioOutputs.values|fullRangeValueImpact … toBe/toFixed`.

### D. KO's golden total debt leaves out a presented debt line; facts were not captured from the presented statements (DO 1, DO 6)
- **Where:** `lib/analyzer/golden/ko.json` `facts.totalDebt` = 43,941,000,000.
- **Root cause:** The value was captured from XBRL tags (`LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities`), not from the presented balance sheet.
- **Evidence:** KO's FY2025 consolidated balance sheet (accession 0001628280-26-010047, R3) presents:
  - Loans and notes payable: 1,551
  - Current maturities of long-term debt: 1,822
  - Long-term debt: 42,119
  
  That totals 45,492, so the golden figure misses $1.551B. The line moved to the live tag `us-gaap:NotesAndLoansPayable`. The JSON's note instead declares short-term borrowings "dead", so the harness fell into the same tag-drift trap it exists to catch. It is also inconsistent with `nue.json`, which includes short-term debt, and with the engine's own debt concept (`tagMap.ts:191-197` includes CommercialPaper/ShortTermBorrowings). KO is the set's leverage-gate company.
- **Smallest fix:**
  - Re-capture every golden fact from the presented statements: line label, accession number, and the R-page / statement name as the page reference. The sandbox block was the builder's environment, and the source is reachable.
  - Correct KO total debt to 45,492 (or document the scope explicitly).
  - Add a check that the golden debt components sum to the presented balance-sheet lines.
  - Optionally run `detectTagDrift` against a raw capture across the debt concept family, so a moved line fails loudly.

### E. D1 classification not validated on a wider set; the escalation is not a closed question (DO 5, ESCALATE)
- **Where:** `lib/analyzer/golden/cyclicalSic.ts`; draft §"CALVIN REQUIRED".
- **Root cause:** Validation stops at the eight golden companies. Running the PR's own `classifyCyclicality` on live SEC SICs shows that the "28 excluding 283" rule labels household and personal-care staples as cyclical:
  - PG 2840, CHD 2840, ECL 2840, CLX 2842, CL 2844, EL 2844 → "cyclical"
  - The rule correctly gives F/GM 3711, INTC/AMD 3674, STLD 3312, DOW 2821, LYB 2860 → cyclical, and PFE 2834 → stable.
  - The "367" prefix also sweeps in APH 3678 (connectors).
  
  The PR's escalation asks an open question ("which other industries…?"). ESCALATE requires one closed question.
- **Smallest fix:**
  - Add a wider-set validation table (about 20 real SICs, as above) to the PR and assert it in a test.
  - Replace the open question with one closed question, for example: "Does D1's 'chemicals ex-pharma' cyclical class include SIC 284x (soaps, detergents, cosmetics — PG, CL, CLX)? yes / no", plus any further closed question the wider validation shows is needed.
  - Do not invent the answer.

### Notes (not grounds for CORRECT on their own)
- Neither `tagDrift.ts` nor `cyclicalSic.ts` is wired to any real consumer (by design, since there may be no engine change). The drift test runs on transcribed rows only.
- The RONIC=r `it.fails` does not flip under the terminal-only fix. It also depends on year-1 growth being unfunded (NOPAT₁ = NOPAT₀(1+g)). Name both causes so AR3/AR4 knows that both must land before it flips.
- Prices are null for six companies, with honest notes. That is acceptable.

Recovery as stated (plain revert of new files only) is credible. I left no tracked files modified in repo-a; the scratch probe edit was reverted with `git checkout -- .`.
