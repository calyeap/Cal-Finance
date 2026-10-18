# Leg 2 task contracts (drafts; each is posted only when its turn comes)

Shared preamble for every contract:
- **Authority:** Calvin's GO (18 Oct 2026) for KAIZEN Proof Leg 2.
- **Source of the defect:** found by the Leg-1 independent replay.
- **Status:** re-verified present on master `a2e9ae2`.
- **Method:** reproduce first (RED), then fix (GREEN). If it does not reproduce on current master, stop with the evidence; that is a valid outcome.

---

## O1: CF-LEG2-PREAR4-REPORT-CRASH-01 (TIER: NORMAL), arm A

**Title:** `[AI BUILD] CF-LEG2-PREAR4-REPORT-CRASH-01 — stored pre-AR4 outputs crash the report`

**OUTCOME:** a run output stored before AR4 renders without crashing.

**Evidence**
- `app/components/AnalyzerReport.tsx:767` renders `r={pct(c.rate)}`. AR4 changed `RonicLadderCell.rate` to `Decimal`.
- `fromStorable` revives only values tagged `__decimal__`. An output stored before AR4 therefore brings back `rate: 0.08` as a plain number.
- `pct` then throws `TypeError: value.mul is not a function`.
- Every saved version (the snapshot page) and the stored output of any existing run (the Financials tab) are read exactly as stored, never recomputed. Both paths crash for an output stored before AR4.

**DO**
1. Add a RED test that renders a pre-AR4-shaped stored result (JSON passed through `fromStorable`) through `AnalyzerReport`. It must fail today with this TypeError.
2. Make the smallest fix so that shape renders correctly.
3. Check the other surfaces that read stored outputs (`AnalyzerOverview`, `QuickRead`, `deriveVerdict`, `ai/slots.ts`, `briefAcceptance.ts`) against the same old shape.
   - Fix only a crash or a wrong render.
   - List any degraded but honest state in the PR.

**VERIFY**
- The RED test turns GREEN for the reported reason.
- The same old-shape fixture passes through every surface listed in DO 3.
- `npx tsc --noEmit` is clean.
- `npm test` is green on the exact head.

**DO NOT**
- Do not change valuation outputs, AR4 rules, the storage format of new outputs, or migrations.
- Do not touch PR #466.

**DONE WHEN:** one PR, with CI green on the exact head and independent REVIEW ACCEPT, is merged. **Recovery:** revert.

**ESCALATE ONLY IF:** fixing it requires changing what an existing stored output means.

---

## O2: CF-LEG2-RATE-DOMAIN-COPY-01 (TIER: NORMAL), arm B

**Title:** `[AI BUILD] CF-LEG2-RATE-DOMAIN-COPY-01 — "outside validated domain" sentence shown when leverage was never measured`

**OUTCOME:** the discount-rate domain statement is true in every leverage state.

**Evidence**
- `lib/analyzer/assemble.ts:459` passes `leveragePass: leverage.result === "PASS"`, and `lib/analyzer/discountRate.ts:70` sets `withinValidatedDomain: inputs.leveragePass`.
- So when leverage cannot be measured (`LEVERAGE UNSUPPORTED IN v1`, `netDebtRatio: null`), the result is `false`.
- Two sites then print "Outside its validated domain: net debt is not below 10% of enterprise value.": `app/components/AnalyzerReport.tsx:456` and `lib/analyzer/trustCopy.ts:315`.
- NVDA's real run is one such case: its leverage is unmeasured, yet its filings show net cash.

**DO**
1. RED test: on a run whose leverage is unmeasured, the report and the trust copy currently state the false sentence.
2. Make the domain state three-way: measured PASS, measured ≥10%, or not measured.
   - Keep today's sentence only when the ratio was measured at 10% or more.
   - Otherwise state plainly that net debt could not be measured, so the domain is unknown.
   - Update `types.ts`, both copy sites and any consumers.
3. Add tests for all three states.

**VERIFY**
- RED turns GREEN.
- PASS shows no sentence, measured ≥10% shows today's sentence, and unmeasured shows the unknown-domain sentence.
- `tsc` is clean; `npm test` is green.

**DO NOT**
- Do not change rate selection, D1 values, the leverage computation or any number.
- Do not touch PR #466.

**DONE WHEN:** as O1. **Recovery:** revert.

**ESCALATE ONLY IF:** the wording needs a methodology decision rather than a factual statement.

---

## O3: CF-LEG2-DECIDED-FACT-GATING-01 (TIER: HEAVY), arm B

**Title:** `[AI BUILD] CF-LEG2-DECIDED-FACT-GATING-01 — a contradicted price fact does not gate what depends on it`

**OUTCOME:** AR3 DO 2 holds on the real path: "a contradicted fact blocks every output that depends on it."

**Evidence**
- `lib/analyzer/acquisition/companyInputs.ts:414` and `:466` build `price` with `provenance: CLEAN_PROVENANCE`, whatever the run's decided `price` fact says.
- On 17 Oct (AR3 head `cea1b49`), two independent reviewers reproduced the result: on a real MSFT run, deciding `price` NOT CONFIRMED / CONTRADICTED BY SOURCE left EV, the fair-value range, every reverse-DCF cell and the verdict unchanged.
- The same was true of `current-operating-margin`, through `reverseDcf.ts`'s margin-level list. AR4 has since rewritten that file, so the margin half needs re-checking.

