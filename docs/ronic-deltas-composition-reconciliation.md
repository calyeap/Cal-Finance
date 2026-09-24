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
composition. Both a full acquisition and a closed `CALVIN REQUIRED:` are
success under this outcome's contract; the reconciliation below finds the
second.

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

**Verdict: not determined.** Current approved authority fixes one property
of this term (leases must be included) and nothing else. Which facts sum to
"invested capital" — debt, equity, cash, working capital, net PP&E,
ROU assets, goodwill treatment, and how a lease liability that is already
nested inside an existing debt tag (§`lease-once-measurement.md`, the UNP
case) is counted without double-counting — is a methodology decision no
frozen artefact, ruling, or prior CalFinance pass has made.

## 2. Step 2 — what the already-committed captures carry, for the determined term

Read directly off the already-committed `CompanyFactsDocument` files
(`lib/analyzer/acquisition/captures/{nvda,msft,oklo}-companyfacts.json`) the
same way `calibration/inputs.ts` already does — no EDGAR fetch, no
`TAG_MAPPING_VERSION` bump, no re-acquisition:

| Ticker | `operating-income` tag | Filed annual years | FY(current) | FY(current − 5) present? | Trailing 5-yr Δ NOPAT window |
|---|---|---|---|---|---|
| NVDA | `us-gaap:OperatingIncomeLoss` | 2014–2026 (13) | 2026 | **Yes** (FY2021) | FY2021 $4,532M → FY2026 $130,387M op. income (both endpoints present, `comparatorRecency` reports no live series skipped: `{ currentFiscalYear: 2026, reachedBy: null }`) |
| MSFT (contrast only) | `us-gaap:OperatingIncomeLoss` | 2014–2026 (13) | 2026 | Yes (FY2021) | FY2021 $69,916M → FY2026 $155,237M — for contrast only; MSFT's own M5 figures come from its hand-authored fixture, not acquisition |
| OKLO (contrast only) | `us-gaap:OperatingIncomeLoss` | 2021–2025 (5) | 2025 | **No** — FY2020 is not a filed year for this registrant | blocked; consistent with OKLO's existing Gate 1 `HISTORY INSUFFICIENT` state |

**On NVDA's own committed capture, both endpoints of `fiveYearDeltaNopat`'s
trailing five-year window exist**, on the single-tag, non-stale
`us-gaap:OperatingIncomeLoss` series, with the same `configuredConstants.
nopatTaxRate = 0.21` NVDA's approved bundle already carries.

Step 2 is not run for `fiveYearDeltaInvestedCapital`: step 1 found its
composition undetermined, so there is no defined set of facts to check the
capture for yet (checking for "debt, equity, cash, working capital, net
PP&E, ROU assets, goodwill" *as a composition* would itself be choosing one).

## 3. Why this does not become a half-acquired ladder

SCOPE item 3 gates acquisition on **both** step 1 and step 2 coming back
fully determined, and the OUTCOME's own text is explicit: *"if [current
approved authority] does not [determine those two inputs well enough],
stop."* Step 1 found one of the two terms — the denominator — undetermined
at the definition level, not merely short a data endpoint. That is a
different condition from SCOPE item 3's "half-acquired ladder" allowance,
which covers a term whose **composition is already settled** but whose
**data** turns out to be short an endpoint on a particular capture (the
shape OKLO's operating-income window above shows). Writing a real
`fiveYearDeltaNopat` derivation into `companyInputs.ts:403` while leaving
`fiveYearDeltaInvestedCapital` null would still require picking *some*
invested-capital composition to decide the denominator is null "for the
right reason" rather than merely unimplemented — and picking one is exactly
the invented methodology `tag-mapping-version-review.md` already refused,
and this outcome's HARD BOUNDS refuse again. `companyInputs.ts:403-404` is
therefore left unchanged by this outcome.

## 4. §12 evidence gap — status after this observation

`docs/verdict-methodology-reconciliation.md` §12's first evidence-gap
bullet — "at least one company whose RONIC ladder is not uniformly NOT
MEANINGFUL" — **stays open.** NVDA's RONIC ladder remains
`INCOMPLETE`/`missing REQUIRED input(s): fiveYearDeltaNopat,
fiveYearDeltaInvestedCapital` on the real run
(`lib/analyzer/nvdaRealRunObservation.test.ts:143-191`, unchanged and still
green), and MSFT's remains `RONIC NOT MEANINGFUL` off its hand-authored
placeholder (`lib/analyzer/reverseDcfOnRealRun.test.ts:57-69`, unchanged).
Nothing regressed for either company; nothing was acquired for either
company. This is not a new finding about NVDA's fundamentals — it is the
same pipeline-wide gap `docs/nvda-realrun-observation.md` §(a) already
named, now reconciled one level deeper: one half of the gap
(`fiveYearDeltaNopat`) is closable with no new authority, and the other half
(`fiveYearDeltaInvestedCapital`) is not closable without one.

## 5. CALVIN REQUIRED

**Term:** the composition of "invested capital" in RONIC's denominator —
`docs/frozen/calboard-valuation-methodology.md:313` and
`docs/frozen/calboard-stock-analyzer-v1-spec.md:646` both fix only that it
must include lease-funded assets; neither, nor any other frozen artefact,
names which captured facts sum to "invested capital" itself.

**What is already on record about it:** `docs/tag-mapping-version-review.md`
§5.4 (`:254-263`) already reconciled this and stopped, naming the construct
as "some assembly of debt, equity, cash, working capital, net PP&E, ROU
assets and goodwill" with the choice among them undetermined;
`docs/lease-once-measurement.md` independently stopped on the
lease-inclusion half of the same term (whether a lease liability already
nested inside an existing debt tag, as UNP's is, can be added on top without
double-counting). Neither stop has been lifted by a ruling since
(2026-09-09 is the most recent edit to either file; the one ruling that
document records, "what `total-debt` means," settles a different question
than invested-capital composition itself).

**The smallest closed set of options**, none adopted here:

1. **Financing-side / capital-employed:** total debt (incl. finance-lease
   liabilities, counted once per the UNP nesting rule already ruled at
   `lease-once-measurement.md` §6) + total equity − cash and marketable
   securities.
2. **Operating-asset side:** net working capital + net PP&E + finance-lease
   (and, if in scope, operating-lease) ROU assets + other long-term
   operating assets, with goodwill included or excluded as a named
   sub-choice — the methodology's own text flags this exact sub-choice
   without resolving it (`calboard-valuation-methodology.md:303-319`: "22.0%
   excluding ~$69B of Activision goodwill" read *alongside*, not in place
   of, the 17.8% figure that keeps goodwill in).
3. **Capital-employed variant:** total assets − non-interest-bearing
   current liabilities.

Any of the three (and their goodwill in/out sub-variants) is a defensible
textbook construction; none is implied by the frozen text over the others,
and choosing one here — for every company this mapping version acquires, at
once — is the invented-methodology risk `tag-mapping-version-review.md`
already declined to take.

**Ending.** Per this outcome's TERMINAL CONTRACT, this is the reconciliation
ending: `companyInputs.ts:403-404` stays unchanged, no second document is
created beyond this one, and the run ends on a closed `CALVIN REQUIRED:`
naming the composition of invested capital, not a PR implementing an
acquisition.
