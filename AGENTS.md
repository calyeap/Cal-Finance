# Cal Finance — Entry Point

This file is a **router**, not a source of truth. It tells a fresh worker
where to look before touching this repo. It does not restate project status,
finance methodology, or roadmap — those live outside the repo and go stale
here if duplicated.

Retrieve the minimum relevant source below and stop once you have enough to
act. Don't pull every linked source for every task.

## Naming invariant

The current product/project name is **Cal Finance**. `Calboard`, `calboard`,
`CB-*`, and `CALBOARD-*` may remain only when preserving an existing technical
identifier, filename, database/schema name, frozen/historical artefact, or
verbatim historical quote. New/current-facing product prose and UI use
**Cal Finance**.

## Where authority lives

- **This repo (code, tests, commits, PRs, CI, merges)** is authoritative for
  implementation facts — what the code currently does, what's tested, what's
  merged. Verify against `git log`, the working tree, and GitHub, not against
  memory or a prior report.
- **Current project status / next authorised move** (ACTIVE / BLOCKED /
  NEEDS CALVIN / RECENTLY DONE / NEXT) is owned by native GitHub state, not
  Cal Finance Project Home — see [`docs/CURRENT-AUTHORITY.md`](docs/CURRENT-AUTHORITY.md)
  for how to reconstruct it. Don't infer current state from filenames,
  branch names, or doc age in this repo.
- **Cal Finance Project Home** (external) owns durable semantic authorities
  not covered by the class above and not yet cut over to GitHub — see
  `docs/CURRENT-AUTHORITY.md` for the current split.
- **Cal Finance Methodology** (external) owns finance semantics — what a
  metric means, how it's computed, what counts as correct.
- **Product Decision Log** (external, superseded) previously owned settled
  product decisions; that authority is now
  [`docs/product-decisions.md`](docs/product-decisions.md) — see
  `docs/CURRENT-AUTHORITY.md` for the current split.
- **Product Roadmap** (external, superseded) previously owned strategic
  sequencing; that authority is now
  [`docs/product-roadmap.md`](docs/product-roadmap.md) — see
  `docs/CURRENT-AUTHORITY.md` for the current split.
- **Current Technical / Implementation Contracts** are repo-owned in
  [`docs/technical-specs.md`](docs/technical-specs.md). It selects the current
  approved frozen implementation contract/revision and records the semantic
  boundaries to Product Decisions, Methodology and Design. `scripts/evidence/config.ts`
  (`FROZEN_HASHES`) proves byte identity only; neither filename age nor mere
  presence in `docs/frozen/` decides semantic authority.
- **Current Cal Finance / Analyzer V2 design authority** is external:
  [Cal Finance — UX & Design System Principles](https://app.notion.com/p/3d20ca9a8fd081f08606df9f7dcc489d)
  plus its child
  [Analyzer V2 — Approved Design Artefacts](https://app.notion.com/p/3e40ca9a8fd081358d31cf1f3e1e45a3).
  Analyzer V2 is the strongest current visual reference and proving
  implementation. Existing Portfolio/Holdings surfaces and older M9/frozen
  design contracts are legacy or surface-scoped references and must not
  override newer accepted Analyzer V2 visual authority.
- **Current Cal Finance brand direction / candidate source assets** → external
  [Cal Finance — Brand Identity & Assets](https://app.notion.com/p/3dd0ca9a8fd081c4acdae46985a07f56).
  That page owns the human-readable brand direction and preserved source
  variants. The current SVG pack is a production candidate, not the final
  shipped master until the pending Figma/vector and small-size inspection is
  complete. Once promoted, the actual files shipped from this repo/app are
  implementation truth for production assets; do not revive stale Calboard
  branding or legacy Portfolio visuals as current authority.
- **`DESIGN.md`** is the Portfolio-era routing/index surface over Portfolio
  design intent. It does not govern Analyzer V2 and cannot override the
  current Analyzer V2 design authority above.
- **Old specs, plans, and history** (`docs/spec/`, `docs/superpowers/plans/`,
  prior milestone docs, etc.) are historical record. Their existence is not
  authorisation — don't let an old plan steer current work just because it's
  there. This does not extend to `docs/superpowers/specs/`: an approved spec
  there may still govern its explicitly scoped area — confirm via
  `docs/CURRENT-AUTHORITY.md` / the designated owner rather than assuming.
- **Another AI/chat's report or summary** (including this file's own past
  sessions) is evidence to weigh, never authority to act on directly.

## If authorities conflict

If two authoritative sources disagree on something a change would depend on,
**stop before making the consequential mutation** and return
`RECONCILIATION REQUIRED`, naming the conflicting sources, rather than
picking one.

## Build / test / typecheck

Commands as currently evidenced by the repo (`.github/workflows/ci.yml`,
`package.json`):

```
npm ci
npx tsc --noEmit
npm run migrate
npm test
```

`npm run build` runs a Next.js production build. `npm run evidence` runs the
frozen-artefact SHA-256 check and is not part of the default CI gate.
