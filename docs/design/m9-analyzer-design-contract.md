# M9 Analyzer Design Contract

**OUTCOME-ID:** `M9-DESIGN-CONTRACT-01`
**Originating issue:** [#151](https://github.com/calyeap/Cal-Finance/issues/151)
**Authority:** Issue [#118](https://github.com/calyeap/Cal-Finance/issues/118) (`[M9 PLAN] Stock Analyzer verdict-first finance UX runway`), BOUNDED RUNWAY item 2. Product/UX direction authorised by Calvin, 15 Sep 2026.
**Status of this file:** a design contract — exact information architecture, component roles, theme rules and responsive behaviour for the M9 Analyzer surface. It is not a methodology document and not a product-decision source. Where it makes a design reading of an apparent tension between sources (§2.2, §4), that reading is recorded with its citation, the same way `docs/design/m9-contract-reconciliation.md` recorded its own readings — it is not silently absorbed.

---

## 1. Inputs and standing

**What this contract governs.** The M9 Stock Analyzer surface: the verdict-first Overview page and the Full Analysis navigation structure named in #118's `APPROVED OVERVIEW HIERARCHY` and `FULL ANALYSIS NAVIGATION`. It defines information architecture, component roles and responsibilities, theme rules, and responsive behaviour for that surface. It authorises no component implementation, no CSS, no route code — that is runway item 3 (the desktop shell) and later runway items.

**What it defers to, and does not restate:**

- **`docs/frozen/calboard-stock-analyzer-v1-design.md`** — the currently approved frozen Stock Analyzer design artefact per the Technical Specs Index (confirmed current and byte-verified by `docs/design/m9-contract-reconciliation.md` §1, 18 Sep 2026). This contract reuses its established component primitives (`Figure`, `StateSlot`, `ProvenanceTokens`, `FlagStack`, `Disclosure`, `SectionHead`), its colour-independent state mechanism (§6, §16), its provenance disclosure levels (§9), its canonical colour tokens (§17.11), and its workspace-width system (§17.15) rather than inventing parallel ones. Where #118 requires a structure the frozen artefact does not have (a distinct Overview page, thematic Full Analysis sections), this contract extends that vocabulary rather than replacing it — see §2.2 for the one place this needed an explicit reading.
- **`docs/frozen/calboard-stock-analyzer-v1-spec.md`** and **`docs/frozen/calfinance-methodology-v2.md`** — finance semantics: what the verdict, the valuation position (§10.6) and trust status (§9.6) mean and how they are derived. This contract assigns those concepts a place in the layout; it does not redefine them.
- **`docs/design/m9-contract-reconciliation.md`** — the settled M9 verdict/failure/confidence boundary (its §6 hand-off is binding input here; quoted throughout below rather than re-derived).
- **`AGENTS.md`** — retrieval and the conflict rule.

**What it is not.** Not a methodology source, not a product-decision source, not an implementation. A claim about what a component must show cites a source; a claim about what a number means is CalFinance Methodology v2's, never this file's.

---

## 2. Information architecture

### 2.1 Overview page

The Overview page is a new top-level destination, not a subsection of Full Analysis. It renders #118's `APPROVED OVERVIEW HIERARCHY`, items 1–12, in that fixed order, unconditionally — no slot is reordered, dropped, or rendered only in some states. This mirrors the frozen artefact's own fixed-ordering discipline (`calboard-stock-analyzer-v1-design.md:464`: *"Where a section has nothing to show, it renders its state — a section is never absent"*), carried forward to the new page.

Each slot below states: what it is for, what it must contain, what it must never contain. The per-slot **ordering rule** #118 sets — plain-English decision context, then important evidence/numbers, then deeper finance/provenance — governs *within* any slot whose content has that internal depth (2, 4, 6–11); slots 1, 3 and 12 are structural and carry no internal depth of their own.

| # | Slot | For | Must contain | Must never contain |
|---|---|---|---|---|
| 1 | **Company header** | Orientation — identity before any claim | Company name, ticker, as-of price timestamp. Structural only, matching the frozen artefact's own scale correction (`calboard-stock-analyzer-v1-design.md:906`: identity sits *below* the finding in visual weight, not above it) | Any verdict, figure, or finding-block content |
| 2 | **Dominant verdict + confidence + one-sentence rationale** | The single most prominent element of the page (#118) | The `DominantVerdictSlot` component (§3) — completed verdict or `INCOMPLETE` state (§4); confidence only when the analysis is not `INCOMPLETE` (`m9-contract-reconciliation.md` §4, §6: confidence is scoped to a valid analysis and never substitutes for the failure state); one plain-English rationale sentence, template- or `[C]`-sourced per `calboard-stock-analyzer-v1-spec.md:1130-1134`'s page-one production rules — no sentence assembled any other way | A numeral not present in the Analysis Result (`spec.md:1134`); a confidence figure where none is computed (§8); a rating, score or grade standing in for the rationale (`calboard-stock-analyzer-v1-design.md:1060`, "no scores, no ratings") |
| 3 | **Current price + price chart** | Orientation to the traded price, not an interpretation of it | Price, as-of timestamp, a chart. Per `m9-contract-reconciliation.md` §6, this restates already-acquired facts — it computes nothing new | Any annotation implying advice, a target price line, or portfolio framing (Calboard's durable "describes, never prescribes" rule extends to the Analyzer surface exactly as it does to Portfolio — `DESIGN.md` Hard Product Constraint 1) |
| 4 | **Bear / Base / Bull + attractive-price range + upside/downside, beside what the price assumes** | The valuation-evidence layer feeding the verdict, restated per `m9-contract-reconciliation.md` §2: *"CHEAP / FAIR / EXPENSIVE / INCONCLUSIVE ... feeding the top-level verdict and the valuation-range surfaces (#118 hierarchy items 4/8)"* | The `ScenarioRangeStrip` component (§3): scenario range, the deterministic CHEAP/FAIR/EXPENSIVE/INCONCLUSIVE position (`spec.md` §10.6.1–§10.6.2) where it renders, and upside/downside computed from the range — this is the frozen artefact's Section H reframed as a first-class Overview slot rather than a mid-report frame (`calboard-stock-analyzer-v1-design.md:509-521`). Per that same two-column frame, the range renders beside a condensed restatement of Section E (steady-state EV, PVGO share, implied growth — the same content slot 8 restates in full): H is never shown without E adjacent, matching `design.md:523`'s rule | A single point-value fair price (`spec.md` §10.3, `:1017`: *"Always a range, never a point"*; `:42`); a portfolio action word (trim/add/sell/hold — `spec.md:1114`); the position rendered where suppression rules (`spec.md` §10.6.3) say it must not; the range rendered without the adjacent E restatement |
| 5 | **What the business does** | Plain-English orientation to the company | A short editorial prose block, restating acquired facts | Analytical judgment, valuation reasoning, or a state/flag (those belong to Full Analysis / Evidence) |
| 6 | **Why invest** | The case, in plain English first | Finding-block-shaped prose (§17.3's order: finding → why it matters → for this company → what to examine), `[C]`-authored under `spec.md` §8.3's limits | An action recommendation (§17.4 rule 2: "what to examine" names a subject, never an action to take on the security) |
| 7 | **Why be cautious** | The counter-case, symmetric to slot 6 | Finding-block-shaped prose, same authorship limits as slot 6; may surface the selected challenger point (`calboard-stock-analyzer-v1-design.md` §17.7.1) | A state's only appearance (§17.4 rule 7 — states that a reading depends on must also appear in full, not only inside this prose) |
| 8 | **What today's price assumes** | The price-implied read, restated from the analysis, per `m9-contract-reconciliation.md` §2's item-8 reference | Steady-state EV, PVGO share, implied growth — the frozen artefact's Section E content, restated in full (never recomputed — "one figure, one computation," `DESIGN.md`'s durable UX principle, applies here identically). This is the same content slot 4 already restates in condensed form beside the range (`design.md` §10.2's two-column frame); slot 8 is its complete standalone treatment, not a second computation | A number not in the Analysis Result |
| 9 | **What matters most** | The single biggest driver of the conclusion | One `[C]`-authored plain-English point, restating already-computed material | A ranked list standing in for reasoning |
| 10 | **Biggest risk** | The single most consequential risk | One point, same authorship limits | A generic risk disclaimer not specific to this company |
| 11 | **What would change the verdict** | The reader's next concrete thing to watch | A short, specific statement naming the variable or event | A prediction of what will happen, or advice on when to act |
| 12 | **View full analysis** | The route into Full Analysis | A single, clearly primary link/control per Calboard's "one dominant primary action per screen" convention (`DESIGN.md`) | A second competing primary action |

**On slot 2's prominence given the M8 dependency.** `m9-contract-reconciliation.md` §5 and §6 record that, until M8 delivers the §10.6.2 comparator, `deriveVerdict` returns `INCOMPLETE` on every run. Slot 2 is #118's single most prominent element, so its `INCOMPLETE` presentation (§4 below) must be designed and validated as an expected, common, first-class case — not styled as a rare edge case that happens to be what every current run shows. This is a design instruction that follows directly from a recorded fact; it is not a sequencing decision about M8 (out of scope here per issue #151's HARD BOUNDS) and does not reorder or pull forward any runway item.

### 2.2 Full Analysis navigation

Sections, in #118's order: **Overview · Business · Financials · Valuation · Risks & Thesis · Market Context · Evidence.**

**Navigation mechanism — a design reading, recorded.** `calboard-stock-analyzer-v1-design.md` §10.1 states: *"One continuous document with a persistent section rail... Tabs are prohibited by §10.1's ordering principle... a tabbed report structurally permits opening H without E."* Read only against §10.1, #118's `FULL ANALYSIS NAVIGATION` list could look like a request for route-switched tabs, which would conflict. It is not, for two independent reasons. First, on Overview itself: §2.1 slot 4 carries §10.2's two-column frame directly (`design.md:509-521`) — the fair-value range beside a condensed restatement of Section E — so H is never shown without E adjacent on Overview, at the single most prominent valuation slot on the page (Section E's own full restatement is separately at slot 8; see §2.1). Second, in Full Analysis itself: the document stays one continuous, rail-navigated scroll (below), so H (in Valuation) is never reachable without having scrolled past E first — a tabbed route swap is exactly what would permit opening H without E, and that is precisely what this IA does not do. Nothing in Full Analysis's own six sections carries an equivalent "never shown alone" requirement from any approved source beyond the E/H pairing already accounted for above. §10.1's specific prohibition is therefore satisfied by construction under the new IA, not overridden by it, and the reading below extends rather than contradicts §10.1:

- **Full Analysis is one continuous, scrollable document** with a persistent section rail, exactly the frozen artefact's existing mechanism (`calboard-stock-analyzer-v1-design.md` §10.1, §17.9): the rail's current-section marker tracks scroll position, and the section anchor is in the URL so a return restores position (§17.9's "Requirement for BUILD," carried forward here).
- **"Overview" in the Full Analysis nav list is a link back to the Overview page**, not a seventh scrollable section of the Full Analysis document — Overview's own content is fully specified in §2.1 and is not duplicated here.
- **The remaining six items are anchored sections of one document**, in the stated order, navigated by the same rail. This is what makes the mechanism *navigation* in #118's sense (every named destination is one click away, at all times) without being *tabs* in §10.1's prohibited sense (a route swap that can leave required context off-screen and permits, e.g., opening a valuation figure without ever having scrolled past the evidence that grounds it).

This is recorded here, with its citation, rather than silently picked, because it is exactly the kind of exact-navigation-mechanism decision issue #151 SCOPE item 2 assigns to this contract.

Full Analysis's six sections re-group the frozen artefact's fixed report content (Sections A–J, `calboard-stock-analyzer-v1-design.md` §10.2) thematically rather than sequentially. Nothing in that content is dropped, renamed at the data level, or given new methodology — only its presentation grouping changes, which is exactly what a design contract may decide (SCOPE item 2) and exactly what neither the frozen artefact nor CalFinance v2 forbids reorganising, provided the never-hidden and disclosure rules in §15 (frozen doc) continue to hold, which they do under this grouping (each theme still renders every state, flag and provenance token it inherits, per §7 below).

| Section | For | Must contain | Must never contain |
|---|---|---|---|
| **Business** | What the company does and how, in depth | The Overview's "what the business does" content, expanded; qualitative facts from Section B (fact set) that describe the business rather than its financials | Valuation reasoning, financial diagnostics |
| **Financials** | The deterministic diagnostics | Sections C (gate results) and D (deterministic diagnostics, M1–M14) content, with their states, per §7 | A verdict or a position — those live on Overview and in Valuation only |
| **Valuation** | The full price-implied and analyst-assumed picture | Sections E (price-implied diagnostics), F (analyst scenarios), G (scenario outputs) and H (fair-value range, restated per `spec.md` §10.3) — the reverse-DCF grid, scenario matrix and fair-value frame belong here in full, not only summarised on Overview | A recomputation of anything Overview already restates (one figure, one computation) |
| **Risks & Thesis** | The editorial interpretation layer, in full | Sections I (Interpretation) and I2 (Challenger findings), per `calboard-stock-analyzer-v1-design.md` §17.7.1 and §10.7 prohibitions | A counter-case produced anywhere other than the blind challenger (`spec.md:1043`); an interpretation-layer position (the frozen prohibition on Section I2 reading `interpretation` stands, `design.md:558`) |
| **Market Context** | Sourced, comparative context for the price and the company — new to M9, with no direct analog in the frozen artefact's Sections A–J | Only facts traceable to the acquired fact set (Section B) or already-computed comparator material (e.g. the §10.6.2 comparator once M8 lands); peer/sector framing where sourced | Any invented peer comparison, index, or score not backed by an acquired fact — this section has no approved content source yet beyond what Business/Financials/Valuation already carry, so it is explicitly **scoped down to what those sections' existing facts support** until a source authorises more; do not invent content to fill it |
| **Evidence** | The provenance and disclosure register, in full | Section J (provisional and unmodelled register, `spec.md` §10.2, "never collapsed" per `design.md` §10.6) and the fact set's full provenance display (§9 of the frozen doc) | A collapsed or summarised register (`design.md:541`: collapsing Section J "would be exactly the footnote failure §5.5 describes") |

**Per-section ordering rule.** Every Full Analysis section leads with plain-English decision context, then important evidence/numbers, then deeper finance/provenance — #118's stated rule, and identical in shape to the frozen artefact's own finding-block order (`calboard-stock-analyzer-v1-design.md` §17.3: finding → why it matters → for this company → what to examine → existing content). This contract does not require a literal finding block on every section (Business and Evidence do not carry one today per `design.md` §17.6, for reasons — an editorialised fact set, and a disclosure register — that still hold); it requires that whatever a section's opening content is, it satisfies the plain-English-first ordering before the deeper material.

---

## 3. Component roles

Named per issue #151 SCOPE item 3: responsibility and boundaries, not code. Primitives already defined by the frozen artefact (`Figure`, `StateSlot`, `ProvenanceTokens`, `FlagStack`, `Disclosure`, `SectionHead`, `calboard-stock-analyzer-v1-design.md:137-146`) are reused unchanged and are not redefined here.

| Role | Responsibility | Boundaries |
|---|---|---|
| **`DominantVerdictSlot`** | Renders the single most prominent element of Overview: the completed BUY/HOLD/SELL verdict, or the `INCOMPLETE` state in its place (§4). Owns the visual/editorial distinction between the two | Never renders a portfolio action; never renders a verdict the Analysis Result does not carry (`spec.md:1134`); the `INCOMPLETE` presentation and the completed-verdict presentation are two distinct render paths, not one path with a colour swap (§4) |
| **`ConfidenceIndicator`** | Communicates uncertainty inside a valid analysis, adjacent to the verdict | Renders only when the analysis is not `INCOMPLETE` (`m9-contract-reconciliation.md` §4, §6); until a computation is authorised (§8, open item), this role has no figure to render and must not fabricate one — see §8 |
| **`RationaleLine`** | The one-sentence rationale beside the verdict | Template- or `[C]`-sourced only, per `spec.md` §10.7's page-one production rules; never a second, competing explanation of the verdict |
| **`PriceChartPanel`** | Current price plus its chart | Restates acquired price facts; issues no target, no annotation implying advice |
| **`ScenarioRangeStrip`** | Bear/Base/Bull, attractive-price range, upside/downside, and the CHEAP/FAIR/EXPENSIVE/INCONCLUSIVE position where it renders | Never compresses a pre-revenue distribution summary into bear/bull bounds (`spec.md` §10.3, carried into this role exactly as the frozen `FairValueFrame` compound observes it); never renders the position under suppression (`spec.md` §10.6.3) |
| **`EditorialProseBlock`** | The `[C]`-authored plain-English content in Overview slots 5–11 and in Business/Risks & Thesis | Bound by `spec.md` §8.3's hard limits throughout — no facts it was not given, no figure it did not receive, no portfolio-action language, no ranking of its own findings |
| **`EvidenceProvenanceSurface`** | Renders Section J (provisional/unmodelled register) and the fact set's provenance tokens in Full Analysis → Evidence | Always fully expanded (`design.md` §10.6); reuses `ProvenanceTokens` / `Disclosure` unchanged; never summarised |
| **`FullAnalysisNav`** (section rail) | The persistent, URL-anchored navigation across Full Analysis's six sections, plus the link back to Overview | One rail, tracks scroll position, carries no counts/badges/completion indicators (`design.md:503`, `:918`) — extends the frozen artefact's existing rail role (§2.2), not a new navigation primitive |

---

## 4. Verdict and failure-state treatment

Per issue #151 SCOPE item 4 and `m9-contract-reconciliation.md` §3 and §6: the `INCOMPLETE` failure state is today undifferentiated markup from a completed verdict (`app/analyzer/[runId]/report/page.tsx:81-82` renders `Verdict — {verdict.status}` / `{verdict.reason}` through the same `.name`/`.cause` classes regardless of status), and its UI treatment is explicitly assigned to this contract.

**Rule.** A completed verdict (BUY / HOLD / SELL) and the `INCOMPLETE` state are two distinct presentations within `DominantVerdictSlot`, not one presentation with different words substituted:

- **Completed verdict.** The verdict word, the confidence indicator (where present), and the one-sentence rationale, in the visual register #118 describes as dominant — the largest, most prominent element on the page.
- **`INCOMPLETE`.** Uses the frozen artefact's existing suppressing-state mechanism (`calboard-stock-analyzer-v1-design.md` §6): state name, cause line, left-aligned, breaking the rhythm a completed verdict's right-aligned tabular treatment would otherwise establish, no glyph. This reuses `StateSlot`'s established structural distinction rather than inventing a second one, and it is exactly the same mechanism already governing every other suppressing state in the product — extended to the one place it does not yet reach (§10 of the frozen doc governs Section H and the report body; this contract extends it to the Overview verdict slot specifically, which did not exist when §6 was written).
- **Editorially**, the two states differ in what surrounds them: a completed verdict is followed by the confidence indicator and rationale (slot 2, §2.1); `INCOMPLETE` is followed by its cause line and, only where the derivation supplies one, a recovery statement — never an invented one.

**Cause without recovery — three of four branches.** `m9-contract-reconciliation.md` §3 records that only the `COMPARATOR_NOT_YET_AVAILABLE` branch states a recovery path in its `reason`; the other three (`trust.status === "UNUSABLE"`, `range.kind === "suppressed"`, `range.kind === "pre-revenue-distribution"`) state a cause only. This contract's rule: **render `verdict.reason` verbatim as the cause line in every case; render a recovery statement only where the derivation supplies one.** Do not author placeholder recovery copy for the other three branches — per issue #151 HARD BOUNDS, no invented recovery copy that no approved source supplies. Where no recovery path exists, the state name and cause line are the complete, honest presentation; this matches Calboard's durable rule elsewhere that "failure is a named state, not a blank" (`DESIGN.md`) without requiring every failure to name a fix.

**Do not conflate with `SuppressingState.INCOMPLETE`.** Per `m9-contract-reconciliation.md` §3, the module-level `SuppressingState` union's own `"INCOMPLETE"` member (`lib/analyzer/suppression.ts`) is a distinct, diagnostic-level concept from `VerdictStatus.INCOMPLETE`. This contract's rule above governs the report-level `DominantVerdictSlot` only; a module-level suppressed cell elsewhere on the page uses the frozen artefact's existing `StateSlot` treatment as already specified, unchanged.

---

## 5. Theme rules

One persistent two-state light/dark toggle across routes (#118), reusing `ThemeContext` — the same session-only mechanism Dashboard and Holdings already share (`DESIGN.md`: *"same session-only shape as `PrivacyContext`"*) and the one the frozen artefact's §17.11 cross-site pass put the Analyzer onto. This contract does not invent a third toggle implementation.

**Token structure.** Reuse the canonical token set the frozen artefact's §17.11 already declared for the Analyzer, aliased onto Calboard's shipped Dashboard/Holdings tokens rather than a parallel palette:

| Role | Canonical token | Light | Dark |
|---|---|---|---|
| Ground / page background | `--ground` | `#F2EEE5` | `#16181A` |
| Field / surface | `--field` | `#F8F5EE` | `#1E2124` |
| Strong hairline | `--line-strong` | `#CBC2AE` | `#3C4045` |
| Muted text | `--muted` | `#5F5A50` | `#979CA1` |
| Suppression-state tint (Analyzer-only; no Dashboard/Holdings equivalent, derived from `--ground`) | `--tint` | `#E8E1D2` | `#24272A` |

(`calboard-stock-analyzer-v1-design.md:947-957`.) The dominant-verdict slot and the scenario-range strip introduce no new colour role beyond these — a verdict is distinguished structurally (§7), not by a dedicated verdict colour, consistent with Calboard's durable "status is never carried by colour alone" principle (`DESIGN.md`).

**State rules, both themes.**

- **Dark is calm/premium, not crushed-black or neon** (#118) — `--ground` is `#16181A`, not `#000000`; no saturated accent colour is introduced for the verdict or the valuation strip.
- **Light is low-glare, not pure-white** (#118) — `--field` (`#F8F5EE`) is the working surface, matching the frozen artefact's own explicit rejection of pure white as a Calboard surface value (`design.md:947`, noting `--surface` was pure white before this alias table and that was a defect to fix).
- **Contrast** is checked against this token set at both themes (`design.md:746`), including the new `DominantVerdictSlot` and `ScenarioRangeStrip` roles, which did not exist when §16 accessibility was last validated.

**Sequencing condition (contract condition, not permission to ship one theme).** If sequencing forces one theme to lead, **dark is designed and validated first** (#118); **light must reach parity before M9 acceptance** — this is a `DONE WHEN` condition of the M9 acceptance runway item (#118 BOUNDED RUNWAY item 11), recorded here as binding on however runway items 3, 7 and 11 sequence the work, not as a licence to defer light mode indefinitely.

---

## 6. Responsive behaviour

Per #118's stated priority order and the frozen artefact's existing workspace-width system (`calboard-stock-analyzer-v1-design.md` §17.15, three modes driven by window width, not device), extended to name explicit device classes for the two phone tiers #118 adds that the frozen system did not previously name:

| Priority | #118 tier | Frozen-system mode it maps to | Layout behaviour |
|---|---|---|---|
| 1 | Desktop half-window / normal working width | **Standard** (1024–1600px) | Section rail │ report column, Overview's slots in a single reading column at the `72ch` prose measure; `ScenarioRangeStrip` and other analytical (non-prose) content use the full column width, uncapped |
| 2 | Full normal desktop | **Standard**, upper range | Same composition; no third column appears (§17.15: *"the main column therefore never narrows as width increases"*) |
| 3 | Full ultrawide | **Wide** (≥1600px) | Same rail │ report composition; the additional width goes to analytical content (charts, the reverse-DCF grid, scenario tables), never to prose measure, and never to a sticky third column — §17.15 explicitly records that an earlier sticky-column design was rejected in user testing and must not return |
| 4 | iPhone Pro Max class width | **Compact** (≤1024px), phone sub-range | Single column: Overview content stacked, `grid-template-areas` composition analogous to §17.15's Compact ordering (summary content first, then navigation, then deeper content). Within slot 4's two-column frame (§2.1), the range and the price-implied restatement stack **price-implied first**, per `design.md:525`: *"so the market's assumption is read before the analyst's on every device"* — both named iPhone tiers are below `design.md:525`'s 720px threshold |
| 5 | iPhone Pro class width | **Compact**, narrower phone sub-range | Same single-column composition as tier 4, including slot 4's price-implied-first stacking (`design.md:525`); this contract does not add a second breakpoint below Compact — the frozen system's `320–976px` main-column range already spans both iPhone Pro and Pro Max class widths, so no new mechanism is required, only validation at both widths |

**Right rails.** Supporting right-rail content (where any exists on Overview or Full Analysis at wide layouts) relocates into the main reading flow at Compact width rather than being dropped — the same rule the frozen artefact's Quick Read component already follows (`design.md:1041`: *"Quick Read stays in the main reading flow at every width... the product must not make important information conditional on owning an ultrawide monitor"*). This contract extends that rule to any Overview or Full Analysis supporting rail: **relocate or stack, never crush the core reading flow** (#118's own wording), and never make a slot's content exist only at wide widths.

**Never reflows out of the critical reading path, at any width:** the Overview's slots 1–4 (header, verdict, price, valuation range) and Full Analysis's persistent section rail (or, at Compact width, its collapsed equivalent per §17.15's Compact composition) — matching the frozen artefact's durable rule that no state, flag or provenance token is ever hidden, truncated, collapsed or moved off-screen at any width (`design.md:692`).

---

## 7. Colour-independent state encoding

Per issue #151 SCOPE item 7: every state this contract defines — the completed verdict, `INCOMPLETE`, the CHEAP/FAIR/EXPENSIVE/INCONCLUSIVE valuation position, staleness, and suppression — is distinguishable without colour, extending the frozen artefact's existing structural mechanism rather than introducing a new one:

- **No state, flag or provenance label is colour-only** (`design.md:742`: *"no state, flag or provenance label is encoded in colour, so the entire vocabulary survives greyscale, colour-blindness and high-contrast mode by construction"*). This holds identically for the new `DominantVerdictSlot` and `ScenarioRangeStrip` roles: the verdict word, the position token and every suppressing state render as real text with a structural cue (left-rule break, alignment, weight — §4, §6), never a colour swatch standing alone.
- **The verdict/`INCOMPLETE` distinction (§4)** is carried by which render path fired (word + rationale vs. state name + cause line), not by a colour difference between the two.
- **Stale and suppressed states** reuse the existing marker-plus-wording pattern Calboard already ships on Dashboard/Holdings (`DESIGN.md`'s States table: a `.marker` dot plus wording, never colour alone) and the Analyzer's own `StateSlot` mechanism — both are structural-first, colour-second.
- **Full accessibility validation is runway item 9** (#118) and is not performed here; this section defines the encoding rule the later audit will check against, per issue #151 SCOPE item 7's own instruction.

---

## 8. Open items, named explicitly

Per `m9-contract-reconciliation.md` §6 and issue #151 SCOPE item 8, the following are recorded as open — this contract does not close them, and no computation, threshold or UI relationship is invented to make them look closed:

1. **Confidence computation.** No approved source defines how the Overview slot-2 confidence figure is computed (`m9-contract-reconciliation.md` §4: *"no approved source defines how M9's verdict-level confidence figure is computed"*; `calfinance-methodology-v2.md:479` lists source-count confidence scores under "Not governing requirements"). `ConfidenceIndicator` (§3) has a named role and a stated condition for when it may render, but no computation to render — that is a genuine open item for a future methodology decision, not for this contract or for the desktop-shell implementation to default.
2. **The §10.6.4 entry-side action clause vs. the top-level verdict.** `m9-contract-reconciliation.md` §6: *"no source reconciles the two into one UI element, and this outcome does not invent that reconciliation."* This contract places the action clause inside `ScenarioRangeStrip` (Overview slot 4, §2.1) as part of the valuation-evidence layer, and the verdict inside `DominantVerdictSlot` (slot 2) — adjacent on the same page, per #118's fixed ordering, but this contract does not assert any further UI relationship (a shared component, a cross-reference, a combined rendering) between them beyond that shared-page adjacency, which follows directly from #118's own fixed slot order rather than from a new design decision.
3. **Market Context's content source.** As recorded in §2.2's table: no approved source defines what "market context" contains beyond what the existing fact set already supports. The section role is named and bounded; its eventual content is scoped down to sourced facts only, pending whatever future outcome defines it further.
4. **M9 acceptance validation of the `INCOMPLETE`-by-default state.** §2.1 records that, under the current M8 dependency, `DominantVerdictSlot` will render `INCOMPLETE` for every run until M8 lands. This contract instructs that the state be designed and validated as first-class (§2.1), but whether that validation happens before or is blocked on M8 remains a sequencing question outside this contract's HARD BOUNDS.

---

## 9. Hand-off statement

Runway item 3 (the desktop shell) may build directly from this contract: the Overview page's twelve slots and their component roles (§2.1, §3), the Full Analysis navigation mechanism and its six sections (§2.2), the verdict/`INCOMPLETE` distinction (§4), the theme token set and toggle (§5), and the responsive tier mapping (§6) are all specified to component-role depth and cite their sources.

What remains open, and is not implementation-ready: the confidence computation, the action-clause/verdict UI relationship, and Market Context's eventual content source (§8) — the desktop shell may render `ConfidenceIndicator` and Market Context as structurally present but content-empty/deferred roles until those are resolved, rather than inventing content to fill them. Full accessibility validation (runway item 9) and real-company validation (runway item 10) are later runway items this contract does not perform.

---

## Verification

- `npx tsc --noEmit` — no application code touched by this outcome; run to confirm no regression.
- `npm test` — no application code touched by this outcome; run to confirm no regression.
