# TAG_MAPPING_VERSION review — `calboard-secmap-2026-09-1` → `-09-2`

**Status: the bump is made and this is the review §3.8.1 requires of it.** No
frozen artefact was touched. Eight contract hashes verified before any work.

Spec §3.8.1 line 294 rests the queue exemption on the fact that a mis-mapped
tag is "caught by §3.8.2 and by the mapping's own version review — not by an
analyst confirming one figure at a time." **The version bump is that review's
trigger.** A bump without a review removes the control the exemption depends
on, and the exemption is what keeps roughly fifteen facts per company out of
the spot-check queue. This document is the review, and the harness that
produced it is `scripts/analyzer/tag-mapping-review.ts`.

Reproduce:

```bash
npx tsx scripts/analyzer/tag-mapping-review.ts
```

Every figure below comes from that run, against live EDGAR on 9 September 2026,
across the ten companies of `CALIBRATION_SET`. The full output is written to
`.evidence/tag-mapping-review/review.txt`.

---

## 1. What the bump contains — two changes, one version, one review

Batched deliberately: each bump triggers a review of every previously acquired
fact, and two passes would mean two reviews for one outcome.

**Change 1 — the selection rule.** A candidate whose series the filer has
stopped reporting no longer wins over one that is current. Applied in all three
places that shared the defective rule: `selectTagged.resolveEntry` (the
current-period fact), `history.annualSeries` (the history the comparator reads),
and `history.quarterlySeries` (the run-rate module). Fixing fewer than three
would have left the headline fact and its own history reading different
elements, which is the mixed basis §3.7 refuses.

**Change 2 — one candidate added.** `total-debt` gains
`LongTermDebtNoncurrent + LongTermDebtCurrent (+ CommercialPaper, ShortTermBorrowings)`,
ranked last. Four of the five items on M8-c's list turned out **not** to be
missing candidates; §5 records what each turned out to be instead.

### The ruling this pass needed

**The selection rule is part of what `TAG_MAPPING_VERSION` identifies.** §3.8.1
requires a *fixed, versioned* mapping with the version recorded on the fact. If
the same version could resolve different tags depending on selection logic
living outside the mapping, the version would no longer identify how the fact
was obtained — it would name the table while something else picked the row.
Changing selection therefore bumps the version exactly as adding a candidate
does. That ruling is now written into `tagMap.ts` beside the version string and
into `selectTagged.ts`'s header, so the next person to touch selection meets it
before they touch it.

---

## 2. The rule, stated so it can be reviewed rather than inferred

> A candidate whose latest reported period is older than the filer's own latest
> reported annual fiscal year does not win over a candidate that is current.
> Where **no** candidate is current, the first still wins. Where the filer has
> filed no annual figure at all, the rule is inert.

**"Current" is `latestAnnualFiscalYear` — the filer's own latest reported annual
fiscal year, taken tag-blind.** That definition is not new here: it is the one
Defect D already ruled on for the comparator, and it is imported rather than
re-derived, because a second copy that drifted would let acquisition and the
comparator disagree about the same filing. It is not the clock — every filer is
months behind the calendar between its year end and its 10-K, and a clock-based
test would call all of them stale. It is not the chosen tag, because asking the
chosen tag how far it runs is the question that produced the defect: it can only
ever answer "as far as I go".

**The two bounds are load-bearing, not cautious.** Refusing to resolve where
every candidate is stale would move a fact off the §3.8.1 exempt path and into
the spot-check queue — changing *which* facts are exempt rather than only which
values they carry. That is a Command Center decision and explicitly outside this
pass. The rule therefore never withholds a figure; it only re-orders candidates.
Both bounds carry their own tests.

---

## 3. Every fact whose resolution changed

Eight, across five companies. Five come from the selection rule, three from the
added candidate.

| Company | Fact | Before | After | Why |
|---|---|---|---|---|
| **NVDA** | current-revenue | **$26.914bn** @ 2022-01-30 `RevenueFromContractWithCustomerExcludingAssessedTax` | **$215.938bn** @ 2026-01-25 `Revenues` | Defect D's headline. NVIDIA retired the ASC 606 element after its FY2022 10-K; `Revenues` is candidate #2 of the same entry and runs through FY2026. |
| **NVDA** | capex | **$138.7m** @ 2012-01-29 `PaymentsToAcquirePropertyPlantAndEquipment` | **$6.042bn** @ 2026-01-25 `PaymentsToAcquireProductiveAssets` | **Fourteen years stale, and nobody had found it.** The first tag has exactly three rows, FY2010–FY2012, and stops. |
| **INTC** | depreciation-and-amortisation | **$200.0m** @ 2019-12-28 `DepreciationAndAmortization` | **$11.706bn** @ 2025-12-27 `Depreciation + AmortizationOfIntangibleAssets` | The third candidate ran FY2015–FY2019 and stopped; the fourth runs to FY2025. See §6.1 — the old figure was also wrong in magnitude *at the time*. |
| **LLY** | total-debt | **$33.812bn** @ 2024-12-31 `LongTermDebt + CommercialPaper` | **$42.503bn** @ 2025-12-31 `DebtLongtermAndShorttermCombinedAmount` | `LongTermDebt` stops at FY2024; the combined element continues. |
| **UNP** | sbc | **$107.0m** @ 2023-12-31 `ShareBasedCompensation` | **$142.0m** @ 2025-12-31 `AllocatedShareBasedCompensationExpense` | `ShareBasedCompensation` stops after FY2023; the second candidate continues to FY2025. |
| **COST** | total-debt | **$6.618bn** @ 2022-05-08 `LongTermDebt` | **$5.670bn** @ 2026-05-10 `LongTermDebtNoncurrent + LongTermDebtCurrent` | Costco stopped tagging a debt total in 2022 while continuing to report both halves. Needed the new candidate: selection alone had nothing current to switch to. |
| **RIVN** | total-debt | **$5.526bn** @ 2024-06-30 `LongTermDebt` | **$4.444bn** @ 2026-06-30 `LongTermDebtNoncurrent` | Same shape as Costco, two years less stale. |
| **OKLO** | total-debt | **NOT ACQUIRED** | **$700,000** @ 2026-06-30 `LongTermDebtNoncurrent` | The recorded gap. Oklo tags no debt total at all. |

### Each change checked, not asserted

The dispatch's standing instruction is that any figure moving by this much was
wrong before or is wrong now, and the review is where that gets looked at rather
than assumed. Each was checked against the filings directly:

- **NVDA revenue.** `RevenueFromContractWithCustomerExcludingAssessedTax` has six
  annual years, FY2017–FY2022, and no row of any form ends later.
  `Revenues` has eighteen, FY2008–FY2026. The old figure was NVIDIA's FY2022
  revenue, correct for FY2022 and four years out of date.
