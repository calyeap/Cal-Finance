# The §3.5 EV bridge's nested finance-lease double-count — reconciliation

`CF-LEASE-NESTING-DOUBLECOUNT-RECON-01` (issue #311) asked whether current
approved authority already determines a correction to
`computeEnterpriseValue` (`lib/analyzer/modules/enterpriseValue.ts:52`) for
the first defect `docs/ev-double-count-sizing.md` reports and does not fix —
the §3.5 bridge adding `finance-lease-liabilities` on top of a `total-debt`
figure that, for a nested filer, already contains it. Landed here by
`CF-LEASE-NESTING-LIMITATION-RECORD-01` (issue #312) are both that
reconciliation and the ruling that answers the closed question it produced.

**This document reconciles, reports and records a ruling. It changes no
product code.** The reconciliation itself (§§1–4) was performed at `c01f57c`
(the head issue #311 started from, `#310` merged), and its figures were
re-verified against that same head before landing (§3).

**The determination: no correction is authority-determined by spec text
alone (§§1–4). The resulting closed question is ruled in §5 —
`CALVIN RULING — NONE FOR NOW`: keep the double-count as a documented known
limitation; Routes 1, 2 and 3 are declined under the current finish-line
scope.**

---

## 1. SCOPE 1 — the five named sections, re-read verbatim at head

All five sections named in the issue's AUTHORITY live in
`docs/frozen/calboard-stock-analyzer-v1-spec.md`. Quoted, not paraphrased.

**§3.5 The single-definition rule** (`:232-244`):

> EV = market capitalisation + total debt + **finance** lease liabilities −
> cash and marketable debt securities − non-operating equity investments.
>
> Operating leases are excluded from the bridge and their cost stays in
> opex… The equity bridge reverses this exactly.

**Silent on nesting.** §3.5 states the arithmetic and states which lease
class enters it (finance, not operating). It says nothing about whether
`total debt` and `finance lease liabilities` can overlap, and states no rule
for the case where they do.

**§4.2 REQUIRED inputs by output group** (`:373-390`), the EV row:

> Enterprise value and every EV-based multiple | shares outstanding;
> treasury-method dilution; price + timestamp; total debt; finance lease
> liabilities; cash and marketable debt securities; non-operating equity
> investments at book

**Silent on nesting.** `total debt` and `finance lease liabilities` are
listed as two separate REQUIRED terms, exactly as §3.5 sums them. Nothing
here says they are drawn from disjoint balance-sheet lines, and nothing here
says how to treat a filer whose `total debt` tag already contains its
finance leases.

**§4.3 OPTIONAL inputs** (`:392-398`):

> Optional inputs improve an output but do not block it… **Rule:** an
> OPTIONAL input that is absent is shown as absent beside the output that
> would have used it. Absence is never rendered as zero.

**Silent on nesting, and not the governing rule for this defect on its own
terms.** §4.3 governs OPTIONAL inputs. `finance-lease-liabilities` is
REQUIRED (§4.2), so §4.3's rule does not apply to it directly — the
REQUIRED-input absence rule is §4.1's ("A missing REQUIRED input returns
INCOMPLETE for every dependent output"), which is what `computeEnterpriseValue`
already implements (`enterpriseValue.ts:53-56`). §4.3's "absence is never
rendered as zero" principle is invoked by analogy elsewhere in this
authority chain (`phase-a-bridge-coherence-blast-radius.md` §7 item 4) to
argue that a REQUIRED input's absence must be treated the same way — but
that is an extension by the reports, not text §4.3 itself states. Either
way, nothing in §4.3 addresses nesting or double-counting.

**§7.2 M1** (`:630`):

> **M1 — Enterprise value and equity bridge.** §2.1 single definition.
> Suppressed by: nothing. INCOMPLETE if any REQUIRED input missing.

**Silent on nesting.** "Suppressed by: nothing" names the module's only
listed suppression condition as a missing REQUIRED input. It does not name
nesting, overlap, or any other suppression condition — because none is
specified anywhere in this authority for this module.

**§3.8.1 Tagged acquisition, and the one exemption from the queue**
(`:300-317`):

> Tagged acquisition is required wherever a tag exists… AI extraction is a
> **documented fallback**, permitted only where no tag exists for that
> figure, where the tag is present but unmapped in the version in force, or
> where the tagged value fails the §3.8.2 cross-checks.

**Silent on nesting, and its silence is itself load-bearing.** The fallback
is scoped to acquiring **a figure**. `total-debt` for a nested filer is not
missing a tag, is mapped in the version in force, and passes its
cross-checks — it fails none of the three named conditions. §3.8.1 supplies
no route for "this figure resolved correctly but a *classification about
what it contains* is unresolved," which is exactly what a nesting
determination is. `docs/filing-text-evidence-routes.md` §4 reaches the same
reading independently ("A nesting determination is not a figure… this reads
as a new permission").

**Conclusion of SCOPE 1: none of the five sections speaks to nesting.** The
bridge's own definition, its REQUIRED-input list, its OPTIONAL-input rule,
its module suppression list, and its tagged-acquisition/fallback contract
are all written as if `total debt` and `finance lease liabilities` are
disjoint quantities. Authority never says so; it simply never considers the
case where they are not.

## 2. SCOPE 2 — does authority already determine a correction?

### 2a. What is settled, restated so it is not re-litigated

`docs/lease-once-measurement.md` §6, ruled 2026-09-09: **"`total-debt` means
interest-bearing debt EXCLUDING lease obligations… the nested filers' debt
figure is the one that has to move, not the lease term."** This is not
reopened here. It settles *which side of the arithmetic is wrong* for a
nested filer.

What it does not settle, and states so itself: **"how nesting is
established for a filer that tags no combined element, and what happens
when it cannot be."** Both halves are needed before anything is built.

### 2b. The precedent question, settled

The issue's own AUTHORITY section flags `companyInputs.ts:214-253` — RONIC's
invested-capital delta — as already implementing a carve-out at a different
seam, and asks whether that asymmetry with the EV bridge is a determined
defect or the open half of §6. It is the open half, for three reasons:

1. **The carve-out is not general authority; it is a separately ruled,
   narrowly scoped construction.** `CALVIN RULING — FINANCING-SIDE INVESTED
   CAPITAL` (issue #298, `docs/ronic-deltas-composition-reconciliation.md:19-21`)
   defines RONIC's own invested-capital denominator as "total equity +
   interest-bearing debt + lease liabilities not already included in debt −
   cash − marketable securities" and states leases are "counted exactly
   once." That ruling is about RONIC's denominator. It says nothing about
   the §3.5 EV bridge, and HARD BOUNDS here forbids treating it as if it
   did ("No invested-capital construction, no RONIC work… changed").
2. **The carve-out's actual mechanism doesn't reach the case that causes
   the EV defect.** `investedCapitalAt` (`companyInputs.ts:654-668`) folds
   in a finance-lease term only when it is present, and reads its *absence*
   as "already sitting inside the debt figure" (`companyInputs.ts:649-652`).
   That is a rule about what to do when the lease term does **not**
   resolve. UNP — the one company this defect is proven and sized for — has
   its finance-lease term **resolve** ($105M, `ev-double-count-sizing.md`'s
   own sizing). The RONIC carve-out has no branch for a resolved, nested
   lease at all; it was never asked that question.
3. **Reading tag presence as evidence of non-nesting would be exactly the
   inference this outcome's HARD BOUNDS forbids**, and UNP disproves it
   directly: UNP tags `finance-lease-liabilities` (it resolves) **and** is
   NESTED. A rule of "fold it in only if untagged" inverted to "assume
   non-nested whenever tagged" is not implied by the RONIC ruling and is
   contradicted by the one company this defect is sized against.

**So the precedent does not transfer, and does not determine a correction.**
It is a ruling about a different construction's treatment of *absent*
lease data, and the live EV defect is about a *resolved* one.

### 2c. Whether a correction can be built within this outcome's bounds

Setting the precedent question aside, the live question is narrower: can
`computeEnterpriseValue` be made to return INCOMPLETE for a nested filer
(the only HARD-BOUNDS-legal shape of correction — SCOPE item 4) without
first knowing, per filer, whether it is nested? It cannot — determining that
is exactly `lease-once-measurement.md` §6's open half — and every mechanism
this repository has for making that determination is named and closed off
by this outcome's own HARD BOUNDS:

| Mechanism | What it would supply | Why it is out of this outcome's bounds |
|---|---|---|
| A new `TAG_MAP` element test (the E3 issuer-element-identity check `scripts/analyzer/nesting-evidence.ts` already implements, HARNESS-ONLY by its own header comment) | Deterministic, machine-checkable nesting for UNP (and, per `phase-a-bridge-coherence-blast-radius.md` §2, no others without dimensional data) | "No TAG_MAPPING_VERSION bump, no TAG_MAP candidate change, no `resolveEntry` change, no new mapping-level element test, and no §3.8.1 review triggered" |
| Route 1 — fetch the filing's XBRL instance + calculation linkbase | Machine-checkable nesting for 2 of 10 (UNP, RIVN) per `filing-text-evidence-routes.md` §2 | "No new acquisition, no new capture, no network or EDGAR fetch, no filing-text extraction route built" |
| Route 2 — a fourth §4.4-style recorded judgment | Human-read nesting for 6 of 10 per `filing-text-evidence-routes.md` §3 | "No §4.4 judgment recorded or changed"; the route itself requires amending §4.4's frozen enumeration of exactly three judgments, which is independently a `docs/frozen/` HARD BOUND |
| Route 3 — the §3.8.1 AI-extraction fallback | Model-read nesting for the same 6 of 10 per `filing-text-evidence-routes.md` §4 | "No new acquisition… no filing-text extraction route built"; also unsettled on its own terms — §3.8.1's fallback is scoped to acquiring "that figure," and a nesting classification is not a figure (§1 above) |

**All three named routes, and the one deterministic mechanism this
repository has already built and deliberately kept HARNESS-ONLY, are closed
off by this outcome's own HARD BOUNDS.** This is not a coincidence of
drafting — `lease-once-measurement.md` §6 names exactly these as the
undecided question, and this outcome's HARD BOUNDS exist to keep this pass
from being the one that decides it.

### 2d. Why the one theoretically bounds-compliant shape still fails

SCOPE item 4 allows a correction that "can only ever return INCOMPLETE with
a stated cause naming the nesting condition." The only version of that
which needs no per-filer nesting knowledge would be: whenever
`finance-lease-liabilities` resolves at all (for any filer), refuse the
bridge. This is rejected, not built, because it fails SCOPE item 5's own
tripwire before it reaches code: MSFT and OKLO are both established
NOT NESTED on approved issuer disclosure (`filing-text-evidence-routes.md`
§0), and an unconditional refusal would move both of them from computable to
INCOMPLETE despite neither being the defect this outcome exists to fix. That
is precisely the "surprise" SCOPE 5 says to stop on rather than push
through — it is not the smallest correct change, it is a different, broader
one made because the narrow one cannot be built.

### 2e. Which blast-radius §8 decision this crosses

`phase-a-bridge-coherence-blast-radius.md` §8 lists four decisions. This
correction would have to cross:

- **Decision 2 — "How does an issuer's note-text disclosure enter the
  system?"** Yes. §8 itself lists exactly the three routes evaluated in
  §2c above as decision 2's options. This is the decision that gates the
  correction.

It would **not** have to cross:

- **Decision 1 — "Is deductive impossibility approved nesting evidence?"**
  No. UNP's nesting (the only proven, sized instance of the defect) rests
  on issuer element identity and an explicit schedule (§103-129 of
  `lease-once-measurement.md`), not on lease-exceeds-debt reasoning.
  Deductive impossibility is not load-bearing for the correction this
  outcome would need.
- **Decision 4 — "Can a REQUIRED input be genuinely nil?"** No. That
  decision is about a filer with no finance lease at all producing a
  REQUIRED-input gap forever. This defect is about a filer whose finance
  lease resolves and is nested — the opposite situation (too much
  information combined wrongly, not too little).

**Conclusion of SCOPE 2: authority does not determine a correction.** The
2026-09-09 ruling settles what `total-debt` *means*; it does not supply a
way to tell, per filer, whether a given `total-debt` figure needs that
correction applied — and every route to that determination is closed by
this outcome's own HARD BOUNDS. This crosses `lease-once-measurement.md`
§6's still-open half and `phase-a-bridge-coherence-blast-radius.md` §8
decision 2, both named in the issue's own CALVIN REQUIRED gate as
qualifying conditions.

## 3. SCOPE 3 — re-probed at head, MSFT / OKLO / NVDA

`scripts/analyzer/ev-double-count-sizing.ts --offline` re-run against
`lib/analyzer/acquisition/captures/{msft,nvda,oklo}-companyfacts.json` at
`c01f57c`, through the real `resolveEntry` / `TAG_MAP` (mapping version
`calboard-secmap-2026-09-3`, unchanged). Re-run again for this landing
(`CF-LEASE-NESTING-LIMITATION-RECORD-01`, issue #312) against the same head
— identical result, confirming the figures below rather than trusting them
as written. Full output: `.evidence/ev-double-count/sizing.txt`.

| Ticker | total-debt | finance-lease input | NESTING | Affected today? |
|---|---:|---:|---|---|
| MSFT | $40,294M @2026-06-30 via `LongTermDebt` | $66,594M | **NOT NESTED** (recorded issuer disclosure, `0001193125-26-323660`) | No |
| OKLO | $0.7M @2026-06-30 via `LongTermDebtNoncurrent` | $0.2M | **NOT NESTED** (recorded issuer disclosure, `0001628280-26-054571`) | No |
| NVDA | $33,366M @2026-07-26 via `LongTermDebt` | NOT ACQUIRED (`NO_TAG_IN_FILINGS`) | **UNKNOWN** (recorded issuer disclosure — insufficient, `0001045810-26-000021`) | No — no lease input resolves, so nothing is added twice |

**Overstatement across the re-probed three: $0.** This is not a re-measure
of the sizing — it is the affirmative confirmation that neither of the two
companies this repo can re-verify without a new capture is the one the
$105M/UNP finding is about.

**UNP, COST, RIVN, XOM, KO, INTC and LLY are not re-probable here.** No
committed capture exists for any of the seven
(`lib/analyzer/acquisition/captures/` holds exactly `msft-`, `nvda-` and
`oklo-companyfacts.json`, plus `prices.json`). The $105M UNP sizing is
therefore **cited from `docs/ev-double-count-sizing.md`, never re-verified,
and not restated here as freshly measured.**

## 4. SCOPE 5 — tripwire

**Nothing moves, because nothing was changed.** This outcome, and the record
landed by `CF-LEASE-NESTING-LIMITATION-RECORD-01`, both end with zero
product-code diff (`git diff` against `c01f57c` touches only documentation:
this document, `docs/ev-double-count-sizing.md`'s pointer prose, and
`docs/lease-once-measurement.md` §6's disposition). `gates.leverage`,
`fairValueRange`, `trust.status` and verdict status for MSFT, OKLO and NVDA
are therefore identical to what they were before this outcome ran, by
construction rather than by re-verification.

The re-probe in §3 additionally confirms the tripwire's own stated
expectation directly: MSFT and OKLO are NOT NESTED and NVDA is UNKNOWN with
no lease input resolving, so even a hypothetical bounds-compliant correction
scoped to genuinely-nested, genuinely-resolved filers would not have touched
any of the three re-probable companies. The exposure this outcome reports
stays exactly where `ev-double-count-sizing.md` already placed it: latent,
UNP-shaped, and not reachable from this repository's committed captures.

## 5. The ruling

**Question put to Calvin**, restated verbatim from BUILD's terminal comment
([#311 comment 5826803195](https://github.com/calyeap/Cal-Finance/issues/311#issuecomment-5826803195))
and OWNER's unchanged restatement
([#311 comment 5826817451](https://github.com/calyeap/Cal-Finance/issues/311#issuecomment-5826817451)):
which nesting-determination route, if any, should be authorised to fix the
§3.5 EV bridge's proven $105M/UNP double-count — Route 1 (fetch the filing's
XBRL instance + calculation linkbase), Route 2 (a fourth §4.4-style recorded
judgment), Route 3 (the §3.8.1 AI-extraction fallback), or none of these for
now?

**The four options, as sized and put to Calvin** (unchanged from the closed
question; full reasoning and consequences above and in
`filing-text-evidence-routes.md` §6):

1. **Route 1** — resolves 2/10 (UNP, RIVN) deterministically and
   machine-checkably; largest new surface (instance + linkbase parsers); no
   §4.4/AI question.
2. **Route 2** — resolves 6/10 (MSFT, OKLO, COST, UNP, RIVN, LLY); requires
   amending §4.4's frozen three-judgment enumeration; standing
   per-company-per-period human cost.
3. **Route 3** — resolves the same 6/10; requires first ruling whether a
   nesting classification is "a figure" under §3.8.1; opens the
   AI-extraction `[C]` layer to a REQUIRED EV input for the first time.
4. **None for now** — defect stays reported, not corrected. Purely latent
   today: no calibration company's EV completes regardless (the §4.4
   non-operating-investments judgment is unrecorded for the whole set), so
   nothing changes on screen until this is picked up later.

**Ruled — `CALVIN RULING — NONE FOR NOW`**
([#311 comment 5826854441](https://github.com/calyeap/Cal-Finance/issues/311#issuecomment-5826854441),
2026-09-25T04:40:32Z), quoted in full:

> Keep the finance-lease nesting double-count as a documented known
> limitation for the Analyzer V2 finish line.
>
> Do not add a new XBRL instance/calculation-linkbase parser, a recurring
> per-filer human judgment, or §3.8.1 AI-extraction authority for this
> REQUIRED EV classification under the current finish-line scope.
>
> Revisit the per-filer nesting-determination mechanism only if it blocks a
> real supported company or as a separately scoped post-freeze reliability
> improvement.
>
> Proceed to the remaining Analyzer acceptance/closeout work. Do not continue
> opening latent future-filer correctness work unless it breaks the current
> live acceptance path, materially misstates a currently supported real run,
> or prevents final acceptance.

**Option 4 — None for now — is the option ruled.** Routes 1, 2 and 3 are
all declined under the current finish-line scope; none is authorised. The
defect stays exactly where §§1–4 above and `ev-double-count-sizing.md` leave
it: reported, sized ($105M for UNP), not corrected, and purely latent today
(no calibration company's EV completes regardless, since the §4.4
non-operating-investments judgment is unrecorded for the whole set).

**What this ruling does and does not settle.** It answers the closed
question above — which route, if any, is authorised now — with "none." It
does **not** answer `lease-once-measurement.md` §6's still-open half ("how
nesting is established for a filer that tags no combined element, and what
happens when it cannot be"); that half stays open, recorded as such in
`docs/lease-once-measurement.md` §6, not closed by this ruling. The ruling
states the conditions under which it is revisited: the mechanism "blocks a
real supported company," or as "a separately scoped post-freeze reliability
improvement." Neither condition is evaluated or triggered by this document.

**Ending.** This document is landed on `master` as the record of that
ruling, per `CF-LEASE-NESTING-LIMITATION-RECORD-01` (issue #312). No line of
`lib/`, `scripts/`, or any byte-unchanged artefact changed by issue #311's
reconciliation or by this landing. The only diffs across both outcomes are
this document; the pointer added to `docs/ev-double-count-sizing.md`'s
first-defect prose; and the disposition recorded in
`docs/lease-once-measurement.md` §6 — the sizing itself, and the still-open
half of §6, are restated by neither.
