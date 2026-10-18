CALVIN REQUIRED: At head e5e95a6, should the Methodology's 22 Sep "Verdict synthesis policy v1" (verdict = price ÷ Base scenario value against the BUY ≤0.90/0.80/0.70× and SELL ≥1.20/1.30/1.45× bands) decide BUY/HOLD/SELL on its own, replacing the frozen §10.6.2 Ruling-C path (Step 2 growth licence → Step 3 licensed value → Step 6 flip test) and treating the bands as fixed, non-PROVISIONAL constants? YES = keep this PR's mechanism; it then needs findings 2–3 fixed before it can be accepted. NO = the bands only fill Ruling C's open Step 4/5 zone and are applied to the growth-licensed value; this PR goes back for rework.

Reviewed: PR for issue #444 (CF-ANALYZER-STAGE3-VERDICT-FINISH-01), TIER: HEAVY, at exact head e5e95a65c3ca6d17ca7026505e929c5568d24d65.

## What I verified
- `npx tsc --noEmit` passes. 10 targeted test files (verdict, msftStage3VerdictOnRealRun, overviewCopy, snapshotComparison, snapshotComparisonOnRealRun, automaticAnalysisOnRealRun, step4SignalObservationOnRealRun, m9RealCompanyValidationGuards, acceptanceGateOnRealRun, analyzerSurfacesOnRealRun) were run on a throwaway `*_test` DB after `npm run migrate`: 127 of 128 pass.
  - The one failure is the verdict.ts hash pin. It is caused by the Windows CRLF checkout, not by the PR. With line endings normalised, the file hashes to `3221c6ac…`, the pinned value, so the pin is correct.
- The real MSFT path (createRun → computeAnalysisForRun → deriveVerdict) gives SELL:
  - price $499.70 ÷ Base $283.31 = 1.7638×;
  - bear/bull are $214.26 / $402.73;
  - trust is PARTIAL.
  - The arithmetic and the band edges are correct. Exactly 0.90, 1.20 and 1.45 behave as written: 0.90 and 1.20 are treated as ambiguous and return INCOMPLETE, and 1.45 is SELL.
- The rest of `verdictSynthesisV1.ts` behaves as described:
  - it does not invent a formula for the uncertainty bucket; BUY/SELL issue only when all three buckets agree;
  - BUY is withheld (INCOMPLETE) because the business-quality judgement does not exist yet;
  - a missing price or a Base value that is not positive returns INCOMPLETE.
- The PR does not touch `docs/frozen/`, `FROZEN_HASHES` or `growthLicence.ts`/`flipTest.ts`, and makes no production DB write.
- Real-company coverage is thin. On real data only MSFT reaches the new path. OKLO and NVDA are blocked earlier in the pipeline, so no real HOLD or BUY-candidate case is exercised.

