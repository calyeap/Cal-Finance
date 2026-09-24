# Closing the last named zero-price flattening, and two further reads —
# reconciliation

`CF-MULTIPLES-NOPRICE-RECON-01` (issue #304). `docs/noprice-honesty-
reconciliation.md` §4 (merged `f740941`, PR #303) named one remaining member
of the zero-price flattening class it left "reported, not fixed":
`multiplesInput.price`. That same OUTCOME also asked for two further
`fixture.price.value` reads on the pre-revenue success-weight path
(`assemble.ts`'s `successAsPriceRequires` and `computeImpliedProbability`
call) to be read, classified and, where authority determines the honest
behaviour, corrected. This document does that, and corrects only what
current approved authority already determines.

**This document reconciles, corrects and reports. It rules nothing.** It
answers none of §11's open items, marks no acceptance-matrix row satisfied,
and produces no verdict (`docs/product-decisions.md` items 3 and 9).

**Result, stated up front.** All three items carry a full determination, and
all three are **determined and corrected** — none needed a `CALVIN
REQUIRED:` gate. `multiplesInput.price` is fixed by carrying the
already-known absence of a price through to it, the identical fix
`CF-NOPRICE-HONESTY-RECON-01` gave `EnterpriseValueInput.price`.
`successAsPriceRequires` is fixed by recognising, from §10.3's own text,
that price is a REQUIRED input of the pre-revenue fair-value range itself —
not merely of one of its four displayed parts — and reusing the exact
mechanism `cashPerShare`'s own absence already uses to remove the range.
`computeImpliedProbability`'s price read is fixed by adding the identical
REQUIRED-input rule to the one function that reads it, reusing the
already-existing `NOT COMPUTED / SUPPRESSED` state. All three corrections
are latent on every run this codebase can currently produce — confirmed by
direct probe, not assumed — so nothing observable changes for NVDA, MSFT or
OKLO today. No run that has a price changes its output, for any company; no
`INCOMPLETE` is removed.

## 1. `multiplesInput.price` — the last named member of the flattening class

**What authority determines.** §7.2 M1: "INCOMPLETE if any REQUIRED input
missing." `acquiredRun.ts:163-165`'s own committed disclosure: *"No price was
available for this run, so anything that needs one reports incomplete. A
price is never estimated or carried forward from an earlier day."* P/E
trailing, P/E forward and P/B need a price — `simpleMultiple`
(`multiples.ts:10-15`) already returns `suppressedValue("INCOMPLETE",
\`missing REQUIRED input(s) for ${label}\`)` when either operand is `null`,
exactly the branch every other absent operand on this path already uses.
`MultiplesInput.price` (`multiples.ts:101`) is already typed
`SourcedValue<Decimal> | null` — the identical shape `EnterpriseValueInput.
price` had before `CF-NOPRICE-HONESTY-RECON-01` closed the same gap for
enterprise value. Nothing about *whether* a priceless run's multiples should
report `INCOMPLETE` is ambiguous; the only question was *how* to express it
without inventing anything, and the immediately preceding outcome already
answered that question for the identical shape.

**Determined: yes.**

**The fix.** `lib/analyzer/acquisition/companyInputs.ts:396` (`multiplesInput.
price`) now reads:

```ts
price: track("price", price === null ? null : { value: price.value, provenance: CLEAN_PROVENANCE }),
```

replacing the unconditional `{ value: price?.value ?? new Decimal(0),
provenance: CLEAN_PROVENANCE }` that flattened absence to `$0`. `track()` is
the same helper every other `multiplesInput` field already uses to register
an absent input (`epsTrailing`, `epsForward`, `ebitda`, `bookValue` two lines
below it) — `price` was previously the only one of the group that bypassed
it. `fixture.price` (§3.4's display sentinel) and `fixture.enterpriseValue.
price` (defect A's own fix) are both untouched by this change.

**What this changes, and what it does not.** On a company where price is the
only missing input a given multiple needs, that multiple moves from a
computed (wrong, off a `$0` price) figure to `INCOMPLETE`. On a company where
the multiple's *other* operand is already missing — every acquired run today
(§3 below) — the multiple was already `INCOMPLETE`; `multiplesInput.price`
carrying `null` instead of `$0` changes nothing observable. On any company
that **has** a price, `multiplesInput.price` is `{ value, provenance:
CLEAN_PROVENANCE }`, byte-identical to before this outcome.

## 2. CONTEXT item 6, read one — `assemble.ts`'s `successAsPriceRequires`

**Direct probe, not code reading alone.** `buildAcquiredRun({ ticker:
"OKLO", price: null, ... })` against the real committed OKLO capture, before
this outcome's fix, produces `fairValueRange.kind: "suppressed"`, state
`"LEVERAGE UNSUPPORTED IN v1"` — **not** `"pre-revenue-distribution"`. The
same probe with a real price produces the identical `"LEVERAGE UNSUPPORTED
IN v1"` result. The real acquired OKLO pipeline (`companyInputs.ts:356`) sets
`leverage.enterpriseValue: null` unconditionally, the same as every other
acquired company, so a priceless run's `enterpriseValue` (already
`INCOMPLETE` per defect A) fails the leverage precondition and removes the
*whole* fair-value range before `successAsPriceRequires` could ever be
observed — the identical cascade `docs/noprice-honesty-reconciliation.md`
§2 already documents for NVDA, here shown to hold for OKLO's real acquired
run too, with or without a price. `successAsPriceRequires: fixture.price.
value` is computed internally (as `$0`) but discarded before assignment,
exactly as `computedFairValueRange`'s other pre-revenue fields already are
when suppressed (e.g. `failure: cashPerShareBasis ?? new Decimal(NaN)`).

**Isolating the read from that cascade.** `OKLO_FIXTURE` (the hand-authored
fixture, never routed through `buildAcquiredRun`) states its own `leverage.
enterpriseValue` directly (`fixtures/oklo.ts:217`, `new Decimal(600)`),
bypassing the cascade. Forcing only `enterpriseValue.price: null` on that
fixture (`lib/analyzer/assemble.test.ts`, "pre-revenue fair-value range with
no price") isolates the read: before this outcome's fix, `fairValueRange.
kind` stays `"pre-revenue-distribution"` and `successAsPriceRequires`
computes as `$0` — a manufactured figure with no real price behind it,
exactly the defect class this outcome exists to close, and exactly what
`FINAL OWNER RULING #205` forbids.

**What authority determines.** §10.3: *"For pre-revenue companies the range
is the distribution summary — failure / success-as-commonly-described /
success-as-the-price-requires — plus the cash floor."* `successAsPriceRequires`
is one of the range's own four named parts, not an incidental display
figure beside it. §9.6 rule 1 (trust status derivation): *"a REQUIRED input
of the range is INCOMPLETE"* removes the range entirely (UNUSABLE) —
the same rule `assemble.ts`'s own standing comment already applies to
`cashPerShare` ("a REQUIRED input of the fair-value range... its absence
removes the range itself"), even though `cashPerShare` too is a REQUIRED
input of only part of the range (`failure`/`cashFloor`), not all four parts.
Price is a REQUIRED input of `successAsPriceRequires` by the same standing
cashPerShare already has for its own two parts; extending the identical,
already-coded principle to a second of the range's four named parts is not
a new interpretation.

**Determined: yes**, and expressible without any new visual or copy
pattern: the fix reuses the *literal* existing `kind: "suppressed"`
`FairValueRange` variant and the exact `notComputed` / `scope: "the
fair-value range"` mechanism `cashPerShare`'s own check already uses two
lines above it (`assemble.ts`, inside the `if (fixture.preRevenue !== null)`
block). No type change to `successAsPriceRequires`, no new render branch in
`AnalyzerReport.tsx`, `QuickRead.tsx` or `ai/slots.ts` — all three already
branch on `fairValueRange.kind`, and once the whole range is `"suppressed"`,
none of them ever reads `successAsPriceRequires` again (confirmed:
`QuickRead.tsx`'s own `preRevenue !== null && fairValueRange.kind ===
"suppressed"` branch already exists and already handles the generic
"range removed" case for `cashPerShare`'s absence).

**The fix.** `assemble.ts` (inside the `fixture.preRevenue !== null` block,
alongside the `cashPerShare`/`quarterlyBurn`/`runway` checks) adds:

```ts
if (fixture.enterpriseValue.price === null) {
  suppressing.push({
    ...notComputed(
      NOT_COMPUTED_BINDING.successAsPriceRequires,
      "INCOMPLETE",
      "missing REQUIRED input: a price for this run — a price is never estimated or carried forward from an earlier day"
    ),
    scope: "the fair-value range",
  });
}
```

`NOT_COMPUTED_BINDING.successAsPriceRequires` is a new catalogue entry
(`notComputed.ts`), the same mechanical addition every prior "bare Decimal
with no way to say not computed" fix in this codebase has made — not a new
kind of state. `fixture.enterpriseValue.price` is the same honest signal
`assemble.ts`'s own `currentPrice` read (scenario outputs) already reuses;
`fixture.price.value` stays untouched as §3.4's unconditional display
sentinel, and `successAsPriceRequires: fixture.price.value` itself is left
as written — it is provably unreachable-when-null now, exactly as
`computedFairValueRange`'s other pre-revenue fields already are under
suppression.

## 3. CONTEXT item 6, read two — `computeImpliedProbability`'s price argument

**Direct probe.** The real OKLO acquired-run harness
(`acquiredRun.test.ts`) already confirms every `successDefinitions` row
resolves to `{ kind: "NOT COMPUTED / SUPPRESSED", cause: "V_success's
valuation date is not established" }` — the date-cause check, not the price
read, decides every row on the real acquired path. `companyInputs.ts:334-336`
unconditionally nulls `vSuccessAsOfDate`/`vSuccessBasis` for **every** real
acquired run (Step 7's real per-definition dates do not exist yet), so
`successWeightDateCause` fires before `computeImpliedProbability` is ever
called, on every company, permanently — not merely today. `fixture.price.
value` at this call site is therefore unreachable code on the real acquired
path as currently architected, confirmed by probe rather than assumed.

**Isolating the read.** `OKLO_FIXTURE`'s own hand-authored success
definitions carry matching, comparable dates/bases (definitions 3 and 4
already resolve to real `"probability"` states against its real $14.50
price — `assemble.test.ts`'s existing "definitions 3 and 4... return real,
distinct probabilities" test). Forcing only `enterpriseValue.price: null` on
that fixture isolates the read from the date/basis gate: before this
outcome's fix, definitions 3 and 4 compute `computeImpliedProbability(
vSuccess, vFail, $0)` — a real market comparator function invoked with the
flattened display sentinel instead of "no price", producing whichever of
`PRICE NOT JUSTIFIABLE BY THIS OUTCOME` or a fabricated `probability` a `$0`
happens to trigger for the given `vSuccess`/`vFail` pair. Definitions 1 and 2
(`vSuccess <= vFail`) are unaffected either way — their outcome does not
depend on price.

**What authority determines.** The same §7.2 M1 REQUIRED-input rule applies:
`computeImpliedProbability`'s `price` parameter is a real market comparator
(the two-outcome pricing identity, `price = p·V_success + (1-p)·V_fail`),
not the §3.4 display sentinel, and a run with no price cannot honestly
solve that identity. `SuccessDefinitionState` already carries a `"NOT
COMPUTED / SUPPRESSED"` member (`types.ts:630`) for exactly this shape —
the same state `assemble.ts`'s own date/basis cause check already produces
for this same field — so no new state is needed.

**Determined: yes.**

**The fix.** `computeImpliedProbability`'s signature widens from `price:
Decimal` to `price: Decimal | null` (`modules/preRevenue.ts:522`), checked
immediately after the price-independent `vSuccess <= vFail` case (so that
outcome — needing no price — is never suppressed merely because the run
also has none) and before the `price >= vSuccess` comparison:

```ts
if (price === null) {
  return {
    kind: "NOT COMPUTED / SUPPRESSED",
    cause: "missing REQUIRED input: a price for this run — a price is never estimated or carried forward from an earlier day",
  };
}
```

`assemble.ts`'s call site simplifies to pass `fixture.enterpriseValue.price?.
value ?? null` — the same honest signal reused everywhere else in this
document — straight through, rather than defaulting it. Keeping the null
check inside `computeImpliedProbability` itself (rather than duplicating the
`vSuccess <= vFail` comparison at the call site) keeps every branch of the
two-outcome pricing identity in the one function that owns it.

## 4. Per-company delta, stated honestly (SCOPE item 4)

**NVDA.** Confirmed by direct probe (`nvdaRealRunObservation.test.ts`,
extended): `multiplesInput.price` now carries `null` instead of `$0`, but
`epsTrailing`, `epsForward` and `bookValue` are already `null` on this run
(EPS is not in this mapping version) — P/E trailing, P/E forward and P/B
were already `INCOMPLETE` via that other missing operand, unchanged by this
fix. `enterpriseValue`, `leverage`, `fairValueRange`, `trust.status` and
`deriveVerdict` are all unaffected (NVDA has no `preRevenue` bundle — the
range-suppression and success-weight fixes in §§2-3 do not apply to it at
all). No change downstream of "still INCOMPLETE."

**OKLO — real acquired run (`buildAcquiredRun`, live pipeline).** Confirmed
by direct probe (`acquiredRun.test.ts`, extended): `multiplesInput.price`
now carries `null` instead of `$0`; P/E trailing, P/E forward and P/B are
unaffected — already `INCOMPLETE` via the same missing-EPS/book-value
pattern as NVDA. `fairValueRange` and `successDefinitions` are unaffected
by §§2-3's fixes either way, with or without a price: the real acquired
OKLO pipeline already reaches `LEVERAGE UNSUPPORTED IN v1` (via the
unmade §4.4 judgment, the same reason NVDA does) before this outcome's new
checks would ever fire, and the date-cause already suppresses every success
definition regardless of price. **This fix is fully latent for OKLO's real
acquired run today**, for a different, independent reason than NVDA's
(NVDA has no `preRevenue` at all; OKLO's real run has one, but the leverage
and date-cause gates both already close first).

**OKLO — hand-authored fixture (`OKLO_FIXTURE`, unchanged, per HARD
BOUNDS).** The fixture always carries a real price, so none of this
outcome's three fixes changes its own committed test assertions — confirmed
by the full suite passing unmodified. Forcing `enterpriseValue.price: null`
on a *copy* of the fixture (the isolating probes in §§2-3, added as new
tests, never as an edit to the fixture itself) is the only way any of
today's committed code reaches the corrected branches, and there
`fairValueRange` moves from `"pre-revenue-distribution"` (computing
`successAsPriceRequires` off `$0`) to `"suppressed"` (`INCOMPLETE`, price
named), and success definitions 3/4 move from a market-comparator read
against `$0` to `"NOT COMPUTED / SUPPRESSED"` (price named) — definitions 1
and 2 (`THIS SUCCESS IS WORTH LESS THAN FAILURE`) are unchanged, since that
outcome needs no price.

**MSFT.** Unaffected in every case: `MSFT_FIXTURE` always carries a real
price and `preRevenue: null` (multiplesInput's real epsTrailing/epsForward/
bookValue values are untouched — confirmed by the full suite's unmodified
MSFT assertions), and a priceless real acquired MSFT run carries no
`preRevenue` bundle either, so §§2-3's fixes never apply to it.

**Any other company, real or fixture, that has a price.** Unaffected by
construction: every fix in this document changes only the `null` branch of
an already-nullable field or an already-nullable function parameter; the
non-null branch is untouched everywhere.

**No `INCOMPLETE` is removed anywhere by this outcome.** All three fixes
either leave a run's observable output unchanged (the latent cases above)
or add a new, honestly-caused suppression where a fabricated figure stood
before.

## 5. What was checked, and what was not touched

- `lib/analyzer/verdict.ts`, `lib/analyzer/policy.ts` — byte-unchanged.
- `docs/frozen/` — no byte changed; `FROZEN_HASHES` — no entry changed.
- `lib/analyzer/acquisition/tagMap.ts`, `TAG_MAPPING_VERSION` — unchanged.
- `lib/analyzer/fixtures/msft.ts`, `fixtures/oklo.ts` — unchanged (every
  isolating probe in §§2-3 builds a *copy* of `OKLO_FIXTURE` with one field
  overridden, in test code, never an edit to the fixture file itself).
- No price acquisition of any kind — no `prices.json` row, no feed change,
  no network call, no widened capture. Every fix carries an *absence*
  through honestly; none supplies a price.
- No §4.4 judgment made; no §11 item answered; no acceptance-matrix row
  marked; no verdict produced; no `INCOMPLETE` removed by assertion.
- No Analyzer V2 design change: no new route, component, layout, token or
  visual treatment anywhere in this diff. `successAsPriceRequires`'s fix
  reuses the literal existing `kind: "suppressed"` `FairValueRange` variant
  and the `notComputed`/`scope: "the fair-value range"` mechanism
  `cashPerShare`'s own check already uses; `computeImpliedProbability`'s fix
  reuses the literal existing `NOT COMPUTED / SUPPRESSED` `SuccessDefinitionState`
  member. Neither `AnalyzerReport.tsx`, `QuickRead.tsx` nor `ai/slots.ts` was
  touched — all three already branch generically on `fairValueRange.kind`.
- `npx tsc --noEmit` — clean.
- `npm test` — green apart from the documented CI-exempt Playwright
  `chrome-headless-shell` baseline (`scripts/evidence/selfTest.test.ts`,
  `.github/workflows/ci.yml`'s named environmental exception): 2048/2049
  passing. No existing test's expected value changed — every new assertion
  is additive (named in §6).

## 6. Tests reproducing this outcome in CI

No new parallel harness. Reused, per SCOPE item 5:

- `lib/analyzer/nvdaRealRunObservation.test.ts` — test (c), extended: direct
  probe confirming `multiplesInput.price` is `null` (not `$0`) on NVDA's
  real acquired run, and that P/E trailing, P/E forward and P/B are already
  `INCOMPLETE` via their other missing operand — the latent-case regression
  for NVDA.
- `lib/analyzer/acquiredRun.test.ts` — new describe block, "a real acquired
  run with no price — multiplesInput.price": direct probes for MSFT and
  OKLO's real acquired pipelines (force the input null on the real
  pipeline, assert the honest `null`, per `app/components/QuickRead.test.tsx`'s
  own established style for defect B), plus a same-block regression proving
  a run with a price is unaffected for both companies.
- `lib/analyzer/modules/preRevenue.test.ts` — two new
  `computeImpliedProbability` unit tests: a null price with `vSuccess >
  vFail` returns `NOT COMPUTED / SUPPRESSED` naming the missing price; a
  null price with `vSuccess <= vFail` still returns `THIS SUCCESS IS WORTH
  LESS THAN FAILURE` unchanged (the price-independent case must survive).
- `lib/analyzer/assemble.test.ts` — new describe block, "pre-revenue
  fair-value range with no price": isolates `successAsPriceRequires`'s fix
  and `computeImpliedProbability`'s call site from the leverage/date-cause
  cascades using a copy of `OKLO_FIXTURE` with only `enterpriseValue.price`
  forced null (leverage stays stated directly on the fixture, bypassing
  that cascade) — proves the range is suppressed, bound to
  `successAsPriceRequires` by name (not `cashPerShare`, which stays
  present), that only the price-dependent success definitions (3, 4) are
  suppressed while the price-independent ones (1, 2) are not, and a
  same-block regression proving the unmodified fixture (has a price) is
  unaffected.

## Summary

| Item | Authority determines | Corrected? | Reachable today? |
|---|---|---|---|
| `multiplesInput.price` | §7.2 M1 + `simpleMultiple`'s existing null branch; `EnterpriseValueInput.price`'s identical prior fix is the fix shape | Yes — carries the honest absence through via `track()` | Latent — every acquired run's own EPS/book-value gap already suppresses P/E and P/B independently |
| `successAsPriceRequires` | §10.3 names it as one of the range's own four parts; the range-wide REQUIRED-input rule `cashPerShare`'s own check already applies | Yes — reuses the existing `kind: "suppressed"` range variant, via the existing `notComputed`/scope mechanism | Latent — the real acquired path's leverage cascade (unmade §4.4 judgment) already suppresses the whole range first, for every company that has a `preRevenue` bundle |
| `computeImpliedProbability`'s price argument | Same REQUIRED-input rule; `NOT COMPUTED / SUPPRESSED` already exists for this exact field | Yes — widened to accept `Decimal \| null`, checked after the price-independent case | Latent — the date-consistency gate (`vSuccessAsOfDate` unconditionally null on every real acquired run) already suppresses every row first |

All three items were fully determined by current approved authority; none
required a `CALVIN REQUIRED:` gate. No run that has a price changes its
output, for any company. No `INCOMPLETE` is removed. `docs/noprice-honesty-
reconciliation.md` §4 is updated with a one-line pointer to this document,
and its §5 stale test count is corrected to this document's own merged
figure.

**Update (CF-PRICE-DISPLAY-HONESTY-RECON-01, issue #306).** This document's
own §2 fix left one adjacent read of `scenarioOutputs.ts` untouched:
`rateAtWhichBaseEqualsPrice`, which still solved a supplied revaluation
function against `currentPrice ?? new Decimal(0)` — the identical
$0-flattening class this document closes above for `successAsPriceRequires`
and `computeImpliedProbability`, just not named as CONTEXT there. That gap
is now closed — see `docs/price-display-honesty-reconciliation.md` for the
fix, its isolating probe (via `OKLO_FIXTURE`'s own real, if
fixture-illustrative, `revalueBaseCaseAtRate`) and its per-company delta
(latent for NVDA, MSFT and OKLO alike).
