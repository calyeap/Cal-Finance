# Analyzer Reset — Execution Handoff (planning record, 17 Oct 2026)

> **PLANNING RECORD — NOT CANONICAL AUTHORITY.** This handoff and the master plan it points to
> record what Calvin approved on 17 Oct 2026. They do not change finance semantics, product
> decisions or implementation contracts: authority still lives where `AGENTS.md` and
> `docs/CURRENT-AUTHORITY.md` route it. AR0 records the approved decisions in those authorities.
> **Nothing here authorises starting AR0 — that needs Calvin's explicit go.**

> **Execution record (added 17 Oct 2026):** Calvin gave the explicit AR0 go on 17 Oct 2026. AR0
> runs as `CF-AR0-RECORD-DECISIONS-01` (#447) and `CF-AR0-SPEC-AMEND-01` (#448). Current execution
> state lives in native GitHub (`docs/CURRENT-AUTHORITY.md`), not in this file; §0, §1 and §7
> describe the state before the go.

Full plan: `docs/superpowers/plans/2026-10-17-analyzer-reset-master-plan.md` (its APPROVAL SHEET
and BOUNDED PROOF govern if anything differs).

---

## 0. Status at handoff (17 Oct 2026)

- Master plan and decisions D1–D6 **approved by Calvin**; D4 answered "moat required".
- **Execution not started.** No commit, PR, issue, Notion edit, migration or BUILD dispatch has
  been made. Notion Methodology is unchanged (v2, last edited 7 Oct 2026).
- Planning baseline: GitHub `master` = `8ec5f86` (PR #446). The local checkout at
  `C:\Users\Calvin\Projects\Cal-Finance` was a **detached HEAD at `90961e4`** (stale); these two
  planning files are untracked there.
- Open at handoff, with the dispositions the plan implies (AR0 executes them, REVIEW verifies):
  PR #436 → close, superseded by #440; PR #421 → close after moving its speed fix into AR7 scope
  (it is conflicted); #418 → close, folded into AR1/AR7; #435 and #439 → close, completed by
  #440/#443; #311 → fold into AR4 bridge flags (LLY golden case); #269 and #210 → close, superseded
  by D3/AR5; #264 → close, superseded by this reset; #209 → close, folded into the AR2/AR8 golden
  set.

## 1. What a fresh session does first

1. Read `AGENTS.md`, `docs/CURRENT-AUTHORITY.md`, this handoff, then the master plan's APPROVAL
   SHEET, BOUNDED PROOF and Parts 4 and 8. Pointers: Cal Finance Methodology (Notion)
   https://app.notion.com/p/3d20ca9a8fd08144ad14e66530f86e30 — "TEST n" below means item n of its
   "TEST / provisional — NON-GOVERNING" list; CAL Build Doctrine (Notion)
   https://app.notion.com/p/3e40ca9a8fd08101848de49ce4b12b45; routines `.github/ai-routines/BUILD.md`,
   `CC.md` (REVIEW) and `OWNER.md`.
2. **Stop unless Calvin has explicitly said go for AR0.**
3. With the go: sync to current `origin/master` (keep the two untracked planning files), then
   re-verify live state — master SHA, open issues/PRs, the Notion Methodology's last-edited date.
   If anything conflicts with this plan, return one `RECONCILIATION REQUIRED` to Calvin.
4. Run AR0 through the existing BUILD → REVIEW → OWNER routines (see §5): one AR0 issue with a
   full BUILD contract, created only after the go. AR0 may commit these two planning files under
   `docs/superpowers/plans/` as records; they are never cited as authority.

## 2. Approved decisions — exact rules

**D1 — Discount rate: market-anchored, two bands, reset yearly.**
Stable businesses = the market's expected return (9.0% today: 10-yr Treasury 5.09% + Damodaran
implied premium 3.7–4.2%). Cyclical industries (industry code — e.g. steel, semiconductors, autos,
chemicals ex-pharma — or the existing trigger B) and pre-revenue companies = market +2pp (11.0%).
Growth alone does not raise the rate. Every verdict is also checked at ±0.5pp. Valid only inside
the existing <10% net-debt gate. If today's rate and a long-run "normal" market return diverge by
>1pp, the annual methodology review decides which to use.
*Measurement note (technical; keeps the approved 9.0%):* "market expected return" = Damodaran's
own published implied expected return on the S&P 500 (8.99% in his Oct 2026 file), rounded to the
nearest 0.5% → 9.0%. Pinning to that figure avoids an ambiguity in the plan's "9.0% either way":
today's 5.09% yield + his 4.20% premium variant would give 9.29%, which rounds to 9.5%.
"Industry code" means the SEC SIC code; AR2 fixes the full cyclical list (steel, semiconductors,
autos and chemicals ex-pharma are confirmed examples).

**D2 — Reinvestment and terminal returns** (supersedes the 16 Oct MSFT reinvestment path).
Reinvestment = NOPAT × growth ÷ return on new investment, fading to terminal by year 10; this
year's investment funds next year's growth; mid-year timing, terminal at 9.5 years, valued at the
price date, TTM base. Moat credit on new capital after year 10: +0 / +1 / +3pp (none / narrow /
wide); bear +0; bull = base +1.5pp. Which moat class applies is Calvin's per-company judgement in
the assumption sheet.

**D3 — Verdict mechanics.** V1 is the only verdict rule; C/F/E labels go; PD-22/23/24 retire as
superseded; "why" reasons are built from computed numbers (AI may not argue a position). The
verdict is computed at three rates × three uncertainty levels: all agree → issued automatically;
only the uncertainty level matters → one question to Calvin (AI proposes, with evidence);
rate-band ends disagree → close call for Calvin. No mechanical uncertainty checklist. Calvin's
answers are stored as versioned inputs; "not sure" never becomes agreement. HOLD and SELL can
issue automatically; a BUY additionally needs Calvin's D4 inputs (the "BUY confirmation" — moat
class, management rating, adopted process items). Until he gives them, the result reads "BUY
candidate — needs your quality call".