## Finding 1: the choice of verdict mechanism is a finance-policy call that only Calvin can make (this is why the verdict is CALVIN REQUIRED)
- **Where:** `lib/analyzer/verdict.ts:113-126`, `lib/analyzer/verdictSynthesisV1.ts`, `lib/analyzer/policy.ts` (`verdictSynthesisV1Buy`/`Sell`), and `docs/proof/cf-analyzer-stage3-verdict-finish-01.md` §1.
- **Root cause:** The PR treats V1 and Ruling C as "two independent, non-conflicting mechanisms" and makes V1 the only thing that decides the verdict. The repo's own authority says they are two derivations of the same output and that they conflict:
  - **Same verdict layer.** Amended frozen §10.6.2 (spec :1070) says the position comes from "a single underwritten-value-versus-price comparison" whose value is chosen by Step 2's growth licence. `docs/verdict-methodology-reconciliation.md` §6.5 records that this CHEAP/FAIR/EXPENSIVE position maps to BUY/HOLD/SELL and that the mapping is settled. So §10.6.2 is the verdict derivation itself, not an "internal diagnostic" as the proof doc says.
  - **Bands must be PROVISIONAL.** The same §10.6.2 (spec :1104) says "Bands are policy constants … marked **PROVISIONAL** with what they were calibrated on". The PR records them as non-PROVISIONAL, with no provenance entry.
  - **Later rulings forbid new bands.** Ruling C (24 Sep) says "Do not adopt … any new numeric threshold", and §11 items 1 and 5 (margin of safety, numeric band) are still open. Two rulings dated after the V1 text (#211 "Choose B", 22 Sep 02:24:07Z, and #269) say no new bands/cut-points. The Methodology page also lists numerical cut-points as NON-GOVERNING (item 8, recorded in `docs/decision-packs/cf-analyzer-final-method-decision-01.md` §4).
  - **The proof doc gets the dates wrong and leaves out the counter-authority.** It calls V1 "later-dated" than Ruling C, but V1 is 22 Sep and Ruling C is 24–25 Sep. It never addresses #211, #269 or item 8.
  - **It removes the 18 Sep safeguard.** The earlier ruling says no single diagnostic or price location alone may decide the verdict. The PR deletes the test that guarded this ("stays INCOMPLETE regardless of where price sits inside or outside the range"). After the PR, the verdict depends only on where price sits relative to the middle of the range.
- **The rules that apply:** Calvin's #430 NO (as quoted in the contract) says not to retire V1 and to reuse "Ruling C and valid V1 policy", reconciling rather than assuming. `docs/technical-specs.md` says that on a conflict like this the work must stop and return RECONCILIATION REQUIRED. Issue #444 DO 3 / SAFETY says that choices needing real policy judgement (cut-points, margin of safety, the growth-licence question, SELL asymmetry) are Calvin's.
- **Why it matters:**
  - **MSFT:** the SELL probably holds either way. Every scenario, bull included, is below the price, and a no-growth value would be lower still.
  - **HOLD:** every HOLD in the 0.90–1.20× zone is issued without the Step 2 licence or the Step 6 flip test. HOLD is also issued even though the thesis-invalidation judgement doesn't exist, while BUY is withheld for the equivalent missing quality judgement.
- **Recommended answer (least complex):** NO. Put V1's numbers in as Ruling C's Step 4/5 bands, marked PROVISIONAL, and apply them to the Step 3 value with the Step 6 flip test. On current real data MSFT still comes out SELL; OKLO and NVDA are unchanged.
- **Smallest fix after the ruling:**
  - **If YES:** record Calvin's ruling inline in `policy.ts`/`verdict.ts` and fix findings 2–3.
  - **If NO:** send the call to `synthesizeVerdictV1` through `growthLicence.ts` and `flipTest.ts`, and mark the band constants PROVISIONAL with their calibration basis.

## Finding 2: the Overview reintroduces a rejected placeholder, and the check that would catch it was weakened (must be fixed whatever the ruling)
- **Where:**
  - `lib/analyzer/overviewCopy.ts:221`: the regex is changed to `/(?<!Unavailable — )see Evidence/i`.
  - `lib/analyzer/overviewCopy.test.ts:129`: the existing case that asserts `"Unavailable — see Evidence"` is FORBIDDEN is rewritten to a different string, and a new test asserts the opposite.
  - `app/components/DominantVerdictSlot.tsx`: on the Overview, a completed verdict shows the word plus `REASON_UNAVAILABLE_MARKER`.
- **Root cause:**
  - On MSFT's real Overview the hero now reads "SELL · Unavailable — see Evidence". The cause and the strongest reasons against acting are not shown anywhere outside Evidence.
  - The PR justifies the carve-out with "the SAME PR #399's later CALVIN RULING — A (comment 5933170464)". That comment is earlier than the ruling that forbade "see Evidence" placeholders on the Overview (comment 5952716764, the `overviewCopy.ts` header).
  - `trustCopy.ts:107-112` records that Calvin rejected exactly this "Unavailable — see Evidence" hero as "naming that a verdict is missing, never why".
  - This loosens a check that acceptance relies on (an evaluator change) and changes what the product shows. It is not disclosed as a separate consequential change.
  - It also fails issue #444 DO 4/5, which asks for verdict causes and the strongest reasons against acting on the verdict-first surface.
- **Reproduction:**
  - At base (diff reverse-applied in `work-a/base`), `overviewCopy.test.ts` flags "Unavailable — see Evidence".
  - At head, `acceptanceGateOnRealRun.test.tsx` and `analyzerSurfacesOnRealRun.test.tsx` pass while asserting that the MSFT Overview hero contains "SELL" and "Unavailable — see Evidence".
- **Smallest fix:**
  - Revert the regex and the test-case change.
  - Have the completed-verdict path outside Evidence render a plain-English rationale built from the facts already computed. For example: "Price $499.70 is 1.76× the Base fair value $283.31 — above every SELL threshold". Include the strongest reason against acting.

## Finding 3: misstatements in the PR's own proof and comments (for correction)
- **Where:**
  - The proof doc (§1) and `verdict.ts` header call V1 "later-dated", which is false.
  - The `overviewCopy` comment calls Ruling A "later", which is false.
  - The proof doc says "no number invented". The numbers do come from the Methodology, but treating them as non-PROVISIONAL goes against spec :1104.
- **Smallest fix:** Correct the dates, and cite #211, #269 and Methodology item 8 alongside Calvin's #430 NO.

## Notes (not blocking)
- `step4SignalObservationOnRealRun.test.ts` now deletes MSFT's migration-010 row in `beforeEach`. At base, this file already fails when that row is present (`expected 'PARTIAL' to be 'UNUSABLE'`, reproduced). The PR's fix keeps the old expectations stable by deleting state rather than updating them. That is acceptable as an isolation fix, but it is worth recording.
- The `m9RealCompanyValidationGuards` hash pin is legitimately re-pinned and disclosed inline.
- `briefAcceptance.ts` only checks that the completed verdict's word appears in the Overview text, which is a weak check.
- There is no gate on how fresh the price is. Offline runs use the 4 Sep 2026 captured close; the live path fetches the latest close.
