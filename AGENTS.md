# Cal Finance — Entry Point

This file is a **router**, not a source of truth. It tells a fresh worker
where to look before touching this repo. It does not restate project status,
finance methodology, or roadmap — those live outside the repo and go stale
here if duplicated.

Retrieve the minimum relevant source below and stop once you have enough to
act. Don't pull every linked source for every task.

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
- **Product Decision Log** (external) owns settled product decisions.
- **Product Roadmap** (external) owns strategic sequencing — what's next and
  why, beyond a single bounded task.
- **Technical Specs Index** (external) identifies which frozen
  artefacts/revisions under `docs/frozen/` are currently *approved*. Neither
  filename age nor mere presence in `docs/frozen/` decides that — check the
  index. `scripts/evidence/config.ts` (`FROZEN_HASHES`) proves the bytes in
  `docs/frozen/` match what was frozen; that's integrity evidence, not
  semantic authority.
- **`DESIGN.md`** is a routing/index surface over design intent, not the
  design contract itself. Defer to the specific approved design contract it
  points to when the two could differ.
- **Old specs, plans, and history** (`docs/spec/`, `docs/superpowers/plans/`,
  prior milestone docs, etc.) are historical record. Their existence is not
  authorisation — don't let an old plan steer current work just because it's
  there. This does not extend to `docs/superpowers/specs/`: an approved spec
  there (e.g. the Portfolio UX spec) may still govern its area — confirm
  current status via Project Home rather than assuming either way.
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
