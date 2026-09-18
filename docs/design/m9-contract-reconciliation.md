# M9 Contract Reconciliation

**OUTCOME-ID:** `M9-CONTRACT-RECON-01`
**Originating issue:** [#148](https://github.com/calyeap/Cal-Finance/issues/148)
**Authority:** Issue [#118](https://github.com/calyeap/Cal-Finance/issues/118) (`[M9 PLAN] Stock Analyzer verdict-first finance UX runway`), BOUNDED RUNWAY item 1. Product/UX direction authorised by Calvin, 15 Sep 2026.
**Status of this file:** reconciliation and recording only. It creates no new finance policy, product rule, or design contract. It is downstream evidence for the next outcome (#118 runway item 2, the M9 design contract), not a source of authority in its own right.

This document reconciles three sources that speak to the M9 verdict/failure contract — the frozen `docs/frozen/` Stock Analyzer artefacts, issue #118, and the current Notion Technical Specs Index / Product Decision Log — and records where each currently stands.

## 1. Frozen-artefact hash verification

Every artefact `AGENTS.md` and the Technical Specs Index route to for this outcome was re-hashed directly from the working tree (`sha256sum docs/frozen/*`) and compared against both `scripts/evidence/config.ts`'s `FROZEN_HASHES` and the Technical Specs Index's own currently-approved-revision register (fetched live, 2026-09-18, from `https://app.notion.com/p/3c60ca9a8fd081328231ded31fbe1f54`).

| File | SHA-256 (computed) | Matches `FROZEN_HASHES` | Matches Technical Specs Index register |
|---|---|---|---|
| `calboard-stock-analyzer-v1-spec.md` | `6a9cf282ce3808d0…` | yes | yes — H3 amendment `CB-H3-CONTRACT-01`, 12 Sep 2026, PR #61 |
| `calboard-stock-analyzer-v1-design.md` | `7535c6b6551b0ebf…` | yes | yes — amendment §20.8, `CB-OKLO-SECTIONS-01` + `CB-AUDIT-01` conflict A, 16 Sep 2026, PR #130 |
| `calboard-valuation-methodology.md` | `a4a39e33717993fe…` | yes | yes — v1.0.2, **superseded as authority** by `calfinance-methodology-v2.md` on 8 Sep 2026, retained deliberately as history only |
| `calfinance-methodology-v2.md` | `0e07ec7454b1c128…` | yes | yes — re-frozen 14 Sep 2026, PR #94, 31,304 bytes; canonical semantic authority is the Notion *CalFinance methodology v2 — Current* page, this file is its implementation snapshot |
| `mock-human-steps.html` | `2f9e741bb770c7ee…` | yes | yes — M7-c, 7 Sep 2026, PR #30 |
| `mock-report-msft.html` | `4c7547cb23dfe6a6…` | yes | yes — re-frozen 10 Sep 2026, `CB-IA-DISCLOSURE-02`, PR #52 |
| `mock-report-oklo.html` | `8d02adac2b9e9a83…` | yes | yes — re-frozen 16 Sep 2026, `CB-OKLO-SECTIONS-01` + `CB-AUDIT-01` conflict A, PR #130 |
| `mock-screen1-entry.html` | `700db080c611440…` | yes | yes — re-frozen 9 Sep 2026, amendment M8-2-D, PR #48 |

All 8 registered artefacts are present, byte-exact, and consistent in both directions (repo bytes ↔ `FROZEN_HASHES` ↔ Technical Specs Index). No missing artefact, no drift. Presence in `docs/frozen/` is confirmed as *approved for the revision shown*, per the Technical Specs Index register above — not assumed from mere presence.

## 2. Verdict vocabulary — what governs which surface

**Governs the top-level completed verdict slot:** the Notion **Product Decision Log** and **Technical Specs Index**, both carrying an explicit callout dated **18 Sep 2026** (reaffirming Calvin's 15 Sep 2026 ruling), and `lib/analyzer/verdict.ts`'s in-repo record of the same ruling (CF-V2-PROOF-01, merged as PR #140).

- Product Decision Log (fetched live, 2026-09-18): *"Stock Analyzer verdict vocabulary = **BUY / HOLD / SELL only** (RULED by Calvin, 15 Sep 2026)... For a supported stock whose analysis completes reliably, Stock Analyzer must return exactly one stock-level verdict: BUY, HOLD or SELL."* And, in the reaffirming callout: *"the product verdict remains exactly BUY / HOLD / SELL. CHEAP / FAIR / EXPENSIVE / INCONCLUSIVE are supporting valuation-evidence states, not competing top-level product verdicts."*
- Technical Specs Index (fetched live, 2026-09-18): *"Current authority — FINAL owner ruling reaffirmed 18 Sep 2026: ... Whenever Cal Finance reaches a stock-level investment decision, the final vocabulary is permanently BUY / HOLD / SELL... Top-level completed stock verdict = BUY / HOLD / SELL. CHEAP / FAIR / EXPENSIVE / INCONCLUSIVE are supporting valuation-evidence states only."*
- Issue #118: *"Successful Analyzer verdicts are exactly: BUY, HOLD, SELL."*
- `lib/analyzer/verdict.ts:1-18` (code comment, current `master`): records the same ruling verbatim and states *"The top-level vocabulary stays BUY / HOLD / SELL (the ruling is explicit that this overrides the frozen spec's CHEAP/FAIR/EXPENSIVE wording for this slot)."*

**Governs the underlying deterministic position mechanism, as supporting valuation evidence, not the top-level verdict:** the frozen spec, `docs/frozen/calboard-stock-analyzer-v1-spec.md` §10.6.1–§10.6.5. §10.6.1 rules the position vocabulary is CHEAP / FAIR / EXPENSIVE ("Bull and bear are sentiment words for what is arithmetic... HOLD collides with a portfolio-layer state"); the CalFinance Methodology v2 amendment (§10.6.2, per the Technical Specs Index's "M8 AMENDMENT" record) adds INCONCLUSIVE as a fourth positive-evidence state, replacing the old FAIR-on-disagreement fallback. §10.6.2 is the deterministic derivation from price-vs-range and the required-versus-achieved growth comparator; §10.6.4 attaches an entry-side action clause (start / do not start / wait) to that position, not to a BUY/HOLD/SELL verdict.

**Reconciliation, not a conflict.** The frozen spec's §10.6.1 wording ("no verdict... issues exactly one deterministic, entry-side valuation position — CHEAP / FAIR / EXPENSIVE") predates the 15/18 Sep 2026 Calvin rulings and, read alone, could look like it contradicts #118's BUY/HOLD/SELL vocabulary for the top-level slot. Both current Notion authorities are explicit that this is **already settled, not an open conflict**: the Technical Specs Index states *"The frozen Stock Analyzer specification and Design artefacts remain implementation contracts only where they do not conflict with a later explicit Calvin ruling... This decision must not be escalated again because an older frozen artefact says otherwise; the stale artefact is the thing to fix,"* and the Product Decision Log states the same for "older dated entries and frozen implementation artefacts." Per `AGENTS.md`'s conflict rule, `RECONCILIATION REQUIRED` is for *unresolved* disagreement between authorities; this is a stale frozen artefact against an authority that has already ruled and says so on its own page, not an open dispute this outcome must adjudicate. This finding is recorded rather than silently absorbed because the M9 design contract will need to cite it: **the CHEAP / FAIR / EXPENSIVE / INCONCLUSIVE position remains the deterministic supporting-evidence layer (feeding "what today's price assumes" / valuation-range surfaces in #118's Approved Overview Hierarchy, items 4 and 8), while BUY / HOLD / SELL is the separate, later-ruled top-level dominant-verdict slot (#118 item 2) that synthesizes it plus the growth comparator (see §4 below).** No code, no `docs/frozen/` edit, and no re-freeze happens in this outcome; the frozen spec's own wording is left exactly as written, per this outcome's HARD BOUNDS.

## 3. Failure / incomplete semantics

**What governs:** #118 — *"A decision-critical data / valuation failure is not a fourth verdict. It renders as an explicit analysis failure / incomplete-analysis state with cause and recovery path."* The Product Decision Log states the identical rule verbatim: *"If decision-critical evidence is missing, stale or contradictory such that a reliable conclusion cannot be formed, render analysis incomplete / failure with cause and recovery path and do not manufacture HOLD."*

**Implemented shape.** `lib/analyzer/verdict.ts:39` declares `export type VerdictStatus = "BUY" | "HOLD" | "SELL" | "INCOMPLETE"`. `deriveVerdict` (verdict.ts:52-81) returns `{ status: "INCOMPLETE", reason: <cause + recovery path> }` on every path currently reachable (confirmed by `lib/analyzer/verdict.test.ts`, which asserts `INCOMPLETE` for all six exercised cases, including the "the comparator has not been acquired yet" case that fires unconditionally once trust and range are usable). Every `INCOMPLETE` `reason` string in the current code states both cause and recovery (e.g. `COMPARATOR_NOT_YET_AVAILABLE`, verdict.ts:46-50: *"Decision-critical analysis is incomplete... Recovery: this verdict becomes available once M8 delivers the comparator fact."*).

**Does the shape satisfy the contract, or diverge?** Semantically it satisfies #118 and the Decision Log: `INCOMPLETE` is never treated as a peer investment conclusion — it always carries a stated cause and recovery path, and no code path manufactures BUY/HOLD/SELL or a HOLD default in its absence (this is exactly what PR #140 / CF-V2-PROOF-01 was built to enforce, and `verdict.test.ts` pins it). Structurally, `INCOMPLETE` is one member of the same `VerdictStatus` union as the three real verdicts — a type-level grouping, not a rendering decision. Today's only consumer, `app/analyzer/[runId]/report/page.tsx:81-82` (and its snapshot-page equivalent, `app/analyzer/[runId]/snapshot/[version]/page.tsx:45-46`), renders `Verdict — {verdict.status}` and `{verdict.reason}` through the same two CSS classes (`.name` / `.cause`) regardless of which status it is — there is currently no distinct visual treatment separating a completed verdict from the failure state. That is an open point for the M9 design contract to rule on, not something this outcome resolves: the Decision Log's own UI requirement elsewhere (on a related state, suppression/qualification) is that such states *"require distinct visual treatment,"* which is a reasonable analogy but is not itself a ruling on `INCOMPLETE`'s rendering. This reconciliation records the gap; it does not close it.

**A separate, same-named module-level convention exists and must not be conflated with the above.** `lib/analyzer/types.ts`'s `SuppressingState` union also includes an `"INCOMPLETE"` member (§9.3 register), handled by `lib/analyzer/suppression.ts`'s `SUPPRESSION_SCOPE_BY_STATE` / `SCOPE_REMOVES_FAIR_VALUE_RANGE` machinery. That is a *diagnostic-level* suppression state (one cell or output of an analysis failing to compute), which `lib/analyzer/trust.ts` rolls up into `TrustStatus` (`UNUSABLE` / `PARTIAL` / `CLEAN`). `deriveVerdict`'s `VerdictStatus.INCOMPLETE` is a distinct, *report-level* concept: it reads `TrustStatus` and `fairValueRange.kind`, not the module-level `SuppressingState` directly. The two concepts currently interact only through `TrustStatus` as an intermediate signal; they are not the same state reused, and the M9 design contract should not assume one implies the visual or copy treatment of the other.

## 4. Confidence semantics

**What "confidence" is authorised to mean.** #118: *"Confidence communicates uncertainty inside a valid analysis"* — i.e. confidence is scoped to a completed, valid analysis and is not a substitute for the failure/incomplete state. The Product Decision Log states the same rule verbatim in its 18 Sep 2026 callout: *"Confidence expresses uncertainty inside a valid analysis; it does not replace the verdict."*

**Whether any approved source defines how it is computed: no.** Searched `docs/frozen/*` and the fetched Product Decision Log and Technical Specs Index pages directly for a computation rule; none exists.

- `docs/frozen/calfinance-methodology-v2.md:479` explicitly lists "source-count confidence scores" under **"Not governing requirements"** (§"Minimum necessary complexity") — i.e. CalFinance does not require this mechanism, and nothing else in that file supplies an alternative computation.
- The Product Decision Log (Action Candidate surfacing row): *"No confidence score / universal action score."*
- `docs/frozen/calboard-stock-analyzer-v1-design.md:373` and `docs/frozen/calboard-stock-analyzer-v1-spec.md:198` both forbid *collapsing* existing per-fact provenance/quality signals into "one combined token, one quality score or one confidence badge" — a constraint on how not to represent evidence, not a definition of a confidence computation.
- `docs/frozen/calboard-stock-analyzer-v1-spec.md:791` similarly forbids the AI layer from producing "confidence tallies" via voting/aggregation.

Per this outcome's SCOPE item 4, this is recorded plainly rather than resolved: **no approved source defines how M9's verdict-level confidence figure is computed.** The M9 design contract may not invent one under this reconciliation's authority; it is a genuine open item for that outcome (or a dedicated methodology decision) to raise explicitly rather than default silently.

## 5. M8 dependency — finding, not a sequencing decision

`deriveVerdict` (`lib/analyzer/verdict.ts:52-81`) returns `VerdictStatus.INCOMPLETE` on every currently reachable path. Per the code's own recorded reasoning and `docs/frozen/calboard-stock-analyzer-v1-spec.md` §10.6.5 (*"The comparator of §10.6.2 requires a section B fact on the same series and horizon as the implied-growth figure, and that fact may not exist in the current fact set. Acquiring it is milestone M8 work... This is sequencing, not deferral."*), the only second input the current methodology defines for synthesizing a verdict beyond the fair-value range alone — the required-versus-achieved growth comparator — has not been acquired for any run. `AnalysisResult` (`lib/analyzer/types.ts`) carries no such field today. `lib/analyzer/verdict.test.ts` documents this as intentional, correct behaviour, not a coverage gap.

**Consequence for a verdict-first M9 surface, stated as a finding:** #118's Approved Overview Hierarchy item 2 — "Dominant BUY / HOLD / SELL verdict + confidence + one-sentence rationale" — is the single most prominent element of the proposed Overview page. Under the current fact set, that slot would render the `INCOMPLETE` failure state (§3 above) for every run, for every company, until M8 delivers the §10.6.2 comparator. This reconciliation does **not** decide how the M9 design contract should handle that (e.g. whether the failure-state treatment for that slot needs to be designed as a first-class, expected-common case rather than an edge case) — that is explicitly out of scope per this outcome's HARD BOUNDS ("Do not decide the sequencing... do not reorder the #118 runway, do not start M8 acquisition, do not design around it"). It is recorded here so the M9 design contract's own author starts from this fact rather than rediscovering it.

## 6. Hand-off statement

The next outcome (#118 runway item 2, the M9 design contract) **may rely on as settled:**

- The top-level completed verdict vocabulary is BUY / HOLD / SELL (§2). This is not open for the design contract to revisit.
- CHEAP / FAIR / EXPENSIVE / INCONCLUSIVE are supporting valuation-evidence states, feeding the top-level verdict and the valuation-range surfaces (#118 hierarchy items 4/8); they are not a competing top-level vocabulary (§2).
- A decision-critical failure renders as an explicit `INCOMPLETE` state carrying a cause and a recovery path, never a manufactured verdict and never a default HOLD (§3).
- Confidence, when it exists, is scoped to uncertainty inside a valid (non-`INCOMPLETE`) analysis, and is not a stand-in for the failure state (§4).
- All 8 frozen Stock Analyzer artefacts are byte-verified current and consistent across `docs/frozen/`, `FROZEN_HASHES`, and the Technical Specs Index as of this reconciliation (§1).
- Today, and until M8 lands the §10.6.2 comparator, the dominant-verdict slot is `INCOMPLETE` for every run (§5).

The next outcome **may not rely on as settled:**

- How the `INCOMPLETE` failure state should look or read in the UI — today it is undifferentiated markup from a completed verdict (§3); this is exactly the kind of exact-information-architecture / component-role decision #118 assigns to the design contract, not to this reconciliation.
- How, or whether, a confidence figure is computed or displayed at all (§4) — no approved source defines this; inventing a computation is out of scope for both this outcome and, per CalFinance v2's "not governing requirements," not obviously required at all.
- Any UI/architectural relationship between the §10.6.4 entry-side action clause (attached to the CHEAP/FAIR/EXPENSIVE position) and the top-level BUY/HOLD/SELL verdict — the frozen spec defines the former only; no source reconciles the two into one UI element, and this outcome does not invent that reconciliation.
- Any sequencing consequence of the M8 dependency finding in §5 (e.g. whether M9 design work should proceed assuming `INCOMPLETE`-by-default, or whether M8 should be pulled forward) — explicitly out of scope by this outcome's HARD BOUNDS.

## 7. Conflicts

No unresolved conflict between authoritative sources was found. The one apparent tension — the frozen spec's §10.6.1 CHEAP/FAIR/EXPENSIVE wording versus #118's BUY/HOLD/SELL top-level vocabulary — is addressed directly and by name in both current Notion authorities (Product Decision Log and Technical Specs Index, both dated 18 Sep 2026) as an already-settled supersession, not an open dispute (§2). `RECONCILIATION REQUIRED` is not returned.