- **NVDA capex.** `PaymentsToAcquirePropertyPlantAndEquipment`: FY2010 $77.6m,
  FY2011 $97.9m, FY2012 $138.7m, then nothing.
  `PaymentsToAcquireProductiveAssets`: FY2022 onward, FY2024 $1.069bn, FY2025
  $3.236bn, FY2026 $6.042bn. Two disjoint series; the old rule took the one that
  ended in 2012.
- **INTC D&A.** `Depreciation` FY2025 $10.757bn + `AmortizationOfIntangibleAssets`
  FY2025 $0.949bn = $11.706bn, which is Intel's reported D&A. The retired
  `DepreciationAndAmortization` carried its entire life in five rows — FY2015
  $265m, FY2016 $294m, FY2017 $177m, FY2018 $200m, FY2019 $200m — against a real
  D&A near $10bn in those years, so it was never the whole quantity.
- **LLY total debt.** The strongest evidence available: the two candidates
  **overlap**. At 2024-12-31 the old path gives $33.812bn and the combined
  element gives $33.644bn — 0.5% apart, the difference being classification of
  short-term borrowings. The switch is a like-for-like refresh to a fresher
  date, not a definitional jump.
- **UNP SBC.** The two candidates also overlap, and **agree exactly**: both
  report $107m at FY2023. `AllocatedShareBasedCompensationExpense` then continues
  to FY2024 $118m and FY2025 $142m.
- **COST / RIVN / OKLO total debt.** The new candidate is the two halves
  `us-gaap:LongTermDebt` is *defined* to foot to, which is why the §3.8.2 footing
  check runs against it unchanged — `componentsFor` foots a summed entry against
  its own contributing tags.

**No change is unexplained.** Every one is a filer changing which element it
tags, with the two series overlapping or abutting cleanly.

---

## 4. The §3.8.1 boundary — the question that decides whose call this was

The dispatch's stop condition: if fixing selection changed which facts are
**exempt** from spot-check, rather than only which values they carry, that moves
facts across the §3.8.1 boundary and is a Command Center decision.

**Measured, in two parts, because the two changes have to be judged separately.**

**The selection rule, measured on its own before any candidate was added:**

> Facts whose resolution changed: **5**. Facts that started or stopped being
> acquired: **0**.

Five values moved. Nothing crossed the line. That is the finding that kept this
inside an acquisition pass, and it is a property of the rule rather than luck:
the rule only re-orders candidates that already resolve, and never withholds.

**The added candidate** does move one fact — `OKLO total-debt`, from NOT
ACQUIRED to acquired and exempt. That is not a fact leaving the queue; it is a
fact that did not exist before. Measured on the OKLO capture:

| | before | after |
|---|---|---|
| facts acquired | 12 | 14 |
| **queued** | 1 — `cash-fcf` | 2 — `cash-fcf`, **`net-debt`** |
| **exempt** | 11 | 12 — plus **`total-debt`** |

Nothing left the queue. Two facts appeared: one exempt because it came through
the mapping, and one — the derived `net-debt`, newly computable — **queued**, on
the fail-closed side. No fact a human was previously looking at stopped being
looked at, which is the only direction that would matter.

---

## 5. What was NOT added, and why

M8-c's list, re-measured rather than assumed. **Four of five were not candidate
gaps at all** — the dispatch's warning that fixing selection might make listed
additions unnecessary was right in spirit and understated in degree.

### 5.1 XOM — not a mapping problem

`XOM` resolves through the SEC ticker directory to **CIK 0002115436,
"ExxonMobil Holdings Corp"** — a successor registrant carrying **100 tags, all
from 10-Q filings, and not one annual report**. `latestAnnualFiscalYear` is
null and `filedAnnualYears` is 0.

There is no revenue tag to add. `us-gaap:Revenues` exists with four rows, all
quarterly. XOM acquires four facts, and would acquire four under any candidate
list, because the entity has filed no 10-K.

**The history is intact one CIK away, and this was checked rather than assumed.**
CIK **0000034088**, "Exxon Mobil Corporation", carries **19 filed annual years**
and a seventeen-year `us-gaap:Revenues` series, FY2009–FY2025, ending at
**$332.238bn**. The current mapping would acquire from it without a single
change. The SEC ticker directory simply has one `XOM` row and it points at the
successor holdco.

**This is a ticker-to-CIK resolution question, not a tag-mapping one**, and it is
outside this pass. Adding a revenue candidate would have grown the mapping for
every company forever and fixed nothing — XOM's problem is the CIK it starts
from, and the fix is worth roughly twelve facts on this one company.

### 5.2 LLY operating income — no defensible tag exists

Eli Lilly does not tag `OperatingIncomeLoss`. Searching all 558 of its tags:
no `OperatingIncomeLoss`, no `GrossProfit`, no `CostsAndExpenses`, and
`OperatingExpenses` stops at FY2019. **Lilly does not present an operating-income
subtotal on its income statement**, which is ordinary for pharma.

The only near-candidate is
`IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest`
— **pre-tax income, which is a different quantity**: it includes interest
expense, interest income and other non-operating items. Mapping it to
`operating-income` would silently substitute pre-tax income for operating income
on *every* filer that lacks `OperatingIncomeLoss`, and would corrupt the
operating margin those filers' reverse DCF is built on.

**This is the dispatch's stop condition — a needed figure with no defensible tag
that would require approximating one — and the answer is to add nothing.** The
existing `NO TAG EXISTS` fallback record is already the correct behaviour: §5.1
refuses to replace an unverifiable figure with an estimate, and an absence
recorded is the honest output. Returned as a Command Center item, not fixed.

### 5.3 treasury-method-dilution — no tag exists on the six

Still missing on exactly six of ten (OKLO, NVDA, KO, UNP, XOM, RIVN) — the
selection fix did not change the count. None of the six tags
`IncrementalCommonSharesAttributableToShareBasedPaymentArrangements` or any
variant of it. **There is no candidate to add.**

Two things are worth recording rather than left implicit:

- **For OKLO and RIVN the absence is correct and must not be "fixed".** Both are
  loss-making, their awards are antidilutive, and diluted equals basic exactly.
  The mapping's own basis note already says so: absence there is a fact, not a
  gap.
- **For NVDA, KO and UNP the quantity is exactly recoverable** as diluted
  weighted-average minus basic weighted-average — both tagged, both already
  acquired as §3.8.2 reconciliation companions, and that identity is what the
  tag *means* under ASC 260. But that is a **derivation, not a tag**, and
  §3.8.1 guard 1 puts a deterministic calculation on the queued side of the
  line. Building it would add a queued §3.8 material fact for six companies —
  a spot-check-queue decision, which this pass is told not to touch.

