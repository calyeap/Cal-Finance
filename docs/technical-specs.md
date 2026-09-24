# Cal Finance — Technical / Implementation Contracts

This file is the repo-owned authority for **which implementation contracts are current**. It is intentionally small: it selects approved implementation artefacts and points to the separate semantic owners rather than duplicating their content.

## Current implementation contract

### Stock Analyzer v1 functional specification

- **Artefact:** [`docs/frozen/calboard-stock-analyzer-v1-spec.md`](frozen/calboard-stock-analyzer-v1-spec.md)
- **Status:** current approved implementation contract
- **Effective revision:** CF-VERDICT-1064-APPLY-01 amendment (§10.6.4, CALVIN RULING — A), 24 Sep 2026
- **SHA-256:** `e40f990803c14cd8bbe0e18ce6c4afa31c6803c80d68978172e09a05a143e8e4`
- **Integrity source:** `scripts/evidence/config.ts` (`FROZEN_HASHES`) and the bidirectional frozen-artefact gate

This contract remains subordinate on semantic conflicts to the current Product Decisions and Cal Finance Methodology. A later explicit Calvin ruling or current semantic authority wins; this file selects the implementation contract, it does not create product or finance semantics.

### Cal Finance Methodology implementation snapshot

- **Artefact:** [`docs/frozen/calfinance-methodology-v2.md`](frozen/calfinance-methodology-v2.md)
- **Status:** frozen implementation snapshot only
- **SHA-256:** `0e07ec7454b1c12883603a3bfa816ac3c6102c210509ea558147470cb4388c07`
- **Semantic owner:** current Cal Finance Methodology in Notion

The repo snapshot exists for reproducible implementation evidence. It is **not** the semantic finance authority and must not be used to overrule the current Methodology.

## Explicit boundaries

- **Product decisions** → [`docs/product-decisions.md`](product-decisions.md)
- **Strategic sequencing** → [`docs/product-roadmap.md`](product-roadmap.md)
- **Finance semantics** → current Cal Finance Methodology (external)
- **Current Analyzer V2 design** → [Cal Finance — UX & Design System Principles](https://app.notion.com/p/3d20ca9a8fd081f08606df9f7dcc489d) + [Analyzer V2 — Approved Design Artefacts](https://app.notion.com/p/3e40ca9a8fd081358d31cf1f3e1e45a3)
- **Brand direction / candidate source assets** → [Cal Finance — Brand Identity & Assets](https://app.notion.com/p/3dd0ca9a8fd081c4acdae46985a07f56)
- **Code/runtime truth** → repository code, tests, commits, PRs, CI and merged state
- **Current status / NEXT** → native GitHub issue/PR state, not this file

## Legacy / historical material

The remaining files under `docs/frozen/` — including the older valuation methodology, frozen design document and HTML mocks — are preserved implementation/history artefacts. Their presence or hash registration does **not** make them current Analyzer V2 design authority or current product/finance semantic authority.

`FROZEN_HASHES` proves byte identity only. It does not decide semantic precedence.

## Conflict rule

If this file points to an implementation contract whose wording conflicts with a later explicit Calvin ruling or the current Product Decisions / Methodology / accepted Analyzer V2 design authority on a change that depends on that point, stop before the consequential mutation and return `RECONCILIATION REQUIRED` naming the conflicting sources. Do not silently choose the older frozen wording.
