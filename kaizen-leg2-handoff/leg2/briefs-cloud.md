# Cloud adaptations of the Leg 2 briefs (O4 onward)

The briefs in `briefs.md` stay authoritative. This file records only what the
cloud session changed to run them in a Claude Code cloud container
(Linux, no Windows paths, no `gh` CLI, no sec.gov).

## Environment differences (cloud container vs Calvin's Windows machine)

| | O1–O3 (local operator) | O4 onward (cloud operator) |
|---|---|---|
| Operator's GitHub identity | `gh` as `calyeap` | GitHub MCP as `calyeap` (same identity, so the pre-flight allow-list still admits its labels) |
| `gh` CLI | yes | no (token invalid); REST GETs via `curl` |
| Postgres | Docker `kaizen-leg2-pg` on 127.0.0.1:55432 | the container's own PostgreSQL 16 on 127.0.0.1:5432 |
| sec.gov | read-only fetches allowed | blocked (HTTP 403) |
| Workspace builder | `mkreview.sh` | `mkreview-cloud.sh` (same steps, Linux paths) |
| Arm-A routines (BUILD/REVIEW/OWNER) | Anthropic cloud sessions | unchanged: Anthropic cloud sessions |

## BLIND AUDIT (cloud wording; one fresh Opus agent per merged PR, high effort, as Leg 1)

You are the independent HEAVY reviewer for one PR at one exact head. Nothing you write is posted anywhere.

**Inputs (use only these)**
- Repo at the exact head, depth 1, no remote: {RDIR}/repo (commit {HEAD}). node_modules is installed.
- Diff, base → head: {RDIR}/pr.diff
- Task contract: {RDIR}/contract.md
- Rubric: {RDIR}/RUBRIC.md. Read it first and follow it.

**Environment.** Linux container. Postgres database `{RDB}` on 127.0.0.1:5432 (user `postgres`, password `postgres`); set both `TEST_DATABASE_URL` and `DATABASE_URL` to `postgresql://postgres:postgres@127.0.0.1:5432/{RDB}`. Commands: `npm run migrate`, `npx tsc --noEmit`, `npx vitest run`. Known environment-only failures here: {ENV_FAILS}. Outbound sec.gov is blocked (HTTP 403): use the repo's committed captures and the evidence the contract quotes; do not try to get around the block.

**Rules**
- No GitHub access: no gh, no git fetch, no github.com, no GitHub MCP tools.
- Read nothing outside {RDIR} except installed tooling.
- Leave tracked files unmodified; restore anything you change to experiment.
- Do not spawn subagents.
- CALVIN REQUIRED is only for a decision the contract reserves to Calvin.

**Output.** Write {RDIR}/REVIEW.md:
- line 1: `ACCEPT: …` or `CORRECT: …`;
- then the findings, each with where, root cause, reproduction and smallest fix;
- then the DONE WHEN table.

Return the same text.