This is now the **single largest blocker on enterprise value: 6 of 10.**

### 5.4 RONIC's two five-year deltas — no definition to map against

The binding constraint on Input B, and the one item where the honest answer is
that the work cannot start yet.

`fiveYearDeltaNopat` is derivable in principle — operating income is acquired,
and NOPAT is operating income × (1 − τ) — but τ is `nopatTaxRate`, one of the
four `UNDEFINED_POLICY_CONSTANTS` Command Center has not defined.

`fiveYearDeltaInvestedCapital` is the blocker. **Invested capital is not a
tagged element and is not defined as a formula in any frozen artefact.** All
four say the same eleven words and no more:

> RONIC = trailing five-year change in NOPAT ÷ trailing five-year change in
> invested capital, invested capital including lease-funded assets

(spec §4.2 and M5; valuation methodology §3.3.) "Including lease-funded assets"
constrains one term of a definition that is otherwise absent. There is no
`us-gaap:InvestedCapital`; the construct is some assembly of debt, equity, cash,
working capital, net PP&E, ROU assets and goodwill, and **which** assembly is a
methodology decision. The MSFT fixture carries a placeholder `100`.

**Constructing one here would be inventing methodology and writing it into a
mapping whose whole claim is that it is a table.** A wrong definition would be
wrong for every company at once — precisely the failure the version review
exists to catch. **Stopped and returned:** RONIC needs a ruling on how invested
capital is measured, and a defined `nopatTaxRate`, before any acquisition work
on it is possible.

### 5.5 One gap found that the dispatch did not list — reported, not added

**LLY capex.** Lilly tags neither mapped candidate. It reports capex as
`PaymentsToAcquireOtherPropertyPlantAndEquipment` (76 rows, current to
2026-06-30), which is its cash-flow-statement "net purchases of property and
equipment" line.

That looks like a defensible third candidate, and it is deliberately **not
added**: it is not on the dispatch's list, and the dispatch is explicit that
every addition carries §3.8.1 review burden forever. Recorded here so the next
pass can authorise it in one line rather than rediscover it.

---

## 6. What this pass exposed and did not fix

### 6.1 `us-gaap:DepreciationAndAmortization` is not always the whole quantity

Intel's retired `DepreciationAndAmortization` carried $177m–$200m in FY2015–FY2019
against a real D&A near $10bn. It was a **component**, not the total, for the
whole time it was tagged. The recency rule routes around it here for the right
reason, but by luck of it also being retired: on a filer that still tags it as a
component, candidate #3 would win and be wrong. Not addressed in this pass —
it is a candidate-scoping question, not a staleness one.

### 6.2 The comparator's window was selected by index, not by fiscal year — **FIXED**

Newly visible because NVDA's series is now current and therefore actually read.

NVIDIA tagged FY2019 revenue only under the ASC 606 element, so `us-gaap:Revenues`
— correctly chosen now, eighteen years long — **has no FY2019 row at all**.
`achievedRevenueCagr` took its far endpoint by index
(`observations[length - 1 - horizonYears]`), which equals selection by year only
on a contiguous series. NVDA's ten-year comparator therefore reported
**FY2015→FY2026 — eleven fiscal years — under a `horizonYears: 10` label**, and
compounded eleven years of growth over ten.

**Fixed in this branch** (no mapping change, no second version bump — this is
comparator code, not acquisition). The far endpoint is now `FY(to − horizon)`,
looked up by fiscal year:

- A gap **inside** the window is tolerated and is not a defect. A CAGR is a
  function of its two endpoints and nothing between them; §3.7's concern is that
  the window sit on one accounting basis, which a single-tag series already
  guarantees.
- A gap **at** the endpoint blocks, naming the year: *"us-gaap:Revenues carries
  no FY2015 observation; a 10-year CAGR ending FY2025 needs 11 annual years"*.
  That is the same §10.6.2 rule as the too-short case with a different cause.

**Effect, measured:** NVDA's ten-year comparator corrects from **46.69%
(FY2015→FY2026, eleven years) to 45.70% (FY2016→FY2026, ten years)**. MSFT and
LLY are unchanged. The ten-year count stays 3/10 and the five-year 7/10 — no
company gained or lost a comparator, one company's figure stopped being wrong.
The blocked message also improved: it now names the missing fiscal year instead
of reporting an observation count.

### 6.3 Staleness the rule cannot reach, now measurable

`preferCurrent` can only move a retired candidate aside when another candidate is
current. Where an entry has one candidate, the figure is still stale and still
acquired — deliberately, since withholding it would cross the §3.8.1 boundary.
The staleness does not disappear; it becomes **measured**, and the harness prints
it, because a review that reported only the half the fix happened to solve would
be the wrong kind of reassuring.

| Company | Fact | Carried value | Behind |
|---|---|---|---|
| LLY | treasury-method-dilution | 6,855,000 @ 2011-12-31 | **14 years** |
| INTC | operating-lease-liabilities | $1.455bn @ 2021-12-25 | 4 years |
| UNP | finance-lease-rou-additions | 0 @ 2023-12-31 | 2 years |
| KO | total-debt | $42.218bn @ 2024-03-29 | 1 year |
| LLY | operating-lease-liabilities | $1.147bn @ 2024-12-31 | 1 year |

LLY's fourteen-year-stale dilution figure is the one worth acting on, and §5.3 is
why it was not acted on here.

### 6.4 Enterprise value blocks on a genuine nil

Not a mapping finding, but it falls out of the same measurement and it is the
cheapest remaining unblock. `finance-lease-liabilities` is absent on 5 of 10, and
for LLY the absence is verifiable and genuine: Lilly tags **no** `FinanceLease*`
element of any kind, only operating-lease ones. It has no material finance
leases, so the correct value is **zero**, and `computeEnterpriseValue` is
returning INCOMPLETE for a missing REQUIRED input where §4.3's "genuinely nil is
different from unknown" says nil is the answer. Reported for the next pass.

---

## 7. How much closer calibration is — measured, not promised

Ten companies, re-run end to end. **This is not a claim that calibration will
run.** It will not: zero of ten produce a usable observation, unchanged.