**D4 — Quality bar for BUY** (Calvin's decision, 17 Oct). The Methodology's five process items
(thesis, valuation, key risks, invalidation criteria, strongest bear case) before any BUY; computed
floor = 5-yr average ROIC incl. goodwill above the rate; **at least a narrow moat (mechanism
cited) and management Calvin does not rate "poor"**. Cheap companies without a moat can be HOLD or
SELL, never BUY. "Not sure" leaves a BUY candidate open — never a manufactured HOLD.

**D5 — AI-drafted scenarios for new tickers: adopt-to-finalize.** Report, valuation and verdict
zone appear automatically; the final verdict waits for one "adopt" tap (drivers may be adjusted
first); re-runs of adopted sheets finish automatically. MSFT and NVDA need one re-adoption after
D2 adds the return-on-new-investment driver. Drafts never see the price.

**D6 — Scope and acceptance.** Repair the engine, finish the unfinished workflow, delete what each
step replaces — no rewrite (CAL Build Doctrine §19). Park Portfolio Review, Screen and Holdings
work until AR8. Allow a recent-analyses list (amends spec §13.1). "Save this version" is the dated
decision record. Acceptance = eight golden companies captured from presented statements, failing
invariants, AI-only comparison, Calvin's timed review.

**Amendments these imply (recorded in AR0, none silent):** Methodology v2.1 — D1 rate convention
(TEST 5), D2 reinvestment timing and RONIC path (TEST 1, 7), moat credit (TEST 6), D3 verdict
check, D4 quality bar, numeric C/F/E dropped (TEST 8); SBC single-count stays TEST. Spec — the
higher-band rule, one reverse-DCF solve replacing the 9-cell grid (§6.2/§7.1), judgements as
versioned inputs (§10.6.2), recent analyses (§13.1). Product decisions — D1–D6 entries; PD-22,
PD-23, PD-24 retired; PD-25 noted superseded; PD-19 read as adopt-to-finalize.

## 3. Sequence AR0–AR8

| Step | Outcome | Needs | DONE when | Calvin |
|---|---|---|---|---|
| AR0 | Record D1–D6 (product decisions; Methodology v2.1; spec + `FROZEN_HASHES` as its own PR; dated roadmap entry); dispose stale PRs/issues; pre-create AR1–AR8 issues with BUILD contracts; separate evidence issues for AR7 prototype and AR8 acceptance | Calvin's go | Authorities consistent; issues exist | Methodology wording |
| AR1 | Quick Read onto the Overview; verdict caveat ("rate convention under review") until AR5; plain-language states | AR0 | Rule-based test GREEN; screenshots at five widths | — |
| AR2 | Golden facts for eight companies from presented statements (captured without reading `tagMap.ts`); failing invariants; classify every test (ruling vs output pin) | AR0 | Harness in CI; RED list matches plan §4 | — |
| AR3 | Reproducible runs: fact/price/code snapshot per run, contradicted facts gated, mid-year/price-date timing, TTM base, terminal share | AR2 | Rerun → identical outputs | — |
| AR4 | D1 rate rule, D2 reinvestment and moat credit, one reverse-DCF solve, expected return, sensitivity, bridge flags; delete the 9-cell grid and dead modules | AR3 | AR2 GREEN; plan §4.4 reproduced | — |
| AR5 | D3/D4 verdict: 3×3 check, uncertainty question only when it matters, close call, quality bar, templated reasons; remove Ruling-C dead code | AR4 | Exhaustive truth table; MSFT/COST/NVDA verdicts in the real app | — |
| AR6 | Any ticker: cited research from filings and recent 8-Ks, price-blind drafts with full history, validators, D5 adopt, append-only sheets; delete fixture path | AR5 | A new ticker (e.g. AAPL) runs end to end with no migration or PR | — |
| AR7 | Report content after a static prototype review | AR6 | Real-run screenshots; every number sourced | Prototype review |
| AR8 | Real-app acceptance on eight companies with existing tooling (`npx tsx scripts/analyzer/acceptance-run.ts <TICKER>`) | AR7 | All checks pass → freeze recorded | Acceptance |

AR1 may run alongside AR2; AR3–AR6 are sequential (shared `lib/analyzer/assemble.ts`).

## 4. Financial proof requirements

**Golden set:** MSFT, COST, NVDA, NUE (cyclical), KO (tag drift, IRS case), OKLO (pre-revenue —
must say "can't conclude"), LLY (nested finance leases; Elanco restatement), one bank such as JPM
(must be refused).

**Invariants that must hold (and can fail):**
- Zero growth → EV = NOPAT ÷ r.
- Return on new investment = rate → growth after year 1 adds no value (McKinsey identity).
- Terminal ÷ year-10 FCF within 0.95–1.10 for every golden company the engine values (OKLO must
  return "can't conclude" and the bank must be refused).
- Reverse DCF round-trips to the price.
- Same fact snapshot + sheet version + policy version + code SHA → identical outputs.

**Other acceptance:** facts 100% equal to presented statements; D1 classification correct on a
wider set; AI uncertainty proposals compared with Morningstar where public; three independent AI
drafts per golden company within ≤10% value spread; BUY reachable in tests; "not sure" never
yields a verdict; tests are never loosened to pass (Doctrine §12).

**Reference values from planning (scratch calculations, not preserved — re-derive independently,
never import as an oracle):**

| Check | Expected |
|---|---|
| Current code, approved MSFT bundle (r 10%, end-of-year from 30 Jun 2026) | $214.26 / $283.31 / $402.73 |
| D1/D2 conventions, MSFT base (growth 14%, margin 45%, tax 19%, base return on new investment 21.5%, narrow moat, $529.05 on 16 Oct, net cash $6.303B, 7,449,545,491 shares) | 8.0% $411 · 8.5% $378 · 9.0% $348 (1.52×) · 10% $301 |
| MSFT moat lever at 9% (terminal return on new capital) | r $335 · r+1 $348 · 12.5% $373 · 15% $389 · 20% $411 |
| Growth invariance, MSFT inputs, return on new investment = rate = 9%, year-1 growth funded, end-of-year | EV $1,344B at 0 / 5 / 14 / 25% growth |
| Same test on the 16 Oct %-of-revenue path (year 1 treated the same way as the coherent rule, whose values are $1,411B → $1,680B) | $1,396B → $4,322B at 5% → 25% growth (fails; ~$2.6T of unpaid growth at 25%) |
| 5-yr average ROIC incl. goodwill | MSFT 39%, COST 38%, NVDA 83%, NUE 25%, KO 15%, LLY 25%; OKLO fails |
| D1 classification | MSFT, COST, KO, LLY stable; NVDA, NUE cyclical; OKLO pre-revenue; JPM refused; net debt/EV KO 6.3%, NUE 7.0%, LLY 3.7% |

## 5. Boundaries

- Implementation runs only through the existing BUILD → REVIEW → OWNER routines; do not modify
  those routines, GitHub workflows or KAIZEN infrastructure.
- Every NORMAL/HEAVY outcome: PLAN (FILES · ORDER · RISKS · PROOF) before code; defects RED →
  GREEN; protected evaluators (test changes reviewed separately, never loosened); recovery stated
  (code revert ≠ data recovery; additive migrations; `pg_dump` before migrating).
- Finance outcomes are HEAVY. REVIEW (not Calvin) accepts value changes caused by correctness
  fixes inside the approved rules.
- Notion Methodology: Calvin writes or explicitly authorises the v2.1 text; no agent edits it
  otherwise.
- Calvin's touchpoints: AR0 Methodology wording, AR7 prototype, AR8 acceptance; in normal use,
  BUY confirmations, close calls and uncertainty questions only when they change the verdict.
- Change control: rule values or verdict logic → CALVIN RULING; technical choices inside the
  rules → AI DEFAULT with a receipt; cosmetic findings never reopen a merged milestone; a real
  methodology conflict → one RECONCILIATION REQUIRED.
- Out of scope: new services, stores or orchestration; alerts, screeners, sizing, scores, Monte
  Carlo, beta-WACC calculators, peer sets, 3-statement models, paid feeds (unless PD-10).

## 6. Known limitations and unverified items

- Outside prices (16 Oct 2026) and Morningstar ratings/fair values come from secondary sources
  (UNVERIFIED); they are humility checks, never inputs or acceptance targets.
- MSFT reports Q1 FY27 on 28 Oct 2026; all MSFT reference values are as of 16 Oct.
- OpenAI stake fair value unknown; MSFT's useful-life and lease-classification changes are from
  secondary reports; data-centre leases signed but not commenced are not in companyfacts.
- SEC tag drift seen live: KO long-term debt series stops Mar 2024; NVDA marketable securities
  stop Oct 2025. AR2 must fail loudly on such gaps.
- NVDA's recorded drivers are stale (year-1 revenue below the current run-rate); refresh in AR6.
- AI-draft stability and AI uncertainty proposals are untested at scale (AR5/AR6 acceptance).
- `docs/analyzer-v2-final-acceptance-freeze.md`, `docs/acceptance-matrix.md` and PD-25 are stale
  against master (they predate the SELL verdict); AR0 notes this.

## 7. One-line instruction for the next session

Read `docs/superpowers/plans/2026-10-17-analyzer-reset-execution-handoff.md`, then wait for
Calvin's explicit go before starting AR0.
