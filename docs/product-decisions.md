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
10. Paid research data allowed only when Calboard names the exact
    decision-relevant blind spot, shows public sources insufficient, and
    trials before recurring commitment.
11. Calboard aims for decision readiness, not certainty; Calvin supplies
    final judgment.
12. Do not add analysis once core decision jobs are covered unless it
    materially improves them.
13. Cross-Calboard UX/design consistency is a hard product requirement —
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
    silently counts as agreement. Scenario authorship stays human.
20. Calvin-friendly default UX is a hard product requirement: Quick Read
    first, Deep Dive optional, no Beginner/Pro split.
21. Analyzer supports listed operating companies only; funds/ETFs/indices/
    currency/crypto are UNSUPPORTED at Step 1 entry (does not weaken
    ETF-as-holding elsewhere).
22. Informed override (6 Sep 2026): Quick Read may state a deterministic,
    price-scoped CHEAP/FAIR/EXPENSIVE position with an entry-only action
    clause (start / do not start / wait) — never trim/add/sell, never the
    word "HOLD" here.
23. Step 4 forecast-dispersion reading (`CF-STEP4-READING-IMPL-01`,
    25 Sep 2026): adopts A2-in-principle / A1-fallback + B2 for Step 4 — the
    Step 4 quantity is the maximum `fullRangeValueImpact` across the
    tornado rows that are `available: true`, which is exactly the growth
    row alone whenever growth is the only, or the largest, available row;
    rendered as a categorical LOW/MEDIUM/HIGH dispersion tier. This ruling
    does not adopt any numeric tier boundary, band or cut-point — those
    stay open. (`CALVIN RULING — OPTION 1 APPROVED`, 25 Sep 2026 10:36:08Z,
    [PR #325 comment 5830997078](https://github.com/calyeap/Cal-Finance/pull/325#issuecomment-5830997078).)
