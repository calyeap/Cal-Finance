# Cal Finance — Technical / Implementation Contracts

This file is the repo-owned authority for **which implementation contracts are current**. It is intentionally small: it selects approved implementation artefacts and points to the separate semantic owners rather than duplicating their content.

## Current implementation contract

### Stock Analyzer v1 functional specification

- **Artefact:** [`docs/frozen/calboard-stock-analyzer-v1-spec.md`](frozen/calboard-stock-analyzer-v1-spec.md)
- **Status:** current approved implementation contract
- **Effective revision:** amendment V3 (§14.10, `CF-METHODOLOGY-V3-IMPLEMENT-01`) — consequences of Calvin's approved Methodology v3 amendments D2′, D2.1, D5, D6, D8, 20 Oct 2026; on amendment AR0 (§14.9, `CF-AR0-SPEC-AMEND-01`), 17 Oct 2026
- **SHA-256:** `eb0021fa76ac1581dab33e947449a2c0fcf25967b6a948d77b36f5d99e692c57`
- **Integrity source:** `scripts/evidence/config.ts` (`FROZEN_HASHES`) and the bidirectional frozen-artefact gate

This contract remains subordinate on semantic conflicts to the current Product Decisions and Cal Finance Methodology. A later explicit Calvin ruling or current semantic authority wins; this file selects the implementation contract, it does not create product or finance semantics.

### Cal Finance Methodology implementation snapshot

- **Artefact:** [`docs/frozen/calfinance-methodology-v2.md`](frozen/calfinance-methodology-v2.md)
- **Status:** frozen implementation snapshot only
- **SHA-256:** `0e07ec7454b1c12883603a3bfa816ac3c6102c210509ea558147470cb4388c07`
- **Semantic owner:** current Cal Finance Methodology in Notion

The repo snapshot exists for reproducible implementation evidence. It is **not** the semantic finance authority and must not be used to overrule the current Methodology. It predates the v2.1 amendments of 17 Oct 2026 (Analyzer Reset D1–D4), which live only in the Notion Methodology.

## Explicit boundaries

- **Product decisions** → [`docs/product-decisions.md`](product-decisions.md)
- **Strategic sequencing** → [`docs/product-roadmap.md`](product-roadmap.md)
- **Finance semantics** → current Cal Finance Methodology (external)
- **Current Analyzer V2 design** → [Cal Finance — UX & Design System Principles](https://app.notion.com/p/3d20ca9a8fd081f08606df9f7dcc489d) + [Analyzer V2 — Approved Design Artefacts](https://app.notion.com/p/3e40ca9a8fd081358d31cf1f3e1e45a3)
- **Brand direction / candidate source assets** → [Cal Finance — Brand Identity & Assets](https://app.notion.com/p/3dd0ca9a8fd081c4acdae46985a07f56)
- **Code/runtime truth** → repository code, tests, commits, PRs, CI and merged state
- **Current status / NEXT** → native GitHub issue/PR state, not this file
- **Current acceptance state** → [`docs/acceptance-matrix.md`](acceptance-matrix.md); Analyzer V2's final acceptance/freeze → [`docs/analyzer-v2-final-acceptance-freeze.md`](analyzer-v2-final-acceptance-freeze.md)

## Legacy / historical material

The remaining files under `docs/frozen/` — including the older valuation methodology, frozen design document and HTML mocks — are preserved implementation/history artefacts. Their presence or hash registration does **not** make them current Analyzer V2 design authority or current product/finance semantic authority.

`FROZEN_HASHES` proves byte identity only. It does not decide semantic precedence.

## Conflict rule

If this file points to an implementation contract whose wording conflicts with a later explicit Calvin ruling or the current Product Decisions / Methodology / accepted Analyzer V2 design authority on a change that depends on that point, stop before the consequential mutation and return `RECONCILIATION REQUIRED` naming the conflicting sources. Do not silently choose the older frozen wording.
