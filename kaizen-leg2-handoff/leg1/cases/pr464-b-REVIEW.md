CORRECT: one reproduced material defect. The new D1 domain line says "net debt is not below 10% of enterprise value" on runs where net debt was never measured. On NVDA's real run, which has net cash, the report states this false fact. Everything else checks out: the engine, Part 4.4, the deletions and the R5 bridge all match my independent recomputation.

Review of PR #464 at 45e78906 (CF-AR4-RATE-REINVESTMENT-TERMINAL-01, HEAVY), checked against issue #452 as written.

## Finding 1 (material): the rate's validated-domain line states a false balance-sheet fact when leverage could not be measured

- **Where:**
  - `lib/analyzer/assemble.ts:449`: `leveragePass: leverage.result === "PASS"`
  - `lib/analyzer/discountRate.ts:70`: `withinValidatedDomain: inputs.leveragePass`
  - `app/components/AnalyzerReport.tsx:456` (ValuationBasisView, Section E): `{!r.withinValidatedDomain && " Outside its validated domain: net debt is not below 10% of enterprise value."}`
  - `lib/analyzer/trustCopy.ts:278` (`rateInUseLine`, shown in the Overview verdict slot): the same sentence.
- **Root cause:** `evaluateLeverage` (gates.ts:166-174) fails closed to `"LEVERAGE UNSUPPORTED IN v1"` with `netDebtRatio: null` whenever a required input is missing. The PR collapses that case and a measured ratio of 10% or more into one boolean. It then prints the measured-ratio explanation for both.
- **Reproduction:**
  - **Data path:** NVDA's real gated run (migration 008 seed, spot-check confirmed, profile confirmed, run through `computeAnalysisForRun`). Probe file written under `lib/analyzer/`, run, then deleted.
    - `gates.leverage = { netDebtRatio: null, result: "LEVERAGE UNSUPPORTED IN v1" }`
    - The EV bridge is INCOMPLETE: missing treasuryMethodDilution, price, financeLeaseLiabilities, nonOperatingEquityInvestmentsAtBook.
    - `valuationBasis.discountRate.withinValidatedDomain = false`
    - `rateInUseLine(...)` returns: "Valued at 11.0% — the market's expected return plus 2pp, for a cyclical business (rate dated 2026-10-17). Outside its validated domain: net debt is not below 10% of enterprise value."
  - **Rendered report:** `<AnalyzerReport>` rendered on that result (jsdom). Section E reads: "Discount rate in use 11.0% — cyclical industry by SEC SIC code 3674 … Dated 2026-10-17; checked at 10.5% and 11.5%. Outside its validated domain: net debt is not below 10% of enterprise value."
  - **Why it is false:** NVDA's own golden facts give total debt $8.468B against cash and equivalents of $10.605B (period ending 2026-01-25). Net debt is negative before marketable securities are even counted. The master plan's D1 evidence also lists every non-bank, NVDA included, as passing the <10% gate.
  - **Wider reach:** the same false sentence appears for any run whose leverage inputs are incomplete, for example MSFT before the §4.4 judgement.
- **Why it is material:** this sentence is new copy introduced by this PR to meet DO 1 ("the dated rate in use is shown … valid only inside the <10% net-debt gate"). On a golden company's real run, the report states something untrue about the balance sheet.
- **Smallest fix:**
  - Carry the unknown case through: make `withinValidatedDomain` `boolean | null`, set to `null` when `leverage.netDebtRatio === null`.
  - Keep the current sentence only when the ratio was measured at 10% or more.
  - Otherwise say, for example: "Net debt could not be measured on this run (missing inputs), so whether the rate is inside its validated domain is not known."
  - Apply the change in both `AnalyzerReport.tsx:456` and `trustCopy.ts:278`.
  - Add a test on NVDA's real run that fails today.

## DONE WHEN / DO table

