ACCEPT: at 1b8d9bb the contradicted `price` fact now gates EV, the range, the reverse DCF and the verdict on MSFT's real run. The `current-operating-margin` half gates its only remaining reader. All-confirmed outputs are byte-identical to base. RED->GREEN reproduced. No material defect found.

# Findings (material)

None. Each candidate below was checked and found not to be a defect.

- **Price provenance (companyInputs.ts:390-391, 429, 481, 509-515).** `priceSourced` now takes the decided `price` fact's tokens. Before, it used `CLEAN_PROVENANCE`. EV, the multiples price and marketCap all read it.
  - Reproduced on the base code (the PR's source changes reverse-applied). A real MSFT run with `price` decided NOT CONFIRMED / CONTRADICTED BY SOURCE still produced EV 3,716,234,881,852.7, a rendered range, and a CLOSE CALL verdict at "price $499.70 is 1.34x / 1.45x / 1.56x Base".
  - At head the same run gives:
    - EV suppressed with `NOT_CONFIRMED_INPUT_CAUSE`;
    - leverage fails closed;
    - steady-state EV, PVGO and the reverse DCF suppressed;
    - the range suppressed;
    - trust UNUSABLE;
    - verdict INCOMPLETE / CANNOT BOUND VALUE, even with a close call bound to that run's own fingerprint.
- **Margin half (steadyStateEvPvgo.ts:61-71, assemble.ts:503-507).** After AR4, the only runtime reader of the `current-operating-margin` fact is M6's NOPAT gap (`currentMarginNopat`). Other consumers checked:
  - `resolveMarginLevels` has no production caller.
  - `marginHistory` and `aiProposedBundle` read the margin series, not the fact.
  - M14 uses typed analyst ranges.
  - The frozen spec's amendment AR0-2 (docs/frozen/calboard-stock-analyzer-v1-spec.md:670, 1700) settles that M7 no longer reads margin levels. So this needed no methodology call.
  - Base vs head on the margin-contradicted run: the only output that changed is `priceImplied.nopatGap`, from {current 125,741,970,000; median 111,802,704,383.66} to null.
- **Evaluator change (automaticAnalysisOnRealRun.test.ts:465-477).** The old assertion was trust PARTIAL plus "Price is NOT CONFIRMED". It held only because of the defect. The replacement asserts EV suppressed with the unconfirmed-input cause and trust UNUSABLE, which is stricter. Rule-2 coverage on the real path moves to decidedFactGatingOnRealRun.test.ts:424-428 (the margin case). The change is justified, not a loosening.
- No changes to migrations, `FROZEN_HASHES`, CI, thresholds or approved values. Six files in the diff.

# Evidence run (all on DIR\repo at 1b8d9bb, test DB audit_o3_test)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run` (full suite): 2677 passed, 2 failed. Both failures are known environment issues:
  - The m9RealCompanyValidationGuards verdict.ts hash. The CRLF checkout causes it: `tr -d '\r' < verdict.ts | sha256sum` gives exactly the expected 2b17017a...
  - nvdaAnalystDraftValidation, a backslash-path allow-list.
- AR2 harness (lib/analyzer/golden/*: goldenFacts, knownReds, valuationInvariants, ar4Engine, tagDrift): all green.
- RED: with the source changes reverse-applied (`git apply -R` on companyInputs.ts, assemble.ts and steadyStateEvPvgo.ts; tests kept), decidedFactGatingOnRealRun has 4 of 13 tests failing, each for the reported reason:
  - price inputs do not carry the decision;
  - all 11 price dependents are unblocked;
  - the margin NOPAT gap is shown;
  - the own-bound price verdict issues.
  
  At head: 13 of 13 pass. Tracked files were restored with `git checkout -- .` afterwards.
- All-confirmed byte identity: I wrote my own dump test. It runs createRun -> queue -> decisions -> loadGateState, plus `computeRunOutput` (the production path) and `withStatedD2Inputs`, and serialises with run ids and timestamps stripped. For the all-confirmed run, base and head match exactly on all four outputs:
  - the fixture;
  - the stated-D2 result;
  - the production result;
  - queue + verdict + trust.
- Independent recompute (confirmed run):
  - diluted market cap = 499.70 x (7,425,545,491 + 24,000,000) = 3,722,537,881,852.7.
  - EV = 3,722,537,881,852.7 + 40,294,000,000 + 66,594,000,000 - 76,843,000,000 - 36,348,000,000 = 3,716,234,881,852.7.
  - Basic market cap = 499.70 x 7,425,545,491 = 3,710,545,081,852.7.
  
  All three match the engine. The confirmed price token is {PRIMARY, DETERMINISTIC/STRUCTURED, CONFIRMED}, which equals `CLEAN_PROVENANCE`.
- Independence on the price run: my own path diff (base vs head) shows changes only in EV-derived and price-derived outputs: leverage, EV, EV/EBIT, EV/revenue, FCF yield on market cap, M6, M7, scenario per-share values, range, price location, rate at which Base equals the price, trust, verdictInputs, the D1 validated domain and the fingerprint. fcf, marginHistory, runRate, gate0/1, triggers and achievedRevenueCagr are unchanged.
- The queue for MSFT is exactly {price, current-operating-margin}, as asserted at decidedFactGatingOnRealRun.test.ts:372-375.

# DONE WHEN / DO / VERIFY

| Item | Status | Evidence |
|---|---|---|
| DO 1: RED DB-backed real-run test, each queued fact decided NOT CONFIRMED in turn, dependents suppressed, no verdict | MET | decidedFactGatingOnRealRun.test.ts:258-441. Queue = {price, current-operating-margin}, pinned at :372. RED reproduced on the base code (4 failures). See nit 1 on the margin "no verdict" test. |
| DO 2: carry the decided fact's provenance into every input built from it | MET | companyInputs.ts:390-391, 429, 481, 509-515. assemble.ts:726-727 for the bare-value price reads. steadyStateEvPvgo.ts:61-71. |
| DO 3: all-CONFIRMED outputs byte-identical | MET | My base-vs-head dump: fixture, stated, production result and verdict all identical. Test at :392-397. |
| VERIFY: RED->GREEN for the reported reason | MET | 4 failing on base, 13/13 passing on head |
| VERIFY: independent outputs stay computed | MET | Path diff above, and the test at :413-415 |
| VERIFY: all-confirmed unchanged | MET | As DO 3 |
| VERIFY: AR2 harness green | MET | golden/* all pass |
| VERIFY: `tsc --noEmit` clean | MET | exit 0 |
| VERIFY: `npm test` green on the exact head | MET (local) | Only the two known environment failures. CI not provided. |
| DO NOT: rules, thresholds, fact-state meaning, migrations, #466/#454 | MET | None touched in the diff |
| DONE WHEN: one PR open; HEAVY REVIEW ACCEPT with CI green; merged | Pending / outside the review | This review is ACCEPT. CI and merge are not visible to me. |

# Nits (not counted)

1. **The per-fact "no verdict is issued" test is vacuous.** It is decidedFactGatingOnRealRun.test.ts:417-421, and it passes on the base code too. The close call is bound to the all-confirmed fingerprint, so any change to the inputs voids it.
   - For `price`, the real proof is the own-bound test at :430-440, which fails on base.
   - For `current-operating-margin`, a close call bound to that run's own fingerprint does issue a verdict. I reproduced trust PARTIAL, ISSUED SELL, with the same price/Base line as all-confirmed.
   - This is correct under VERIFY ("independent outputs stay computed") and policy v1 (PARTIAL does not block). Neither price/Base nor baseAtCheckRates reads the current margin.
   - The PR body should state this explicitly rather than let the test title suggest the margin blocks the verdict.
2. **The range-level cause on a contradicted-price run names the cascade, not the root.** The range and verdict say "LEVERAGE UNSUPPORTED IN v1 — inputs missing", and the reverse DCF says "missing REQUIRED input(s): targetEnterpriseValue". The NOT CONFIRMED reason appears only at the EV field and at the price/location bindings. This is the same cascade a priceless run already shows.
3. **Undecided runs change slightly.** Their EV and multiples tokens move from "SPOT-CHECK NOT REQUIRED" to "SPOT-CHECK PENDING", and their fingerprint changes. This is more honest, and it is unreachable through `computeRunOutput`, which throws before the spot-check is complete.
4. **The §4.2 table in requiredInputs.ts:158 is stale.** It still maps the reverse DCF to `margin-levels` -> `current-operating-margin`, and so does frozen spec line 389. AR0-2 superseded that, and the CLI completeness report (scripts/analyzer/acquire-run.ts) would still flag the reverse DCF on a contradicted margin. This was not introduced by this PR.
5. **MSFT's M14 margin sensitivity anchor is a typed copy of the current margin.** The 46.8% in analystInputs.ts:116-125 does not follow a contradicted margin decision. It is an approved analyst-recorded value, so it is out of scope here.
