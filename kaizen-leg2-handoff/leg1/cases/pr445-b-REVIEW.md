CORRECT: The new SELL rests on price ÷ Base alone, ignoring Ruling C's growth licence. The verdict-first hero shows a bare "SELL … Unavailable — see Evidence" because the forbidden-text evaluator was loosened. The HOLD branch issues HOLD even though no thesis-invalidation judgement is recorded.

Review of PR head e5e95a6 (issue #444, CF-ANALYZER-STAGE3-VERDICT-FINISH-01, HEAVY).
Checks run: `npx tsc --noEmit` is clean. All 16 changed or new test files: 226 of 227 pass. The one failure is the verdict.ts sha256 pin in `m9RealCompanyValidationGuards.test.ts`. It is environment-only: the CRLF checkout gives a different hash, while `git show HEAD:lib/analyzer/verdict.ts | sha256sum` = 3221c6ac…, which matches the pin. I also ran a throwaway repro test on the real MSFT path (pr445b_test DB), file kept at `work-b/zzzReviewRepro.test.tsx` and removed from repo-b afterwards.

## Findings

### F1 — The evaluator was loosened so the PR's own output passes, and the verdict-first hero now gives no cause (material)
- **Where:**
  - `lib/analyzer/overviewCopy.ts:221`: the pattern `/see Evidence/i` became `/(?<!Unavailable — )see Evidence/i`.
  - `lib/analyzer/overviewCopy.test.ts:129`: the base row `["Unavailable — see Evidence", '"see Evidence" placeholder']` (that exact string was pinned as forbidden) was swapped for a different string. A new test now asserts that the string is allowed.
  - `app/components/nonOperatingJudgmentRecordedOnRealRun.test.tsx`: the assertion `expect(hero.textContent).toContain(headline)` was deleted.
  - `app/analyzer/acceptanceGateOnRealRun.test.tsx`: now asserts the hero contains "Unavailable — see Evidence".
- **Root cause:** A completed verdict goes through `DominantVerdictSlot.tsx:109`, which renders `REASON_UNAVAILABLE_MARKER` outside Evidence. Before this PR that path never ran on real data. When it did, it tripped the forbidden list, so the PR relaxed the list instead of supplying a plain-English rationale.
  - The PR justifies this by calling CALVIN RULING — A (comment 5933170464) "later". But the forbidden list's own header cites ruling comment 5952716764, which has a higher ID, so it is the later one. It lists "see Evidence" placeholders as forbidden. `AnalyzerOverview.tsx:151/234` also records the 7 Oct Option 1 decision ("no 'see Evidence' placeholder") and a review correction that removed a redirect to Evidence as forbidden.
- **Reproduction:** the real MSFT run (createRun → advanceRunAutomatically → AnalyzerPage, tab=overview) renders this hero text:
  `"SELLEvidence behind this analysis: partial.Unavailable — see Evidence"`.
  - The head-version `overviewTextViolations(hero)` returns `[]`.
  - The base pattern `/see Evidence/i` matches the same text, so it would be flagged.
  - The plain-English price-vs-range headline that the hero used to show ("Trading at or above the bull case…") no longer appears.
  - The verdict-first surface therefore shows SELL with no cause and no "strongest reason not to act". The contract requires both (DO 4, DO 5; product-decisions item 5).
- **Smallest fix:**
  1. Revert the regex and the test row.
  2. Pass DominantVerdictSlot a plain-English completed-verdict sentence for non-Evidence tabs, built the same way `incompleteExplanation` is. Example: "Price $499.70 is 1.76× the base-case value $283.31 — above the sell level at every uncertainty level." It must contain no §, raw codes or Evidence redirect.
  3. Keep the verbatim reason on Evidence.
  4. Restore a test asserting that the hero contains that sentence.

### F2 — BUY/HOLD/SELL comes from one diagnostic (price ÷ Base); Ruling C's built growth licence is ignored, and the reconciliation leaves out later contrary authority (material)
- **Where:**
  - `lib/analyzer/verdictSynthesisV1.ts:61`: `synthesizeVerdictV1(price: Decimal, base: Decimal)` is the only input to the outcome once the gates pass (`verdict.ts:124`).
  - `docs/proof/cf-analyzer-stage3-verdict-finish-01.md` §1.
  - `lib/analyzer/policy.ts:74-84`.
- **Root cause:** The PR declares the Methodology's V1 bands and Ruling C to be "two independent, non-conflicting mechanisms" and implements only V1. It reconciles neither of the following:
  - **The single-diagnostic boundary** (18 Sep ruling, still quoted at `verdict.ts:8-14`): "A fair-value range or any other single diagnostic must not by itself determine BUY / HOLD / SELL." The contract says the same: a label from "price/range alone is also NOT completion".
    - Ruling C keeps "no price-location-alone verdict". `docs/verdict-methodology-reconciliation.md` §10.2 shows that the one comparison passes the 18 Sep test only because Step 2's growth licence decides which value is compared.
    - Because the PR resolves the uncertainty bucket by invariance, the bucket drops out. For SELL and HOLD the answer is then a pure function of price ÷ Base.
  - **Later authority the proof never mentions:**
    - `CALVIN RULING — Choose B` (#211, 22 Sep, after the V1 text): "no new bands/cut-points".
    - Ruling C: "no new numeric threshold".
    - Frozen §10.6.2 as amended: "Bands are policy constants … marked PROVISIONAL with what they were calibrated on". The PR marks the bands explicitly *not* PROVISIONAL.
    - `docs/product-decisions.md` item 25 (26 Sep): verdict completion deferred "rather than inventing … CHEAP/FAIR/EXPENSIVE policy bands", with §11 items 1–7 parked.
    - `docs/decision-packs/cf-analyzer-final-method-decision-01.md` §4 lists these conflicts explicitly.
    - Under `AGENTS.md` "If authorities conflict" and the contract ("Reconcile this precisely before changing behaviour"; "Reuse DCF evidence, Ruling C and valid V1 policy"), these had to be reconciled or surfaced, not left out.
  - **Result:** the AnalysisResult now contradicts itself.
- **Reproduction** (real MSFT run, head):
  - `verdict = SELL`.
  - `result.growthLicence = {"status":"YES", … "RONIC (17.7164%) exceeds every rate …"}`. It is computed (`assemble.ts:1306`) and never read by `deriveVerdict`.
  - `result.verdictBlockers` still contains `{"step":"Step 4/5","kind":"OPEN POLICY","cause":"… Step 5's numeric band/cut-point (§11 item 5) remains a separate open decision. Disagreement or absence here is never resolved to a default verdict."}`, plus a Step 3 OPEN POLICY entry.
  - Pure-function check: `synthesizeVerdictV1(100,100)` = HOLD, `(146,100)` = SELL. No other company fact reaches the result.
- **Smallest fix:**
  1. Route V1 through Ruling C's built Step 2. Compare price against Base only when `result.growthLicence.status === "YES"`. For NO or UNKNOWN, return INCOMPLETE naming §11 item 3 (no conservative-value model), or apply `evaluateFlipTest` once one exists.
  2. Make `verdictBlockers` agree with whatever `deriveVerdict` now does.
  3. Rewrite proof §1 to address #211 Choose B, Ruling C's "no new numeric threshold" and "PROVISIONAL" clauses, and product-decisions item 25.
  4. If treating the V1 bands as filling Ruling C Step 4/5 (§11 items 1/5) cannot be shown from existing authority, surface that as the single consolidated CALVIN REQUIRED question (DONE WHEN B) rather than shipping the label.
  - MSFT impact of the fix: none on the headline. Its growth licence is YES, and 1.7638× clears 1.45×, so it stays SELL.

### F3 — HOLD is issued even though the thesis-invalidation judgement has no mechanism (material, latent)
- **Where:** `verdictSynthesisV1.ts:106-118` (the HOLD branch).
- **Root cause:**
  - The Methodology's HOLD rule as the PR quotes it is "HOLD … unless thesis invalidation requires SELL".
  - The PR's own BUY comment says thesis invalidation has "no product mechanism on AnalysisResult today". `lib/analyzer/ai/challengerPayload.ts:42` agrees: "there is no thesis field on a run".
  - So "no thesis-invalidation signal exists on this run" is true by construction. The HOLD is not invariant to an unrecorded judgement that could turn it into SELL.
  - This breaks the PR's own invariance rule. The equivalent unrecorded judgement on the BUY side (the quality bar) correctly yields INCOMPLETE.
  - It also conflicts with the 18 Sep ruling: "do not manufacture HOLD".
- **Reproduction:**
  - `synthesizeVerdictV1(100,100)` and `(119,100)` both return HOLD.
  - `snapshotComparison.test.ts` now asserts `deriveVerdict(a).status === "HOLD"` on a fixture at a ratio of 1.0002×.
  - No real company reaches this zone today (MSFT is SELL; NVDA and OKLO are blocked upstream). It ships for the next one that does.
- **Smallest fix:** In the HOLD zone, return INCOMPLETE naming the unrecorded thesis-invalidation judgement, the same way BUY treats its missing quality judgement. Alternatively, include this item in the F2 consolidated question.

### F4 — Price freshness is not shown on the verdict or in the proof (minor, contract item)
- **Where:**
  - `verdictSynthesisV1.ts` reason strings: price with no date. They also print "$499.7".
  - The proof §3 table.
- **Root cause:** The proof SELL uses the offline recorded quote dated `2026-09-04` (`prices.json`; repro: `result.price.timestamp = "2026-09-04"`). That is about six weeks before the issue. DO 4 requires "price freshness" to be shown on eligible paths, and neither the reason nor the proof states it.
- **Magnitude:** The SELL holds for any price ≥ 1.45 × 283.31 = $410.80.
- **Smallest fix:** Put the price date and source in the reason and the proof table, and state that the proof price is an offline capture.

## Independent recomputation
- 499.70 / 283.3138 = **1.7638**, which matches the PR.
- SELL holds down to $410.80 (1.45× Base). The Low-bucket SELL level is $339.97 (1.20×). The BUY boundary at 0.90× is $254.98.
- Price vs Bull: 499.70 / 402.73 = 1.2408× (above Bull). Base, Bear and Bull ($283.31, $214.26, $402.73) match the PR #440 approved figures quoted in the contract.
- The real run (test DB, migration 010 re-applied) confirms trust is PARTIAL and the range kind is "range".

## DONE WHEN / DO table
| Item | Status | Evidence |
|---|---|---|
| DO 1: reconcile approved, implementation-ready and unresolved items precisely | PARTIAL | Proof §1/§2 exist but leave out #211 Choose B, Ruling C's threshold and PROVISIONAL clauses, and product-decisions item 25 (F2) |
| DO 2: propagate proven mechanics, reuse RONIC/growth machinery, fail closed | NOT MET | `growthLicence` (YES for MSFT) is not consumed; `verdictBlockers` contradicts the verdict (F2) |
| DO 3: calibrate only if grounded; surface any genuine policy choice as one CALVIN REQUIRED | PARTIAL | The bucket ambiguity fails closed (`verdictSynthesisV1.ts:126-146`, good). The V1-vs-Ruling C composition and the HOLD exception are chosen silently (F2, F3) |
| DO 4: MSFT real proof on the test DB | MET | `msftStage3VerdictOnRealRun.test.ts` passes through createRun → computeAnalysisForRun with migration 010; numbers recomputed above |
| DO 4: contrasting company / fail-closed cases | PARTIAL | No new contrasting-company verdict test. Existing NVDA (UNUSABLE) and OKLO (pre-revenue) INCOMPLETE tests still pass |
| DO 4: price freshness and strongest reasons against action shown | NOT MET | F1, F4 |
| DO 5: verdict-first surface tells the right truth | NOT MET | The hero is a bare "SELL … Unavailable — see Evidence" (F1) |
| DO 6: one finite HEAVY PR | MET | |
| SAFETY: no docs/frozen, FROZEN_HASHES or Notion edits; test DB only; no claim of Calvin acceptance or local migration | MET | Diff file list; proof header |
| DONE WHEN (A) or (B) | NOT MET | (A) needs a defensible verdict under reconciled approved rules and a correct product surface. (B) needs the consolidated question, which was not surfaced |

## Test integrity notes
- The re-pinned INCOMPLETE→SELL expectations follow from the behaviour change. The new MSFT test would fail on the old code (old code gives INCOMPLETE), so it is a valid RED→GREEN.
- `snapshotComparison.test.ts` dropped its UNUSABLE→INCOMPLETE case from the label/reason test. That is minor; it is covered elsewhere in `verdict.test.ts`.
- The overviewCopy evaluator change is a loosening (F1).

## Nits (not counted)
- The verdict.ts hash guard fails on CRLF checkouts. It also does not pin `verdictSynthesisV1.ts` or the policy bands, which is where the thresholds actually live.
- `briefAcceptance.ts`: `overviewText.includes(verdict.status)` is a bare substring check (for example, "HOLD" could match other uppercase text).
- `money()` renders "$499.7" rather than "$499.70".