| Item | Status | Evidence |
|---|---|---|
| AR2 harness GREEN, including exact growth invariance and terminal ÷ year-10 FCF of 0.95–1.10 | MET | See note 1 below. |
| Part 4.4 MSFT table reproduced from the 16 Oct inputs | MET | See note 2 below. |
| Deletions done | MET | See note 3 below. |
| Keep M9, M10, M11, M13 and the comparator | MET | See note 4 below. |
| DO 1: R1 rate (D1) | PARTIAL (Finding 1) | See note 5 below. |
| DO 2: R2 reinvestment | MET | See note 6 below. |
| DO 3: R3 terminal | MET | See note 7 below. |
| DO 4: reverse DCF, expected return, sensitivity | MET | See note 8 below. |
| DO 5: R5 bridge flags | MET | See note 9 below. |
| Inputs before adoption (Option A) | MET | See note 10 below. |
| `npx tsc --noEmit` | MET | Exit 0. |
| `npm test` | MET (environment-only failures) | See note 11 below. |
| DO NOT: no verdict-logic change, no rule value beyond D1/D2 | MET | See note 12 below. |

Notes to the table:

1. **AR2 harness.**
   - `golden/valuationInvariants.test.ts` and `golden/knownReds.test.ts` pass.
   - The RONIC = r invariant was restated as EV = NOPAT₁ ÷ r × (1 + r)^0.5 exactly, with paths that share year 1 valuing identically. Contract DO 2's "NOPAT × next-year growth ÷ RONIC" forces this restatement: under that timing, year-1 growth is funded by base-year investment.
   - My oracle confirms the handoff's reference values. The coherent rule gives $1,411B at 5% growth and $1,680B at 25%. With year-1 growth funded, EV is a flat $1,344B at 0 / 5 / 14 / 25% growth. So the restatement is the same invariant, not a loosening.
   - Terminal ÷ year-10 FCF is exactly 1.03.
2. **Part 4.4.**
   - `golden/ar4Engine.test.ts` passes.
   - My own Python oracle (`work-b/oracle.py`) reproduces all 13 Part 4.4 figures: rate table $411.3 / $377.6 / $348.4 / $300.7; moat lever $335 / $348 / $373 / $389 / $411; RONIC lever $283 / $329 / $348 / $374.
   - It also reproduces the reverse DCF (24.07% at 9%, 21.93% at 8.5%) and the expected return (~7.1%).
   - This only works with the PR's RONIC fade (constant in years 1–5, linear fade over years 6–10). A straight-line fade from year 1 gives $332 at 9%, not $348.
3. **Deletions.**
   - `rateGrid`, `terminalRoicPremium`, `step4DispersionTier*` and `selectStep4ForecastDispersionReading`, the 9-cell grid types and UI, `CompanyFixture.terminalValuePv` and `buildFadingReinvestmentIntensityPath` are all gone.
   - A grep finds no leftover in non-test code.
4. **Kept modules.**
   - M9 is now computed from the base valuation's own terminal value ÷ year-10 EBIT. I recomputed 9.7335× on the MSFT run.
   - M10 (assemble.ts:608), M11 and M13 are unchanged.
   - The required-versus-achieved comparator now reads the one solve (`calibration/inputs.ts`).
5. **DO 1, rate.**
   - `policy.ts`: a dated table (2026-10-17, 9% / 11%), provenance including the measurement convention, and the ±0.5pp check points.
   - `discountRate.ts`: MSFT, COST, KO and LLY come out stable at 9%; NVDA and NUE cyclical at 11%; OKLO pre-revenue at 11%. Growth alone does not raise the rate.
   - The rate is shown in Section E and in the verdict slot. The domain copy is wrong (Finding 1).
6. **DO 2, reinvestment.** `scenarioOutputs.ts` and `growthPath.ts` `buildRonicPath` implement it. M7 and M15 are one function.
7. **DO 3, terminal.** `terminalReturnOnNewCapital`: bear = r; base = r + 0 / 1 / 3pp; bull = base + 1.5pp; no moat input = r.
8. **DO 4, reverse DCF, expected return and sensitivity.**
   - `solveReverseDcf` runs once on `computeScenarioValuation`. The expected return is `rateAtWhichBaseEqualsPrice` on the engine.
   - The tornado rows (rate ±0.5pp, RONIC, moat, growth, margin) recompute exactly. See the verification section below.
