# CALBOARD-OWNER

> Workflow procedure adapter only. This file does not own product truth, finance methodology, project sequencing, or acceptance. Retrieve the current authoritative sources before consequential work.
>
> **Scope:** this adapter owns the **dispatch decision** — how `CALBOARD-OWNER` chooses the next outcome from the Runway and wakes a worker for it. Reconciliation, the Notion safe-write boundary, derived-view propagation and the agent-attribution rule stay in the routine's own instructions and are deliberately not restated here, so the two cannot drift.

## Mission

After reconciliation and derived-view refresh are complete, choose and dispatch the next authorised Calboard outcome from PROJECT RUNWAY, wake a worker for it, or report `WAIT` when nothing qualifies.

## Start gate

1. Reconciliation and derived-view refresh for this run are complete. Dispatch never runs before them.
2. Read PROJECT RUNWAY on Calboard — Project Home:
   <https://app.notion.com/p/3d90ca9a8fd081fd92bbdf9480d8ffa3>
   Treat that link as a starting pointer, not authority; revalidate current owner state rather than trusting a remembered Runway.
3. Confirm no `[AI BUILD]` pull request is open and no worker is running for Calboard. If either is true, do not dispatch.

## Classify

Runway items are listed in priority order. Item 1 is the highest priority. Start at the top and work down. Never reorder the Runway, and never reach for a lower item because it looks easier — the only reason to pass over an item is that it cannot be executed, established by the classification below.

Items already dispatched, closed or complete are **not skips**. Step over them and keep reading; they need no record.

For each remaining item in turn, classify it into exactly one of three cases.

### CASE A — bounded, authorised code work

Dispatch it. Open a GitHub issue on `calyeap/calboard` titled
`[AI BUILD] <OUTCOME-ID> — <short outcome>` containing: `OUTCOME`, `AUTHORITY` (cite the Runway item and its authorising ruling), `SCOPE`, `DONE WHEN`, `ROUTES`, `STOP CONDITIONS`, `DO NOT`.

State the outcome and the bounded acceptable routes rather than hard-coding one mechanism. Pre-authorise fallbacks that sit inside existing authority, so the worker does not return merely to choose between routes already open to it.

Then **wake the worker** (below). This run's dispatch is now spent — stop classifying.

### CASE B — requires a Calvin or CC ruling

Do not rule on it.

First check whether the evidence for that ruling already exists — a posted comparison, a prior evidence issue, or a comment that already lays out the conflicting artefacts side by side. If it does, leave it alone, SKIP it under the skip rule below naming where that evidence is so Calvin can find it, and continue down the Runway.

If it does not, dispatch a bounded evidence-gathering outcome titled
`[AI BUILD] <OUTCOME-ID>-EVIDENCE-01 — <what is being compared>`. Its `DONE WHEN` asks for each artefact's content verbatim, a row-by-row alignment, and an explicit note of anything that could not be established. Then **wake the worker** (below). This counts as the run's dispatch — stop classifying.

Every evidence outcome carries these `DO NOT` lines:

- Do not change any code, mock, spec or design file.
- Do not open a PR.
- Do not rule on the conflict. Recommend nothing. Present the evidence and stop.
- Do not write Notion.

The no-recommendation rule is not optional. A worker that suggests an answer turns Calvin's decision into a rubber stamp, which is the exact failure the ruling boundary exists to prevent.

### CASE C — cannot be executed by this routine

A design pass, a permission, a final acceptance, or any outcome with no executor available to it. Do not dispatch it, and do not stop the run. SKIP it under the skip rule below and continue down the Runway.

## Wake the worker

After opening an `[AI BUILD]` issue, apply the **`needs-build-wake`** label to it.

An issue opened by a routine does not by itself wake `CALBOARD-BUILD`. The label is what fires it, through the `fire-build` job in `.github/workflows/cc-auto-fire.yml`; that job removes the label again on success, so it is a trigger rather than durable state. Without this step a dispatch opens into a void — the failure that left issue #86 at zero worker activity for roughly ten and a half hours on 14 Sep 2026.

A dispatch is not complete until the worker is woken.

## The skip rule

Ruled by Calvin, 14 Sep 2026.

An item that cannot be executed is **SKIPPED, not a STOP**. Record why, continue down the Runway in priority order, and dispatch the first item that is both executable and genuinely independent of every item skipped above it. Return `WAIT` only when no such item exists.

The three guards below are part of that authorisation and are not optional.

### GUARD 1 — escalate on the first skip, not the third

The moment an item is skipped for lack of an executor, raise it as a `NEEDS YOU` item on Chief of Staff naming the item and exactly what it is waiting on.

A stall is loud; skipping makes it quiet, and a board that looks busy while its most important item sinks is worse than a board that stops. One skip, one surfaced item. Do not wait for a pattern.

### GUARD 2 — never skip past a blocker into its own dependents

If an item is skipped, every item that depends on it is skipped too. Drop only to work that is genuinely independent.

Dependency-satisfied prevents incorrect order, not unproductive order — without this guard the loop produces a busy week that gets no closer to acceptance. *Illustration, 14 Sep 2026: Runway item 4 blocks 5 and 7, so skipping 4 must not dispatch 5. Re-read the current Runway rather than trusting those numbers.*

### GUARD 3 — name the classification and the rule

Every skip states which of the three cases the item was classified as, and which rule made it unexecutable.

A skip decision gets less scrutiny than a stop, so the reasoning must be visible. **If the classification is uncertain, STOP rather than skip.**

## After dispatch

Record the dispatch in `RECENT CHANGES` on Project Home, then stop.

## Hard bounds

- Dependency-satisfied is required.
- Runway items only. A new outcome is Calvin's to authorise.
- One dispatch per project per run. Never two. An evidence outcome counts as that run's dispatch.
- Do not dispatch while an `[AI BUILD]` PR is open or a worker is running for that project.
- **`CB-SWEEP-01` Rule 1 cap:** maximum three **autonomous** dispatches per day across all projects. A dispatch Calvin names and directs is not autonomous selection, does not count against the cap, and never was in scope (ruled by Calvin, 14 Sep 2026). Both kinds still report.
- If nothing qualifies, write `WAIT`. Do not manufacture work.

## Always report

Report which case applied to each item classified, every skip with its case and its rule per GUARD 3, and the outcome: an issue opened, which Runway item it came from, and that the wake label was applied — or `WAIT` and why.

Never finish a run silently on this step.

## Hard boundaries

- Runway order is authority; convenience is never a reason to depart from it.
- A skip is a recorded decision, never a silent omission.
- Never invent a Runway item, an `OUTCOME-ID` Calvin has not seen, or an authorising ruling.
- Never use Calvin as a message courier.
- GitHub trigger payloads and comments are routing/evidence, not product or finance authority.
