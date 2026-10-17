# Cal Finance — Analyzer Reset Master Plan (planning record, approved 17 Oct 2026)

> **PLANNING RECORD — NOT CANONICAL AUTHORITY.** Calvin approved this plan, including decisions
> D1–D6, on 17 Oct 2026. It does not change finance semantics, product decisions or
> implementation contracts by itself: current authority still lives where `AGENTS.md` and
> `docs/CURRENT-AUTHORITY.md` route it (Notion Methodology, `docs/product-decisions.md`,
> `docs/technical-specs.md`, native GitHub state). AR0 is the step that records D1–D6 in those
> authorities, and it starts only on Calvin's explicit go — approval is not a BUILD dispatch.
> Where any section below differs, the **APPROVAL SHEET (D1–D6)** and the **BOUNDED PROOF** govern.
> Execution handoff: `docs/superpowers/plans/2026-10-17-analyzer-reset-execution-handoff.md`.
>
> Record note: copied from the approved planning file on 17 Oct 2026. Three secondary lines (§4.11
> R1, AR5 scope, and the sequence table's AR5 row) were aligned to the approved D1/D3 wording; no
> approved rule was changed. D5/D6 headings now read "Approved". For the precise rate measurement
> (Damodaran's published expected return, rounded to the nearest 0.5%) and other clarifications,
> see the handoff §2.

Prepared 17 Oct 2026 against GitHub `master` = `8ec5f86` (PR #446). Planning only: no code,
database, Notion, issue or PR was changed. Labels: **VERIFIED** (read in code/filings or
recomputed independently), **INFERRED**, **UNVERIFIED** (external, not re-checked at source).
This version already incorporates two fresh-context adversarial reviews (Appendix C).

---

## BOUNDED PROOF FOR D1–D4 (17 Oct 2026 — scratch calculations only; Methodology unchanged)

Your 17 Oct direction: strategy and AR sequence accepted; D5–D6 accepted as product direction;
D1–D4 stay proposals until you approve them. Test set: MSFT, COST, NVDA, NUE, KO, LLY, OKLO, JPM
(SEC companyfacts and filings; prices 16 Oct 2026).

**Result: evidence settles D1–D3 and most of D4; you decided the one genuine policy question on
17 Oct (a BUY requires at least a narrow moat). Two proposals changed because the evidence
contradicted them. Approval of this plan is not a BUILD dispatch: AR0 starts only when you say go.**

**D1 — Discount rate · settled by evidence (needs only your sign-off as an amendment)**
- Anchor: 10-yr Treasury 5.09% (US Treasury, 16 Oct) + Damodaran's 1 Oct implied premium (3.70%
  cash-yield or 4.20% trailing payout) = 8.8–9.3% → **9.0% either way**.
- Margin of safety already lives in V1's bands; a 10% personal hurdle on top would count it twice,
  and the Methodology separates hurdle from discount rate. So: market-anchored, reset yearly.
- **Changed:** growth alone no longer raises the rate. LLY (beta 0.45) and NVDA (beta 2.22) are
  both "high-growth" yet carry very different market risk; growth uncertainty is already priced
  in the scenarios and the margin of safety. Higher band (market +2pp = 11%) only for cyclical
  businesses (cyclical industry code — e.g. steel, semiconductors, autos, chemicals ex-pharma — or
  the existing trigger B) and pre-revenue companies.
- **Changed:** my earlier data-only cyclicality tests failed (revenue declines flagged KO;
  operating-income falls flagged LLY because of the Elanco divestiture). Industry code + trigger B
  classifies all eight correctly: MSFT, COST, KO, LLY stable (9%); NVDA, NUE cyclical (11%); OKLO
  pre-revenue (11%); JPM bank (refused). All seven non-banks pass the <10% net-debt gate (KO 6.3%,
  NUE 7.0%, LLY 3.7%).
- Note, no decision now: today's rate and a long-run "normal" market return coincide (≈9%); if they
  diverge by >1pp, the annual methodology review decides which to use.

**D2 — Reinvestment and terminal returns · settled by evidence**
- Coherence test (if new investment earns exactly the rate, growth adds no value): proposed rule
  keeps MSFT's EV flat at $1,344B for 0–25% growth; the approved %-of-revenue path rises to
  $4,322B, ~$2.6T of value from growth it never pays for — a breach of the Methodology's existing
  scenario-coherence rule. Terminal ÷ year-10 FCF = 1.03 for MSFT, COST, NVDA.
- Timing: this year's investment funds next year's growth (McKinsey; existing reverse DCF);
  funding MSFT's year-1 growth again would double-count FY26's $140B capex (~$25/share).
- Moat credit (terminal return on new capital +0 / +1 / +3pp for none / narrow / wide): anchored to
  persistence evidence — 50% of companies with ROIC >20% still exceed 20% ten years later
  (McKinsey); top-quintile persistence 41% vs 20% by chance and the top–bottom spread halves in a
  decade (Mauboussin). A perpetual +3pp is a conservative average of that fade. Value effect
  +2–4% (narrow) and +6–10% (wide); it does not flip MSFT (that needs ~+11pp).
- History anchors per company exist (5-yr incremental return: MSFT 16.6% [21.5% ex-Activision],
  COST 46%, NVDA 74%, NUE 11%, KO 32%, LLY 34%). Which moat class a company deserves stays your
  per-company judgement in its assumption sheet.

**D3 — Verdict mechanics · settled by existing authority plus evidence**
- **Changed:** the five-flag uncertainty checklist matched Morningstar's ratings on only 2 of 5
  companies (MSFT, NVDA right; COST, KO, LLY wrong — it misses drug-patent, pricing and franchise
  risk). A mechanical bucket is not reliable enough to decide verdicts.
- Your Methodology already lists margin of safety as judgement-assisted, and the 22 Sep ruling
  forbids mandatory steps. Reconciled rule: the app computes the verdict at 9 points (three rates ×
  three uncertainty levels). If all agree, it issues automatically. If only the uncertainty level
  matters, it asks you that one question (AI proposes, with evidence). If the rate-band ends
  disagree, it shows a close call for you.
- Test-set behaviour today: COST automatic SELL (2.6× base everywhere); MSFT one question
  (SELL unless you rate it High uncertainty; Morningstar says Medium); NVDA one question and
  possibly a close call (on stale drivers that AR6 refreshes).
- V1 stays the only verdict rule; C/F/E labels go; PD-22/23/24 retire as superseded.

**D4 — Quality bar for BUY · settled; your decision recorded (17 Oct: moat required)**
- Settled: the five process items (thesis, valuation, risks, invalidation, bear case) are already
  required by the Methodology before any new BUY; the computed floor (5-yr average ROIC incl.
  goodwill above the rate) passes MSFT 39%, COST 38%, NVDA 83%, NUE 25%, KO 15%, LLY 25%, fails
  OKLO — a screen against value-destroyers, not a quality ranking.
- **Genuine decision (your investment philosophy):** must a BUY have a durable competitive
  advantage — at least a narrow moat with its mechanism cited, and management you don't rate
  "poor"? Evidence can inform it (high returns persist about half the time over a decade) but
  cannot choose between quality-first and deep-value investing for you.
  - Recommend **yes**: it matches your stated quality-conscious, long-term, low-activity style and
    the Methodology's focus on avoiding permanent impairment. Consequence: cheap companies without
    a moat can be HOLD or SELL, never BUY.
  - Alternative: allow a no-moat BUY only at a deeper discount (e.g. the High-uncertainty BUY
    line, ≤0.70× base) — more opportunities, more value-trap risk.
  - If deferred: BUY stays unreachable until you decide.
  - **Decided 17 Oct 2026: YES — moat required.**

**Still validated in BUILD, not more planning:** the industry-code list against a wider set (AR2);
uncertainty proposals against Morningstar where public (AR5); three-draft stability ≤10% (AR6).

---

## APPROVAL SHEET — D1–D6 and implementation sequence

*Correctness* = settled by evidence or existing authority; REVIEW verifies it in BUILD.
*Your call* = genuine investment policy. Updated after the bounded proof above: D1 and D3 changed
where the evidence contradicted the earlier proposal.

**D1 — Discount rate · market-anchored, two bands, reset yearly** (settled; sign-off)
- Stable businesses = the market's expected return (9.0% today: 10-yr Treasury 5.09% + Damodaran
  implied premium 3.7–4.2%). Cyclical industries (industry code or existing trigger B) and
  pre-revenue companies = market +2pp (11.0%). Growth alone does not raise the rate. Every verdict
  is also checked at ±0.5pp. Only inside the existing <10% net-debt gate.
- Effect: MSFT 9.0% → base $348, 1.52× → SELL; COST → SELL everywhere.
- BUILD acceptance: classification of a wider company set (AR2); dated rate inputs shown.

**D2 — Reinvestment and terminal returns** (settled; sign-off — supersedes the 16 Oct MSFT path)
- Reinvestment = NOPAT × growth ÷ return on new investment, fading to terminal by year 10; this
  year's investment funds next year's growth; mid-year timing, terminal at 9.5 years, valued at
  the price date, TTM base.
- Moat credit on new capital after year 10: +0 / +1 / +3pp (none / narrow / wide); bear +0; bull
  base +1.5pp. Which class applies is your per-company judgement in the assumption sheet.
- BUILD acceptance: growth-invariance test exact; terminal ÷ year-10 FCF 0.95–1.10; MSFT
  reproduces Part 4.4.

**D3 — Verdict mechanics** (settled by existing authority plus evidence; sign-off)
- V1 is the only verdict rule; C/F/E labels go; PD-22/23/24 retire as superseded; "why" reasons
  are built from computed numbers.
- The verdict is computed at three rates × three uncertainty levels. All agree → issued
  automatically. Only the uncertainty level matters → one question to you (AI proposes, with
  evidence). Rate-band ends disagree → close call for you. No mechanical uncertainty checklist
  (it matched Morningstar on only 2 of 5 companies).
- BUILD acceptance: exhaustive truth table; AI uncertainty proposals compared with Morningstar
  where public (AR5).

**D4 — Quality bar for BUY** (decided by you, 17 Oct: moat required)
- Settled: the Methodology's five process items before any BUY; computed floor = 5-yr average
  ROIC incl. goodwill above the rate.
- **Your decision (17 Oct): yes.** A BUY needs at least a narrow moat (mechanism cited) and
  management you don't rate "poor". Cheap companies without a moat can be HOLD or SELL, never BUY.
  "Not sure" leaves a BUY candidate open — never a manufactured HOLD.
- BUILD acceptance: BUY reachable in tests; the bar evaluates as expected on the test set.

**D5 — AI-drafted scenarios for new tickers · Approved: adopt-to-finalize**
- Report, valuation and verdict zone appear automatically; the final verdict waits for one
  "adopt" tap (adjust any driver first if you like); re-runs of adopted sheets finish
  automatically. MSFT and NVDA need one re-adoption after D2 adds the return-on-new-investment
  driver.
- Why: honours PD-19 (you author scenarios) and #399 (no verdict from unreviewed AI numbers) while
  keeping the 22 Sep ruling's intent (a full report without interaction).
- BUILD acceptance: three independent drafts per golden company with value spread ≤10% (wider →
  validators tighten before shipping); drafts never see the price; every driver cites its anchor.

**D6 — Scope, sequence, acceptance · Approved: as the master plan**
- Repair + finish + delete-as-replaced (no rewrite, Doctrine §19); park Portfolio Review, Screen
  and Holdings work until AR8; allow a recent-analyses list (amends spec §13.1; the design
  authority already asks for it); "Save this version" is the dated decision record; acceptance =
  eight golden companies captured from presented statements, failing invariants, AI-only
  comparison, your timed review.
- Correctness (resolved): test design, golden capture, invariants, migrations, rollback vs data
  recovery.

**Implementation sequence** (after your YES; via BUILD → REVIEW → OWNER; nothing dispatched yet)

| | Outcome | Your involvement |
|---|---|---|
| AR0 | Record D1–D6 (product decisions; Methodology v2.1 text you write or authorise; spec + `FROZEN_HASHES` as its own PR); dispose stale PRs/issues; pre-create AR1–AR8 | Methodology wording |
| AR1 | Quick Read onto the Overview; verdict caveat until AR5; plain-language states | — |
| AR2 | Golden facts for eight companies (presented statements), failing invariants, test transition | — |
| AR3 | Reproducible runs: snapshots, gating, timing, terminal share | — |
| AR4 | D1 rate rule, D2 reinvestment and moat table, one reverse DCF, bridge flags | — |
| AR5 | D3/D4 verdict: 3×3 check, uncertainty question only when it matters, close call, quality bar, templated reasons | — |
| AR6 | Any ticker: cited research, price-blind drafts, D5 adopt | — |
| AR7 | Report content (prototype first) | Prototype review |
| AR8 | Real-app acceptance on eight companies | Acceptance |

**Approved by Calvin, 17 Oct 2026** (D4 answered: a BUY requires at least a narrow moat).

---

## PART 1 — Executive verdict

**What went wrong**
1. **The arithmetic is right; the inputs, conventions and decision layer were never pinned
   down.** Two independent re-implementations reproduce the app's MSFT values to the cent
   ($214.26 / $283.31 / $402.73). That proves only the arithmetic. The result depends on choices
   nobody made explicitly:
   - **Discount rate.** The code applies 10% to every company (`assemble.ts:455,578,700`). The
     approved implementation contract sets risk bands by company type ("~8–9% large stable
     low-leverage; ~10–12% high-growth or cyclical", spec §7.1), which no code applies. 10% was
     never put to you as a decision; it entered as "the 10% cost of capital" inside other rulings.
   - **Reinvestment.** Modelled as a % of revenue unlinked to growth, so the approved bear case
     is the most capital-efficient of the three — a known inversion you accepted on 16 Oct.
   - **Judgement.** The verdict is price ÷ Base alone: SELL and HOLD issue without the
     uncertainty, quality or thesis judgements V1 requires, and BUY can never issue.
2. **The MSFT SELL largely survives correction — but for reasons the app never showed you.**
   With one consistent convention at today's $529, MSFT's base is ~$348 at a market-anchored 9%
   rate (1.52× → SELL), ~$378 at 8.5% (SELL unless you rate it High uncertainty), and ~$411 only
   if you believe its moat keeps new investment earning ~20% for decades (roughly Morningstar's
   wide-moat view).
   Buying today implies ~7%/yr if your base case happens, vs ~9% for the market. The decisive
   questions are business ones — **how durable is the moat, and will AI capex earn its keep?** —
   and the app never asked them. Its "1.76× overvalued" overstated the gap.
3. **The process optimised for compliance, not truth.** 228 PRs in 49 days, ~63% process or
   reconciliation docs; tests mostly pin the code's own outputs; the last live proof (9 Oct)
   predates every valuation and verdict change; you were made the technical-finance checker.
4. **The product isn't the one you described.** ~3 minutes to a first report, Quick Read only on
   tab 7, audit-trail sections and raw states, no financial statements, numbers that can change
   when a report is reopened, and a new ticker that doesn't "just work".

**Could a strong AI prompt replace the app?** Tested (Appendix B): three fresh AI-only runs got
all 52 SEC facts right, surfaced material risks the app never shows (OpenAI deal made
non-exclusive, $28.9B IRS claim, AI-lab concentration in a $684B backlog) and valued MSFT at
$396–$416 (HOLD at ~9.2%). But identical runs differed 5–10% in value, each chose its own
conventions (e.g. 3.5% terminal growth vs your 3%), and each took 13–27 minutes. Answer: a small
deterministic engine for facts, rules, reproducibility and instant revaluation; AI for research,
assumption drafts and challenge.

**Is the methodology sound?** Yes in substance — it matches Damodaran's consistency rules and
Morningstar's uncertainty-scaled margins (your V1 bands sit between Morningstar's 4★ and 1★
lines). But finishing the Analyzer needs **explicit amendments** where the Methodology is silent
or marks items TEST (rate convention, reinvestment timing, terminal returns, uncertainty method,
quality bar, close-call rule). All are listed in Part 10 for your approval; none is silent.

**Repair, partially rebuild or fully rebuild?** **Repair the engine, finish the unfinished
workflow, delete what each step replaces** — no rewrite of methodology, valuation logic or the
approved design (CAL Build Doctrine §19). Keep the SEC pipeline, the arithmetic, AI
number-tracing, snapshots and the North Star shell.

**The ideal Cal Finance.** Type a ticker → within ~2 minutes a Quick Read: verdict (or "close
call — your call"), bear/base/bull, what today's price assumes, expected return vs the market,
business quality, top risks, the strongest counter-argument → HOLD/SELL finish automatically;
BUY or a close call asks you one or two business questions → the result is saved and dated →
Deep Dive tabs hold statements, valuation and sources.

**Fastest credible path.** Six decisions (Part 9) → AR0 record them and clean the board → AR1
Quick Read onto the Overview (visible value in days) → AR2 outside-truth tests → AR3–AR4 engine
repairs → AR5 verdict → AR6 any-ticker research and drafts → AR7 report content → AR8 real-app
acceptance on eight companies.

---

## PART 2 — External research: what to take, ranked by relevance

| # | Lesson | Source | Call | Why / cost | Cal Finance today |
|---|---|---|---|---|---|
| 1 | Verdict = price/fair value against uncertainty-scaled margins | Morningstar 2023 (Low: 5★ ≤0.80, 1★ ≥1.25; Med ≤0.70 / ≥1.35; High ≤0.60 / ≥1.55) | ADAPT | V1 already has this shape; the bucket method is missing | Bucket never set |
| 2 | AI never writes valuation numbers unchecked | FinanceBench (GPT-4T+RAG wrong/refused 81%); Vals Finance Agent v2 best 50.9% all-pass (snippets) | ADOPT | AI drafts with anchors; code validates; you adopt | AI drafts flow straight into value |
| 3 | Reinvestment tied to growth and return on new capital; terminal g ≤ risk-free; terminal reinvestment = g ÷ RONIC | Damodaran; McKinsey value-driver formula | ADOPT | One convention for forecast and terminal | % of revenue, unlinked |
| 4 | Moat sets how long excess returns last; RONIC applies to new capital only | Morningstar fade stage; McKinsey | ADAPT | Your moat judgement sets terminal returns | Provisional r+3pp default |
| 5 | Reverse DCF in driver language + expected return at today's price | Morningstar, Damodaran | ADOPT | "Price needs X%"; "you'd earn Y%/yr" | Separate engine, DEGENERATE cells |
| 6 | One rate convention anchored to the market's expected return | Morningstar COE 7.5/9/11/13.5% (4.5% rf + 4.5% ERP × beta); Damodaran expected stock return 8.99% (30 Sep); 10-yr UST 5.09% (16 Oct) | ADAPT | Risk bands re-centred yearly | Bands exist, not applied |
| 7 | Valuation age; flag analyses older than the latest filing | Morningstar | ADOPT | Trivial | None |
| 8 | Quick Read: header strip, bulls say / bears say, price-vs-value bar | Morningstar; TIKR "business owner mode" | ADAPT | Inside the locked shell | Overview mostly placeholders |
| 9 | Capital-allocation view | Morningstar | ADAPT (inside the quality judgement) | AI drafts, you judge | None |
| 10 | Outside fair values as a humility check only | Morningstar MSFT $600 (kept after 29 Jul results; wide moat, switching costs) / COST $650 / NVDA $310 | ADAPT (manual) | Shows distance from informed opinion | None |
| — | Composite scores; paid platform data in the pipeline (TIKR/Koyfin no licensable API; FMP non-commercial); OpenBB/FinanceToolkit; enterprise connectors; agent swarms | various | REJECT | Cost without decision value | — |
| — | SEC EDGAR APIs (in use); edgartools (MIT) for company-extension tags later | SEC; GitHub | ADOPT / LATER | Explains why MSFT acquisitions are missing (extension tag) | In place |

Retail DCF sites disagree on MSFT by ~40% ($424–$600): outputs are assumption-dominated, so the
assumptions — not the arithmetic — must be the product's focus.

---

## PART 3 — Existing system audit

From two independent specialist audits of `master` plus my own reads (VERIFIED unless marked).

| Area | Component | Call | Evidence |
|---|---|---|---|
| Data | SEC client, `selectTagged`, `history`, Item-1 extraction, `crosschecks`, `materialFilings` | **KEEP** | Deterministic; my extraction matched every MSFT/COST fact |
| Data | `tagMap.ts` | REPAIR | No acquisitions, ΔNWC, minorities, preferred, pretax/tax; EBITDA/book value forced null; silent tag drift (NVDA marketable securities stop Oct 2025; KO long-term debt stops Mar 2024 — live companyfacts query) |
| Data | Run reproducibility | REPAIR | Facts never stored per run (migration 002); every report load recomputes from re-fetched facts and price (`reportAnalysis.ts:148`) while stored AI prose is reused |
| Data | Price | REPAIR | No age check; re-fetched on every load |
| Data | Verification gating | REPAIR | Facts NOT CONFIRMED or failing cross-checks still feed value (`companyInputs.ts:37-48`) |
| Engine | Scenario DCF arithmetic | REPAIR | Correct; needs rate rule, growth-linked reinvestment, mid-year + price-date timing, terminal share |
| Engine | Universal 10% scenario rate | REPLACE | One constant (`rateGrid[1]`), no provenance but itself |
| Engine | Equity bridge | REPAIR | Minorities/preferred/convertibles/pensions missing, unflagged; nested-lease filers (#311) |
| Engine | Reverse DCF 9-cell grid | REPLACE | Second DCF convention; replaced by one solve on the main engine |
| Engine | Sensitivity | REPAIR | MSFT-only; rate rows null; ranges from a retired fixture |
| Engine | Unused/always-null modules (terminal-share placeholder, exit multiple, ±1% rate, shape mismatch, FCF-yield+growth, Step-4 tier, `achievedRevenueCagr`) | REMOVE as replaced | Never computed on real runs |
| Inputs | Fixtures as display/test data | REMOVE | Synthetic $265/$510/$650 showed in a "live" run (1 Oct) |
| Inputs | Bundles seeded by SQL migrations + `AnalystBundleForm` | REPLACE | One row per ticker, overwritten on conflict; typed dollar values; four tests delete the MSFT row; NVDA's "approved" base is $102.38 in the seed but $142.30 live |
| Inputs | `aiProposedBundle` / `scenarioProposal` | REPAIR | Model sees only revenue, CAGR, two margins and a statutory tax rate — no capex, D&A, returns, backlog |
| Verdict | `verdictSynthesisV1.ts` + gates | REPAIR | Keep approved bands; add bucket, conditional judgement, close-call rule |
| Verdict | `growthLicence` / `verdictBlockers` / `flipTest` | FOLD then REMOVE | Read by nothing; contradict the issued verdict |
| States | trust/suppression/notComputed/stateCatalogue | SIMPLIFY | 60+ labels; raw codes reach Evidence and SCREEN |
| AI | interpretation, challenger, traceability, prohibitions | **KEEP** | 74/74 cited figures traced in the 1 Oct live run |
| UI | Shell, frame, tokens, `ScenarioRangeStrip`, `DominantVerdictSlot` | **KEEP** | Approved North Star |
| UI | Overview body, lettered A–J sections | REPLACE (content) | Quick Read only on Evidence tab (`app/analyzer/[runId]/page.tsx:67-81`) |
| UI | Financials / Market Context / Upcoming Events | REPAIR | No statements; one SIC line; always empty |
| UI | Entry / Analyzing | REPAIR | ~171 s first render (#418, your 8 Oct test); no progress; no recent list |
| UI | `globals.css` | REPAIR (later) | Tokens declared 3×; 8 breakpoints; text below 13 px |
| Stores | run / snapshot / AI-output stores | KEEP, extend | Snapshots (migration 004) already store full results |
| Surfaces | Dashboard/Holdings/Accounts; Portfolio Review; Screen | PARK | Dormant or URL-only |
| Tests | Output-pinning "OnRealRun" tests, hash pins | REPLACE via AR2 | They pin implementation outputs |
| Process | BUILD / REVIEW / OWNER, routing, Slack | **OUT OF SCOPE — unchanged** | Your boundary |

**Why REPLACE, not repair:** the 10% constant *is* the defect; a second DCF convention can't be
"repaired" into agreement more cheaply than one solve; migration-seeded bundles need a PR and a
ruling per company per update; the lettered audit sections are a content model, not styling;
output-pinning tests can't become outside-truth tests.

---

## PART 4 — Financial engine and independent proof

### 4.1 MSFT reproduction (VERIFIED twice, independently)
Bear $214.26 / base $283.31 / bull $402.73; EV $1,589.8B / $2,104.3B / $2,993.9B; terminal share
52.5 / 65.1 / 71.6%. Inputs: FY26 revenue $331.839B; margins 41.68/45/46.78%; tax 19%; growth
8/14/20% (yrs 1–5) fading to 3%; net reinvestment 7/20/26% of revenue fading to 10.13/9.94/9.09%;
terminal ROIC 10/11/12.5%; r 10%; net cash $6.303B; 7,449,545,491 diluted shares; end-of-year
discounting from 30 Jun 2026. Both checks re-implement the published formula, so they prove
arithmetic, not method.

### 4.2 Why the bull is $402.73
Revenue +20%/yr to $826B (FY31), fading to 3% → $1,311B (FY36). Record 46.78% margin held →
FY36 NOPAT $497B. Net reinvestment 26% of revenue leaves FCF of $47B (yr 1) to $378B (yr 10).
PV yrs 1–10 $851B + PV terminal $2,143B (terminal value $5,557B = 11.2× FY36 NOPAT) = EV $2,994B.
Held down by: the 10% rate, near-peak AI-capex intensity for five years, terminal ROIC 12.5%,
end-of-year timing. Paying $499.70 for the bull case earns ~8.9%/yr.

### 4.3 One consistent convention for everything below
Mid-year cash flows; terminal value discounted at year 9.5; valued at the price date (16 Oct,
$529.05); reinvestment = NOPAT × next-year growth ÷ return on new capital (RONIC), RONIC fading
linearly to terminal ROIC by year 10 (terminal FCF ≈ 1.03× year-10 FCF in every case — the
coherence you required on 15 Oct); approved growth and margins; base explicit RONIC 21.5% (MSFT's
FY21→26 incremental return ex-Activision); terminal ROIC relative to the rate (your approved
pattern: bear r, base r+1pp, bull r+2.5pp).

### 4.4 MSFT — rate, moat and AI-payoff levers (VERIFIED)
| Rate | Base | Price ÷ Base | V1 (Low / Med / High) |
|---|---|---|---|
| 8.0% | $411 | 1.29× | SELL / HOLD / HOLD |
| 8.5% | $378 | 1.40× | SELL / SELL / HOLD |
| 9.0% (≈ market expected return) | $348 | 1.52× | SELL / SELL / SELL |
| 10% (today's code) | $301 | 1.76× | SELL / SELL / SELL |

Moat lever at 9% (terminal return on new capital): r → $335 · r+1pp → $348 · 12.5% → $373 · 15% →
$389 · 20% (wide-moat view) → $411 (1.29×, HOLD under Medium/High).
AI-payoff lever at 9% (explicit RONIC, terminal 10%): 12% → $283 · 17.5% → $329 · 21.5% → $348 ·
30% → $374. Cash taxes (12.8% paid vs 19.4% book) would add ~3–4% (sensitivity only).

**Reading:** at today's price MSFT is expensive against your approved base case under every
defensible rate (expected return ~7%/yr vs ~9% market). SELL is robust under Low/Medium
uncertainty at rates ≥ ~8.5%; HOLD needs High uncertainty with a low rate, or a wide-moat view.
The current app's SELL is directionally defensible but reached through an undecided rate, with
an overstated magnitude and none of the judgements V1 requires.

### 4.5 What today's price assumes (same convention)
$529.05 needs ~24% revenue growth a year for five years at a 9% rate (~22% at 8.5%), holding a
45% margin and 21.5% return on new investment. FY26 growth 17.8%; 5-yr CAGR 14.6%; consensus FY27
≈ +15–18% (snippets); commercial backlog (RPO) $684B, 2.1× revenue. To reach Morningstar's $600 at
9% you'd need ~17% growth, margins toward ~50%, capital efficiency ~2.5× FY26's and terminal
returns ~20%.

### 4.6 MSFT historical economics (VERIFIED)
| | FY19–21 | FY24 | FY26 |
|---|---|---|---|
| ROIC (NOPAT ÷ IC incl. leases, ex cash/investments) | 69–74% | 32% | 27% |
| Sales-to-capital (Δrevenue ÷ capex + finance leases − D&A) | 1.9–3.2 | 0.92 | 0.49 |
| FCF after finance-lease capacity | $36–53B | $62B | $42B |
Incremental ROIC FY21→26: 17.5% (21.5% ex-Activision). The approved bundle implies 25.5%.

### 4.7 Material inputs the app misses (MSFT, NVDA)
- **MSFT OpenAI:** ~25% as-converted stake, equity method, near book (~$1.6/share); at reported
  $500–850B valuations ≈ $17–28/share (UNVERIFIED). $24.1B (7.3%) of FY26 revenue from OpenAI;
  agreement amended Apr 2026 to non-exclusive (secondary reports).
- **MSFT other:** IRS claim $28.9B + interest (~$4/share; unrecognised tax benefits $25.8B);
  data-centre leases signed but not commenced (10-K text only); useful lives 15→25 yrs and future
  leases moving to operating (changes reported capex and margins); cash vs book tax gap.
- **Acquisitions / ΔNWC:** MSFT's acquisitions sit in an extension tag companyfacts can't read;
  ~1–3% of value (Stage-2 §5); proxy `GoodwillAcquiredDuringPeriod`.
- **NVDA:** guarantee exposure $108.5B (VERIFIED, companyfacts 26 Jul 2026), long-term debt
  $33.4B, equity securities at fair value $42.8B, marketable-securities tag stops Oct 2025.
- **SBC:** expensed in operating income with current diluted shares — the standard convention;
  exact single-count treatment remains TEST in the Methodology (dilution here is 0.3%).

### 4.8 Contrasting companies
| | COST (low margin, premium multiple) | NVDA (hyper-growth, cyclical) |
|---|---|---|
| Facts (VERIFIED) | FY26 rev $303.15B (+10.1%), op margin 3.85%, ROIC ~36%, sales-to-capital ~7 | TTM to 26 Jul 2026 $303.0B, op margin 65.2%; latest quarter $96.2B (~$385B run-rate) |
| Values | Illustrative drivers at 8.5%: $288 / $385 / $483 | App's recorded drivers on TTM base, 11%, 21% tax: ~$39 / $141 / $358 |
| Price; ratio | $989.11; 2.57× | $214.13; ~1.52× |
| What the price needs | ~28–33%/yr growth at a 4% margin, or accept ~5%/yr; even an optimistic case is ~$602 | ~27%/yr for 5 yrs at a 55% margin |
| Verdict reading | SELL in every bucket (AI-only run agrees: $409, SELL) | SELL zone at 11%, HOLD at 10% → close call; the bundle is already stale (yr-1 revenue below today's run-rate) |
| Morningstar (snippets) | FV $650, 1★ | FV $310, 4★, Very High uncertainty |
COST shows a coherent policy consequence (valuation discipline flags a premium compounder);
NVDA shows why hand-authored assumptions must be refreshed and why "can't bound value" or "close
call" must be honest states.

### 4.9 Verdict as built (VERIFIED)
SELL at price ÷ Base ≥ 1.45×; HOLD at 0.90–1.20× with no thesis input; BUY unreachable (no
quality input); everything else INCOMPLETE (bucket never set). Ruling C exists only as unused
data. The Overview "Uncertainty" badge is evidence completeness relabelled.

### 4.10 Authority conflicts (reviewed, not assumed compatible)
1. **V1 vs Ruling C:** complementary — Ruling C's seven steps give the structure, V1 the numbers.
2. **V1 vs 18 Sep "no single diagnostic":** compliant only if Base is a whole-analysis synthesis
   and the V1 judgements exist; today they don't. Your 16 Oct approval also said the valuation
   "alone" does not establish a verdict; #445 then issued SELL from it alone.
3. **Notion TEST item 8 (numeric C/F/E cut-points) vs V1 bands:** same mechanism; drop C/F/E.
4. **PD-22** (C/F/E on Quick Read, "never the word HOLD") contradicts the 18 Sep ruling and PD-1.
5. **PD-23/24** (Step-4 dispersion tier) are superseded if the uncertainty method (D3) is adopted.
6. **PD-19 "scenario authorship stays human" vs the 22 Sep "no mandatory interaction after
   ticker entry" ruling (`autoRun.ts:9-12`) vs #399's "AI values, no BUY/HOLD/SELL":** needs D5.
7. **Spec §13.1** excludes saved analyses/thesis records; `runStore.ts` forbids a recent-runs list;
   the design authority wants recent analyses — needs D6.
8. **Spec §10.6.2** "no per-company override" — human judgements must be stored as versioned
   inputs, not overrides.
9. **AI prohibitions** (`prohibitions.ts:4-6`): AI may not reason toward a position → "why this
   verdict" must be templated from computed facts, not AI prose.

### 4.11 Recommended financial approach (minimum credible model)
One 10-year FCFF DCF (bear/base/bull) + reverse DCF on the same engine + expected return at
today's price + own-history multiples as a cross-check. No Monte Carlo, peer sets, 3-statement
models or beta calculators.
- **R1 Rate (D1):** stable = market expected return; cyclical industries (industry code or the
  existing trigger B) and pre-revenue companies = +2pp; growth alone does not raise the rate;
  valid only inside the <10% net-debt gate (where equity ≈ firm rate); verdict checked at ±0.5pp.
- **R2 Reinvestment (D2):** NOPAT × next-year growth ÷ RONIC, RONIC per scenario anchored to the
  company's incremental-return history, fading to terminal — the same formula the reverse DCF
  already uses, so the two engines become one.
- **R3 Terminal returns (D2):** default = the rate (no excess return on new capital); moat table
  +0/+1/+3pp (none/narrow/wide) for base, bear +0, bull base +1.5pp.
- **R4 Timing (correctness):** mid-year; terminal at N−0.5; value at the price date; TTM base;
  every figure dated.
- **R5 Bridge (correctness):** add minorities/preferred/convertibles where tagged, else flag;
  strategic stakes at book with disclosed fair value shown separately; contingent items (IRS,
  guarantees) listed.
- **R6 Outputs:** terminal share, RONIC path, expected return, break-even rate/growth/moat.
- **R7 Gating (correctness):** contradicted facts block what depends on them; immutable fact,
  price, sheet, policy and code-version snapshot per run.
- **R8 Display:** whole dollars, ranges, no false precision.

### 4.12 MSFT claims by evidence class
| Class | Items |
|---|---|
| Verified facts | FY26 revenue, operating income, tax, capex, finance-lease additions, D&A, SBC, debt, leases, cash and investments, shares; OpenAI stake %, OpenAI revenue (10-K excerpts); NVDA guarantees |
| Approved methodology | Blended valuation; scenario coherence; terminal consistency; V1 bands; no single diagnostic decides; profile bands (implementation contract) |
| Your approved forecasts (16 Oct) | Growth 8/14/20%; margins 41.68/45/46.78%; reinvestment 7/20/26% fading; terminal ROIC 10/11/12.5% |
| Unresolved judgement | Rate convention; uncertainty; quality bar; moat durability; AI-capex payoff; OpenAI stake value |
| Implementation defects | Profile band not applied; end-of-year timing with no stub; terminal share never computed; unconfirmed facts used; runs not reproducible; non-MSFT tickers use the reverse-DCF-only r+3pp terminal |
| Correct code, questionable modelling | Reinvestment unlinked to growth (bear more efficient than bull) |
| Unsupported conclusions | "1.76× overvalued"; SELL as a robust verdict; the Overview "Uncertainty" badge |

### 4.13 Proved vs still to prove
- **Proved:** arithmetic; rate convention never applied or decided; MSFT verdict sensitivity
  table; facts for MSFT/COST/NVDA; BUY unreachable; runs not reproducible; AI drafts blind to
  capex/returns; AI-only reproducibility ±5–10%.
- **Still to prove:** reliability across company types (AR2/AR8); outside prices and Morningstar
  values; OpenAI stake value; AI-draft quality and stability at scale (AR6); that you reach a
  confident decision in minutes (AR8).

---

## PART 5 — Proposed final product

**MVP (listed operating companies inside the leverage gate):**
1. Home: ticker entry + recent analyses (needs D6).
2. Analyzing: four approved stages with real progress; ≤ ~2 min for a new ticker, seconds on re-run.
3. Quick Read (Overview body): verdict in the existing verdict slot, bear/base/bull, what the price
   assumes, expected return, business quality, top risks, strongest counter-argument, what would
   change the verdict.
4. Conditional judgement: only for a BUY, a close call, or to record a broken thesis.
5. Assumption sheet (Valuation tab): AI-drafted, price-blind, cited; you adopt or adjust growth,
   margin, return on new investment and moat.
6. Deep Dive: Business (cited research), Financials (10-yr statements and returns), Valuation,
   Risks & Thesis, Market Context (EOD chart, own-history multiples), Evidence (sources, calculations).
7. Saved, dated result: the existing "Save this version" snapshot carries judgements and expectations.

**LATER (on real need):** refresh prompt on new filings; decision-learning review; simple WACC for
leveraged companies; outside fair values entered manually; segment data via filing XBRL; cash-tax
modelling; CSS token clean-up.

**NO:** alerts/streaming, screener or sizing inside the Analyzer, agent debates, scores, Monte Carlo,
beta-WACC calculators, peer sets, 3-statement models, technical analysis, paid feeds (unless PD-10).

---

## PART 6 — UX and design

Unchanged authority: locked North Star shell, seven tabs, tokens, responsive contract (32" full and
half-window, iPad, iPhone), dark-only, no raw states. The verdict uses the **existing** verdict
slot — no duplicate verdict card. Only tab bodies change.

**Quick Read (Overview body):**
```
[verdict slot]  SELL · price $529 is 1.5× our base value · Medium uncertainty
                (or) Close call: HOLD at 8.5%, SELL at 9% — your call   [decide]
                (or) Can't conclude yet — <plain cause> — <what fixes it>
[Bear | Base | Bull | Uncertainty]  ← existing slots, price marker on the bar
What today's price assumes: "~24%/yr revenue growth for 5 years at a 45% margin.
  Microsoft grew 17.8% last year and 14.6%/yr over 5 years."
If our base case happens you'd earn ~7%/yr (market ~9%).
Why this verdict — 3 templated reasons built from computed figures (no AI reasoning)
Strongest argument against — challenger, 2–3 lines
Business quality — moat mechanism · ROIC 27% (was ~70%) · capital allocation
Top risks — AI-capex payoff · OpenAI 7% of revenue, now non-exclusive · $28.9B IRS claim
What would change it — "HOLD if new investment keeps earning ~20% for decades" / break-even rate
```
**Judgement (only when needed):**
```
The price needs ~24%/yr growth for 5 years. You expect:  [more] [about that] [less] [not sure]
How durable is the moat?  [wide — excess returns for decades] [narrow] [none] [not sure]
Is your thesis broken?   [no] [yes → SELL] [not sure]
```
Answers are stored as versioned inputs with the dated snapshot; "not sure" never becomes agreement.

**States (plain language, section-local):** loading (4 stages) · stale price · newer filing than
this analysis · assumptions older than the latest quarter · section unavailable · close call ·
can't bound value / can't conclude (cause + fix) · true failure.

**Design evidence:** completed = North Star, shell contract, tokens (Notion + repo authority).
Proposed = the Quick Read and judgement above. First step of AR7: a static HTML prototype with real
MSFT numbers at desktop, half-window and phone for your review. No visual prototype exists yet.

---

## PART 7 — Architecture

Same stack (Next.js, local Postgres, Anthropic SDK, SEC EDGAR, Yahoo EOD). No new services.
```
acquire (SEC facts + filing text + price) → snapshot (immutable per run)
 → normalise & history (deterministic)
 → research (AI reads 10-K Items 1/1A/7, latest 10-Q, recent 8-Ks/earnings releases; cites
   everything; optional web news/consensus labelled SECONDARY, display-only; cached per filing)
 → assumption draft (AI, price-blind, policy-bounded) → validators → adopt/adjust (versioned)
 → value (pure functions + dated policy table)
 → challenge (AI blind challenger + figure tracing)
 → verdict (V1 + bucket + close-call rule + any stored judgements)
 → report (reads stored outputs; never recomputes on view)
```
**Ownership:** code = facts, periods, arithmetic, rules, validators, verdict rule, templated
reasons. AI = research, drafts with anchors, explanation, challenge, uncertainty proposal. You =
business story (adopt/adjust), moat and thesis judgements, final decisions, policy approvals.

**Data:** existing Postgres. New append-only `assumption_sheets` table (migration 006's one-row-
per-ticker upsert can't version); extend migration 004 snapshots with fact/price snapshot, sheet
version, policy version, code SHA and judgements. Reproducibility test: same tuple → identical
outputs. `pg_dump` before each migration; code rollback ≠ data recovery, stated per milestone.

**Repair vs rebuild:**
| Option | For | Main risk | Verdict |
|---|---|---|---|
| Repair only | Arithmetic and data sound | Leaves the causes of lost trust in place | Too little |
| **Repair + finish + delete-as-replaced** | Defects cluster in inputs, verdict wiring, presentation | Scope creep → contained by small outcomes and the freeze | **Recommended** |
| AI analyst + tiny calculator | DCF core is small | Loses tag selection, cross-checks, tracing guardrails; breaks Doctrine §19 and PD-19 | No |
| Full rebuild | Simpler code | Discards verified assets; restarts governance | No |

---

## PART 8 — Implementation roadmap

Milestones AR0–AR8 ("Analyzer Reset"; avoids the historical M7/M8/M9 names; fits
`docs/product-roadmap.md`'s order: Analyzer before UPDATE → PORTFOLIO REVIEW → SCREEN). Each follows
PLAN (FILES · ORDER · RISKS · PROOF) → TEST/PROVE → BUILD → VERIFY → INDEPENDENT REVIEW → MERGE →
REAL-APP ACCEPTANCE via BUILD → REVIEW → OWNER. Defects RED → GREEN. Test changes are separate,
reviewed changes; output-pinning tests are replaced by invariants, never loosened. Each milestone
deletes what it replaces.

**AR0 — Record decisions and clean the board** (NORMAL; after your D1–D6)
- Why: BUILD stops on conflicting authority; decisions must exist in the right places first.
- Scope: `docs/product-decisions.md` entries for D1–D6 (retiring PD-22, PD-23/24 by name and
  noting PD-25 superseded); Methodology v2.1 entries (you write or authorise); spec amendment +
  `FROZEN_HASHES` as its own evaluator-change PR; dated roadmap entry; close PR #436 (superseded);
  dispose PR #421 (conflicted — salvage only its speed fix into AR7) and stale issues (#418, #435,
  #439, #311, #269, #264, #210, #209) with reasons; pre-create AR1–AR8 issues with full BUILD
  contracts; separate evidence issues for the AR7 prototype review and AR8 acceptance so no PR
  waits on you.
- Proof: authority docs consistent (RECONCILIATION check passes); issues exist. Recovery: doc revert.

**AR1 — Quick Read onto the Overview + verdict caveat** (NORMAL)
- Why: visible value now, no finance change.
- Scope: render the existing Quick Read on Overview; existing verdict slot shows "rate convention
  under review — SELL at 10%, see sensitivity" until AR5; plain-language state copy for what exists.
- Files: `app/analyzer/[runId]/page.tsx`, `AnalyzerOverview.tsx`, `DominantVerdictSlot.tsx`,
  `overviewCopy.ts`. Proof: rule-based RED test (no raw state codes, Quick Read on Overview) → GREEN;
  real-run screenshots at five widths. Recovery: revert.

**AR2 — Outside-truth harness and test transition** (HEAVY)
- Why: prove economics before building around them; stop tests that pin outputs.
- Scope: (1) golden facts for eight companies captured by REVIEW from the **presented statements**
  (label, accession, page) without reading `tagMap.ts` — MSFT, COST, NVDA, NUE (cyclical), KO
  (leverage gate, tag drift), OKLO (pre-revenue), LLY (nested finance leases), one bank (must be
  refused); (2) closed-form invariants that can fail: zero growth → EV = NOPAT ÷ r; growth from
  year 1 with reinvestment = g ÷ RONIC equals single-stage Gordon (catches year-10 jumps); RONIC
  = r → value independent of growth (fails today); reverse-DCF round trip; (3) classify every
  existing test as "encodes a ruling" (keep) or "pins an output" (replace); (4) policy REDs added
  only after AR0 (tests cannot create policy).
- Files: `scripts/evidence/golden/*`, `lib/analyzer/golden/*.json`, `valuationInvariants.test.ts`,
  `goldenFacts.test.ts`, test-transition list.
- Proof: harness runs in CI; RED list matches Part 4's defects. Verification: a second reviewer
  re-captures two companies blind.

**AR3 — Engine repairs I: data, timing, reproducibility** (HEAVY)
- Scope: R4, R7, terminal share; fact/price/code snapshot per run; gating of contradicted facts;
  TTM base; report reads stored outputs.
- Files: `acquisition/companyInputs.ts`, `provider.ts`, `reportAnalysis.ts`, `runStore.ts`,
  `snapshotStore.ts`, `modules/scenarioOutputs.ts`, additive migration.
- Proof: invariants + golden GREEN for these items; rerun → identical outputs. REVIEW (not you)
  accepts value changes caused by correctness fixes. Recovery: revert; additive columns kept.

**AR4 — Engine repairs II: rate, reinvestment, terminal, bridge** (HEAVY; needs D1, D2)
- Scope: R1 profile-band rule incl. cyclicality and leverage domain; R2 RONIC-linked reinvestment;
  R3 terminal default; reverse DCF as one solve on the main engine; expected return; sensitivity
  (rate band ends, growth, margin, RONIC, moat); R5 bridge flags; delete the 9-cell grid, unused
  modules and the second convention.
- Files: `policy.ts` (dated table + provenance), `assemble.ts`, `modules/scenarioOutputs.ts`,
  `growthPath.ts`, `modules/reverseDcf.ts`, `modules/sensitivity.ts`, `modules/enterpriseValue.ts`,
  `acquisition/tagMap.ts`.
- Proof: AR2 GREEN; independent oracle reproduces MSFT/COST/NVDA; Part 4.4 table reproduced.

**AR5 — Verdict consolidation, MSFT first** (HEAVY; needs D3, D4)
- Scope: one V1 path; verdict computed at three rates × three uncertainty levels — all agree →
  automatic; only the uncertainty level matters → one question to Calvin (AI proposes, with
  evidence); rate-band ends disagree → close call for Calvin; no mechanical uncertainty checklist;
  "can't bound value" state; BUY needs the D4 quality bar (incl. at least a narrow moat);
  thesis-broken → SELL; templated reasons; judgements stored as versioned inputs; remove Ruling-C
  dead code; fix the uncertainty badge.
- Files: `verdict.ts`, `verdictSynthesisV1.ts`, `growthLicence.ts`, `verdictBlockers.ts`,
  `flipTest.ts`, `trustCopy.ts`, `DominantVerdictSlot.tsx`, judgement component.
- Proof: exhaustive truth table (zones × buckets × band ends × judgements); "not sure" never yields
  a verdict. DONE: MSFT, COST, NVDA verdicts in the real app; AR1 caveat removed.

**AR6 — Any ticker: cited research and price-blind drafts** (HEAVY; needs D5)
- Scope: research from filing text (reuse `item1Extraction.ts`, `materialFilings.ts`) and recent
  8-Ks; price-blind AI draft with full history (capex, D&A, returns, backlog, guidance); validators
  (history ranges, ordering, RONIC path, terminal consistency, base growth never from the reverse
  DCF, stale-assumption check vs latest quarter); three independent drafts per golden company with
  the spread reported; adopt/adjust; append-only sheets; migrate MSFT/NVDA bundles; delete the
  fixture path.
- Files: `ai/scenarioProposal.ts`, `acquisition/aiProposedBundle.ts`, `recordedBundles.ts`,
  `analystInputs.ts`, new sheet module/components, migration.
- DONE: a new ticker (e.g. AAPL) completes end to end with no migration or PR.

**AR7 — Report content** (prototype gate → NORMAL)
- Static prototype → your review (separate evidence issue) → build: Financials statements,
  Valuation tab (sheet, sensitivity, market-implied), Business research, Risks & Thesis, Market
  Context, Evidence ledger, progress state, recent analyses (if D6), speed fix from #421.
- Proof: real-run screenshots at five widths; forbidden-text evaluator; every number links to
  a source.

**AR8 — Real-app acceptance** (HEAVY; your reserved gate)
- Existing tooling only: `npx tsx scripts/analyzer/acceptance-run.ts <TICKER>` for all eight; the
  manual live-proof workflow unchanged for MSFT/NVDA/COST. MSFT reports Q1 FY27 on 28 Oct 2026 —
  acceptance after that date must first show "newer filing", then refresh.
- Checks: time to Quick Read; every figure vs golden facts (independent reviewer); side-by-side
  with the AI-only baseline and one outside reference; you answer "do I understand why?" per
  verdict. DONE → freeze recorded.

**Order:** D1–D6 → AR0 → AR1 → AR2 → AR3 → AR4 → AR5 → AR6 → AR7 → AR8 (AR1 can run alongside
AR2; AR3–AR6 are sequential because they share `assemble.ts`).

**Plan-level risks:**
| Risk | Mitigation |
|---|---|
| Verdicts change when D1–D3 land | Close-call rule, band-end display, "what would change it" |
| AI drafts unstable | Price-blind, validators, three-draft spread test, your adopt step |
| Scope creep | One outcome per milestone; freeze; cosmetic findings never reopen work |
| SEC tag drift | Golden harness fails loudly; affected output withheld, never guessed |
| Price outages | Stored price snapshot + visible staleness |
| Outside values treated as truth | Humility check only |
| Coordination stalls (#440 hit four BLOCKED stops) | Pre-created issues; your gates in separate evidence issues |

**Your touchpoints, all of them:** D1–D6 now; the AR7 prototype; AR8 acceptance. Nothing else
unless a real methodology conflict appears (one RECONCILIATION REQUIRED, not a series of rulings).

---

## PART 9 — Your decisions

Resolved in the **Approval Sheet** at the top of this plan (D1–D6). It is the single version;
nothing here overrides it.

---

## PART 10 — Freeze proposal

**Locked on approval:** Part 5 scope; Part 7 architecture boundaries; the North Star authority plus
Part 6; AR2 + AR8 acceptance; AR0–AR8 order.

**Every amendment this plan would make (none silent):**
- Methodology v2.1: market-anchored discount rate (stable = market expected return; cyclical
  industries and pre-revenue = +2pp; growth alone does not raise the rate; ±0.5pp check) valid
  inside the <10% net-debt gate (TEST 5); reinvestment = NOPAT × growth ÷ return on new investment
  fading to terminal (TEST 1, 7); moat credit +0/+1/+3pp, bear +0, bull base +1.5pp (TEST 6);
  verdict checked at three rates × three uncertainty levels, asking you only when the answer
  changes; BUY quality bar = process items + 5-yr ROIC floor + at least a narrow moat +
  management not rated poor (your 17 Oct decision); numeric C/F/E dropped (TEST 8 resolved). SBC
  single-count stays TEST.
- Implementation contract (spec): industry-code/trigger-B rule for the higher band; reverse-DCF grid replaced by one solve
  (§6.2/§7.1); §10.6.2 judgements as versioned inputs; §13.1 recent analyses.
- Product decisions: D1–D6 entries; PD-22, PD-23, PD-24 retired; PD-25 noted superseded; PD-19
  interpreted as adopt-to-finalize (D5); the 16 Oct MSFT reinvestment path superseded (D2).

**Change control:** rule values or verdict logic → CALVIN RULING; technical choices inside the
rulebook → AI DEFAULT with a receipt; cosmetic findings never reopen a merged milestone; a real
methodology conflict → one RECONCILIATION REQUIRED to you.

**NOW:** D1–D6; AR0; AR1. **NEXT:** AR2 → AR3 → AR4 → AR5. **LATER:** AR6 → AR7 → AR8, then LATER
items only on proven need. **NO:** Part 5 NO list; changes to BUILD/REVIEW/OWNER.

---

## Appendix A — MSFT base path (approved inputs, VERIFIED)
Year 1→10 revenue $378B→$911B; NOPAT $138B→$332B; reinvestment $76B→$91B (peak $128B, yr 6); FCFF
$62B→$242B; PV explicit $734B; terminal value $3,554B (PV $1,370B, 65.1%). Bridge: debt $40.294B +
finance leases $66.594B − cash & ST investments $76.843B − LT investments $36.348B = −$6.303B.
The planning scratch engine and SEC extracts were temporary and are not in the repo; AR2/AR4 must re-derive these values independently.

## Appendix B — AI-only baseline vs Analyzer
Same strong prompt (SEC data via code, web research, mid-year FCFF, V1 policy text), fresh agents,
no repo access.
- **COST** (cutoff 16 Oct): 18/18 facts exact; membership fees 51% of operating income, renewal
  92.3%, payables 117% of inventory; 9.0% CAPM; base $409 (mine $385); 2.42× → SELL in every bucket;
  24 tool calls, ~13 min, ~160k tokens.
- **MSFT run A** (cutoff 4 Sep, $499.70): 17/17 facts exact; 9.16%; terminal growth 3.5%, terminal
  return 20%; $228 / $416 / $636; 1.20× → HOLD (Medium); surfaced the OpenAI amendment, IRS claim,
  $684B backlog, useful-life change; 23 calls, ~16 min, ~180k tokens.
- **MSFT run B** (identical prompt): 17/17 facts identical; 9.19%; $211 / $396 / $576; 1.26× → HOLD,
  "+14bp on the rate makes it SELL"; 30 calls, ~27 min, ~250k tokens.

| Dimension | Strong AI-only prompt | Current Analyzer | Proposed Analyzer |
|---|---|---|---|
| Facts | 52/52 exact (it wrote extraction code) | Exact for mapped tags; gaps; unconfirmed facts used | Exact + golden harness + gating |
| Financial credibility | Sound, but picks its own conventions each run | Undecided 10%; unlinked reinvestment; BUY impossible | One rulebook |
| Reproducibility | Facts identical; values ±5–10%; verdict borderline | Re-fetches on every view | Identical reruns |
| Research | Best: 8-Ks, backlog, legal, accounting | Weak | Cited research in Quick Read |
| Usefulness | Clear verdict, ~1,800-word memo | Single-ratio SELL | Verdict + close call + levers |
| Speed / cost | 13–27 min; 160–250k tokens | ~3 min | ≤ ~2 min new; seconds re-run |
| Your attention | Read and trust a memo | Technical rulings | Only BUY / close calls |
| Maintenance | A prompt | Very high | Moderate |

**What deterministic software adds:** fixed rules for every company and run, instant revaluation,
saved snapshots, protection against drift. **What AI adds:** research, anchors, challenge.

## Appendix C — Independent challenge (two fresh-context reviewers) and resolution
**Finance reviewer** (own engine, raw SEC data): verified the reproduction, history, COST/NVDA facts
and code claims. Corrected: mixed timing conventions in my first tables; terminal returns held fixed
while cutting the rate; "repaired = HOLD" overstated (SELL survives under most settings); my
sales-to-capital fix broke terminal coherence (adopted their RONIC-linked rule instead); my NVDA
figures used the wrong tax rate (now ~$39/$141/$358); the spread-based bucket rule rewards
optimism (replaced); 8.5% implies a beta of 0.87 vs 1.10 observed (bands now market-anchored);
"no other amendment" was false (Part 10 now lists all); missed MSFT backlog, cash taxes,
uncommenced leases, NVDA guarantees (added).
**Product/architecture reviewer:** the pause and mandatory judgement contradicted standing rulings
(now conditional judgement and a caveat); decisions needed a recording step before BUILD (AR0);
proofs partly re-implemented the same formula (AR2 now uses presented statements and failing
invariants); the rate band lacked a profile rule and a cyclical class (D1); milestones were too
big and value came late (AR1 first, smaller outcomes); test changes unplanned (AR2 transition);
data model can't version (append-only sheets, code SHA); coordination stalls (pre-created issues).
**Unresolved, stated honestly:** MSFT's verdict genuinely depends on your moat and rate calls;
outside prices and Morningstar figures are unverified snippets; AI-draft stability is untested at
scale; the OpenAI stake value is unknown.

## Appendix D — Key sources
Notion: Methodology (3d20ca9a8fd08144ad14e66530f86e30), CAL Build Doctrine (3e40ca9a8fd08101848d…),
UX & Design System Principles (3d20ca9a8fd081f08606…). Repo: `docs/frozen/calboard-stock-analyzer-v1-spec.md`
§7.1/§10.6.2/§13.1, `docs/frozen/calboard-valuation-methodology.md` §3.4 (safeguards; MSFT at 8.5%),
`docs/proof/cf-msft-stage2-real-valuation-proof-01.md`, `docs/proof/cf-analyzer-stage3-verdict-finish-01.md`,
`docs/decision-packs/cf-analyzer-final-method-decision-01.md`, `docs/product-decisions.md`,
`docs/product-roadmap.md`; PR #440 rulings; issue #418. Data: SEC companyfacts (MSFT 789019, COST
909832, NVDA 1045810, KO 21344); MSFT FY26 10-K and 7 Oct earnings-date release; Morningstar Equity
Research Methodology (14 Jun 2023) and MSFT note; Damodaran data and 8 Oct 2026 post; Treasury daily
yields; stockanalysis.com prices (16 Oct).
