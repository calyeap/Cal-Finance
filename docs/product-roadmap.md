# Product Roadmap

Current authority for **strategic sequencing** — what's next and why, beyond
a single bounded task (see [`CURRENT-AUTHORITY.md`](CURRENT-AUTHORITY.md)).
This is a flat, dated index of durable strategic sequencing / runway content
only — capability-class priorities, not execution position. It carries **no
current-status field, no `NEXT` field, and no NOW-position marker of any
kind**: current execution position stays exclusively native-GitHub authority
(open issues, PRs, labels, comments, CI — see `CURRENT-AUTHORITY.md`'s
"Current project status / next authorised move" route). Where this content
borders another authority class, the boundary is stated inline; the excluded
half lives in that class's own authority (Product Decisions, the M9 design
contract, Investment Methodology, native GitHub state), not here.

This file supersedes the Notion Product Roadmap / Product Sequence page as
current authority for this fact class, per Calvin's ruling
([`CF-ROADMAP-CUTOVER-01`](https://github.com/calyeap/Cal-Finance/issues/247),
authorised on
[issue #246](https://github.com/calyeap/Cal-Finance/issues/246#issuecomment-5791751764),
23 Sep 2026).

## 1. Cal Finance V2 — reconciled architecture direction (17 Sep 2026)

- **Target shape: SIMPLE FIRST.** Prefer the smallest architecture that does
  the investment job over a more general one.
- **Four workflow modes**, kept distinct rather than collapsed into one
  generic surface.
- **Deterministic-vs-Skill split**: what must be deterministic code (hard
  rules, math, data plumbing) versus what can be an AI Skill (judgement,
  synthesis, narrative) is a first-class design decision, not incidental.
- **Snapshot contract**: a defined, stable snapshot boundary that later
  stages (Portfolio Review, monitoring) can depend on without re-deriving
  upstream state.
- **Do-not-build-by-default list**: capabilities that are explicitly not
  built until a real investment job requires them — breadth is not a goal
  in itself.
- **V2 delivery order**: bounded proof → M9 → UPDATE → PORTFOLIO REVIEW →
  SCREEN → monitoring.

## 2. Long-term north star

- **Operating model**: Calvin acts as CIO; Calboard supplies the
  institutional-style research, analysis, challenge, and decision process
  around him.
- **Canonical capability sequence**: Foundation → Stock Analysis →
  Portfolio Review → Calvin Decides.
- **Capability dependency table** (what depends on what): Foundation →
  Analyzer → Research Memory → Sector Intelligence → What Changed →
  Portfolio Review → Decision Logic → Action Candidates → Calvin.
- **Candidate advisor-briefing pattern**: Action Candidates are framed as a
  briefing to Calvin (why-it-appeared, strongest reason not to act,
  remaining checks, uncertainty), not as autonomous instructions.
- **Decision-readiness end state**: the system's goal is decision
  readiness, not certainty or automation — Calvin supplies the final
  judgement throughout.

## 3. Priority gate — capability-class level

NOW / NEXT / THEN / LATER / NO-FOR-NOW, at the capability-class level only
(no specific execution-step ordering — that is native-GitHub-owned):

- Research Memory
- Sector Intelligence
- What Changed?
- Portfolio Review
- Post-mortem / learning loop
- BTC rule
- Systematic research
- Methodology onboarding
- Congressional-trading signal

**NO-FOR-NOW**: capabilities in the do-not-build-by-default list above stay
out of scope until a real investment job requires them.

## 4. External product validation — business drivers

Routing bullets for how Research Memory and What Changed? should treat
driver evidence and valuation review zones:

- Business-driver evidence feeding Research Memory / What Changed? should be
  routed and weighed as supporting context for the decision layer, not as
  an automatic trigger.
- Valuation review zones are decision support surfaces, not automatic
  trade triggers (consistent with the valuation-derived action zones
  principle already settled in Product Decisions).

## 5. Professional research gap-closure track

- **Modelling depth**: close gaps in modelling rigor where they are
  decision-relevant, not for completeness on its own.
- **Forecast accountability**: track forecast quality over time rather than
  treating forecasts as disposable.
- **Evidence triangulation**: prefer conclusions supported by multiple
  independent evidence sources over single-source claims.

## 6. Anti-noise / anti-momentum constraints

- No streaming tape, flashing prices, or mover-driven attention loops.
- Price freshness is not the same as information freshness — do not let
  price movement alone drive attention or action.
- Do not add analysis, surfaces, or signals that do not materially improve
  a core decision job.

## 7. UPDATE workflow mode — reconciled definition (26 Sep 2026)

Opened as the next capability lane per `CALVIN RULING — OPTION B`
([issue #335](https://github.com/calyeap/Cal-Finance/issues/335),
[PR #334 comment 5842994023](https://github.com/calyeap/Cal-Finance/pull/334#issuecomment-5842994023)).
No UPDATE capability is implemented by this record.

- **UPDATE is** the workflow mode that lets an analyst explicitly initiate
  a fresh look at a company Cal Finance already has a report for, once new
  evidence exists worth checking against — a single-company, analyst-
  initiated re-look sitting between M9 and PORTFOLIO REVIEW in the V2
  delivery order above.
- **UPDATE is not** a refresh control, a re-run-with-same-facts shortcut, a
  price- or momentum-triggered surface, a run index/history/listing
  endpoint, or any verdict-completion/M8/BUY-HOLD-SELL work. Producing a
  new report still costs a genuine per-fact decision pass, same as a first
  run — the anti-momentum mechanism in §6 is not optimised away.
- **Which of the "four workflow modes" (§1) UPDATE is remains unanswered**
  by current authority — the delivery order names UPDATE, PORTFOLIO REVIEW
  and SCREEN, and separately names "monitoring," without ever enumerating
  the four modes or stating where monitoring fits. Not resolved here.
- **Depends on** an existing accepted Analyzer report (M9/Analyzer V2,
  accepted and frozen per `docs/analyzer-v2-final-acceptance-freeze.md`)
  and the existing acquire → verify → compute pipeline; whether it also
  depends on the snapshot contract above is left open.
- The `docs/frozen/calboard-stock-analyzer-v1-design.md:110`/`:125`
  no-refresh / no-history-list constraint is **superseded only for
  design-contract purposes** (`docs/CURRENT-AUTHORITY.md`,
  `docs/design/analyzer-v2-design-authority.md`); the underlying
  anti-momentum principle it states binds UPDATE as a live constraint in
  its own right, independently restated in §6 above and in
  `docs/product-decisions.md` item 18. No authority conflict — no
  `RECONCILIATION REQUIRED`.
- Full citations, reasoning, and the first bounded UPDATE implementation
  outcome — implemented (`CF-UPDATE-FIRST-OUTCOME-01`, issue #337):
  [`docs/update-workflow-mode-reconciliation.md`](update-workflow-mode-reconciliation.md).

## Source-of-truth rule

This file is the current authority for strategic sequencing / runway
content as defined above. Current execution position, NOW/NEXT status, and
task-level ordering are never recorded here — they stay native-GitHub-owned
per `CURRENT-AUTHORITY.md`. If a future addition to this file would require
a current-status or NOW-position marker, it does not belong in this file.
