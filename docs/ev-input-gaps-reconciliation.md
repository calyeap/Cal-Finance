# The two non-§4.4 enterprise-value input gaps — reconciliation

`CF-EV-INPUT-GAPS-RECON-01` (issue #300). This document does what the
OUTCOME asks: reconcile, against current approved authority,
`treasuryMethodDilution` and `financeLeaseLiabilities` — the two of NVDA's
three missing enterprise-value REQUIRED inputs that are independent of the
unmade §4.4 judgment (`docs/nvda-realrun-observation.md` §(c)) — and acquire
only what authority fully determines.

**This document reconciles and reports. It rules nothing.** It answers none
of §11's open items, marks no acceptance-matrix row satisfied, and produces
no verdict (`docs/product-decisions.md` items 3 and 9).

**Result, stated up front.** Both terms carry a determination. Neither is
acquired. Both end as **named gates**, not a `CALVIN REQUIRED:` — current
approved authority is not silent on either term; it determines the term's
meaning (§1) or its treatment (§2) fully, and what blocks acquisition in
both cases is that doing so would need acquisition machinery this outcome's
own SCOPE item 3 and HARD BOUNDS forbid building. NVDA's enterprise value
stays `INCOMPLETE` with the **same three** missing REQUIRED inputs it
already reported before this outcome. Nothing in `companyInputs.ts`,
`tagMap.ts`, or `enterpriseValue.ts` is changed.

## 1. `treasuryMethodDilution` — what authority determines

**The quantity.** §3.5's own text: market capitalisation is "most recent
shares outstanding from the filing cover page or balance sheet, **plus**
treasury-method dilution from options, RSUs and warrants per the equity
note. **Not** the weighted-average diluted share count."
(`docs/frozen/calboard-stock-analyzer-v1-spec.md:241`.) The mapping's own
recorded basis for this factId
(`lib/analyzer/acquisition/tagMap.ts:142-156`): "The incremental shares in
the diluted-EPS denominator ARE the treasury-method dilution from options,
RSUs and warrants — that is what the tag means and how the figure is
computed under ASC 260. Cross-checkable exactly: diluted weighted-average
minus basic weighted-average must equal this." That cross-check is wired
and live (`lib/analyzer/crosschecks/reconciliation.ts:36-55`,
"treasury-method dilution equals diluted less basic weighted-average
shares") — it treats the identity as **exact**, not approximate.

**Is it the same quantity?** Yes. §3.5's own definition of the term and the
mapping's own basis for the one candidate tag it names
(`IncrementalCommonSharesAttributableToShareBasedPaymentArrangements`) agree
that this quantity **is** diluted weighted-average shares minus basic
weighted-average shares under ASC 260 — the tagged element and the
arithmetic difference are two ways of observing the identical figure, which
is exactly why the cross-check can assert equality rather than mere
plausibility.

**Does §3.5's refusal reach the difference, or only the base?** Only the
base. The refused quantity is "the weighted-average diluted share count,"
used **as the share-count base itself** — §3.5's own gloss: "Not the
weighted-average diluted share count, which is a backward-looking average of
the period." `treasuryMethodDilution` is not that count; it is the
**difference** between two counts, added onto the cover-page shares
outstanding, which is a different quantity than either count alone. Nothing
in §3.5, §3.8 (which lists "shares outstanding and the treasury-method
dilution added to it" as one of the material facts requiring confirmation,
`:284`, treating them as two related-but-distinct figures) or the mapping's
basis text extends the refusal to the difference. **Determined**: the
refusal governs the base only.

**Is taking that difference an authorised acquisition path, or a new
methodology choice?** This exact question was already reconciled once,
for this exact filer, in a prior committed pass —
`docs/tag-mapping-version-review.md` §5.3 ("treasury-method-dilution — no
tag exists on the six," 9 September 2026):

> For NVDA, KO and UNP the quantity is exactly recoverable as diluted
> weighted-average minus basic weighted-average — both tagged, both already
> acquired as §3.8.2 reconciliation companions, and that identity is what
> the tag *means* under ASC 260. But that is a **derivation, not a tag**,
> and §3.8.1 guard 1 puts a deterministic calculation on the queued side of
> the line. Building it would add a queued §3.8 material fact for six
> companies — a spot-check-queue decision, which this pass is told not to
> touch.

That finding is not superseded by anything since. §3.8.1 guard 1
(`docs/frozen/calboard-stock-analyzer-v1-spec.md:312`) is unchanged: "It is
granted by acquisition path, never by extraction-type label alone. A fact
marked DETERMINISTIC/STRUCTURED that did **not** come through a fixed,
versioned tag mapping — a structured feed field with no tag mapping, or a
**deterministic parse** — is queued." A diluted-minus-basic derivation is
exactly that: `acquire.ts`'s existing `derivedFactRecord` pattern (used
today for `net-debt` and `cash-fcf`,
`lib/analyzer/acquisition/acquire.ts:152-172,283-346`) stamps
`extractionType: "DETERMINISTIC/STRUCTURED"` with no tag-mapping version on
anything it produces — never exempt, always queued. Making
`treasury-method-dilution` resolve this way for NVDA (or any of the other
five filers `tag-mapping-version-review.md` named) would mean a **second**
way of acquiring that same factId — tag lookup when the primary candidate
resolves, arithmetic derivation when it does not — layered onto the
existing `TAG_MAP` seam rather than expressed through it. `TagCandidate`
(`tagMap.ts:75-78`) composes candidates only by **addition** (`plus`); nothing
in it subtracts. That is precisely the condition this outcome's own SCOPE
item 3 names: *"If a determined identity cannot be expressed through the
existing candidate composition without new acquisition machinery (the
current composition adds components; it does not subtract), say so and
treat it as a gate — do not build a second acquisition path."*

**Verdict: determined identity, named gate — not acquired.** Current
approved authority fully determines what the quantity is and that §3.5's
diluted-count refusal does not reach it. It does not license building the
derivation as a second acquisition path for this factId, and a prior
committed reconciliation already found the identical thing for this
identical filer and declined to build it for the same reason (a
spot-check-queue decision outside that pass's scope, and outside this
one's HARD BOUNDS, which permit only what "resolves entirely from facts
those captures already carry" through the **existing** candidate
composition — not new acquisition machinery). Both raw companion tags
(`WeightedAverageNumberOfDilutedSharesOutstanding`,
`WeightedAverageNumberOfSharesOutstandingBasic`) are present in NVDA's
already-committed capture (confirmed directly against
`lib/analyzer/acquisition/captures/nvda-companyfacts.json`, lines 18672 and
20360) — this is not a data-availability gap. It is a HARD BOUNDS gate: no
second acquisition path is built here, so `treasuryMethodDilution` stays
`null` for NVDA, exactly as it already was.

**OKLO, per HARD BOUNDS.** Nothing above reaches OKLO's own recorded
absence (`CF-S44-RECORD-01`, issue #189) as a "pure consequence" — this
reconciliation changes no code, so OKLO's own missing
`treasury-method-dilution` is untouched and stays the recorded finding
#189 left it as.

## 2. `financeLeaseLiabilities` — what authority determines

**The EV bridge treats it as its own separately REQUIRED term.** §3.5:
"EV = market capitalisation + total debt + **finance** lease liabilities −
cash and marketable debt securities − non-operating equity investments"
(`:238`). §4.2's REQUIRED-inputs table lists "total debt" and "finance lease
liabilities" as **two separate** entries for "Enterprise value and every
EV-based multiple" and again for the leverage precondition (`:377-378`) —
never folded into one combined "debt-like liabilities" term. The mapping's
own basis for this factId (`tagMap.ts:225-231`) says nothing about an
absent tag reading as zero: "FINANCE leases only; operating leases stay in
opex and out of the bridge... Verified against mock-report-msft.html's
stated $66.6B" — a statement about scope (finance vs. operating), not about
what an absence means.

**The #298 carve-out, named exactly.** `CALVIN RULING — FINANCING-SIDE
INVESTED CAPITAL` (issue #298, 2026-09-24T17:24:14Z, quoted in full):

> For RONIC, define invested capital as: **total equity + interest-bearing
> debt + lease liabilities not already included in debt − cash − marketable
> securities**. Lease liabilities are counted **exactly once**. If an
> existing debt tag already includes the relevant lease liability, count it
> via the debt figure and do not add that lease liability separately. Add a
> separately captured lease liability only when it is not already contained
> in the debt figure. Goodwill remains included... Apply this definition
> consistently to both endpoints of the trailing five-year invested-capital
> change. Do not introduce proxies, estimates, defaults, or double-counting
> for genuinely missing facts.

This ruling opens with "**For RONIC**" and answers a question §3.5 never
asked: RONIC's invested-capital denominator has **no frozen formula at
all** before this ruling (`docs/ronic-deltas-composition-reconciliation.md`
§1b: "Invested capital is not a tagged element and is not defined as a
formula in any frozen artefact"), so the ruling had to construct a
composition from scratch — and, in doing so, it *chose* to treat debt and
lease liabilities as one combined financing-side quantity with a
no-double-count clause, because nothing pre-existing said otherwise. §3.5's
EV bridge is the opposite case: it is **already** a fully specified, frozen
formula (§3.5, applied "identically to every company," §9 mistake 18) that
has always kept "total debt" and "finance lease liabilities" as two
independently REQUIRED, separately-summed terms (§4.2), with its own
`TAG_MAP` entries carrying no "not already included in debt" language.
There is no textual basis in §3.5, §4.2, §4.3, or the `finance-lease-
liabilities` mapping entry's own basis for reading the #298 ruling's
carve-out — written for a term the frozen spec never defined — into a term
the frozen spec already defines and treats differently.

**§4.3 governs directly.** "Rule: an OPTIONAL input that is absent is shown
as absent... Absence is never rendered as zero" (`:398`) is about OPTIONAL
inputs; `financeLeaseLiabilities` is REQUIRED for EV (§4.2), and §5.2's
table is explicit for a REQUIRED input: missing → `INCOMPLETE`, no number
(`:436`). Nothing rules a REQUIRED-and-absent finance-lease-liability figure
as a zero contribution to the EV bridge specifically — that reading exists,
ruled, but only for RONIC's differently-defined, previously-undefined
invested-capital term.

**Verdict: determined — the carve-out does not extend here.** Current
approved authority determines that `financeLeaseLiabilities` stays
REQUIRED-and-absent for the EV bridge on a filer with no separately tagged
finance-lease liability; it is not read as a zero contribution the way
RONIC's ruled, previously-blank term now is. The #298 carve-out is not
extended to §3.5's EV bridge, in either direction, by this reconciliation.

**Verdict: named gate, not acquired.** NVDA's already-committed capture
carries no `us-gaap:FinanceLeaseLiability` tag at all — confirmed directly
against `lib/analyzer/acquisition/captures/nvda-companyfacts.json` (zero
occurrences) — and that tag is the mapping's **only** candidate for this
factId (`tagMap.ts:229`). There is no second candidate to add and no
already-committed fact this outcome could acquire in its place: this is a
genuine capture gap (the same class HARD BOUNDS names — "No new EDGAR
capture and no re-capture... anything needing a fresh fetch, a newly pulled
tag, or a widened capture surface is a gate, not a decision"), not an
ambiguity for Calvin to rule on. `financeLeaseLiabilities` stays `null` for
NVDA, exactly as it already was.

## 3. What this reconciliation acquires

**Nothing.** `lib/analyzer/acquisition/companyInputs.ts`,
`lib/analyzer/acquisition/tagMap.ts` and
`lib/analyzer/modules/enterpriseValue.ts` are byte-unchanged. Both terms
carry a full determination (§1, §2 above) and both end as named gates, per
this outcome's own DONE WHEN ("either an acquisition reproduced in CI or a
named gate — no term left ambiguous in the record"). No `TAG_MAP` entry
and no `TAG_MAPPING_VERSION` change, so no `docs/tag-mapping-version-
review.md` review section is needed this pass.

**Reproduced in CI, unchanged.** `lib/analyzer/nvdaRealRunObservation.test.ts:256-260`
already asserts, on the real acquired NVDA run, that
`diagnostics.enterpriseValue` is `INCOMPLETE` with cause `"missing REQUIRED
input(s): treasuryMethodDilution, financeLeaseLiabilities,
nonOperatingEquityInvestmentsAtBook"` — the exact state this reconciliation
finds unchanged. That existing test, run unmodified, is this outcome's own
CI reproduction of both gates: no second test harness is needed because
nothing about the run's output changes.

## 4. Downstream consequence, honestly

**NVDA's enterprise value stays `INCOMPLETE`, for the same three REQUIRED
inputs.** This reconciliation does not reduce the missing set from three to
two: `treasuryMethodDilution` (§1, gated) and `financeLeaseLiabilities` (§2,
gated) both stay `null`, and `nonOperatingEquityInvestmentsAtBook` stays
`null` because the §4.4 judgment is untouched (HARD BOUNDS). **All three of
NVDA's REQUIRED enterprise-value inputs remain missing after this
outcome** — not two, not one. Nothing here changes that count.

Because enterprise value is unchanged, everything `docs/nvda-realrun-
observation.md` §(c) already reports as cascading from it is unchanged
too: `priceImplied.reverseDcfGrid` (`INCOMPLETE`, `missing REQUIRED
input(s): targetEnterpriseValue`), `gates.leverage`
(`LEVERAGE UNSUPPORTED IN v1`), `fairValueRange` (suppressed on the same
cause), `trust.status` (`UNUSABLE`), and `deriveVerdict` (`INCOMPLETE`).
The RONIC ladder (`diagnostics.reinvestmentRonic.ronic`, CLEAN at 75.24%
per `CF-RONIC-DELTAS-RECON-01`) is unaffected — it depends on RONIC's own,
differently-defined invested-capital term (§2 above), not on §3.5's EV
bridge. Making the §4.4 judgment alone, separately from this outcome, would
still leave enterprise value `INCOMPLETE` on two independently missing
inputs — exactly the state the merged observation already described before
this outcome, restated rather than changed.

## 5. The zero-price hazard — named, not fixed

`enterpriseValue.price` is never `null` on a priceless run:
`buildAcquiredRun`'s own sentinel supplies `{ value: 0, timestamp: "" }`
(`docs/nvda-realrun-observation.md` §(c)), and `companyInputs.ts:360` wires
that sentinel straight into `enterpriseValue.price` unconditionally.
`computeEnterpriseValue`'s own REQUIRED check
(`lib/analyzer/modules/enterpriseValue.ts:37`,
`input[name] === null`) does not catch it, because the sentinel is a
`SourcedValue` wrapping `Decimal(0)`, not `null`. **On NVDA's own run
today this is not yet realised**, because two other REQUIRED inputs
(`treasuryMethodDilution`, `financeLeaseLiabilities`, per §1–§2 above) and a
third (`nonOperatingEquityInvestmentsAtBook`, §4.4 unmade) are still
genuinely `null` and trip the REQUIRED-missing check first — enterprise
value returns `INCOMPLETE` before the zero-price sentinel is ever reached
as the deciding factor. But the sentinel itself is unconditional and
independent of this outcome: if a future pass filled all seven REQUIRED
fields for a company with no price row (a §4.4 answer, a `treasury-method-
dilution` or `finance-lease-liabilities` acquisition or an authorised
zero-reading, all without a `prices.json` row), `computeEnterpriseValue`
would produce a **computed** enterprise value off a $0 market cap — a
number, not an `INCOMPLETE`. This is reported as an observed fact about the
current build's REQUIRED-field check, in the same "reported, not fixed"
form `docs/nvda-realrun-observation.md` already used for
`scenarioOutputs.priceLocationWithinRange`. Per HARD BOUNDS: **not fixed
here** — no change to the sentinel, no price row, no softening of `FINAL
OWNER RULING #205`'s honest-`INCOMPLETE` posture.

## 6. What was checked, and what was not touched

- `lib/analyzer/verdict.ts`, `lib/analyzer/policy.ts` — untouched.
- `docs/frozen/` — no byte changed; `FROZEN_HASHES` — no entry changed.
- `lib/analyzer/modules/scenarioOutputs.ts` — untouched.
- `lib/analyzer/fixtures/msft.ts`, `lib/analyzer/fixtures/oklo.ts` —
  unchanged.
- `lib/analyzer/acquisition/tagMap.ts`, `TAG_MAPPING_VERSION` — unchanged
  (still `calboard-secmap-2026-09-3`); no mapping-version review needed.
- `lib/analyzer/acquisition/companyInputs.ts`,
  `lib/analyzer/modules/enterpriseValue.ts` — unchanged.
- No §4.4 selection made; no §11 item answered; no acceptance-matrix row
  marked; no verdict produced; no `INCOMPLETE` removed by assertion.
- `npx tsc --noEmit` — clean.
- `npm test` — green apart from the documented CI-exempt Playwright
  `chrome-headless-shell` baseline
  (`scripts/evidence/selfTest.test.ts`, `.github/workflows/ci.yml`'s named
  environmental exception); `lib/analyzer/nvdaRealRunObservation.test.ts`
  and every other suite touching enterprise value, RONIC or the reverse-DCF
  grid pass unmodified.

## Summary

| Term | Authority determines | Acquired? | Ending |
|---|---|---|---|
| `treasuryMethodDilution` | Same quantity as diluted − basic weighted-average shares (ASC 260); §3.5's diluted-count refusal reaches only the share-count base, not this difference | No | Named gate — expressing it needs a second acquisition path (`TagCandidate` composes by addition only); this outcome's own SCOPE item 3 and HARD BOUNDS forbid building one, and a prior reconciliation (`tag-mapping-version-review.md` §5.3) already found and declined the identical thing for this identical filer |
| `financeLeaseLiabilities` | The `#298` "For RONIC" carve-out is scoped to RONIC's own, previously-undefined invested-capital term and does not extend to §3.5's EV bridge, which already separately requires this term with no zero-reading language | No | Named gate — NVDA's capture carries no `us-gaap:FinanceLeaseLiability` tag at all, and the mapping has no second candidate; a new capture is out of HARD BOUNDS |

Both endings are the outcome's own defined success condition (a determined
term expressed as an acquisition or a named gate). NVDA's enterprise value,
and everything that cascades from it, is unchanged by this reconciliation.
