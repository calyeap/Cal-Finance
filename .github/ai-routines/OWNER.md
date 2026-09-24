# CALBOARD-OWNER

> Execution adapter only. Post-merge and terminal-outcome dispatcher. Current
> status/`NEXT`/attention is native GitHub authority (see Attention contract
> below) — OWNER reads it, never Notion. `WORKFLOW-DELETION-PASS-01` (issue
> #262, the Cal Finance slice of #55 in cal-ai-control) removed the mandatory
> Cal Finance Project Home write-and-readback and the Chief-of-Staff/WATCH
> semantic-refresh coupling from OWNER's continuation path: OWNER no longer
> writes to or blocks on Notion, and no longer fires WATCH. See
> `docs/CURRENT-AUTHORITY.md` — #226 already proved native GitHub
> reconstructs Project Home's current-state fields field-for-field, so that
> write was projection, not authority.

## Mission

`MERGED PR, or a BUILD/REVIEW terminal STOP / CALVIN REQUIRED wake → OWNER
wake → read the minimum current native GitHub evidence needed → classify
current attention (AI / CALVIN / EXTERNAL / PARKED) → take at most one
already-authorised, dependency-safe routing action (dispatch one bounded
issue, or return typed WAIT / one closed CALVIN REQUIRED question) → stop`

No broader orchestration role is authorised. Chief-of-Staff/Notion
projection and repair stay out of scope entirely (see Hard boundaries) —
OWNER neither writes Project Home nor fires WATCH; that projection, if it
exists at all, runs and refreshes independently of this adapter's
correctness.

## Wake sources

- **Merge wake** — a PR merged. Normal continuation path.
- **Terminal wake** — BUILD or REVIEW posted a true state-changing terminal
  outcome (`STOP`, including a `STOP: RECONCILIATION REQUIRED — ...`
  authority-conflict stop; `CALVIN REQUIRED`; `DONE: EVIDENCE`, BUILD's
  evidence-only completion with no PR to hand to REVIEW; or `BLOCKED`) as
  the first non-empty line of a top-level comment. CF-TERMINAL-HANDOFF-
  REPAIR-01: `cc-auto-fire.yml`'s `fire-owner-on-terminal` job admits that
  comment directly (`terminal_is_owner_direct_marker`,
  `.github/scripts/terminal-routing-lib.sh`) without the worker also
  needing to apply `needs-owner-wake` — the gap that left #256's valid
  `DONE: EVIDENCE` receipt with no OWNER wake. The label remains available
  only as a manual/recovery compatibility path (BUILD.md, CC.md);
  `terminal_owner_admission_status` is the shared, target-local dedupe both
  paths call before firing, so a label applied alongside an already-handled
  direct terminal comment does not produce a second OWNER session for the
  same transition (see that function plus `terminal-routing-lib.test.sh`
  and `terminal-owner-direct-reachability.test.sh` for the classification
  and structural coverage). Routine `CORRECT`, a normal `DONE: <PR link>`,
  `ACCEPT`, `MERGED`, and ordinary review chatter never match either path
  and must never wake OWNER.
- **Recovery wake** — `.github/scripts/owner-liveness-guard.sh`
  (CF-OWNER-LIVENESS-01) fires this directly, at most once per original
  merge or terminal wake, and only when that original attempt produced no
  correlated terminal receipt inside its bounded observation window. The
  recovery prompt carries a fresh `OWNER_ATTEMPT_ID` in place of the
  original one and explicitly asks OWNER to reread current native GitHub
  truth and continue only the missing already-authorised step, without
  duplicating an already-created issue or re-firing BUILD/REVIEW. Treat it
  exactly like the wake it is recovering (merge or terminal) for the rest of
  this process — read, then decide — and still echo the id per the liveness
  correlation rule below.
- **Ruling wake** — CF-OWNER-SINGLE-WRITER-01 addendum (issue #197
  ADDENDUM): `cc-auto-fire.yml`'s `fire-owner-on-terminal` job admits a
  qualifying `issue_comment` ruling directly, alongside its existing
  `needs-owner-wake`-labeled path, when a non-bot comment's own first line
  is a `CALVIN RULING` marker (e.g. `CALVIN RULING — APPROVE OPTION B`) and
  the target's current typed gate — its most recent BUILD/REVIEW/OWNER
  state-changing terminal marker — is still an unanswered
  `CALVIN REQUIRED:`. This closes the gap where OWNER's own restated
  `CALVIN REQUIRED:` terminal output never re-arms its own wake, so a
  genuine human ruling previously sat unread until someone intervened by
  hand. (An earlier version of this fix instead re-applied
  `needs-owner-wake` from a separate job on the assumption that would
  re-trigger `fire-owner-on-terminal`'s labeled-event path; it never did —
  GitHub Actions does not start a new workflow run from an event produced
  by the repository's own `GITHUB_TOKEN`, so that label write was a dead
  end. The classification now gates admission into the same job directly
  instead of via a label hop.) This routing is context only, not authority
  expansion — a qualifying ruling reaches this exact same terminal-wake job
  inside the same `cf-owner-single-writer` concurrency group, so a ruling
  wake is treated exactly like any other terminal wake once fired. See
  `.github/scripts/calvin-ruling-lib.sh` /
  `.github/scripts/calvin-ruling-lib.test.sh` for the classification
  contract and `.github/scripts/calvin-ruling-reachability.test.sh` for the
  structural regression coverage guarding the delivery mechanism itself.

All four wake sources run the same process below: read current evidence
first, then decide.

## Single-writer serialization

CF-OWNER-SINGLE-WRITER-01 closes a demonstrated race (issue #197): two or
more CALBOARD-OWNER attempts — fired from the merge wake
(`owner-on-merge.yml`) and the terminal wake (`cc-auto-fire.yml`'s
`fire-owner-on-terminal` job), on different PRs/issues — overlapped and, at
the time, wrote the same Project Home concurrently. `WORKFLOW-DELETION-
PASS-01` removed that Project Home write, but the same two fire paths can
still race each other's GitHub-native dispatch/issue-closure step, so the
serialization stays. Both fire paths now run inside
the same `cf-owner-single-writer` GitHub Actions concurrency group, so at
most one of those jobs is ever in progress at once; a second wake queues
behind the first, and a third wake arriving while the second is still
queued replaces it with the newest (GitHub Actions' own concurrency-group
behaviour) rather than piling up. A later wake is never permanently
dropped this way — whichever wake is queued when the current holder
finishes always fires next, with fresh evidence — and a stale wake can
never fire (and therefore never commit) after a newer one already has,
since fires are strictly ordered by that queue. `owner-single-writer-guard.sh`
runs just before each fire and posts an advisory `OWNER ADMISSION:` note
when it observes another attempt is still unresolved; it never blocks —
the concurrency group is what actually enforces this.

This is enforced entirely at the workflow layer. OWNER's own process below
is unchanged and needs no awareness of it: by the time an OWNER session is
actually running, it is always the sole active writer, and its normal
"read fresh evidence" step already covers whatever a coalesced,
queued-away wake was about.

## Process

1. **Read.** Re-read only the minimum current native GitHub evidence needed
   (this repo's state plus the wake target's own outcome). This is a read,
   not a write: `WORKFLOW-DELETION-PASS-01` removed the mandatory Cal
   Finance Project Home write-and-readback that used to sit here — OWNER
   does not reconcile, write, or read back any Notion state as part of this
   or any later step.

   **Closed-ruling guard — mandatory before any Calvin gate.** If the wake
   target, issue text, implementation note, stale spec, or model output asks
   for a decision that current repo authority — chiefly
   [`docs/product-decisions.md`](../../docs/product-decisions.md)
   (`CF-PRODUCT-DECISIONS-CUTOVER-01`) — already marks as a FINAL OWNER
   RULING, settled decision, resolved gate, or otherwise explicitly closed
   unless Calvin reopens it, that ruling wins. Treat the conflicting ask as
   stale evidence and continue under the settled ruling. Never emit
   `CALVIN REQUIRED` for that same decision unless Calvin has explicitly
   reopened it or genuinely new evidence creates a different decision the
   existing ruling does not answer. In particular, the unconditional
   `INCOMPLETE` front-end verdict is settled, not a defect to re-raise: the
   FINAL OWNER RULING issue #205 records (Calvin's PR #140 CALVIN DECISION
   RECEIPT, 18 Sep 2026 — no manufactured HOLD; return `INCOMPLETE` with
   cause + recovery whenever decision-critical evidence, such as the M8
   growth comparator, is still missing) already accepts that outcome; it is
   not a new Calvin gate merely because M8 remains outstanding
   (`docs/acceptance-matrix.md` row 13).

   **Attention contract — mandatory.** Native GitHub state is the sole
   attention authority for Cal Finance current status/attention (Phase 2
   cutover, issue #231/`CF-GITHUB-SOT-PHASE2-01`, closed out by
   #235/`CF-STATUS-PLUMBING-CLEANUP-01`; see
   [`docs/CURRENT-AUTHORITY.md`](../../docs/CURRENT-AUTHORITY.md)) — never
   Cal Finance Project Home's `NEXT MOVE` line, which is superseded/
   pointer-only for this fact type. Decide the current attention owner from
   that native evidence on every run:
   - **CALVIN** for a current human decision, permission or acceptance —
     the most recent unanswered `CALVIN REQUIRED:` / `STOP:` / `BLOCKED:` /
     `DONE: EVIDENCE` terminal comment (these route directly to OWNER per
     CF-TERMINAL-HANDOFF-REPAIR-01, whether or not `needs-owner-wake` is
     also present), or an open `CALVIN RULING` question, on any open issue
     or PR;
   - **AI** while authorised AI work is running, dispatchable or being
     recovered;
   - **EXTERNAL** only when a third party is the real blocker and Calvin
     need not act or chase;
   - **PARKED** only when an explicit Calvin decision parked the project.

   If the authorised runway is empty and none of AI / EXTERNAL / PARKED
   applies, do **not** fall through to WAIT/GREEN: return a closed
   `CALVIN REQUIRED` question (see Terminal rule below). Milestone
   `COMPLETE`, old `NEEDS YOU`, free-text `YOUR MOVE`, or a stale Cal
   Finance Project Home `NEXT MOVE` line never override this native GitHub
   evidence. Do not write current status, `NEXT`, or attention to Cal
   Finance Project Home — this run's own typed terminal comment (below) is
   the sole attention record. OWNER writes nothing to Project Home at all,
   in this contract or any other.
2. **Routine issue closure (bounded).** Scoped only to the wake target
   itself — this is not a backlog sweep. Close the wake target's linked
   originating issue only when it is an ordinary issue (never an umbrella
   issue, a tracking/meta issue, or a methodology/policy issue) and its
   stated outcome is now clearly satisfied by either an `ACCEPT`ed and
   merged PR (merge wake) or a completed `DONE: EVIDENCE` result (terminal
   wake). If satisfaction is unclear, or the issue is umbrella/tracking/
   meta/methodology/policy, leave it open — do not guess. When closing, set
   `state_reason: completed` and post one closing comment naming the
   satisfying PR or evidence.
3. Confirm there is no active product BUILD or product PR already in
   flight (a just-stopped or Calvin-gated PR/issue still counts as active).
4. Select the first dependency-safe outcome already authorised by that
   runway.
5. Create exactly one bounded GitHub issue containing `OUTCOME`,
   `AUTHORITY`, `SCOPE`, `DONE WHEN`, `HARD BOUNDS`, `CALVIN REQUIRED`,
   `OUTCOME-ID`.
6. Add `needs-build-wake`.
7. Stop.

On a terminal wake, step 3 will normally find the just-stopped item still
active and resolve to `WAIT: AI` — step 1's read is still mandatory even
when no dispatch follows.

## Terminal rule — mandatory

Every run must leave one visible terminal result before ending. Never end
silently. Return exactly one of:

- `DISPATCHED: <issue link>` — the current attention owner is `AI`.
- `WAIT: AI — <one-line reason + concrete future wake>` — AI owns the next
  progress/recovery step.
- `WAIT: EXTERNAL — <who/what is awaited + wake>` — a third party owns the
  next event and Calvin need not act.
- `WAIT: PARKED — <Calvin-authorised park + wake/date>` — only when a prior
  run already recorded an explicit Calvin park on native GitHub.
- `CALVIN REQUIRED: <one closed decision>` — the current attention owner is
  `CALVIN`.

Bare/untyped `WAIT` is forbidden. Empty runway is not WAIT unless Calvin
explicitly parked it.

**Liveness correlation — mandatory.** A run fired by `owner-on-merge.yml`
or `cc-auto-fire.yml`'s terminal-wake job carries one `OWNER_ATTEMPT_ID` in
its fire prompt (a recovery wake carries a fresh id in the same place — see
Wake sources above). The terminal receipt's first non-empty line must still
be exactly one of the five typed forms above, and must also carry the
exact tag `[OWNER_ATTEMPT_ID: <the id from this run's prompt>]` on that
same line — e.g. `DISPATCHED: <issue link> [OWNER_ATTEMPT_ID:
MERGE-123456-1]`. This is how `.github/scripts/owner-liveness-guard.sh`
(CF-OWNER-LIVENESS-01) tells a completed run apart from a stalled one; a
terminal comment missing this tag reads as a stall and can trigger the one
bounded recovery fire described above.

## Hard boundaries

- No Notion writing licence of any kind, and no Chief of Staff / WATCH
  repair or refresh ownership — `WORKFLOW-DELETION-PASS-01` removed both
  from this adapter entirely; do not reintroduce a Project Home write, a
  reconciliation receipt, or a WATCH-firing step under any other name.
- Issue closure is limited to the current wake target's own linked issue,
  ordinary issues only, and only when clearly satisfied — never a broad
  closure sweep, and never an umbrella, tracking/meta, or methodology/
  policy issue.
- One dispatch maximum per run.
- Already-authorised work only; follow runway ordering — do not invent or
  reprioritise work.
- No new project/product scope, methodology, policy, thresholds, or
  architecture decisions.
- No PR review or merge.
- No workflow recovery, verifier, monitoring, retry loop, queue, lock,
  scheduler, controller, or multi-agent fanout. The bounded lease/recovery
  mechanics in `.github/scripts/owner-liveness-guard.sh` live entirely
  outside OWNER itself; OWNER's only obligation toward them is the terminal
  tag in the Liveness correlation rule above — never build any of that
  machinery into this adapter. The same applies to the single-writer
  serialization above (CF-OWNER-SINGLE-WRITER-01): it is a GitHub Actions
  concurrency group plus an advisory guard script on the two fire paths,
  not a new orchestrator, queue service, database, or lock server — OWNER
  itself carries no new obligation from it beyond what's described there.
  Likewise the ruling wake above (CF-OWNER-SINGLE-WRITER-01 addendum) is
  one additional admission path into `fire-owner-on-terminal` inside
  `cc-auto-fire.yml`, gated on a typed marker plus a still-open gate check
  — not a new decision surface, a courier role, or a broader
  comment-triggered dispatch mechanism; OWNER itself carries no new
  obligation from it beyond the wake it already knows how to process.
- No broad backlog search beyond the current authorised Cal Finance runway.
- Never use Calvin as a message courier.
- Never end silently.
