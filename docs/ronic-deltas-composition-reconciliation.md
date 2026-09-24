# RONIC's two five-year deltas — composition reconciliation and the NVDA observation

`CF-RONIC-DELTAS-RECON-01` (issue #298). This document does what the
OUTCOME asks: reconcile whether current approved authority already
determines `ronic.fiveYearDeltaNopat` and `ronic.fiveYearDeltaInvestedCapital`
(`lib/analyzer/acquisition/companyInputs.ts:403-404`) well enough to acquire
them from the already-committed captures, and report what the already-committed
captures carry for whichever term is determined.

**This document reconciles and reports. It rules nothing.** It does not
answer §11 items 2 or 4 of `docs/verdict-methodology-reconciliation.md`, marks
no acceptance-matrix row satisfied, and does not construct an invested-capital
composition.

**Update, same OUTCOME-ID, second pass.** The section below (§1b, as
originally committed) found the denominator's *composition* undetermined and
ended on a closed `CALVIN REQUIRED:`. Calvin answered it —
**`CALVIN RULING — FINANCING-SIDE INVESTED CAPITAL`**, issue #298,
2026-09-24T17:24:14Z:

> For RONIC, define invested capital as: **total equity + interest-bearing
> debt + lease liabilities not already included in debt − cash − marketable
> securities**. Lease liabilities are counted exactly once… Goodwill remains
> included… Apply this definition consistently to both endpoints of the
> trailing five-year invested-capital change.

§2 below (rewritten) checks the already-committed captures against that now
-settled composition, per SCOPE item 2. It finds a **second, independent**
blocker: total equity is not present in any of the three captures at all —
not a composition question this time, but a data-availability one — and ends
on a second closed `CALVIN REQUIRED:` (§5, rewritten), the exact condition
this outcome's own CALVIN REQUIRED clause names ("the committed captures
genuinely lack the facts, so that only lifting the no-new-capture/EDGAR bound
could supply them"). The numerator, found determined below and unaffected by
either blocker, **is now acquired** (§3). Both an acquisition and a closed
`CALVIN REQUIRED:` remain success under this outcome's contract; this pass
delivers one of each — the numerator acquired, the denominator still blocked,
now for a data reason rather than a methodology one.

## 1. Step 1 — what current approved authority determines, per input

The frozen definition (`docs/frozen/calboard-stock-analyzer-v1-spec.md:646`,
`docs/frozen/calboard-valuation-methodology.md:313`, identical eleven-ish
words in both):

> RONIC = trailing five-year change in NOPAT ÷ trailing five-year change in
> invested capital, invested capital including lease-funded assets.

Spec `:382` lists both as REQUIRED M5 inputs. Spec `:455`'s cascade — a
missing REQUIRED input returns INCOMPLETE, "correct and must not be
softened" — governs whichever of the two below stays unacquired.

### 1a. `fiveYearDeltaNopat` (the numerator) — **determined**

NOPAT itself already has a live, current-year derivation
(`companyInputs.ts:383`):

```
nopat: track("nopat", nopatFrom(get("operating-income"), analyst.configuredConstants.nopatTaxRate))
```

`nopatFrom` (`companyInputs.ts:458-467`) is `operating-income × (1 −
nopatTaxRate)`, exactly the frozen formula's numerator, where `nopatTaxRate`
is one of the four `UNDEFINED_POLICY_CONSTANTS` (`lib/analyzer/policy.ts:68-73`)
— undefined **globally**, but already carried as an explicit **per-run
configured constant**, surfaced in every report, exactly as spec §7.1
requires ("must be surfaced as explicit configuration with their values
recorded in every report, not buried as literals in code"). NVDA's own
approved Step-7 bundle already configures one:
`configuredConstants.nopatTaxRate = "0.21"`
(`docs/analyst-drafts/nvda-step7-draft.md`, transcribed at
`lib/analyzer/nvdaRealRunObservation.test.ts:94`, round-tripped and asserted
at `:294`).

A **trailing five-year change** in that same figure needs nothing this
codebase does not already compute: `operatingIncomeTags`
(`companyInputs.ts:192`) already drives an `annualSeries` call at
`companyInputs.ts:195` (feeding `operatingMarginSeries`) on the exact same
tag list RONIC's numerator would use. `fiveYearDeltaNopat` is `NOPAT(current
fiscal year) − NOPAT(current fiscal year − 5)`, both computed from that same
series with the same single configured `nopatTaxRate` applied to each
endpoint — the identical pattern `calibration/inputs.ts`'s
`achievedRevenueCagr` (via `annualSeries` + `comparatorRecency`) already
uses for the achieved-growth comparator, on the same acquisition seam,
reused rather than invented per RETRIEVE FIRST item 5.

**Verdict: determined.** Current approved authority (the frozen formula,
spec §7.1's configured-constant contract, and the already-shipped
`nopatFrom`/`annualSeries` machinery) fixes both what this input means and
how to compute it from an already-committed capture, for a run that
configures `nopatTaxRate`.

### 1b. `fiveYearDeltaInvestedCapital` (the denominator) — **not determined**

The frozen text constrains only one term of an otherwise-absent definition:
it says invested capital must **include** lease-funded assets; it never says
what "invested capital" itself is composed of. There is no
`us-gaap:InvestedCapital` tag and no formula for it in any frozen artefact.

This is not a new finding. `docs/tag-mapping-version-review.md:254-263`
(§5.4, "RONIC's two five-year deltas — no definition to map against")
already reconciled this exact question and recorded, verbatim:

> `fiveYearDeltaInvestedCapital` is the blocker. **Invested capital is not a
> tagged element and is not defined as a formula in any frozen artefact.**
> All four say the same eleven words and no more: … "Including lease-funded
> assets" constrains one term of a definition that is otherwise absent.
> There is no `us-gaap:InvestedCapital`; the construct is some assembly of
> debt, equity, cash, working capital, net PP&E, ROU assets and goodwill,
> and **which** assembly is a methodology decision. The MSFT fixture carries
> a placeholder `100`.
>
> Constructing one here would be inventing methodology and writing it into a
> mapping whose whole claim is that it is a table. … **Stopped and
> returned:** RONIC needs a ruling on how invested capital is measured …
> before any acquisition work on it is possible.

`docs/lease-once-measurement.md` independently reconciled the "including
lease-funded assets" half of the same term on its own (whether a lease
liability nests inside an existing debt tag or has to be added on top) and
also stopped before writing any construction: *"Status: STOPPED before the
construction was written… No construction was written… the position
renderer remains disabled."* Its own §6 records what was ruled (what
`total-debt` means, 2026-09-09) and what stayed open (*"how nesting is
determined"*), and that open half is unresolved to this day — no commit
since has touched either `docs/tag-mapping-version-review.md` or
`docs/lease-once-measurement.md`.

Corroborating, not new, evidence: MSFT's own hand-authored M5 validation
fixture does not carry real invested-capital dollars either —
`lib/analyzer/fixtures/msft.ts:193-195` hard-codes
`fiveYearDeltaNopat: 17.8` and `fiveYearDeltaInvestedCapital: 100` (a
placeholder denominator chosen only to make the ratio come out to 17.8%),
exactly as `tag-mapping-version-review.md` already noted. No artefact in
this repository — frozen, mapping, or fixture — has ever expressed
"invested capital" as an assembly of specific tagged facts.

**Verdict, as originally reconciled: not determined.** Current approved
authority fixed one property of this term (leases must be included) and
nothing else — which facts sum to "invested capital" was a methodology
decision no frozen artefact, ruling, or prior CalFinance pass had made.

**Superseded by `CALVIN RULING — FINANCING-SIDE INVESTED CAPITAL`** (issue
#298, 2026-09-24T17:24:14Z, quoted in full above). Composition **is now
determined**: total equity + interest-bearing debt + lease liabilities not
already included in debt − cash − marketable securities, goodwill included,
lease liabilities counted exactly once, applied identically to both
endpoints of the trailing five-year change. §2 below checks the
already-committed captures against this ruled composition.

## 2. Step 2 — what the already-committed captures carry, for both now-determined terms

Read directly off the already-committed `CompanyFactsDocument` files
(`lib/analyzer/acquisition/captures/{nvda,msft,oklo}-companyfacts.json`) the
same way `calibration/inputs.ts` already does — no EDGAR fetch, no
`TAG_MAPPING_VERSION` bump, no re-acquisition.

### 2a. `fiveYearDeltaNopat` (unchanged from the first pass)

| Ticker | `operating-income` tag | Filed annual years | FY(current) | FY(current − 5) present? | Trailing 5-yr Δ NOPAT window |
|---|---|---|---|---|---|
| NVDA | `us-gaap:OperatingIncomeLoss` | 2014–2026 (13) | 2026 | **Yes** (FY2021) | FY2021 $4,532M → FY2026 $130,387M op. income (both endpoints present, `comparatorRecency` reports no live series skipped: `{ currentFiscalYear: 2026, reachedBy: null }`) |
| MSFT (contrast only) | `us-gaap:OperatingIncomeLoss` | 2014–2026 (13) | 2026 | Yes (FY2021) | FY2021 $69,916M → FY2026 $155,237M — acquired on MSFT's own real acquired run too (`reverseDcfOnRealRun.test.ts`); MSFT's hand-authored M5 fixture (`fixtures/msft.ts`) is a separate, untouched object and carries its own placeholder figures regardless |
| OKLO (contrast only) | `us-gaap:OperatingIncomeLoss` | 2021–2025 (5) | 2025 | **No** — FY2020 is not a filed year for this registrant | blocked; consistent with OKLO's existing Gate 1 `HISTORY INSUFFICIENT` state |

**On NVDA's own committed capture, both endpoints of `fiveYearDeltaNopat`'s
trailing five-year window exist**, on the single-tag, non-stale
`us-gaap:OperatingIncomeLoss` series, with the same `configuredConstants.
nopatTaxRate = 0.21` NVDA's approved bundle already carries. **Acquired this
pass** (§3).

### 2b. `fiveYearDeltaInvestedCapital` — the ruled composition against the captures

Each committed capture is a **trimmed** `CompanyFactsDocument` — not the full
SEC company-facts response, but exactly the `us-gaap` tags `TAG_MAP` (plus a
handful of footing/cross-check/candidate-investment companions) ever reads,
confirmed by listing every `us-gaap` key each file actually carries:

| Ticker | tags captured | `StockholdersEquity` / `…IncludingPortionAttributableToNoncontrollingInterest` | `LongTermDebt` (debt) | `FinanceLeaseLiability` (lease) | `CashAndCashEquivalentsAtCarryingValue` + `ShortTermInvestments` (cash) |
|---|---|---|---|---|---|
| NVDA | 24 | **absent** | present, FY2021 & FY2026 both covered | absent | cash present FY2021 & FY2026 both covered; `ShortTermInvestments` absent |
| MSFT | 26 | **absent** | present | present | both present |
| OKLO | 21 | **absent** | absent (only `LongTermDebtNoncurrent`) | present | cash present; `ShortTermInvestments` absent |

**Total equity is not present in any of the three captures — checked
directly against the JSON files, not inferred.** Neither
`us-gaap:StockholdersEquity` nor
`us-gaap:StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest`
appears anywhere in `nvda-companyfacts.json`, `msft-companyfacts.json` or
`oklo-companyfacts.json`. Nor does `us-gaap:Assets` or `us-gaap:Liabilities`
(the identity the ruling's own financing-side construction balances against)
— there is no already-captured route to total equity at all, by any name, on
any of the three filers. Debt and cash, by contrast, both carry FY(current)
and FY(current − 5) instant observations on NVDA's own capture (confirmed
directly against the same file: `LongTermDebt` and
`CashAndCashEquivalentsAtCarryingValue` both report 10-K-form instant rows
for FY2014 through FY2026, both endpoints included); NVDA's capture has no
separately tagged `FinanceLeaseLiability` at all, consistent with the ruling's
own "not already included in debt" carve-out reducing that term to nothing
additional where no separate tag exists.

**Why this is a capture question, not a mapping-governance one.** Debt,
lease liabilities and cash are each already `TAG_MAP` entries
(`total-debt`, `finance-lease-liabilities`,
`cash-and-marketable-debt-securities`) — reusing their existing
`.candidates` against the raw document, the way `calibration/inputs.ts`
already reuses `current-revenue`'s, needs no new tag and no version bump.
Total equity has never been a `TAG_MAP` entry, and the trimmed captures show
why an ad hoc unmapped tag read would not even have data behind it: the
figure was never captured, under any of its usual names, for any of the
three filers this milestone has ever acquired. Only a **new capture** — a
wider EDGAR pull carrying `StockholdersEquity` (or an equivalent identity
via `Assets`/`Liabilities`) — could supply it, and that is exactly what this
outcome's HARD BOUNDS forbid ("No new capture, EDGAR fetch or price fetch…
no re-acquisition… Only the already-committed captures").

## 3. What this pass acquires, and why it is a half-acquired ladder, honestly

SCOPE item 3: *"Acquire — only if steps 1 and 2 both come back fully
determined… Where an endpoint or a required term is genuinely missing, the
input stays null with its cause… If only one of the two is determined,
acquire that one and leave the other honestly null with its stated cause; a
half-acquired ladder that still reports INCOMPLETE is a truthful result, not
a failure."*

`fiveYearDeltaNopat` is now fully determined at both step 1 (formula) and
step 2 (data): `companyInputs.ts:403` (was `track("fiveYearDeltaNopat",
null)`) now calls a new `fiveYearNopatDelta` helper — `nopatFrom`'s existing
one-period derivation applied to both endpoints of the operating-income
annual series already read for `margins` (`companyInputs.ts:195`), refusing
with a null endpoint the same way `achievedRevenueCagr` does (RETRIEVE FIRST
item 5) rather than a second series harness. **Acquired**, for NVDA and MSFT
alike; still correctly blocked for OKLO, whose capture lacks the FY(−5)
endpoint.

`fiveYearDeltaInvestedCapital` (`companyInputs.ts:404`) is **left
unchanged, still `null`** — composition is no longer the blocker, but total
equity is genuinely absent from every already-committed capture (§2b), and
supplying it needs exactly the new-capture step this outcome's HARD BOUNDS
forbid. This is the SAME cascade discipline as before (spec `:455`, "correct
and must not be softened") for a DIFFERENT, now-precise reason: not an
undefined methodology choice, but a fact this milestone has never captured
for any filer. The ladder is therefore **half-acquired** exactly as SCOPE
item 3 anticipates — one real input, one honest null — and still reports
`INCOMPLETE`, a truthful result.

## 4. §12 evidence gap — status after this observation

`docs/verdict-methodology-reconciliation.md` §12's first evidence-gap
bullet — "at least one company whose RONIC ladder is not uniformly NOT
MEANINGFUL" — **stays open.** NVDA's RONIC ladder remains `INCOMPLETE`, now
`missing REQUIRED input(s): fiveYearDeltaInvestedCapital` alone (previously
both inputs), on the real run
(`lib/analyzer/nvdaRealRunObservation.test.ts`, updated this pass and still
green). MSFT's real acquired run (`reverseDcfOnRealRun.test.ts`, unchanged
and still green) also now acquires `fiveYearDeltaNopat`, but every cell
stays suppressed for the same reason — the ladder needs both inputs, and the
denominator is still null for MSFT too — so the visible cause string ("RONIC
not meaningful for this company (§7.2 M5 ladder)", `reverseDcf.ts`'s own
generic fallback for "no usable RONIC cell") is unchanged. Nothing
regressed for either company. This is genuine, verifiable progress on one
half of the gap (`fiveYearDeltaNopat`, now acquired and CI-asserted for
real filings) without closing the gap itself, which needs the other half.

## 5. CALVIN REQUIRED

**Term:** total equity (or an equivalent already-captured route to it, such
as `us-gaap:Assets` − `us-gaap:Liabilities`) for RONIC's denominator, under
the now-ruled financing-side composition.

**Why this is not a restatement of the answered question.** `CALVIN RULING
— FINANCING-SIDE INVESTED CAPITAL` settled *what the denominator is made
of*. This is a different, downstream question: *whether the already
-committed captures carry the data that composition needs.* They do not —
checked directly against the three capture files (§2b), not inferred from
the tag mapping. `docs/tag-mapping-version-review.md` and
`docs/lease-once-measurement.md` (the two prior stops the first CALVIN
REQUIRED cited) were both about composition, and neither reached this data
question, because neither had a ruled composition to check captures against
yet.

**Why this is the condition this outcome's own CALVIN REQUIRED clause
names:** *"the committed captures genuinely lack the facts, so that only
lifting the no-new-capture/EDGAR bound could supply them."* Total debt,
lease liabilities and cash are each already `TAG_MAP` entries with data
present on NVDA's own capture through both trailing-five-year endpoints
(§2b) — reusing them needs no new capture. Total equity is not a `TAG_MAP`
entry, was never captured under any of its usual names
(`StockholdersEquity`, the noncontrolling-interest variant, or the
`Assets`/`Liabilities` identity) for NVDA, MSFT or OKLO, and no code change
inside this outcome's bounds can produce it from what is already committed.

**The smallest closed set of options:**

1. **Lift the no-new-capture/EDGAR-fetch bound**, scoped narrowly to adding
   `us-gaap:StockholdersEquity` (with
   `StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest`
   as the usual fallback candidate) to `TAG_MAP` as a new `total-equity`
   entry, and re-running the existing capture step for NVDA, MSFT and OKLO
   to pull the additional tag alongside what is already committed — a
   `TAG_MAPPING_VERSION` bump and a mapping-version review
   (`docs/tag-mapping-version-review.md`'s own established process), not a
   new methodology.
2. **Leave the denominator permanently unacquired** under the current
   capture set, and let §12's first evidence gap stay open until a future,
   separately-authorised capture pass supplies total equity.
3. **Approve a different, already-derivable proxy for equity from what IS
   captured** (e.g., `sharesOutstanding × price`, both already-acquired
   facts) — flagged here only as an option Calvin could pick, explicitly
   **not recommended** by this reconciliation: market value of equity paired
   with book debt is not the book-for-book financing identity the ruling's
   own wording ("total equity" alongside "total debt", "cash and marketable
   securities") implies, and substituting it would be exactly the kind of
   un-ruled methodology choice `tag-mapping-version-review.md` and the
   ruling both mean to foreclose.

**Ending, second pass.** Per this outcome's TERMINAL CONTRACT, this was the
reconciliation ending on the denominator: `companyInputs.ts:404` stayed
`null`, and the run ended on a closed `CALVIN REQUIRED:` naming total
equity's absence from the already-committed captures — alongside a real,
committed, CI-tested acquisition of `fiveYearDeltaNopat`
(`companyInputs.ts:403`), which was not blocked by this question and was not
withheld pending its answer.

## 6. Update, third pass — capture authorised, blocked on this run's own network access

Calvin answered the second `CALVIN REQUIRED:` (§5 above) —
**`CALVIN RULING — AUTHORISE NARROW TOTAL-EQUITY CAPTURE`**, issue #298,
2026-09-24T17:47:12Z:

> Authorise lifting the no-new-capture / EDGAR bound only as required to
> supply the already-ruled RONIC invested-capital denominator. Add
> `total-equity` to the existing tag mapping using
> `us-gaap:StockholdersEquity`, with the appropriate noncontrolling-interest
> variant as fallback where required; bump `TAG_MAPPING_VERSION`; and re-run
> the existing capture path for NVDA, MSFT and OKLO.

This run is the one dispatched to act on that ruling. It attempted the
authorised capture step — add a `total-equity` `TAG_MAP` entry, bump
`TAG_MAPPING_VERSION`, and re-run
`npx tsx scripts/analyzer/capture-companyfacts.ts NVDA MSFT OKLO` to refresh
`lib/analyzer/acquisition/captures/{nvda,msft,oklo}-companyfacts.json` with
the additional tag — and could not: this run's own execution environment has
no path to `data.sec.gov`. The outbound network gateway this session runs
behind refuses the connection at the policy layer (`CONNECT data.sec.gov:443`
→ HTTP 403, "policy denial"), independent of and prior to any application-level
concern; `SEC_USER_AGENT` is also unset in this environment, which
`secClientFromEnv` (`lib/analyzer/acquisition/secClient.ts:328-333`) requires
and fails closed without, exactly as designed (`SecUserAgentMissingError`).
Both facts were confirmed directly (a `curl` to the EDGAR submissions
endpoint, and an environment check), not inferred.

**No code was changed for this reason.** `TAG_MAP` was deliberately left
without a `total-equity` entry, and `TAG_MAPPING_VERSION` was not bumped:
this file's own header requires the version to change whenever an entry
changes and to identify how a fact was actually obtained, and a version bump
with no corresponding re-capture would tag a future run's absent-equity
finding as "checked under the new mapping" when nothing was actually
re-fetched — the same kind of misrepresentation §4.3's "absence is a fact,
not a gap" discipline exists to prevent. `companyInputs.ts:403-404`'s comment
is corrected in place to record this (SCOPE item 6): the denominator is
blocked on an authorised-but-unperformed capture, not on an unresolved
composition question (§1b, superseded) and not on this outcome's own HARD
BOUNDS (superseded by the ruling above) — a narrower, more precise cause than
either prior pass recorded, and the true one as of this run.

**§12 status, unchanged again.** `docs/verdict-methodology-reconciliation.md`
§12's first evidence gap stays **open**: NVDA's RONIC ladder remains
`INCOMPLETE`, `missing REQUIRED input(s): fiveYearDeltaInvestedCapital`
alone, exactly as the second pass left it. Nothing regressed; nothing new
acquired this pass.

**Ending, third pass.** This is not a `CALVIN REQUIRED:` — both the
composition question (§1b) and the capture-authorisation question (§5) are
already ruled, and nothing about this pass's finding is a product, finance,
or permission judgement for Calvin to make. It is a concrete execution
blocker: the authorised capture needs outbound EDGAR access and a configured
`SEC_USER_AGENT` that this run's own environment does not provide. The run
ends `BLOCKED`, naming exactly that, so a future BUILD pass with EDGAR
network access can carry out the already-authorised capture and finish the
acquisition without re-litigating either ruling.
