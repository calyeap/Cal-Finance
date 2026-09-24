# The two "reported, not fixed" no-price defects — reconciliation

`CF-NOPRICE-HONESTY-RECON-01` (issue #302). This document does what the
OUTCOME asks: reconcile, against current approved authority, the two no-price
defects two successive merged documents recorded as "reported, not fixed" —
`docs/ev-input-gaps-reconciliation.md` §5 (the zero-price sentinel reaching
`computeEnterpriseValue`'s REQUIRED check) and `docs/nvda-realrun-
observation.md`'s "An unrelated observation, reported not fixed" (`scenario
Outputs.priceLocationWithinRange`'s ungated price read) — and correct only
what current approved authority already determines.

**This document reconciles, corrects and reports. It rules nothing.** It
answers none of §11's open items, marks no acceptance-matrix row satisfied,
and produces no verdict (`docs/product-decisions.md` items 3 and 9).

**Result, stated up front.** Both defects carry a full determination, and
both are **determined and corrected** — neither needed a `CALVIN REQUIRED:`
gate. Defect A (enterprise value) is fixed by carrying the already-known
absence of a price through to `EnterpriseValueInput.price` instead of
flattening it to a `$0` `SourcedValue` one line upstream. Defect B
(`priceLocationWithinRange`) is fixed by giving it exactly the treatment
`rateAtWhichBaseEqualsPrice` — the same `ScenarioOutputs` struct's other
bare-`Decimal` output — already has: null when not computed, with
`notComputed.ts`'s existing `states.suppressing` binding naming why. Neither
correction touches a run that has a price, for any company; neither removes
an existing `INCOMPLETE`.

## 1. Defect A — the zero-price sentinel reaching `computeEnterpriseValue`

**What authority determines.** §7.2 M1: "INCOMPLETE if any REQUIRED input
missing." §4.2's REQUIRED-inputs table lists "price + timestamp" as REQUIRED
for "Enterprise value and every EV-based multiple," on the same row as
`shares outstanding`, `treasury-method dilution`, `total debt`, `finance
lease liabilities`, `cash and marketable debt securities`, `non-operating
equity investments at book` — the identical seven names
`EnterpriseValueInput`'s `REQUIRED_FIELD_NAMES`
(`lib/analyzer/modules/enterpriseValue.ts:24-32`) already carries. §4.3: "an
OPTIONAL input that is absent is shown as absent... Absence is never
rendered as zero" — price is not even OPTIONAL here, it is REQUIRED, so the
stronger rule (§7.2 M1's own INCOMPLETE) governs directly. `acquiredRun.ts:
161-165`'s own committed disclosure already tells the user this run's
behaviour: *"No price was available for this run, so anything that needs
one reports incomplete. A price is never estimated or carried forward from
an earlier day."* Enterprise value needs a price (§4.2); a missing price
therefore reporting a **computed** figure instead of `INCOMPLETE` is the
code failing to do what the run's own disclosure already promises the user
it does — a correction, not a new decision, exactly as the OUTCOME states.

**Determined: yes.** Nothing about *whether* a priceless enterprise value
should report `INCOMPLETE` is ambiguous — §7.2 M1, §4.2 and §4.3 agree, and
`lib/analyzer/calibration/inputs.ts:60-79`'s own `priceLocationWithinRange`
(a different function, M8-c's price-location input, not M1) already
implements the same "no price → no output" treatment for a structurally
identical read (`blocked("no price")`, `:68-70`). The only question was
*how* to express it without inventing anything — answered by
`EnterpriseValueInput.price` already being typed
`SourcedValue<Decimal> | null` (`enterpriseValue.ts:13`): the type already
admitted the honest value; only the caller supplied a flattened `$0` where
`null` belonged.

**The fix.** `lib/analyzer/acquiredRun.ts` no longer flattens
`options.price` to `{ value: options.price?.value ?? new Decimal(0),
timestamp: options.price?.timestamp ?? "" }` before calling
`buildCompanyInputs` — it passes `options.price` through unchanged, null and
all. `lib/analyzer/acquisition/companyInputs.ts`'s `buildCompanyInputs` now
takes that same nullable shape and threads it to exactly the one place this
defect names:

- `fixture.enterpriseValue.price` — now `track("price", price === null ?
  null : { value: price.value, provenance: CLEAN_PROVENANCE })`. `track()`
  is the same helper every other REQUIRED `enterpriseValue.*` field already
  uses to register an absent input in `absentInputs`; `price` was
  previously the only one of the seven that bypassed it.
- `fixture.price` (the `AnalysisResult.price` display field, §3.4: "Price
  carries its timestamp always... There is no 'approximate' state for
  price") — **unchanged**. It still flattens to `{ value: $0, timestamp:
  "" }` on a priceless run, exactly as before. §3.4 is a different rule
  from §7.2 M1/§4.2 and this outcome does not touch it.
- `fixture.multiplesInput.price` — **unchanged**, for the same reason
  stated in §5 below: out of this defect's SCOPE.

**What this changes, and what it does not.** `computeEnterpriseValue`'s own
missing-input list (`REQUIRED_FIELD_NAMES`, alphabetically-fixed order:
`sharesOutstanding, treasuryMethodDilution, price, totalDebt,
financeLeaseLiabilities, cashAndMarketableDebtSecurities,
nonOperatingEquityInvestmentsAtBook`) now includes `price` whenever a run
has none. On a company where price was the **only** missing REQUIRED input,
enterprise value moves from a computed (wrong, off a `$0` market cap) figure
to `INCOMPLETE` — the defect this outcome exists to close. On a company
where other REQUIRED inputs were already missing (NVDA, today — §3 below),
enterprise value was already `INCOMPLETE`; `price` simply joins the stated
cause list, and nothing downstream of "still `INCOMPLETE`" changes. On any
company that **has** a price, `fixture.enterpriseValue.price` is `{ value,
provenance: CLEAN_PROVENANCE }`, byte-identical to before this outcome —
zero behaviour change (confirmed: MSFT/OKLO fixtures and every acquired-run
test pass unmodified).

## 2. Defect B — `scenarioOutputs.priceLocationWithinRange`'s ungated price read

**What authority determines.** The same §4.2 row that requires price for
enterprise value also lists price under "§10.6 valuation position...
Absent the comparator the gap is INCOMPLETE and the position does not
render" — price gates a position-within-range figure elsewhere in this same
frozen table, by name. `acquiredRun.ts:161-165`'s disclosure ("anything
that needs one reports incomplete") is not scoped to enterprise value
alone — a scenario position is exactly "anything that needs" a price.
`FINAL OWNER RULING #205`: "return `INCOMPLETE` with cause and recovery
whenever decision-critical evidence is missing; no manufactured
alternative" — a position stated as "10.5% below the bear case" with no
real price behind it is precisely the manufactured alternative that ruling
forbids. And the in-repo precedent is exact:
`lib/analyzer/calibration/inputs.ts:60-79`'s own `priceLocationWithinRange`
— the same English name, a genuinely different function (M8-c's raw
calibration input, not §10 G's scenario output) — already returns
`blocked("no price")` when `input.currentPrice === null` (`:68-70`). Two
implementations of "where does the price sit" disagreeing about whether a
missing price gets an answer is exactly the "same conclusion wearing an
opposing label" problem this codebase already ruled out elsewhere (§8.5);
here it is the same *name*, not even a different conclusion.

**Determined: yes**, and expressible without any new visual/copy pattern —
which is what SCOPE 3 makes the actual gate. `ScenarioOutputs` (§10 G) has a
second bare-`Decimal` member, `rateAtWhichBaseEqualsPrice`, that already
had exactly this problem (a real-valued output with no way to say "not
computed") and was already fixed the same way, by `notComputed.ts`
(H2/H4, `CB-AUDIT-01`): typed `Decimal | null`, bound to a named
`NOT_COMPUTED_BINDING` entry in `states.suppressing` when null, rendered by
the same `boundState`/`BoundStateBlock`/`.bound()` machinery every other
suppressed figure in this report already uses. Defect B's fix is that same
treatment, reused verbatim for `priceLocationWithinRange` — not a new
state, not a new component, not new copy beyond the one cause sentence
every other `notComputed` binding already writes for itself.

**Read of every consumer named in CONTEXT item 5, before changing anything:**

| Consumer | What it did before this outcome | Needs a new pattern? |
|---|---|---|
| `modules/scenarioOutputs.ts` | Computed unconditionally off `fixture.price.value` (the `$0` sentinel) | No — gates on the honest `currentPrice: Decimal \| null` input |
| `types.ts` (`ScenarioOutputs`) | `priceLocationWithinRange: Decimal`, no suppression path | No — `Decimal \| null`, identical shape to `rateAtWhichBaseEqualsPrice` two lines below it |
| `assemble.ts` | Passed `fixture.price.value` (flattened) as `currentPrice`; no suppression entry | No — passes `fixture.enterpriseValue.price?.value ?? null` (the same honest signal defect A now produces) and pushes one `notComputed` entry, mirroring the existing `rateAtWhichBaseEqualsPrice` block immediately above it |
| `app/components/AnalyzerReport.tsx`, §10 G table row | `<span className="v">{pct(...)}</span>`, unconditional | No — `BoundStateBlock`, the identical pattern the adjacent `rateAtWhichBaseEqualsPrice` row already uses |
| `app/components/AnalyzerReport.tsx`, `weightedPositionPct` (Section H range-bar marker) | Computed only when `fairValueRange.kind === "range"`, which does **not** by itself imply a real price (see the correction below) | No new pattern, but the existing null guard is **load-bearing**, not defensive — it is what stops a fixture-driven "range" state with no price from rendering a bogus marker |
| `app/components/ValuationStrip.tsx`, `showLocation` line | Unconditional decorative sentence ("X% of the way from bear to bull") | No — omitted when null, the same "never a placeholder" rule the rest of this component already follows (e.g. `fairValueRange.kind === "range" ? ... : "—"`) |
| `app/components/QuickRead.tsx`, "Price vs scenarios" item | `fairValueRange.kind === "range" ? (Inside/Outside text) : ("suppressed" text)` | **Yes — required, and fixed.** See below. |
| `lib/analyzer/ai/slots.ts` ([C] catalogue) | `b.value(...)` — silently drops a `null` with **no cause**, which would violate §9.5 | No new pattern, but a **required** change: switched to `b.bound(...)`, the same call `rateAtWhichBaseEqualsPrice` uses two entries below it |
| `lib/analyzer/ai/challengerPayload.ts` | `priceLocationWithinRange` is already in `FORBIDDEN_KEYS` — never read | No change |
| `lib/analyzer/snapshotComparison.ts` | Reads the field as `unknown`; `valuesEqual` already compares `Decimal` vs `null` correctly (a real change, not a crash) | No change |

**Correction (posted as a REVIEW `CORRECT` on this PR, applied here).** An
earlier version of this section claimed `fairValueRange.kind === "range"`
implies a real price "by construction," and that QuickRead's "Price vs
scenarios" item therefore needed no change. That claim is false, and the
fix below is required, not optional.

The claimed mechanism was: priceless → EV `INCOMPLETE` (defect A) → leverage
precondition fails (`gates.ts`'s `evaluateLeverage`, `enterpriseValue !==
null` gate) → fair-value range suppressed (§9.3's `"every rate-dependent
output"` scope). The middle step does not hold in general.
`assemble.ts:303-306` evaluates the leverage precondition as:

```ts
const leverage = evaluateLeverage({
  ...fixture.leverage,
  enterpriseValue: fixture.leverage.enterpriseValue ?? currentEnterpriseValue?.value ?? null,
});
```

A fixture that states its own `leverage.enterpriseValue` — `fixtures/
msft.ts:117-124` and `fixtures/oklo.ts` both do — satisfies the leverage
precondition from that stated value alone, regardless of whether M1
(enterprise value, and so the price behind it) is `INCOMPLETE`. Probed
directly (MSFT fixture, `enterpriseValue.price` set to `null`, nothing else
changed): `priceLocationWithinRange = null`, EV suppressed, but
`leverage = PASS` and `fairValueRange.kind = "range"` — the exact state the
removed claim said could not occur, and in it `QuickRead.tsx` printed
"Outside the authored bear-bull range" for a position that is actually
unknown, the manufactured-alternative posture `FINAL OWNER RULING #205`
forbids.

**Where the cascade does hold, and where it does not.** On the acquired
path, `acquisition/companyInputs.ts:356` sets `leverage.enterpriseValue:
null` outright (it does not state one), so a real priceless acquired run
(NVDA) does fail the leverage precondition and `fairValueRange.kind` is
`"suppressed"` — confirmed by `nvdaRealRunObservation.test.ts`, unchanged by
this correction. The cascade breaks only for a hand-authored fixture that
states both a price-independent `leverage.enterpriseValue` **and** a null
price — a combination no fixture in this repository exercises today (MSFT
and OKLO both carry a real price), so the per-company delta in §3 stands
unchanged. But this document is read as authority by later outcomes (as
this one cites two predecessors), so the invariant itself had to be stated
correctly, per SCOPE 3's unavailable-case read of each consumer.

**The fix, applied.** `QuickRead.tsx`'s "Price vs scenarios" item now gates
the range branch on `priceLocationWithinRange !== null`, not on
`fairValueRange.kind === "range"` alone — falling through to the same
"fair-value range is suppressed" text already used for the non-range case
when the figure is unavailable. No new state, component, or copy pattern:
the fallback branch already existed. `AnalyzerReport.tsx`'s
`weightedPositionPct` null guard (§10 G / Section H marker) was already
correct code — only its comment claimed the branch was unreachable; the
comment now states that the guard is load-bearing.

## 3. Per-company delta, stated honestly (SCOPE item 4)

**NVDA — the only company either defect reaches today.** No `prices.json`
row exists for NVDA (`FINAL OWNER RULING #205`).

- `AnalysisResult.price` — **unchanged**: `{ value: 0, timestamp: "" }`,
  §3.4's own display sentinel, untouched by this outcome.
- `diagnostics.enterpriseValue` — **still `INCOMPLETE`** (no status
  change), cause **widened from three to four** missing REQUIRED inputs:
  was `"missing REQUIRED input(s): treasuryMethodDilution,
  financeLeaseLiabilities, nonOperatingEquityInvestmentsAtBook"`, now
  `"missing REQUIRED input(s): treasuryMethodDilution, price,
  financeLeaseLiabilities, nonOperatingEquityInvestmentsAtBook"`. This is
  defect A's fix becoming visible in the stated cause, not a new
  suppression.
- `gates.leverage`, `fairValueRange`, `trust.status`, `deriveVerdict` —
  **unchanged** (`LEVERAGE UNSUPPORTED IN v1`, `suppressed`, `UNUSABLE`,
  `INCOMPLETE`). All four were already in this state before this outcome,
  driven by the other three missing REQUIRED inputs; `price` joining the
  list changes nothing downstream of "still `INCOMPLETE`."
- `scenarioOutputs.priceLocationWithinRange` — **this is the real delta**.
  Before this outcome: silently `-0.1046` (≈ "10.5% below the bear case"),
  a number with no real price behind it, exactly as
  `docs/nvda-realrun-observation.md` reported and left unfixed. After: `null`,
  with `INCOMPLETE` bound to it by name in `states.suppressing` ("the
  current price's location within the scenario range" — "missing REQUIRED
  input: a price for this run..."). `-0.1046` is **replaced**, not
  qualified or hedged — no consumer of this field shows both.
- `diagnostics.reinvestmentRonic.ronic`, the achieved-comparator figures,
  the reverse-DCF grid's own cause — **unchanged**. None of these three
  depends on price.
- No `INCOMPLETE` is removed anywhere on this run. Two more are added
  (`price` in the EV cause list; `priceLocationWithinRange`'s own new
  binding) where a false-precision number or an uncredited cause used to
  stand.

**MSFT and OKLO — unaffected.** Both fixtures (`lib/analyzer/fixtures/
msft.ts`, `fixtures/oklo.ts`, byte-unchanged per HARD BOUNDS) carry a real,
non-null price directly as a hand-authored `CompanyFixture`, never routed
through `buildAcquiredRun`/`buildCompanyInputs` — neither file this outcome
edits ever executes for either company. `enterpriseValue.price` and
`scenarioOutputs.priceLocationWithinRange` are unchanged for both,
confirmed by the existing `assemble.test.ts` REGRESSION (B1) assertion
(MSFT, `priceLocationWithinRange` still 64%) and every `AnalyzerReport.
test.tsx`/`QuickRead.test.tsx` case for both companies passing unmodified.

**Any other company with a price, real or fixture.** Unaffected by
construction: `EnterpriseValueInput.price` and `ScenarioOutputsInput.
currentPrice` both carry the same real value they did before this outcome
whenever a price exists; only the `null` branch of each changed.

## 4. What this outcome leaves as a named, not-fixed hazard

**`multiplesInput.price` carries the same flattening this outcome closed
for `enterpriseValue.price`, and it is left exactly as it was.**
`companyInputs.ts`'s `multiplesInput.price` still supplies `{ value:
price?.value ?? new Decimal(0), provenance: CLEAN_PROVENANCE }` on a
priceless run — never `null`, even though `MultiplesInput.price` (`modules/
multiples.ts:101`) is already typed `SourcedValue<Decimal> | null`, the
same shape `EnterpriseValueInput.price` was before this outcome. P/E, P/B
and the other simple multiples (`simpleMultiple`, `multiples.ts:10-15`)
would therefore still compute off a `$0` price on a priceless run, exactly
the defect class this outcome exists to close, for a different output
group. This is **not** one of the two defects the OUTCOME names (defect A
is `computeEnterpriseValue`'s REQUIRED check specifically; defect B is
`scenarioOutputs.priceLocationWithinRange` specifically), and fixing it
here would be scope neither the OUTCOME nor its SCOPE items ask for — this
document reports it as an observed fact about the current build, in the
same "reported, not fixed" form its two predecessors used, not a
correction made here.

**Update (CF-MULTIPLES-NOPRICE-RECON-01, issue #304).** This hazard is now
closed — see `docs/multiples-noprice-reconciliation.md` for the fix, its
two further companion corrections, and the per-company delta.

## 5. What was checked, and what was not touched

- `lib/analyzer/verdict.ts`, `lib/analyzer/policy.ts` — byte-unchanged.
- `docs/frozen/` — no byte changed; `FROZEN_HASHES` — no entry changed.
- `lib/analyzer/acquisition/tagMap.ts`, `TAG_MAPPING_VERSION` — unchanged.
- `lib/analyzer/fixtures/msft.ts`, `fixtures/oklo.ts` — unchanged.
- No price acquisition of any kind — no `prices.json` row, no feed change,
  no network call, no widened capture. Both fixes carry an *absence*
  through honestly; neither supplies a price.
- No §4.4 judgment made; no §11 item answered; no acceptance-matrix row
  marked; no verdict produced; no `INCOMPLETE` removed by assertion.
- No Analyzer V2 design change: no new route, component, layout, token or
  visual treatment anywhere in this diff. Every rendering change reuses an
  existing mechanism already in the same file for an adjacent field
  (`BoundStateBlock`/`boundState`/`NOT_COMPUTED_BINDING` for
  `rateAtWhichBaseEqualsPrice`; the existing "—"/omission convention for
  an unavailable decorative figure).
- `npx tsc --noEmit` — clean.
- `npm test` — green apart from the documented CI-exempt Playwright
  `chrome-headless-shell` baseline (`scripts/evidence/selfTest.test.ts`,
  `.github/workflows/ci.yml`'s named environmental exception): 2039/2040
  passing (corrected — CF-MULTIPLES-NOPRICE-RECON-01, issue #304; the figure
  above was stale at this document's own merged head, per REVIEW's
  non-blocking note on PR #303). Existing fixtures/tests pinning a figure
  this outcome correctly changed were updated and are named in §6.

## 6. Tests reproducing this outcome in CI

No new parallel harness. Reused, per SCOPE item 5:

- `lib/analyzer/nvdaRealRunObservation.test.ts` — test (c), the same test
  the predecessor `ev-input-gaps-reconciliation.md` cited as its own CI
  reproduction, now updated: the EV cause string carries `price` as a
  fourth missing input, and two new assertions confirm
  `scenarioOutputs.priceLocationWithinRange` is `null` with `INCOMPLETE`
  bound to it — the exact NVDA delta stated in §3 above, exercised on the
  real acquired run.
- `lib/analyzer/modules/scenarioOutputs.test.ts` — one new test: a
  priceless call returns `priceLocationWithinRange: null`, while
  `rateAtWhichBaseEqualsPrice` (compared directly against an explicit `$0`
  price call) is proven **unchanged** — confirming defect B's fix does not
  touch the one other output that also reads price in this module, which
  is not this outcome's SCOPE.
- `lib/analyzer/assemble.test.ts`, `app/components/QuickRead.test.tsx` —
  existing MSFT-fixture assertions on `priceLocationWithinRange` updated
  only for the new `Decimal | null` type (optional-chained); their
  expected values (64%) are unchanged, proving a run with a price is
  unaffected.
- `app/components/QuickRead.test.tsx` — one new test, added by the
  correction above: MSFT fixture with `enterpriseValue.price: null` (its
  stated `leverage.enterpriseValue` otherwise unchanged) reaches
  `fairValueRange.kind === "range"` with `priceLocationWithinRange` null,
  and "Price vs scenarios" renders the suppressed wording, never
  Inside/Outside — the exact case the removed "by construction" claim
  said could not occur.

## Summary

| Defect | Authority determines | Corrected? | What changed for NVDA |
|---|---|---|---|
| A — `computeEnterpriseValue`'s zero-price sentinel | §7.2 M1 + §4.2 already require price for EV; §4.3's stronger REQUIRED-INCOMPLETE rule governs; `EnterpriseValueInput.price` was already typed nullable | Yes — `enterpriseValue.price` now carries the honest absence through | EV's stated cause gains `price` as a fourth missing input; still `INCOMPLETE`, unchanged downstream |
| B — `scenarioOutputs.priceLocationWithinRange`'s ungated read | §4.2's own §10.6 row requires price for a price-position figure by name; `calibration/inputs.ts`'s same-named function already implements `blocked("no price")`; `rateAtWhichBaseEqualsPrice` in the same struct already has the exact null/bound treatment needed | Yes — same `notComputed`/`BoundStateBlock` machinery, reused verbatim, no new pattern | `-0.1046` replaced by `INCOMPLETE` (bound, named) |

Both defects were fully determined by current approved authority; neither
required a `CALVIN REQUIRED:` gate. No run that has a price changes its
output, for any company. No `INCOMPLETE` is removed. `multiplesInput.price`
is named, not fixed, as a related hazard for a later outcome, per §4 above.