9. **DO 5, bridge flags.**
   - `enterpriseValue.ts` handles minorities and preferred stock (added only where tagged at the bridge date, otherwise flagged), convertibles (shown as inside total debt), stakes at book with fair value shown separately, and contingent items listed rather than deducted.
   - LLY's leases are counted once through a cited disclosure record (`tagMap.ts`). Tests use LLY and KO golden facts.
10. **Inputs before adoption.**
    - `migrations/012` adds a nullable `moat_class` column with no rows written. `returnOnNewInvestment` lives in the scenarios JSONB.
    - Recorded MSFT and NVDA sheets resolve to PENDING ADOPTION with plain-language copy (`overviewCopy.ts`, `QuickRead.tsx`, `ValuationBasisView`). I confirmed this on the real MSFT run.
    - Stated test inputs live only in `fixtures/statedD2Inputs.ts` and test code.
11. **`npm test`.**
    - 2590 passed and 2 failed out of 2592. Both failures are Windows-environment only and not from this PR.
    - `m9RealCompanyValidationGuards` hashes `verdict.ts` with CRLF line endings. With `tr -d '\r'` the hash is the expected `3221c6ac…`, and the PR does not touch `verdict.ts`.
    - `nvdaAnalystDraftValidation` fails because its allowlist uses forward slashes while the walk returns backslash paths.
12. **DO NOT.**
    - `verdict.ts`, `verdictSynthesisV1.ts` and `verdictBlockers.ts` are untouched.
    - The growth licence now reads the one-cell RONIC ladder at the D1 rate. AR0-2 mandates this ("per-cell evaluation reads as that single solve").
    - The only new constants are plumbing bounds: the solver bracket and the expected-return search floor of terminal growth + 0.25pp.

## Independent verification performed

- **Real MSFT gated run with the stated D2 inputs** (probe written under `lib/analyzer/`, run, then deleted). The engine's numbers match my oracle (`work-b/probe_check.py`) to at least 6 decimals:
  - Bear / base / bull: $226.725071 / $345.020142 / $503.888399.
  - Terminal share 0.697182.
  - Implied growth 22.9518% at 9%.
  - Expected return 7.3226%.
  - Implied exit multiple 9.7335×.
  - Tornado rate row $2,780.28B / $2,563.94B / $2,375.37B.
  - Moat row $2,466.08B / $2,563.94B / $2,712.85B.
  - RONIC row $2,294.17B / $2,563.94B / $2,654.30B.
- **Units and bridge.** The net-cash bridge of −$6.303B matches the planning record.
- **Repo state.** The working tree was restored with `git checkout -- .`. The suite run had rewritten the line endings of one snapshot file.

## Nits (not counted)

1. **`discountRate.ts:35`.** The comment says that for a date before every row "else the earliest", but the code returns the *latest* row. This is harmless with one row. Once a second dated row exists, an older run would pick the newer rate.
2. **`ai/slots.ts:247` and `acceptance/briefAcceptance.ts:387` assume `priceImplied.reverseDcf` exists.** The UI guards pre-AR4 stored snapshots, but these two do not. A pre-AR4 stored output with no stored AI outputs and AI configured would make `generateOnce` throw. It is caught, so the AI layer reports FAILED rather than running.
3. **`AnalystBundleForm` and `app/actions/analystInputs.ts` have no return-on-new-investment or moat fields.** `recordedBundles.ts:210` upserts `moat_class = EXCLUDED.moat_class` and rewrites the scenarios JSONB. Re-saving the form would therefore null any D2 inputs recorded by another route. This is latent today because no writer exists, and AR6 owns adoption. Worth carrying forward.
4. **The "independent oracle" in `ar4Engine.test.ts` shares the engine's fade-shape choices.** Its "different algebraic route" (ΔNOPAT ÷ RONIC) is identical to NOPAT × g ÷ RONIC whenever margin is constant. My separately written oracle agrees, so this is a robustness note, not a defect.
5. **The pinned SEC captures were trimmed to the pre-AR4 tag map.** So the new R5 tags (UnrecognizedTaxBenefits, MinorityInterest, …) are never exercised on a captured real run; MSFT's run lists no contingent items. R5 evidence comes from the AR2 golden JSON (LLY, KO) and synthetic inputs.
