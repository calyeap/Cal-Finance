# CF-ANALYZER-FINAL-METHOD-DECISION-01 — external-oracle check + one governing-methodology decision pack

**Outcome:** `CF-ANALYZER-FINAL-METHOD-DECISION-01` ([issue #429](https://github.com/calyeap/Cal-Finance/issues/429)), TIER: HEAVY.

**What this document is.** A bounded evidence-and-decision package, per issue #429's
explicit authorization. It is **not a decision** — it recommends and asks; it does not
approve any formula, authorize Phase C/D/E, touch `lib/`/`app/`, or mark the Analyzer
accepted. If this pack's own PR merges, that merge does not itself approve anything
below; only Calvin's explicit reply does.

## 1. What Phase B proved and did not prove (recap only — not redone)

[Phase B](../proof/cf-analyzer-msft-valuation-phase-b-proof-01.md) (PR #428) delivered a
real-SEC-sourced, fully-specified 10-year MSFT FCFF DCF ($433.08/share base case, WACC
8.64%), cross-checked by a second, independently-coded engine to 14 decimal places. That
agreement proves the **arithmetic** — discounting, WACC, terminal value, equity bridge —
is internally correct given its disclosed assumptions. It does **not** prove the
assumptions themselves (beta, ERP, risk-free rate, terminal ROIC — all WebSearch
snippets, not primary filings or an executed external oracle). Phase B's own one-variable
sensitivity table already shows the model is fragile: ±19%/+30% on WACC, −26%/+62% on
revenue growth. Phase B's headline is **NOT PROVEN** on the independent-oracle
requirement specifically, and this pack does not change that headline.

## 2. This run's one external-oracle attempt

Per issue #429's own instruction, the previously-identified blocked route
(`pages.stern.nyu.edu`, SEC — sandbox policy denial, confirmed non-transient in Phase B)
was **not retried**. One bounded `WebSearch` check for already-accessible,
externally-authored MSFT DCF figures was run instead:

| Source | Value/share | Disclosed basis |
|---|---|---|
| valueinvesting.io (4 Jun 2026) | **$395.89** | WACC 8.88%, cost of equity 9.02%, 5-yr growth-exit model |
| GuruFocus earnings-DCF (10 Aug 2026) | $527.16 | 11% discount rate, 4% terminal growth, earnings basis |
| GuruFocus FCF-DCF (same date) | $167.67 | Same discount rate, free-cash-flow basis |
| AlphaSpread (live tool) | ~$395–424 | WACC/terminal growth not disclosed in snippet |
| StockUnlock (22 Jul 2026) | $629 | 10% discount rate, 24.9x terminal **multiple** (not perpetuity growth) |

**Like-for-like read.** valueinvesting.io's disclosed WACC (8.88%) is the closest
external match to Phase B's own 8.64%, and its value ($395.89) sits ~8.6% below Phase
B's $433.08 — the same order of magnitude, inside the range Phase B's own sensitivity
table already shows for a sub-1pp WACC/growth perturbation. This is **directionally
consistent with, not contradictory to**, Phase B. The other three providers use
materially different bases (earnings instead of FCF, an exit multiple instead of
perpetuity growth, or an undisclosed WACC) and are not like-for-like comparable; they are
recorded only because their own $167.67–$629 spread — nearly 4x, for the same stock, same
week, from commercial providers — is itself evidence *for* Phase B's fragility finding,
not against it.

**Verdict: EXTERNAL ORACLE still NOT PROVEN** to a Damodaran-grade disclosed-formula
standard — none of these sources exposes formula cells. One genuinely external,
already-accessible comparison point is now on record and does not move Phase B's
headline to PASS; it corroborates Phase B's own candor that single-stock DCF outputs are
assumption-dominated, not settled facts.

## 3. Product-option evaluation

- **(A) Keep/refactor the Analyzer chassis** with a small deterministic, sourced FCFF
  DCF + Ruling C's seven-step synthesis, after a named approval. Blocked today not by
  engineering but by the one open, un-circumventable house-policy item: the numeric
  CHEAP/FAIR/EXPENSIVE classification band (`docs/verdict-methodology-reconciliation.md`
  §11 item 5). That item cannot lawfully be set without real multi-company observations,
  which cannot exist without a band to validate against — the methodology's own named
  circularity, re-confirmed fresh today by [issue #424](https://github.com/calyeap/Cal-Finance/issues/424).
- **(B) An established independent commercially-maintained fair-value provider.** No
  candidate's license/API availability is evidenced here (none was checked for
  licensing), and HARD BOUNDS forbid assuming one. A live option, not a recommendation,
  until a concrete candidate and its terms are evidenced.
- **(C) Stay an honest facts + reverse-DCF / price-implied-expectations tool** — no
  BUY/HOLD/SELL — until a credible, lawful valuation-band evidence path exists. This is
  the Analyzer's **current, already-accepted** state
  ([26 Sep freeze](../analyzer-v2-final-acceptance-freeze.md)): every real run already
  renders `INCOMPLETE` rather than a fabricated verdict, and Calvin has repeatedly
  declined to short-circuit that (22 Sep #211, 24–25 Sep Ruling C, today's #424).

**Recommendation: (C), unchanged from today's accepted state** — not a new product
decision, a confirmation that nothing in Phase B or this run's external check supplies
the missing evidence HARD BOUNDS would require to move toward (A)'s banding step, and
nothing evidences a path to (B). The two engineering-ready, zero-new-policy steps that
*are* dependency-safe under (C) — wiring Ruling C's Steps 2/3/6/7 for MSFT, and retiring
the stale Notion wording below — do not require choosing (A) or (B) and are named in §6.

## 4. Finance-rule authority reconciliation — the alleged 22 Sep bands conflict

Live-fetched this run (not assumed from memory or a prior report): the
[Cal Finance — Methodology](https://app.notion.com/p/3d20ca9a8fd08144ad14e66530f86e30)
page (last edited 2026-10-07) **still contains, verbatim**, a "Verdict synthesis policy
v1 — APPROVED 22 Sep 2026" section with numeric BUY ≤0.90/0.80/0.70× and SELL
≥1.20/1.30/1.45× price/Base-fair-value bands, stating "These cut-points are now APPROVED
V1 POLICY." The **same page**, in its own later "TEST / provisional — NON-GOVERNING"
list, item 8, lists "numerical CHEAP / FAIR / EXPENSIVE cut-points" as explicitly
non-governing. The page is internally inconsistent on this exact point.

Against that, three later, explicit, dated Calvin rulings on GitHub say the opposite,
each on-point and each later than the v1 text:

- `CALVIN RULING — Choose B` ([issue #211 comment 5770328112](https://github.com/calyeap/Cal-Finance/issues/211#issuecomment-5770328112),
  22 Sep **02:24:07Z** — minutes after the v1 text): "Do not introduce PVGO, new
  bands/cut-points, or any other new verdict-synthesis finance policy."
- [Issue #269](https://github.com/calyeap/Cal-Finance/issues/269) (24 Sep): "Its
  prohibitions are not superseded and both rulings agree: no new bands or cut-points."
- `CALVIN RULING — C` (24–25 Sep, [`docs/verdict-methodology-reconciliation.md`](../verdict-methodology-reconciliation.md)
  §9): "Do not adopt Morningstar numeric bands, mirrored SELL geometry, or any new
  numeric threshold in this ruling" — and replaced the entire two-input §10.6.2
  mechanism the v1 bands were drafted for with the seven-step RONIC/growth-licence
  structure. `lib/analyzer/policy.ts`'s `POLICY_THRESHOLD_PROVENANCE` carries no §10.6.2
  entry today (confirmed, this run).
- [Issue #424](https://github.com/calyeap/Cal-Finance/issues/424) — a dedicated,
  Calvin-authorized, read-only recon, closed by Calvin himself **today** (14 Oct 2026)
  as completed — independently reached the identical finding and recommended the Notion
  section be annotated or retired.

Per `docs/CURRENT-AUTHORITY.md`'s own precedence rule, a later explicit Calvin ruling
outranks stale wording on the point of conflict. Every later, explicit, dated ruling on
this exact question — three separate GitHub rulings plus Calvin's own closing of #424
today — says the same thing. This is not an unresolved judgement call being put to
Calvin for the first time; it is his own already-made, repeatedly-reaffirmed decision,
read in full rather than from one page in isolation. What remains is administrative: the
Notion page's own text was never corrected to match, so a future reader could still
implement it as current. This outcome's DO NOT boundary forbids any Methodology/Notion
write from this run — only Calvin (or a separately-authorized outcome) can make that
edit; §5 below asks for exactly that authorization, named rather than assumed.

## 5. The one approval text — Calvin's to answer YES / NO

> **APPROVE:**
> **(1)** Treat the 22 Sep 2026 "Verdict synthesis policy v1" price/Base-ratio bands on
> the Methodology page as superseded / non-current, per §4's three later rulings and the
> page's own current non-governing item 8 — and authorize retiring/annotating that
> Notion section so it stops reading as live policy. The governing mechanism remains
> Ruling C's seven-step structure, with the numeric CHEAP/FAIR/EXPENSIVE band (§11 item
> 5) as the one still-open, un-invented house-policy item.
> **(2)** Keep direction (C) — the Analyzer's current honest reverse-DCF/facts-first,
> no-fabricated-verdict posture — unchanged, rather than forcing a DCF-anchored
> numeric band now. Reason: Phase B's one-stock DCF, even arithmetic-verified, is
> fragility-dominated by assumptions (±19–62% swings) no oracle reachable from this
> environment can check, and this run's external comparison corroborates that fragility
> rather than resolving it; §11 item 5 cannot lawfully be set without evidence this
> circularity prevents; every prior ruling on this exact topic has already refused to
> invent a band. No change to the 26 Sep V2 freeze is requested either way.
> **(3)** Option B (an independent commercial fair-value provider) stays a live,
> unevidenced alternative for a later, separate decision once a concrete, licensable
> candidate exists — not adopted, rejected, or assumed here.
>
> Reply **YES** to confirm (1)+(2) as current direction, or name which clause is wrong.

## 6. Smallest post-approval engineering finish line, and fallback

**If YES:** the smallest bounded next BUILD is the one [#424](https://github.com/calyeap/Cal-Finance/issues/424)
already named — wire Ruling C's Steps 2/3/6/7 for MSFT only (already Step-1/Step-2-ready
on real-run evidence), narrowing MSFT's `INCOMPLETE` cause from the generic comparator
message to the one true remaining cause (§11 item 5 unset); zero new numeric constants;
plus Calvin's own Notion edit per (1). Independently checked against MSFT plus two
deliberately contrasting real companies, per issue #429's own finite-ship-proof
requirement, before any BUY/HOLD/SELL label ever renders — not undertaken by this
outcome, and not authorized by it.

**Stop/kill criterion:** if a future real-company capture is added and still produces no
company whose RONIC ladder straddles the 8/10/12% rate grid (the one condition that
would let the band-options in §11 items 1/2/4 actually be told apart), item 5 stays
unanswerable and direction (C) should be re-affirmed rather than re-litigated on each
new company.

**Fallback if Calvin instead wants (A) pursued immediately:** the lawful next step is
not inventing a band, but commissioning one additional Calvin-authorized real-company
capture whose RONIC ladder is expected to straddle the grid — a new, separately-scoped
evidence outcome, not this one.

## What this document does not do

Does not implement, propose, or imply any numeric band, cut-point, or
`POLICY_THRESHOLD_PROVENANCE` entry; does not touch `lib/`, `app/`, `docs/frozen/`, the
Methodology page, `docs/product-decisions.md`, or the 26 Sep freeze; does not authorize
Phase C/D/E or any successor BUILD; does not call Phase B's DCF a price target or a
verdict. Every determination above is a recommendation for Calvin's reply, not a
decision taken.