| §10.6.2 input | before | after |
|---|---|---|
| **Input A** — price location within the scenario range | 0 / 10 | **0 / 10** |
| **Input B** — required growth (M7's nine cells) | 0 / 10 | **0 / 10** |
| **Usable** (both, as §10.6.2 requires) | 0 / 10 | **0 / 10** |
| achieved comparator, ten-year | 2 / 10 | **3 / 10** — and NVDA's corrects to 45.70% under §6.2 |
| achieved comparator, five-year | 6 / 10 | **7 / 10** |
| counterfactual EV computes (§4.4 resolved) | 2 / 10 | **2 / 10** |
| mapping gaps reported across the set | 17 | **16** |

The movement is NVDA joining the comparator set on both horizons, and OKLO's
total-debt gap closing. Both inputs §10.6.2 actually needs are unmoved, because
their blockers are the ones this pass could not touch: §4.4's judgment,
`nopatTaxRate`, RONIC, and Step 7 scenarios.

**What did change is the quality of what is acquired, which is what the pass was
for.** Before this bump, a report on NVIDIA would have carried a $26.9bn revenue
headline and a $138.7m capex figure — both §3.8 material facts, both exempt from
spot-check, both years out of date and neither flagged.

**The EV blocker table, which is where the next pass should start:**

| Missing REQUIRED input | before | after |
|---|---|---|
| treasuryMethodDilution | 6 | **6** — now the largest, and §5.3 says it needs a queue ruling |
| financeLeaseLiabilities | 5 | **5** — and §6.4 suggests most are genuine nils |
| totalDebt | 2 | **1** — XOM only, and §5.1 says that is a CIK question |

---

## 8. Verification

- Eight frozen-artefact SHA-256 hashes verified against the contract before any
  work. All matched. No frozen artefact was read for a fix or modified.
- Full suite: **1360 passed, 116 files.** Typecheck clean. Build clean.
- Negative tests, each watched failing before its fix:
  - a retired-but-first candidate losing to a current one — failed, then passed;
  - the same for an instant entry;
  - the same for `annualSeries`;
  - the added candidate on OKLO — failed with the candidate removed, passed with
    it, while the MSFT "unchanged" test passed in both states.
- The §6.2 comparator defect this pass exposed was then fixed in the same
  branch, with its three tests watched failing first. It needed no second
  version bump: `achievedRevenueCagr` is comparator code and acquires nothing.
- Three Defect D pins that deliberately recorded the *deferral* of this work were
  updated to record the transition, each with the reason written at the
  assertion. They were the mechanism that made this change conscious rather than
  accidental, and they did their job.

---

## 9. TAG_MAPPING_VERSION review — `calboard-secmap-2026-09-2` → `-09-3`

**Status: the bump is made and this is its review.** `CF-RONIC-DELTAS-
RECON-01` (issue #298), under `CALVIN RULING — AUTHORISE NARROW TOTAL-EQUITY
CAPTURE` (24 Sep 2026 17:47:12Z) — the narrow authorisation is
`docs/ronic-deltas-composition-reconciliation.md` §6–7, not repeated here.

**One change, no selection-rule touch.** `total-equity` added to `TAG_MAP`:
`us-gaap:StockholdersEquity`, with
`StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest` as
the fallback candidate. Nothing about `selectTagged.resolveEntry`,
`history.annualSeries`'s or `history.quarterlySeries`'s own candidate-
preference rule changed — the `-09-2` selection fix stands untouched.

**Why this review is narrow, and correctly so.** §1's own two-part question
— did any EXISTING fact's resolution change, and did any fact cross the
§3.8.1 exempt/queued boundary — has a structural answer for a brand-new
`factId` that a changed selection rule or a changed candidate on an EXISTING
entry does not: **a new entry cannot change what any other entry resolves
to.** Every other `TagMapEntry` in `TAG_MAP` reads its own tag(s) under its
own `factId`; adding `total-equity` touches no candidate list, no `plus`
component and no selection precedence any other entry depends on. Measured
directly rather than assumed: `git diff` on this bump's own capture
refresh (`lib/analyzer/acquisition/captures/{nvda,msft,oklo}-
companyfacts.json`) shows only additions — the `StockholdersEquity` /
`…NoncontrollingInterest` tag blocks and one changed `capturedAt`/`__capture`
timestamp per file — never a changed value under any tag this mapping
already read before this bump.

**Facts whose resolution changed: 0. Facts that started or stopped being
acquired: 1 new one** (`total-equity`, on all three filers this bump
touched — NVDA, MSFT and OKLO all tag `StockholdersEquity`). Zero facts
moved between the §3.8.1 exempt and queued sides: `total-equity` is not in
`NAMED_MATERIAL_FACT_IDS` (`spotCheck.ts`) and was not added there — §3.8
never named total equity as a material fact category, and this bump invents
no new classification decision. It is acquired through the mapping like any
other entry (`tagMappingVersion` recorded, `isExemptFromQueue` true), so it
carries `SPOT-CHECK NOT REQUIRED` and never enters the queue on this run,
exactly as `total-debt`/`finance-lease-liabilities`/`cash-and-marketable-
debt-securities` already do.

**A real defect found and fixed alongside this bump, in acquisition-adjacent
code rather than in the mapping itself:** `history.annualSeries`'s own
"primary tag only, never `plus`" rule (correct for the revenue/operating-
income series it has always served, neither of which has ever carried a
`plus`) would have silently mis-stated `total-debt`'s and `cash-and-
marketable-debt-securities`' HISTORICAL values had the new
`history.instantAnnualSeries` copied it unchanged — MSFT's own `Short
TermInvestments` ($116,110M FY2021, $55,908M FY2026) would have been
dropped from the historical cash reading while the CURRENT-period fact
(`resolveEntry`, unaffected by this bump) kept including it, two different
quantities under one `factId`. Fixed in the same commit
(`docs/ronic-deltas-composition-reconciliation.md` §7b has the full
account): `instantAnnualSeries` sums `plus` components at every historical
observation, matching `resolveEntry`'s own arithmetic. This is not a mapping
change — no candidate, no selection rule and no `TAG_MAP` entry changed as
part of that fix — so it needed no version bump of its own; it is recorded
here because it was found while reviewing this bump's own output and a
silent, unreviewed miscalculation is exactly what this review exists to
catch.

**Verification.** `npx tsc --noEmit` clean. `npm test`: 2037 passed, 1
failed at the documented CI-exempt baseline (`scripts/evidence/
selfTest.test.ts`, Playwright `chrome-headless-shell`, unrelated to this
change). Full account, including the two companies' resulting RONIC ladders,
in `docs/ronic-deltas-composition-reconciliation.md` §7.

---

## 10. TAG_MAPPING_VERSION review — `calboard-secmap-2026-10-1` → `-10-2`

**Status: the bump is made and this is its review.** `CF-AR6-BRIDGE-INPUT-
RECOVERY-01` (issue #468), the bounded Product repair approved under Calvin's
ruling on PR #466. No frozen artefact, finance formula, tolerance or date window
touched.

### 10.1 What the bump contains — two candidates, one selection change

| # | Change | Where |
|---|---|---|
| 1 | `total-debt` candidate **`DebtCurrent + LongTermDebtNoncurrent`**, ranked second (after `LongTermDebt + CP + STB`, ahead of the combined element) | `tagMap.ts` |
| 2 | `total-debt` candidate **`LongTermDebtAndCapitalLeaseObligations + …Current + ShortTermBorrowings`**, ranked last | `tagMap.ts` |
| 3 | **Selection:** `annualFiscalYears` (→ `latestAnnualFiscalYear`, → what "current" means in `preferCurrent`, `annualSeries`, `instantAnnualSeries`, `quarterlySeries`) no longer counts a period ending after the filing that carries it | `history.ts` |

**Why change 3 was needed, found rather than assumed.** On the trimmed capture,
change 2 alone moved NUE's `total-debt` to 2026-07-04. On the **live, untrimmed**
companyfacts document it did not: NUE still resolved to `LongTermDebt` at
2016-12-31. Nucor's FY2010 10-K (`0001193125-11-049351`, filed 2011-02-28) tags
`DefinedBenefitPlanUltimateHealthCareCostTrendRate` = 0.045 for **2027-01-01 →
2027-12-31**, a full-year duration in an annual form. The tag-blind year rule
counted it, so Nucor's "latest reported annual fiscal year" was **2027**, no
candidate of any entry could read as current, and `preferCurrent` fell back to
the stale first candidate — the issue's own diagnosis, for a second reason the
capture trim had hidden. A period that ends after it was filed is an assumption
about a year, not a reported one. Fix applied once, in the shared helper, so
Gate 1 and the comparator keep agreeing on what a filed year is.

**Why candidate 1 leads with `DebtCurrent`.** Led by the noncurrent half (the
first draft), it resolved for every filer reporting `LongTermDebtNoncurrent` at
all and beat the existing parts candidate with the current portion recorded
absent — **Costco dropped from $6.162bn to $3.914bn** in the first measurement.
With `DebtCurrent` as the primary, it only resolves for a filer that tags the
whole current-debt line (here LLY and NVDA; NVDA's `LongTermDebt` stays first).

**Why candidate 2 is last and carries no lease conclusion.** These elements
include capital (finance) lease obligations by definition. A debt-only total
wins wherever one is current (`docs/lease-once-measurement.md` §6), and reaching
this candidate never counts the leases once by itself: that takes a cited issuer
disclosure in `FINANCE_LEASES_INSIDE_TOTAL_DEBT` (DO 3). None was added (§10.4).

### 10.2 Every fact whose resolution changed

Measured by re-resolving **every `TAG_MAP` entry, its history series
(`annualSeries` / `instantAnnualSeries` / `quarterlySeries`),
`latestAnnualFiscalYear` and `filedAnnualYearsCount`** under the `origin/master`
code (`-10-1`) and this branch, on:

- the six fresh captures `lib/analyzer/acquisition/captures/ar6-2026-10-18/`
  (MSFT, COST, NVDA, NUE, KO, LLY — taken 18 Oct 2026 with
  `scripts/analyzer/capture-companyfacts.ts --out=ar6-2026-10-18`);
- the three existing captures (`msft`, `nvda`, `oklo`), left byte-identical;
- the seven **live, untrimmed** companyfacts documents for the same companies,
  fetched 18 Oct 2026.

| Company | Fact | Before (`-10-1`) | After (`-10-2`) |
|---|---|---|---|
| **NUE** | total-debt | $4.379bn @ 2016-12-31 10-K `LongTermDebt + ShortTermBorrowings` | **$7.099bn @ 2026-07-04 10-Q** `LongTermDebtAndCapitalLeaseObligations (6,389) + …Current (581) + ShortTermBorrowings (129)` |
| NUE | total-debt history | `LongTermDebt` FY2014–FY2016 | `LongTermDebtAndCapitalLeaseObligations…` FY2018–FY2025; FY2025 = **7,121M = AR2 golden** |
| NUE (live only) | latestAnnualFiscalYear / filedAnnualYearsCount | 2027 / 20 | **2025 / 19** — the phantom 2027 removed; Gate 1 state unchanged (19 years) |
| **KO** | total-debt | $42.218bn @ 2024-03-29 10-Q `LongTermDebt + CommercialPaper` | **$43.558bn @ 2026-04-03 10-Q** `LongTermDebtAndCapitalLeaseObligations (39,065) + …Current (4,493)`; STB absent — equals KO's `…IncludingCurrentMaturities` at that date |
| KO | total-debt history | `LongTermDebt` FY2014–FY2023 | lease-inclusive FY2023–FY2025; FY2025 = **43,941M = AR2 golden** |
| **LLY** | total-debt | $42.503bn @ 2025-12-31 10-K `DebtLongtermAndShorttermCombinedAmount` | **$54.908bn @ 2026-06-30 10-Q** `DebtCurrent (7,050) + LongTermDebtNoncurrent (47,858)` |
| LLY | total-debt history | combined element FY2014–FY2025 | `DebtCurrent + LongTermDebtNoncurrent` FY2014–FY2025 — **identical value in all twelve years** |

**MSFT, COST, NVDA and OKLO: zero changes** — every entry, every series, on
fresh captures, existing captures and live documents alike. Live and captured
results now agree for all seven companies.

**Each change checked against the filer's own figures, not asserted:**

- **LLY** — at the 10-K instant the new pair foots exactly to LLY's own combined
  element: 1,635 + 40,868 = **42,503M**, and the two series agree to the dollar
  for twelve fiscal years. A like-for-like refresh to LLY's latest balance sheet
  (the one its cash is already read at), not a definitional jump.
- **NUE** — 6,909 + 90 + 122 = 7,121M at FY2025 is the AR2 golden `nue.json`
  composition and value exactly.
- **KO** — 42,119 + 1,822 = 43,941M at FY2025 is the AR2 golden `ko.json` value
  exactly, and at 2026-04-03 the sum equals KO's own `…IncludingCurrentMaturities`
  element (43,558M).

### 10.3 The §3.8.1 boundary

`acquire()` run under both versions on all seven captures; `queuedFacts` and
`exemptFacts` compared as sets:

> Facts moving between exempt and queued: **0**, at every company. Facts that
> started or stopped being acquired: **0**.

Every changed fact was tag-mapped and exempt before and stays so after. One
cross-check outcome changed: LLY's `total-debt` footing goes from NOT APPLICABLE
(a single element) to **PASS** (the two summed lines foot). No other check moved.

### 10.4 What this pass did NOT do, and what it leaves open

- **NUE `FINANCE_LEASES_INSIDE_TOTAL_DEBT` record: added in the correction pass
  (§10.6).** The first pass added none, because NUE's filing text was unreachable
  from its session. **KO** still has none: its lease note addresses no finance
  lease at all (`docs/filing-text-evidence-routes.md` §0), so KO has nothing to
  cite. KO tags no finance-lease liability and stays INCOMPLETE, `missing
  REQUIRED input(s): financeLeaseLiabilities`.
- **KO composition against the previous mapping:** the golden composition
  excludes KO's `CommercialPaper` / `NotesAndLoansPayable` (1,495M / 1,551M at
  FY2025), which `LongTermDebt + CommercialPaper` used to add. The candidate
  follows the golden (DO 2), and STB is recorded absent for KO. Flagged, not
  re-decided.
- `treasury-method-dilution` remains untagged for NUE, KO, LLY and NVDA (§5.3).
  A real run takes it through the §3.8.1 fallback; the proof test states it.

### 10.5 Verification

- `lib/analyzer/acquisition/bridgeInputRecovery.test.ts` (DO 5): eight tests on
  the six fresh captures. **RED on `origin/master`** code with the same captures:
  6 failed (version, LLY, NUE ×2, KO; MSFT/COST/NVDA passed, as they must).
  **GREEN on this branch:** 8/8.
- `history.test.ts`, "does not count a period that ends after the filing
  carrying it": the exact live NUE row injected. **RED on master** (`expected
  2027 to be 2025`), GREEN here.

### 10.6 Correction pass — NUE counted once (same PR, after independent REVIEW)

No `TAG_MAP` candidate or selection change, so `TAG_MAPPING_VERSION` stays
`-10-2` and §10.2/§10.3 are unchanged. Two changes:

1. **NUE record in `FINANCE_LEASES_INSIDE_TOTAL_DEBT`,** in the LLY entry's form.
   Citation: Nucor FY2025 Form 10-K, accession `0001193125-26-071575`, Note 6
   supplemental balance-sheet table. Current finance lease liabilities ($24M) are
   classified in "Current portion of long-term debt and finance lease
   obligations", and non-current ($234M) in "Long-term debt and finance lease
   obligations due after one year".
   - **Source route.** The caption text is the scoped issuer-source capture
     `docs/evidence/nue-fy2025-finance-lease-classification-capture.md`, committed
     on this PR. The session that added the record could not read `www.sec.gov`
     (CONNECT 403) and did **not** independently re-fetch the captions.
   - **What it checked on `data.sec.gov`.** `FinanceLeaseLiabilityCurrent` 24M +
     `…Noncurrent` 234M = `FinanceLeaseLiability` 258M at 2025-12-31, from the same
     accession. The current line foots: `LongTermDebtCurrent` 66M + 24M =
     `LongTermDebtAndCapitalLeaseObligationsCurrent` 90M. The non-current caption
     has no debt-only tag to foot against, so it rests on the cited caption alone.
   - **Effect.** NUE's bridge adds no separate lease term, so the 10-K-only lease
     date no longer blocks it. EV and the leverage ratio compute on total debt
     7,099M and cash 2,692M, both at 2026-07-04. CALVIN RULING A's same-date test
     is unchanged.
2. **Invested capital counts the record too** (`companyInputs.ts`,
   `investedCapitalLeaseSeries`). This is #298's "lease liabilities not already
   in debt", applied with the same record. Without it, NUE's FY2025 invested
   capital is 20,936 + 7,121 + **258** − 2,699 = 25,616M; with it, 25,358M.
   - NUE tags no `OperatingIncomeLoss`, so on the real capture neither ROIC
     history nor RONIC reaches invested capital. The double count was latent,
     not live. The test injects a test-only operating-income series to exercise it.
   - LLY tags no finance-lease liability, so LLY is unchanged. Filers outside the
     record (MSFT, COST, NVDA, KO, OKLO) still add their lease series exactly as
     before.

**Verification.** `bridgeInputRecovery.test.ts` is now 9 tests. On the
pre-correction head it is RED with 2 failures: NUE's record is absent, and NUE's
FY2025 invested capital is `25616000000`, not `25358000000`. After the correction
it is GREEN, 9/9.


---

## 11. TAG_MAPPING_VERSION review — `calboard-secmap-2026-10-2` → `-10-3`

**Status: the bump is made and this is its review.** `CF-LEG2-KO-COMMERCIAL-
PAPER-01` (issue #487), released as KAIZEN Leg 2 O6. No frozen artefact, golden
value, finance formula, finance-lease handling, bridge policy or migration
touched.

### 11.1 What the bump contains — one component, no selection change

| # | Change | Where |
|---|---|---|
| 1 | `us-gaap:CommercialPaper` added as a `plus` component of the last `total-debt` candidate, which is now `LongTermDebtAndCapitalLeaseObligations + …Current + CommercialPaper + ShortTermBorrowings` | `tagMap.ts` |

**Why.** The entry's approved basis already says "commercial paper and other
short-term borrowings sit outside it and are added where tagged". Candidates 1
(`LongTermDebt + CP + STB`) and 4 (the noncurrent/current parts) carry
`CommercialPaper`; the lease-inclusive candidate added at `-10-2` did not. The
lease-inclusive elements are long-term debt and capital leases, noncurrent
and current, so commercial paper sits outside them as it sits outside
`LongTermDebt`. The
component goes in the same place as in candidate 4, ahead of `ShortTermBorrowings`.

**Why no selection change can follow.** `preferCurrent` and
`preferCurrentSeries` choose among candidates by their PRIMARY rows only. A
`plus` component changes the winning candidate's sum and its recorded
absences, never which candidate wins.

### 11.2 Every fact whose resolution changed

Measured by resolving every `TAG_MAP` entry and its history series
(`instantAnnualSeries` / `annualSeries`), plus `latestAnnualFiscalYear`,
`filedAnnualYearsCount`, the full `acquire()` output and the §3.8.2
cross-check outcomes, under `-10-2` and `-10-3`. The inputs were the six AR6
captures (`captures/ar6-2026-10-18/`) and the three older captures (`msft`,
`nvda`, `oklo`). No live data was fetched.

| Company | Fact | Before (`-10-2`) | After (`-10-3`) |
|---|---|---|---|
| **KO** | total-debt | 43,558M @ 2026-04-03 10-Q: `LongTermDebtAndCapitalLeaseObligations (39,065) + …Current (4,493)`, STB absent | **43,808M** @ 2026-04-03: the same lines **+ `CommercialPaper (250)`**, STB absent |
| KO | total-debt history (FY2023 / FY2024 / FY2025) | 37,507 / 43,023 / 43,941M | **41,716 / 44,162 / 45,436M**. Each year adds its 10-K `CommercialPaper` row: 4,209 / 1,139 / 1,495M |
| KO | cross-check prior period (2025-12-31) | 43,941M | 45,436M |
| NUE | total-debt | 7,099M @ 2026-07-04, no absent components | **7,099M, unchanged**. `CommercialPaper` is now recorded absent: NUE's last tagged row is 2015-12-31 |

**MSFT, COST, NVDA, LLY and OKLO: zero changes.** That covers every entry,
every series, every fact and every cross-check outcome, on both capture sets.
Apart from the version string, the only other output that changed is NUE's
fact `source` text, which now lists the absent component.

**Checked against the captured rows:**

- KO at 2026-04-03: 39,065 + 4,493 + 250 = **43,808M**.
- KO at FY2025: 42,119 + 1,822 + 1,495 = **45,436M**. The AR2 golden total
  (`ko.json`, 45,492M) is `NotesAndLoansPayable` 1,551M (commercial paper
  1,495M + other short-term borrowings 56M) + 1,822 + 42,119. The 56M gap is
  KO's non-commercial-paper short-term borrowings, which this pass does not map
  (§11.4).
- Cross-check outcomes are identical at every company. KO's `total-debt`
  footing still PASSes, now with three components.

### 11.3 The §3.8.1 boundary

`acquire()` ran under both versions on all nine captures. Every fact's id,
`verificationState` and fallback record was compared:

> Facts moving between exempt and queued: **0**, at every company. Facts that
> started or stopped being acquired: **0**.

### 11.4 What this pass did NOT do

- **`NotesAndLoansPayable` / `OtherShortTermBorrowings` are not mapped.** They
  account for KO's remaining 82M at 2026-04-03 and 56M at FY2025. Whether those
  belong in total debt is a debt-concept decision reserved for Calvin by issue #487.
- KO's EV stays suppressed (`missing REQUIRED input(s): financeLeaseLiabilities`)
  and its leverage stays `LEVERAGE UNSUPPORTED IN v1`, so no valuation output
  moves.

### 11.5 Verification

- `bridgeInputRecovery.test.ts`, block `CF-LEG2-KO-COMMERCIAL-PAPER-01`: two
  tests. **RED on `-10-2`**: `expected { value: 43558000000, … } to deeply
  equal { value: 43808000000, … }` and `expected 43941000000 to be
  45436000000`. **GREEN on `-10-3`.**
- Evaluator change, called out separately: the same file's version pin
  (`-10-2` → `-10-3`) was re-pinned, along with the KO value (43,558M →
  43,808M) and the KO and NUE compositions (KO gains `CommercialPaper`; NUE
  records it absent). The MSFT/COST byte-identical block, the LLY, NVDA and NUE
  values and the AR2 golden harness were not changed, and they pass.

## 12. TAG_MAPPING_VERSION review — `calboard-secmap-2026-10-3` → `-10-4`

**Outcome:** `CF-AR6-FINANCE-LEASE-UPPER-BOUND-01` (issue #492), which
implements Methodology v2.1 **D7** (issue #491, ruling B, 19 Oct 2026).

### 12.1 The change

One factId is added: `total-liabilities` (`us-gaap:Liabilities`).
- No existing entry, candidate or selection rule is touched.
- Its only reader is `financeLeaseUpperBound` in `companyInputs.ts`.

That reader forms the D7 bound, *total liabilities − total debt*, only when every condition holds:
- no `finance-lease-liabilities` value was acquired;
- the filer has no `FINANCE_LEASES_INSIDE_TOTAL_DEBT` record;
- both inputs are present and not NOT CONFIRMED;
- both share the total-debt as-of date;
- liabilities ≥ debt.

Wherever any condition fails, the bridge stays exactly as it was.

### 12.2 Captures

`captures/ar6-2026-10-19` was taken from live data.sec.gov companyfacts on 19 Oct 2026 by `capture-companyfacts.ts --out=ar6-2026-10-19` under `-10-4`.

Compared tag by tag with `ar6-2026-10-18`, the only difference is the newly mapped `Liabilities` rows:

| Company | Change |
|---|---|
| MSFT | `Liabilities` rows added |
| COST | `Liabilities` rows added |
| NVDA | `Liabilities` rows added |
| NUE | `Liabilities` rows added |
| KO | none (tags no `Liabilities`) |
| LLY | none (tags no `Liabilities`) |

### 12.3 The §3.8.1 boundary

`acquire()` was run on both capture sets, and every existing fact's id, value, date, `verificationState` and source was compared.

> Facts changed: **0** at every company.
> Facts added: `total-liabilities` at MSFT, COST, NVDA and NUE, each `SPOT-CHECK NOT REQUIRED` (mapped, exempt).
> Facts removed: **0**.

### 12.4 What moves

| Company | Bridge |
|---|---|
| NVDA | **Moves.** It reports no finance-lease liability and has no record. Bound = 91,288M − 33,366M = **57,922M** at 2026-07-26 (10-Q `0001045810-26-000075`), the same date as its debt and cash. M1 and §6.5 now compute at the bound and flag it `UPPER BOUND — NOT DISCLOSED` with its per-share effect. |
| KO | **Unchanged.** It tags no `Liabilities`, so no bound can be formed. It stays INCOMPLETE (`missing REQUIRED input(s): financeLeaseLiabilities`). A bound derived by subtraction (`LiabilitiesAndStockholdersEquity` − equity) would need a selection-rule change and is not made. |
| MSFT, COST | **Byte-identical.** Both report a lease figure, so no bound is formed. |
| NUE, LLY | **Byte-identical.** Both have a cited nesting record, so no bound is formed. |

### 12.5 Verification

- **`financeLeaseUpperBound.test.ts`** (real captures, production assembly), 7 tests:
  - the NVDA bound, its date and its citation;
  - M1 computes at the bound, with the flag;
  - §6.5 equals its own definition at the bound;
  - KO stays INCOMPLETE on its exact cause;
  - MSFT, COST, NUE and LLY have bridge, leverage and M1 output JSON-identical to the 18 Oct captures.
- **`enterpriseValue.test.ts`, Methodology D7 block**, 5 tests:
  - the bound is used, labelled and given a per-share effect;
  - a bound with a different date is refused (#308/#309);
  - a reported lease always wins;
  - a nesting record always wins;
  - with no bound, the bridge stays INCOMPLETE, never zero.
- **RED on `-10-3`** (8 failed); **GREEN on `-10-4`**.
- Evaluator changes are called out separately: only the version pins (`-10-3` → `-10-4`) are re-pinned. No value or composition pin is changed.

## 13. TAG_MAPPING_VERSION review — `calboard-secmap-2026-10-4` → `-10-5`

**Outcome:** `CF-METHODOLOGY-V3-IMPLEMENT-01` (issue #499), the build defects
Methodology v3 routed (Calvin, 20 Oct 2026): LLY's margin proxy (operating
income untagged), NUE's return-on-capital input, LLY's capex tag gap, and the
tax series missing from the research pack.

### 13.1 The change

- `operating-income` gains two later candidates, each a **derived element**
  in namespace `cf-derived`, built once at acquisition (`derivedFacts.ts`,
  `provider.ts`) only where every component is filed for the same period in
  the same accession:
  - `OperatingIncomeLossFromPretaxLessNonoperating` = pre-tax income −
    `NonoperatingIncomeExpense` (LLY);
  - `OperatingIncomeLossFromPretaxAddBackNetInterest` = pre-tax income +
    interest expense − `InvestmentIncomeInterest` (NUE).
  A filer's own `OperatingIncomeLoss` stays the first candidate and always
  wins. The first derivation reproduces MSFT's and NVDA's tagged value in
  every filed 10-K year (`methodologyV3.test.ts`).
- `capex` gains `PaymentsToAcquireOtherPropertyPlantAndEquipment` (LLY's
  only capex tag since FY2023).
- No existing candidate or selection rule is changed.
- New series read for Methodology v3 only (`V3_SERIES_INPUTS`): income tax,
  pre-tax income, acquisitions and the cash-flow working-capital lines. They
  feed `v3Inputs.ts` (D5 tax, D2.1 net reinvestment) and are not facts.

### 13.2 Captures

`captures/v3-2026-10-20` was taken from live data.sec.gov companyfacts on
20 Oct 2026 by `capture-companyfacts.ts --out=v3-2026-10-20` (MSFT, COST,
NVDA, NUE, KO, LLY, OKLO). Every row the 19 Oct captures carried is
byte-identical; only the new tags' rows are added.

### 13.3 The §3.8.1 boundary

`acquire()` was run on the 20 Oct captures under `-10-4` (origin/master) and
`-10-5`, and every fact's id, value, date and `verificationState` compared.

| Company | Facts changed | Facts added |
|---|---|---|
| MSFT, COST, NVDA, KO, OKLO | 0 | 0 |
| NUE | 0 | `operating-income` 2,627M FY2025 (`SPOT-CHECK NOT REQUIRED`), `current-operating-margin` 8.1% (`SPOT-CHECK PENDING`) |
| LLY | 0 | `operating-income` 26,302M FY2025, `capex` 7,841M FY2025 (both `SPOT-CHECK NOT REQUIRED`), `current-operating-margin` 40.4%, `cash-fcf` 8,972M (both `SPOT-CHECK PENDING`) |

Facts removed: **0**. No exempt or queued state changes.

### 13.4 Correction

Issue #496 listed "LLY debt" as a tag gap. It is not: `instantAnnualSeries`
already sums `LongTermDebtNoncurrent`; the correction is posted on #496. No
debt candidate is changed.

### 13.5 Verification

- `methodologyV3.test.ts`: LLY and NUE operating income are absent on the raw
  facts (RED) and resolve to the values above once derived (GREEN); LLY capex
  resolves; the derivation is idempotent and leaves the filer's facts
  untouched.
- Evaluator changes: only the version pins in `bridgeInputRecovery.test.ts`
  and `financeLeaseUpperBound.test.ts` (`-10-4` → `-10-5`). No value or
  composition pin is changed.

## 14. TAG_MAPPING_VERSION review — `calboard-secmap-2026-10-5` → `-10-6`

**Outcome:** `CF-AR8-CORRECTIONS-01` (issue #504). These are two bridge inputs that AR8's live run found missing (`docs/evidence/ar8-acceptance/README.md` F1, F3). The correction was routed by Calvin's answer on #458; F3's reading is Calvin's ruling on #504.

### 14.1 The change

Two existing entries gain one **derived element** each. Both are in namespace `cf-derived`, built once at acquisition (`derivedFacts.ts`), and now support balance-sheet instants. No selection rule is changed.

- **`cash-and-marketable-debt-securities`**
  - New first candidate: `CashAndMarketableSecuritiesWhereNoShortTermInvestments` = cash and equivalents + `MarketableSecuritiesCurrent` | `DebtSecuritiesCurrent` (first present).
  - Formed only for a date on which the filer tags no `ShortTermInvestments`. A filer that tags `ShortTermInvestments` therefore keeps resolving to cash + `ShortTermInvestments` exactly as before, and the two can never double-count.
  - NVDA files its balance-sheet "Marketable securities" line under these elements (`DebtSecuritiesCurrent` $34,143M at 26 Jul 2026), and its bridge cash had held cash alone.
- **`total-liabilities`**
  - New second candidate, after `Liabilities`: `LiabilitiesFromLiabilitiesAndEquityLessEquity` = `LiabilitiesAndStockholdersEquity` − `StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest`. It falls back to `StockholdersEquity`, which can only overstate liabilities and so keeps D7's error toward lower value.
  - Formed only for a date on which `Liabilities` is not tagged.

### 14.2 Captures

`captures/ar8-2026-10-20` was taken from live data.sec.gov companyfacts on 20 Oct 2026 by `capture-companyfacts.ts --out=ar8-2026-10-20` (MSFT, COST, NVDA, NUE, KO, LLY, OKLO). It also carries the stale LLY dilution tag that #502 fixed.

### 14.3 The §3.8.1 boundary

`acquire()` was run on the 20 Oct captures under `-10-5` (origin/master `f60e52d`) and `-10-6`, comparing every fact's id, value, date and `verificationState`.

| Company | Facts changed | Facts added |
|---|---|---|
| MSFT, COST, NUE, OKLO | 0 | 0 |
| NVDA | `cash-and-marketable-debt-securities` 22,443M → 56,586M at 2026-07-26 (`SPOT-CHECK NOT REQUIRED` before and after) | 0 |
| KO | 0 | `total-liabilities` 68,483M at 2026-04-03 (`SPOT-CHECK NOT REQUIRED`) |
| LLY | 0 | `total-liabilities` 108,404M (`SPOT-CHECK NOT REQUIRED`). Memo only: LLY's leases are nested in its debt (`FINANCE_LEASES_INSIDE_TOTAL_DEBT`), so D7's bound is never formed and its bridge does not move. |

- Facts removed: **0**.
- No fact moves between the exempt and queued sides.

### 14.4 Verification

- `ar8Corrections.test.ts`, on `captures/ar8-2026-10-20`:
  - NVDA cash is 56,586M.
  - KO total liabilities is 68,483M, labelled `cf-derived`.
  - KO's bridge computes at the D7 bound of 24,675M.
  - MSFT's cash still resolves through `ShortTermInvestments`.
- On origin/master's code the first three fail (RED) and the MSFT invariant passes. On this branch all four pass (GREEN).
- Evaluator changes: only the version pins in `bridgeInputRecovery.test.ts` and `financeLeaseUpperBound.test.ts` (`-10-5` → `-10-6`). No value or composition pin is changed.