**DO**
1. RED: a DB-backed real-run test (offline captures, test DB) that decides each queued fact (`price`, `current-operating-margin`, and any other queued material fact) NOT CONFIRMED. Assert that its dependents are suppressed and that no verdict is issued.
2. Carry each decided fact's provenance into every input built from it, using the existing `decideFacts`/`raw()` and `combineProvenance` seams.
3. Show that an all-CONFIRMED run's outputs are byte-identical to today's.

**VERIFY**
- RED turns GREEN for the reported reason.
- The unaffected outputs (cascade) stay computed.
- The all-confirmed run is unchanged.
- The AR2 harness is green.
- `tsc` is clean; `npm test` is green.

**DO NOT**
- Do not change approved rule values, timing, D1–D4, thresholds or the meaning of a fact state.
- Do not change migrations.
- Do not touch PR #466.

**DONE WHEN:** one PR; HEAVY independent REVIEW ACCEPT on the exact head with CI green; merged. **Recovery:** revert; no data is written.

**ESCALATE ONLY IF:** deciding which outputs depend on a fact needs a methodology choice the contract does not settle.

---

## O4: CF-LEG2-PINNED-REOPEN-01 (TIER: HEAVY), arm A

**Title:** `[AI BUILD] CF-LEG2-PINNED-REOPEN-01 — reopening a pinned run ignores the pin and calls the model`

**OUTCOME:** a run whose analyst inputs are pinned reopens from its pin, without a model call, offline or online.

**Evidence**
- `lib/analyzer/gate.ts:375` calls `loadGateState` → `isSupportedTicker(run.ticker)`, and at `:69-70` that calls `analystInputsFor(ticker)` *without* the runId. It therefore skips the run's pin.
- After the 15-minute cache expires, or after a restart, every reopen calls the AI proposal again.
- If that call returns nothing (offline, no key, refusal), the reopen throws `RunNotFoundError` although the pin exists.
- Reproduced on 14 Oct (head `15866a5`) by two independent reviewers; the code is unchanged on master.

**DO**
1. RED: a pinned run, on a ticker with no committed or recorded bundle, opens through `loadGateState` offline. The AI resolver must not be called. This fails today.
2. Make the support check run-aware: pass `runId`, or resolve the bundle once.
3. Keep "no bundle at all" failing closed.

**VERIFY**
- RED turns GREEN.
- A run with no pin and no bundle still fails closed.
- Existing pinning tests stay green.
- `tsc` is clean; `npm test` is green.

**DO NOT**
- Do not change what gets pinned, the cache, the AI proposal or any valuation.
- Do not touch PR #466. It also edits `gate.ts`; leave its rebase to its own flow.

**DONE WHEN:** as O3. **Recovery:** revert.

**ESCALATE ONLY IF:** a pinned run should legitimately become unopenable in some state.

---

## O5: CF-LEG2-KO-GOLDEN-DEBT-01 (TIER: HEAVY), arm A

**Title:** `[AI BUILD] CF-LEG2-KO-GOLDEN-DEBT-01 — KO golden total debt omits $1.551B of loans and notes payable`

**OUTCOME:** every golden company's total debt follows one stated definition and matches its presented balance sheet.

**Evidence** (KO FY2025 10-K, accession `0001628280-26-010047`, SEC companyfacts, 2025-12-31)
- `NotesAndLoansPayable`: 1,551,000,000. Commercial paper (1,495,000,000) sits inside this line.
- `LongTermDebtAndCapitalLeaseObligationsCurrent`: 1,822,000,000.
- `LongTermDebtAndCapitalLeaseObligations`: 42,119,000,000.
- Presented total: **45,492,000,000.**
- `lib/analyzer/golden/ko.json` `facts.totalDebt` = 43,941,000,000 (`LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities`). It leaves out the short-term loans and notes.
- NUE and LLY include short-term borrowings, so the definitions are inconsistent.

**DO**
1. This is an evaluator change: golden data. Call it out in the PR as a separate, consequential change.
2. Correct KO's golden total debt to the presented-balance-sheet total, with its accession number and line labels.
3. Add one golden invariant: for every golden company, total debt equals the sum of its presented debt lines under one written definition (short-term borrowings + current maturities + long-term debt + separately-presented finance leases, as the engine's debt concept defines them).
4. Report whether the engine's own KO total debt on the pinned capture includes the $1.551B.
   - If it does not, and the fix is a tag inside the existing approved debt concept (the short-term borrowings family), fix it here with a RED test.
   - Otherwise stop and report.

**VERIFY**
- The new invariant is RED on today's KO golden value and GREEN after the fix.
- Every other golden company passes, or any differences are explained.
- The AR2 harness is green.
- `tsc` is clean; `npm test` is green.

**DO NOT**
- Do not change other golden values without the same presented-statement evidence.
- Do not change the D1–D4 rules, the bridge policy (#467 Option B) or NVDA's finance-lease state.
- Do not touch PR #466.

**DONE WHEN:** as O3. **Recovery:** revert; it is data in the repo only.

**ESCALATE ONLY IF:** the debt definition itself needs a methodology decision.

---

## O6: the next roadmap outcome Calvin releases, arm B

Its contract is Calvin's or OWNER's, unchanged.
