# The presentation and narration reads of the §3.4 price sentinel —
# reconciliation

`CF-PRICE-DISPLAY-HONESTY-RECON-01` (issue #306). The zero-price flattening
class has been closed one engine member at a time — `enterpriseValue.price`
and `scenarioOutputs.priceLocationWithinRange` (`docs/noprice-honesty-
reconciliation.md`, merged `f740941`), then `multiplesInput.price`,
`successAsPriceRequires` and `computeImpliedProbability`'s price argument
(`docs/multiples-noprice-reconciliation.md`, merged `8909255`). Every one of
those fixes is latent on every run this codebase can currently produce. This
document closes the one place the `$0` sentinel is still **realised**: the
layer that shows a price to a human and hands one to the narrator.

**This document reconciles, corrects and reports. It rules nothing.** It
answers none of §11's open items, marks no acceptance-matrix row satisfied,
and produces no verdict (`docs/product-decisions.md` items 3 and 9).

**Result, stated up front.** Every item in SCOPE 1-4 is determined by current
approved authority and corrected — none needed a `CALVIN REQUIRED:` gate.
CONTEXT 1-5 (the "Current price" tile in both `ValuationStrip` branches, the
[C] price slot, Section A's price row, the price chart panel, and Quick
Read's "price as of" footer clause) are fixed by binding a new
`NOT_COMPUTED_BINDING.price` state to `states.suppressing` exactly where this
run has no price, and swapping that state in for the figure using the
literal existing mechanism each component already has for an adjacent
suppressed output. CONTEXT 6 (`scenarioOutputs.ts`'s
`rateAtWhichBaseEqualsPrice`, previously solved against the flattened
`currentPrice ?? new Decimal(0)`) is also fixed, by gating it on the same
signal. CONTEXT 7 (`snapshotComparison.ts`, `acquire.ts`) is classified, not
fixed: neither is a presentation read of the kind this outcome's AUTHORITY
names, confirmed by direct reading. No run that has a price changes its
output or its rendering, for any company. No `INCOMPLETE` is removed.

## 1. SCOPE 1 — does authority determine the honest presentation?

**Yes, determined.** `acquiredRun.ts:164-169`'s own committed disclosure is
already shown to the user on every priceless run: *"No price was available
for this run, so anything that needs one reports incomplete. A price is
never estimated or carried forward from an earlier day."* A tile reading
`$0` under the label **Current price**, a header row reading `$0.00` beside
a blank as-of timestamp, a price panel plotting a `$0` point, a footer
reading "price as of " with nothing after it, and a slot handing the
narrator `"current share price": "$0.00"` are each a direct, literal
contradiction of that disclosure — not a new interpretation of it. Two
frozen-spec rules independently require the same correction:

- **§7.2 M1**: "INCOMPLETE if any REQUIRED input missing." §4.2's own
  REQUIRED-inputs table lists "price + timestamp" twice — once for
  "Enterprise value and every EV-based multiple" and again, by name, for
  "§10.6 valuation position and action clause." The "Current price" tile
  sits directly beside that §10.6 valuation-position figure in both
  `ValuationStrip` branches (bear/base/bull and failure/success), restating
  the same REQUIRED input for the same comparison.
- **§4.3**: "an OPTIONAL input that is absent is shown as absent... Absence
  is never rendered as zero." Price is REQUIRED here, not merely OPTIONAL,
  so the stronger §7.2 M1 rule governs directly — but the underlying
  principle (never render an absence as zero) settles the presentation
  question either way.

**The fix shape is already in this exact layer, precedent for precedent.**
`ValuationStrip.tsx:64/72` (`cashPerShareState`) already renders a bound
state string in place of a figure, inside the identical `.cur`/`.fig` tile
shape the "Current price" tile uses two lines below it.
`AnalyzerReport.tsx`'s `ValuationSections` (`:922`, `:1163-1167`) already
swaps `BoundStateBlock` in for `priceLocationWithinRange` on exactly this
condition, right beside Section A's price row. `ai/slots.ts`'s `.bound()`
method already exists precisely to hand the narrator a state name instead of
silently dropping or mis-formatting an absent figure (`:364-373`,
`rateAtWhichBaseEqualsPrice`/`priceLocationWithinRange`). Nothing new had to
be designed for any of the five presentation surfaces this outcome
corrects — each already runs this exact branch for an adjacent output.

**What is NOT determined, and stays untouched.** §3.4 (`AnalysisResult.price`
itself: "Price carries its timestamp always... There is no 'approximate'
state for price") is a different rule, about the sentinel's own type, not
about what a *consumer* of it may present. This outcome does not reinterpret
§3.4 — it leaves `AnalysisResult.price` and `CompanyFixture.price` exactly as
defined (HARD BOUNDS), and instead governs what the five presentation
surfaces named above are entitled to *show*, the same separation
`CF-NOPRICE-HONESTY-RECON-01` already drew for `enterpriseValue.price`.

## 2. SCOPE 2 — which signal is a presentation consumer entitled to read?

**The honest signal is `fixture.enterpriseValue.price === null`** — the
identical `currentPrice` read `assemble.ts` already uses for
`priceLocationWithinRange` (`assemble.ts:460`, now extracted to a single
local `currentPrice` const so every consumer of "does this run have a real
price" — `computeScenarioOutputs` and the two new presentation bindings
below — reads the one signal). It is a 1:1 signal for "this run has no
price": `fixture.enterpriseValue.price` is set to `null` if and only if
`options.price` passed into `buildCompanyInputs` was `null`
(`companyInputs.ts`, `CF-NOPRICE-HONESTY-RECON-01`'s own fix), independent of
every other REQUIRED enterprise-value input.

**Is `NOT_COMPUTED_BINDING.priceLocationWithinRange`'s own binding the right
signal to lean on directly, instead?** No — determined, not assumed. It is
numerically 1:1 with "no price" today (`computeScenarioOutputs` runs
unconditionally, before any gate-driven suppression, so
`priceLocationWithinRange` is null exactly when `currentPrice` is null,
confirmed by reading `assemble.ts`'s call order), but it is a **coincident**
signal, not the honest one: it is bound to and named for "the current
price's location within the scenario range," a different fact from "the
current share price." Leaning on it to gate the "Current price" tile would
put a cause sentence about range position underneath a price figure, and
would break silently if a future change ever decoupled the two (e.g. a
scenario range computed from something other than `fixture.enterpriseValue`
alone). SCOPE 2 asks this question by name and the answer is: reuse the
signal, not the binding.

**The fix.** A new `NOT_COMPUTED_BINDING.price` catalogue entry
(`notComputed.ts`) — `"the current share price"` — bound into
`states.suppressing` in `assemble.ts`, right beside the existing
`priceLocationWithinRange` binding, from the identical `currentPrice`
signal:

```ts
if (currentPrice === null) {
  suppressing.push(
    notComputed(
      NOT_COMPUTED_BINDING.price,
      "INCOMPLETE",
      "missing REQUIRED input: a price for this run — a price is never estimated or carried forward from an earlier day"
    )
  );
}
```

**Is this a new field on `AnalysisResult`, or a new state?** No to both.
`states.suppressing` already exists on `AnalysisResult`; `NOT_COMPUTED_BINDING`
is a module-level dictionary of binding names, not part of the schema — the
identical mechanical addition `CF-NOPRICE-HONESTY-RECON-01` and
`CF-MULTIPLES-NOPRICE-RECON-01` each already made (`priceLocationWithinRange`,
`successAsPriceRequires`) without a `CALVIN REQUIRED:` gate, per
`notComputed.ts`'s own header comment: "No new state and no schema change.
The states are §9.3's own, and the member is the one the contract already
has." This is not the SCOPE 8 gate.

## 3. CONTEXT 1-4 — corrected

All four determined (§1-2 above) and fixed, reusing each component's own
existing "bound state in place of a figure" mechanism — no new visual
treatment anywhere:

- **`lib/analyzer/ai/slots.ts:196-197`.** The `price`/`price.timestamp` slots
  now use `.bound()` (the same call `rateAtWhichBaseEqualsPrice` and
  `priceLocationWithinRange` already use), keyed to the new
  `NOT_COMPUTED_BINDING.price`. `price.timestamp` — a companion field with
  no figure of its own to bind a state to — is simply omitted when the price
  is suppressed, the identical "no companion field when the primary figure
  is suppressed" rule `preRevenue.cashPerShareAsOfDate` already follows two
  entries below it.
- **`app/components/ValuationStrip.tsx:83` and `:108`.** Both branches'
  "Current price" tile now render `priceState.state` in place of the figure
  when bound — the identical inline-text pattern `cashPerShareState` already
  uses in the same `.fig` span, two lines above.
- **`app/components/AnalyzerReport.tsx:1659-1662`** (`HeaderAndStatesSection`,
  Section A). The price row now renders `BoundStateBlock` — exported from
  this file for reuse (see CONTEXT 5) — in place of the figure and
  timestamp, the identical component `ValuationSections` already swaps in
  for `priceLocationWithinRange` a few hundred lines below in the same file.
- **`app/components/QuickRead.tsx:648`.** The " · price as of {timestamp}"
  clause is now omitted entirely when the price is suppressed, rather than
  printed with a blank trailing value — the same "never a placeholder" rule
  `ValuationStrip`'s own `showLocation` line already follows.

## 4. CONTEXT 5 — `AnalyzerReportFrame.tsx:109` / `PriceChartPanel.tsx` — corrected

**Direct probe, not assumed.** `PriceChartPanel` was read in full: it takes
the whole `result.price` sentinel and, unconditionally, renders
`$${num(price.value)}` and `{price.timestamp}` in a `.pricerow` — the
identical markup and the identical defect as Section A's price row (CONTEXT
3), plus a static SVG axis/dot and a "No price history is in this analysis'
fact set" caption that exist only to describe that same price. This is not a
component that merely "restates already-acquired facts" honestly on a
priceless run, as its own header comment claims — it restates the $0/blank
sentinel as if it were one.

**Determined: yes**, same authority as CONTEXT 1-4. **The fix.**
`AnalyzerReportFrame.tsx` computes the same `priceState` (via `boundState`)
and passes it to `PriceChartPanel` as a new prop. When bound, the whole panel
body — figure, chart and caption alike, since all three exist only to
describe the one price fact this panel has no other purpose than to show —
is replaced with `BoundStateBlock` (imported from `AnalyzerReport.tsx`,
exported there for this reuse rather than duplicated): there is no real
point to plot and no history sentence to restate when there is no price.
`price` (the raw sentinel prop) is otherwise unchanged and still required,
for the has-a-price branch.

## 5. CONTEXT 6 — `scenarioOutputs.ts:172-177` (`rateAtWhichBaseEqualsPrice`) — corrected

**Direct probe, not assumed — and the probe changes the determination.** The
predecessor comment (`CF-NOPRICE-HONESTY-RECON-01`) asserted this was
"[e]xpected to be latent today because `revalueBaseCaseAtRate` is `null` for
every recorded bundle," citing `recordedBundles.ts`'s own contract. That
holds for the **real acquired path** (`recordedBundles.ts:285`, confirmed:
`revalueBaseCaseAtRate` and `preRevenue` are always `null` there) and for
`MSFT_FIXTURE` (`msft.ts:280`, `null`) — but **not** for `OKLO_FIXTURE`,
which supplies a real (if fixture-illustrative, `CB-AUDIT-01` H2) function:
`oklo.ts:354`, `revalueBaseCaseAtRate: () => new Decimal(31)`. The hazard is
therefore reachable today, on a straightforward isolating probe (forcing
only `enterpriseValue.price: null` on a copy of `OKLO_FIXTURE`, the exact
methodology `docs/multiples-noprice-reconciliation.md` §§2-3 already used)
— not merely a hypothetical for some future fixture, as the predecessor
comment implied. `OKLO_FIXTURE` itself is unaffected either way (it always
carries a real price, and — confirmed by the pre-existing, unmodified test
`assembleAnalysisResult — the rate at which the base case equals the price
(G)` — its constant `$31` function never equals its own real `$14.50` price,
so it already returns `NO SOLUTION IN RANGE`, for a reason unrelated to this
fix, both before and after it).

**What authority determines.** The same §7.2 M1 / §4.3 rule as CONTEXT 1-5:
a revaluation solved toward `currentPrice ?? new Decimal(0)` on a priceless
run manufactures a specific, wrong "rate at which the base case equals the
price" from a target that was never a real price — the identical
$0-flattening defect class, in the one engine call site it had not yet
reached. `rateAtWhichBaseEqualsPrice` already has a `null` branch and an
existing `NOT_COMPUTED_BINDING` entry (shared with the "no revaluation
function supplied" and "no solution in range" causes); no new state or
binding is needed.

**The fix.** `scenarioOutputs.ts`:

```ts
const rateAtWhichBaseEqualsPrice =
  input.revalueBaseCaseAtRate === null || currentPrice === null
    ? null
    : solveRateForTargetValue(input.revalueBaseCaseAtRate, currentPrice);
```

`rateSolveTargetPrice` (the `currentPrice ?? new Decimal(0)` flattening) is
removed entirely — `currentPrice` is used directly, already null-checked.
`assemble.ts`'s cause block gains one branch, checked **after** the existing
"no revaluation function supplied" check and **before** "no solution in
range," so a run that already has no revaluation function supplied (every
real acquired run, `MSFT_FIXTURE`) keeps its existing cause unchanged
regardless of price — confirmed by a regression test (§9):

```ts
} else if (currentPrice === null) {
  suppressing.push(
    notComputed(
      NOT_COMPUTED_BINDING.rateAtWhichBaseEqualsPrice,
      "INCOMPLETE",
      "missing REQUIRED input: a price for this run — a price is never estimated or carried forward from an earlier day"
    )
  );
}
```

**Comment hygiene (SCOPE item 8).** The removed comment ("Unchanged by this
outcome... naming that a defect too is not this outcome's SCOPE") asserted
the opposite of what the code now does; it is replaced with one stating this
outcome's own fix and pointing at this document.
`docs/multiples-noprice-reconciliation.md` gets a one-line pointer to this
section, so a later reader of that document is not misled into thinking the
hazard it left "reported, not fixed" is still open.

## 6. CONTEXT 7 — `snapshotComparison.ts:52`, `acquire.ts:241-273` — classified, not fixed

**`acquire.ts:241-273`.** Read in full. This builds the acquisition-time
`FACT` record for price from `input.price`, entirely inside `if
(input.price !== null)` (`:236`). It never executes on a priceless run and
never reads the flattened `$0` sentinel at all — it is not a member of this
defect class. **Classification: not a presentation read; not in scope;
nothing to fix.**

**`snapshotComparison.ts:52`.** Read in full, together with its one caller
(`app/analyzer/[runId]/snapshot/[version]/page.tsx`, `WhatChangedSince`).
`diffStoredSnapshots` reads `s.result.price.value` — the §3.4 sentinel — as
one of a fixed, uniform list of `FIELD_SPECS` (`verdict.status`,
`fairValueRange`, `gates.leverage`, …), diffed and rendered generically by
`formatComparableValue`/`toComparable`, with no per-field judgment
(`snapshotComparison.ts`'s own header comment: "It reports what moved, from
what, to what, and what did not... two more fields that can appear in
`changed` or `unchanged` like any other"). On a comparison spanning a
priceless run, this can print `price.value: 5.23 → 0` (or the reverse) to a
human on `SnapshotPage` — literally showing the `$0` sentinel, the same
surface family this outcome targets.

**Determined: this is not the same class of claim CONTEXT 1-5 correct, and
is left as a named, not-fixed hazard rather than corrected here.** Three
reasons: (1) it is inherently comparative — framed as "what changed since
version N," never a standalone "the current price is $X" assertion, the
specific dishonesty §3.4/§4.3/`acquiredRun.ts`'s disclosure are about; (2) it
is a uniform, generic diff mechanism by explicit design (its own header
comment) — giving `price.value` special treatment would mean reading a
second, structurally different kind of value (a bound-state name) into a
field typed `unknown` and diffed by raw structural equality, which is not
"an already-existing state a consumer reads," it is a redesign of the
comparison's own uniformity, which AUTHORITY does not license here, so
correcting it would need a decision about whether to special-case one field
in a deliberately-uniform mechanism — not something SCOPE 1/2 settles; and
(3) it is not named anywhere in AUTHORITY's list of "the two places this
disclosure is most directly contradicted" (only the tile and the narrator
slot are named) nor among CONTEXT 1-5. This is a genuine classification
question SCOPE 4 asks to be settled, not silently skipped — named here as a
**not-fixed hazard**: a future outcome that wants to correct it will need to
decide how (a second, non-generic code path for `price.value` alone, or
accepting the raw diff as an audit surface distinct from the report's
headline presentation) — a product/design call this outcome does not make.

## 7. Per-company delta, stated honestly (SCOPE item 5)

**NVDA — the only company any of this reaches today.** No `prices.json` row
exists (`FINAL OWNER RULING #205`).

- `AnalysisResult.price` — **unchanged**: `{ value: 0, timestamp: "" }`,
  §3.4's own sentinel, untouched by this outcome (confirmed:
  `nvdaRealRunObservation.test.ts`).
- `states.suppressing` — **gains one new binding**: `NOT_COMPUTED_BINDING.price`,
  `INCOMPLETE`, naming the missing price — confirmed by direct probe
  (`nvdaRealRunObservation.test.ts`, extended). This is the real delta: the
  five presentation surfaces (CONTEXT 1-5) now read this binding and show
  `INCOMPLETE` in place of `$0`/blank timestamp, instead of the flattened
  sentinel.
- `enterpriseValue`, `leverage`, `fairValueRange`, `trust.status`,
  `deriveVerdict`, `scenarioOutputs.priceLocationWithinRange` — **all
  unchanged**, exactly as `docs/noprice-honesty-reconciliation.md` and
  `docs/multiples-noprice-reconciliation.md` already left them.
- `scenarioOutputs.rateAtWhichBaseEqualsPrice` (CONTEXT 6) — **unaffected**:
  NVDA's real acquired run always has `revalueBaseCaseAtRate: null`
  (`recordedBundles.ts`), so the "no revaluation function supplied" branch
  fires first, unchanged by this fix, both before and after.
- `snapshotComparison.ts` (CONTEXT 7) — not exercised by this document's
  fixes (classified, not corrected); NVDA's own comparison behaviour is
  unchanged.
- No `INCOMPLETE` is removed. One new suppression is added where a `$0`
  figure previously stood, uncredited, on five separate surfaces.

**MSFT and OKLO — unaffected on their own committed fixtures.** Both always
carry a real, non-null price (`MSFT_FIXTURE`, `OKLO_FIXTURE`, byte-unchanged
per HARD BOUNDS), so `currentPrice` is never null for either: no new
suppression binds, every presentation surface renders exactly as before
(confirmed: full `AnalyzerReport.test.tsx`/`QuickRead.test.tsx` suites pass
unmodified), and CONTEXT 6's fix is a no-op for both (`MSFT_FIXTURE` has no
revaluation function; `OKLO_FIXTURE`'s own constant-`$31` function already
returned `NO SOLUTION IN RANGE` against its real `$14.50` price, for a
reason unrelated to price absence, both before and after this fix).

**Isolating probes (test code only, never a fixture edit).** Forcing
`enterpriseValue.price: null` on a *copy* of `MSFT_FIXTURE` or
`OKLO_FIXTURE` (new tests, §9) is the only way any of today's committed code
reaches the five corrected presentation branches or CONTEXT 6's corrected
branch — this fix is fully latent on every run this codebase currently
produces, in the same sense the two predecessor documents' fixes were.

**Any other company, real or fixture, that has a price.** Unaffected by
construction: every fix in this document changes only the `null` branch of
the existing `currentPrice`/`fixture.enterpriseValue.price` signal; the
non-null branch renders byte-identically to before.

## 8. What was checked, and what was not touched

- `lib/analyzer/verdict.ts`, `lib/analyzer/policy.ts` — byte-unchanged.
- `docs/frozen/` — no byte changed; `FROZEN_HASHES` — no entry changed.
- `lib/analyzer/acquisition/tagMap.ts`, `TAG_MAPPING_VERSION` — unchanged.
- `lib/analyzer/fixtures/msft.ts`, `fixtures/oklo.ts` — unchanged (every
  isolating probe builds a *copy* of a fixture with one field overridden, in
  test code only).
- `AnalysisResult.price` / `CompanyFixture.price` — unchanged, still always a
  value and a timestamp (§3.4, HARD BOUNDS). No nullability change, no new
  "approximate" state (`types.ts:1018-1019`'s own prohibition, untouched).
- No price acquisition of any kind — no `prices.json` row, no feed change,
  no network call, no widened capture. Every fix suppresses a *presentation*
  of an absence; none supplies a price.
- No §4.4 judgment made; no §11 item answered; no acceptance-matrix row
  marked; no verdict produced; no `INCOMPLETE` removed by assertion.
- No Analyzer V2 design change: no new route, component, layout, token, copy
  pattern or visual treatment anywhere in this diff. Every rendering change
  reuses an existing mechanism already in the same file (or, for
  `PriceChartPanel.tsx`, imported from the file that already has it) for an
  adjacent field.
- `enterpriseValue.ts`'s `REQUIRED_FIELD_NAMES`, the two enterprise-value
  gates (`treasuryMethodDilution`, `financeLeaseLiabilities`) — untouched.
- `npx tsc --noEmit` — clean.
- `npm test` — 2062/2063 passing; the one failure is the documented
  CI-exempt Playwright `chrome-headless-shell` baseline
  (`scripts/evidence/selfTest.test.ts`, `.github/workflows/ci.yml`'s named
  environmental exception). One existing test pinned the exact defect
  CONTEXT 6 corrects as if it were correct behaviour
  (`scenarioOutputs.test.ts`, "without changing rateAtWhichBaseEqualsPrice's
  existing $0-target behaviour") — updated here, per SCOPE item 7, and
  explicitly named as changed rather than deleted or skipped. No other
  existing test's expected value changed.

## 9. Tests reproducing this outcome in CI

No new parallel harness. Reused, per SCOPE item 5:

- `lib/analyzer/nvdaRealRunObservation.test.ts` — test (c), extended: direct
  probe confirming the new `NOT_COMPUTED_BINDING.price` binding is present,
  `INCOMPLETE`, on NVDA's real acquired run — the real-run regression for
  CONTEXT 1-5's signal.
- `lib/analyzer/assemble.test.ts` — two new describe blocks: one isolating
  the new `price` binding (MSFT copy, `enterpriseValue.price: null`) with a
  same-block regression proving `AnalysisResult.price` itself is untouched
  and a has-a-price run binds nothing; one isolating CONTEXT 6 (OKLO copy,
  same override), proving `rateAtWhichBaseEqualsPrice` is now `null` with
  the missing-price cause, with regressions proving the unmodified
  `OKLO_FIXTURE` (still `NO SOLUTION IN RANGE`, its own pre-existing,
  unrelated reason) and a run with both a real price and a real, solvable
  revaluation function are both unaffected.
- `lib/analyzer/modules/scenarioOutputs.test.ts` — the stale-pinned unit
  test updated (named in §8), plus a new regression proving a **real** `$0`
  price (never to be conflated with "no price") still solves
  `rateAtWhichBaseEqualsPrice` for real.
- `lib/analyzer/ai/slots.test.ts` — one new test: a priceless run's `price`
  slot is `INCOMPLETE`/suppressed and the `price.timestamp` slot is absent
  entirely, beside the existing has-a-price assertion.
- `app/components/QuickRead.test.tsx` — one new describe block: the
  "Current price" tile shows `INCOMPLETE` never `$0.00`, the "price as of"
  clause is omitted, both with a same-block has-a-price regression; plus one
  more test isolating the pre-revenue branch's own tile (`OKLO_FIXTURE`
  copy) — CONTEXT 3's other `ValuationStrip` branch.
- `app/components/AnalyzerReport.test.tsx` — one new describe block: Section
  A's price row renders `BoundStateBlock` (`INCOMPLETE`, cause, no `$0.00`
  or `.p` span) on a priceless run, with a has-a-price regression.
- `app/components/PriceChartPanel.test.tsx` — existing tests updated for the
  new required `priceState` prop (`null` = has a price, unchanged
  behaviour); one new test proving the whole panel body — figure, chart and
  caption — is replaced by `BoundStateBlock` when suppressed.

## Summary

| Item | Authority determines | Corrected? | Reachable today? |
|---|---|---|---|
| CONTEXT 1 — `ai/slots.ts` price/price.timestamp slots | §7.2 M1 + §4.2 (§10.6 row) + §4.3; `.bound()` already exists for the adjacent output | Yes — `.bound()`, new `NOT_COMPUTED_BINDING.price` | Latent — every current run either has a price or is NVDA (real, exercised) |
| CONTEXT 2/3 — `ValuationStrip.tsx` tiles, `AnalyzerReport.tsx` Section A | Same, plus each component's own existing bound-state precedent | Yes — inline state text / `BoundStateBlock`, reused verbatim | Latent for MSFT/OKLO; real for NVDA |
| CONTEXT 4 — `QuickRead.tsx` "price as of" | Same; `ValuationStrip`'s own "never a placeholder" precedent | Yes — clause omitted when suppressed | Latent for MSFT/OKLO; real for NVDA |
| CONTEXT 5 — `PriceChartPanel.tsx` | Same | Yes — whole panel body swapped for `BoundStateBlock` | Latent for MSFT/OKLO; real for NVDA |
| CONTEXT 6 — `scenarioOutputs.ts` `rateAtWhichBaseEqualsPrice` | §7.2 M1 / §4.3; existing `NOT_COMPUTED_BINDING.rateAtWhichBaseEqualsPrice` and null branch already exist | Yes — gated on `currentPrice === null` too | Latent for all three companies (NVDA/MSFT: no revaluation function ever supplied; OKLO: already `NO SOLUTION IN RANGE` for an unrelated reason) — reachable only via an isolating test probe |
| CONTEXT 7 — `snapshotComparison.ts`, `acquire.ts` | `acquire.ts`: not a sentinel read, out of scope. `snapshotComparison.ts`: a generic, comparative diff surface, not one of AUTHORITY's named presentation surfaces | `acquire.ts`: nothing to fix. `snapshotComparison.ts`: **not fixed** — named as a not-fixed hazard | `acquire.ts`: never reachable (guarded). `snapshotComparison.ts`: reachable on any comparison spanning a priceless run (NVDA, today) |

Every determined item was fully settled by current approved authority; none
required a `CALVIN REQUIRED:` gate. No run that has a price changes its
output or its rendering, for any company. No `INCOMPLETE` is removed.
`docs/multiples-noprice-reconciliation.md` is updated with a one-line
pointer to this document's CONTEXT 6 fix.
