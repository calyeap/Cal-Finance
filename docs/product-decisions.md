# Product Decisions

Current authority for **settled product semantics / Calvin rulings** (see
[`CURRENT-AUTHORITY.md`](CURRENT-AUTHORITY.md)). This is a flat, dated index
of settled product decisions only — no finance methodology, no design-token
or pixel/typography detail, no roadmap sequencing, no workflow/ops rules,
and no historical/superseded rows. Where a decision borders another
authority class, the boundary is stated inline; the excluded half lives in
that class's own authority (Investment Methodology, the M9 design contract,
Product Roadmap), not here.

This file supersedes the Notion Product Decision Log as current authority
for this fact class, per Calvin's ruling
([`CF-PRODUCT-DECISIONS-CUTOVER-01`](https://github.com/calyeap/Cal-Finance/issues/238),
authorised on
[issue #237](https://github.com/calyeap/Cal-Finance/issues/237#issuecomment-5790727600),
23 Sep 2026).

Currency note: the 23 Sep 2026 Analyzer Shell Contract V1 lock is a
design-contract item, not a product decision, and is deliberately not
promoted here. It belongs to the M9 design lane and is not yet reflected in
`docs/design/m9-analyzer-design-contract.md` on `master` — a design-lane
update, not a semantic conflict.

1. Successful-report verdict is always BUY/HOLD/SELL; `INCOMPLETE` never
   renders as a completed-report verdict. (22 Sep 2026)
2. M9 Analyzer identity: premium investment-research product,
   verdict-first hierarchy; fixed Full Analysis nav (Overview / Business /
   Financials / Valuation / Risks & Thesis / Market Context / Evidence);
   Market Context supports, never overrides fair value. (15 Sep 2026)
3. Decision layer = hard rules + human-confirmed judgement + candidates;
   AI does not make the final qualitative call.
4. HOLD is the default ownership state; REVIEW ≠ automatic action; price
   movement alone never triggers BUY/ADD/TRIM/SELL.
5. Action Candidates must show why-it-appeared / strongest reason not to
   act / remaining checks / uncertainty; no confidence score, no universal
   action score.
6. Valuation-derived action zones are decision support, not automatic
   trade triggers; assumptions stay visible and move with evidence.
7. Institutional reference model: personal long-only fund manager /
   family-office OS — borrow selectively, add features only for a real
   investment job.
8. Good company ≠ good price ≠ appropriate position size — underwriting /
   valuation stays separate from portfolio fit / sizing.
9. Human + AI division of labour: AI carries repeatable analytical
   workload; humans supply real-world context, management/incentive
   judgement, final qualitative decisions; human input is evidence, not
   authority; no MNPI.
10. Paid research data allowed only when Cal Finance names the exact
    decision-relevant blind spot, shows public sources insufficient, and
    trials before recurring commitment.
11. Cal Finance aims for decision readiness, not certainty; Calvin supplies
    final judgment.
12. Do not add analysis once core decision jobs are covered unless it
    materially improves them.
13. Cal Finance-wide UX/design consistency is a hard product requirement —
    one durable design language, same semantics/tokens across surfaces.
14. INVESTING (separate project) owns portfolio-policy numbers (target
    weights, caps, rebalance rules); Cal Finance consumes/checks but never
    authors or invents them.
15. Stock Analyzer is one-company only — no portfolio fit, sizing,
    cross-company state or ranking inside the Analyzer.
16. No generic "Intelligence Layer" — concrete chain only: Foundation →
    Stock Analysis → Portfolio Review → Calvin.
17. No universal score, autonomous trading, or persona voting.
18. Market-data posture: EOD-first (not EOD-only forever) — no streaming
    tape, flashing prices, or mover-driven attention loops; price
    freshness ≠ information freshness.
19. North Star (verbatim): *"Calboard exists to compensate for my
    investing weaknesses and improve the quality and consistency of my
    investment decisions by giving me an institutional-style research,
    analysis, challenge and portfolio decision process that I can
    understand and interrogate."* Caddie = product mental model, not
    architecture. Calvin is NOT the technical-finance correctness
    checker. UNSURE/I-don't-know is a legitimate human outcome and never
    silently counts as agreement. Scenario authorship stays human — read
    from 17 Oct 2026 as adopt-to-finalize for AI-drafted scenarios (item 30).
20. Calvin-friendly default UX is a hard product requirement: Quick Read
    first, Deep Dive optional, no Beginner/Pro split.
21. Analyzer supports listed operating companies only; funds/ETFs/indices/
    currency/crypto are UNSUPPORTED at Step 1 entry (does not weaken
    ETF-as-holding elsewhere).
22. *Retired 17 Oct 2026* — the 6 Sep 2026 informed override (Quick Read
    CHEAP/FAIR/EXPENSIVE position with an entry-only action clause) is
    superseded by item 28 (D3).
23. *Retired 17 Oct 2026* — the Step 4 forecast-dispersion reading
    (`CF-STEP4-READING-IMPL-01`, 25 Sep 2026) is superseded by item 28 (D3):
    uncertainty is settled by the verdict check, not a dispersion tier.
24. *Retired 17 Oct 2026* — the Step 4 dispersion-tier boundaries
    (`CF-STEP4-TIER-BOUNDARY-DEFAULT-01`, an `AI DEFAULT` derived from
    item 23) fall with item 23.
25. *Superseded (noted 17 Oct 2026)* — the 26 Sep 2026 Analyzer V2 final
    acceptance/freeze (`CF-ANALYZER-V2-FINAL-ACCEPTANCE-FREEZE-01`,
    `CALVIN RULING — A`,
    [PR #332 comment 5842778329](https://github.com/calyeap/Cal-Finance/pull/332#issuecomment-5842778329))
    predates the V1 verdict now on `master` (#399, #445). Analyzer
    acceptance is re-established by Analyzer Reset AR8 (item 31). Historical
    record: `docs/analyzer-v2-final-acceptance-freeze.md`.
26. **Analyzer Reset D1 — discount rate** (Calvin, 17 Oct 2026: approval of
    the Analyzer Reset master plan, decisions D1–D6, and his explicit AR0
    go; recorded under `CF-AR0-RECORD-DECISIONS-01`,
    [#447](https://github.com/calyeap/Cal-Finance/issues/447)).
    Market-anchored, two bands, reset yearly; growth alone never raises the
    rate. The product shows the dated rate in use. Finance semantics
    (bands, measurement, verdict check, leverage domain, cyclical classes):
    Cal Finance Methodology v2.1, D1 — not here.
27. **Analyzer Reset D2 — reinvestment and terminal returns** (same
    authority as item 26). Supersedes the 16 Oct 2026 MSFT reinvestment
    path (`CALVIN RULING: YES — APPROVED`,
    [PR #440 comment 6213272009](https://github.com/calyeap/Cal-Finance/pull/440#issuecomment-6213272009)).
    The moat class (none / narrow / wide) is Calvin's per-company judgement
    in the assumption sheet; MSFT and NVDA re-adopt once under item 30.
    Finance semantics (reinvestment formula, timing, moat credit):
    Methodology v2.1, D2.
28. **Analyzer Reset D3 — verdict mechanics** (same authority as item 26).
    V1 (Methodology) is the only verdict rule; CHEAP/FAIR/EXPENSIVE labels
    are removed from the product, and items 22–24 are retired. Routing: when all
    nine rate × uncertainty checks agree, the verdict issues automatically;
    when only the uncertainty level matters, Calvin gets one question (AI
    proposes, with evidence); when the rate-band ends disagree, Calvin gets
    a close call. No mechanical uncertainty checklist. Calvin's answers are
    stored as versioned inputs; "not sure" never becomes agreement. HOLD and
    SELL may issue automatically; a BUY also needs item 29's BUY
    confirmation — until then the result reads "BUY candidate — needs your
    quality call". "Why" reasons are templated from computed numbers; AI may
    not argue a position. The nine-point check itself: Methodology v2.1,
    D3.
29. **Analyzer Reset D4 — quality bar for BUY** (Calvin's own policy
    decision, 17 Oct 2026: a BUY requires at least a narrow moat). The bar —
    the five process items, the computed ROIC floor, at least a narrow moat
    with its mechanism cited, management Calvin does not rate "poor" — is
    defined in Methodology v2.1, D4. Product consequence: the BUY
    confirmation is Calvin's moat class, management rating and adopted
    process items; cheap companies without a moat can be HOLD or SELL, never
    BUY; "not sure" leaves a BUY candidate open, never a manufactured HOLD.
30. **Analyzer Reset D5 — AI-drafted scenarios: adopt-to-finalize** (same
    authority as item 26). For a new ticker, the report, valuation and
    verdict zone appear automatically from a price-blind AI draft whose
    every driver cites its anchor; the final verdict waits for one "adopt"
    (drivers may be adjusted first); re-runs of adopted sheets finish
    automatically. Adoption is Calvin's authorship of the scenarios
    (item 19). MSFT and NVDA need one re-adoption once D2 adds the
    return-on-new-investment driver. This later decision narrows the
    22 Sep 2026 ticker → report ruling (frozen spec §14.8) for the final
    verdict only — the report itself still completes without interaction.
31. **Analyzer Reset D6 — scope and acceptance** (same authority as
    item 26). Repair the engine, finish the unfinished workflow, delete what
    each step replaces — no rewrite (CAL Build Doctrine §19). A
    recent-analyses list is allowed (amends frozen spec §13.1). "Save this
    version" is the dated decision record. Analyzer acceptance = eight
    golden companies captured from presented statements, failing
    invariants, AI-only comparison and Calvin's timed review (Analyzer Reset
    AR8). Sequencing — including Portfolio Review, Screen and Holdings work
    parked until AR8: `docs/product-roadmap.md` §10.
