# Current Authority — Where to Look

This file is a **pointer index**, not a source of truth. It exists so a
fresh worker who lands on a historical document (e.g. `docs/spec/*-v1.2.md`)
has one obvious first hop to current authority. It does not restate any
requirement — see [`AGENTS.md`](../AGENTS.md) for the fuller router this
summarises.

## Route by class of truth

- **Current project status / next authorised move** → Cal Finance Project Home.
- **Finance semantics** (what a metric means, how it's computed, what counts
  as correct) → current Cal Finance Methodology.
- **Settled product semantics / Calvin rulings** → Product Decision Log.
- **Strategic sequencing** (what's next and why, beyond one bounded task) →
  Product Roadmap.
- **Current implementation contracts** (which frozen artefact/revision under
  `docs/frozen/` is currently approved) → Technical Specs Index.
- **Current M9 UX contract** →
  [`docs/design/m9-analyzer-design-contract.md`](design/m9-analyzer-design-contract.md).
- **Current acceptance state** (outcome → implementation proof →
  real-company validation → Calvin acceptance, per acceptance-relevant
  outcome) → [`docs/acceptance-matrix.md`](acceptance-matrix.md).
- **Code / runtime truth** (what the code currently does, what's tested,
  what's merged) → this repository directly: `git log`, the working tree,
  tests, CI, GitHub — never memory or a prior report.

## Precedence

A later explicit Calvin ruling and the current semantic authorities above
outrank stale historical or frozen wording on the point of conflict.
Implementation artefacts — code, frozen specs, this file — implement
authority; they do not create it. If two authoritative sources disagree on
something a change depends on, stop before the consequential mutation and
return `RECONCILIATION REQUIRED`, naming the conflicting sources, rather
than picking one.

## What this file is not

Not a duplicate of anything it points to — it carries no current
requirement, threshold, or ruling of its own. If this file and an authority
it points to ever appear to disagree, the pointed-to authority wins and this
file is wrong.

---

Historical V1 contracts this file exists to disambiguate:
`docs/spec/01-PRD-v1.2.md`, `docs/spec/02-TRD-v1.2.md`,
`docs/spec/03-TDD-v1.2.md`.
