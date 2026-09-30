#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

fail() { echo "FAIL: $*" >&2; exit 1; }
require() { grep -Eq "$2" "$1" || fail "$1 missing: $3"; }
forbid() { ! grep -Eq "$2" "$1" || fail "$1 still contains forbidden: $3"; }

ROUTER=.github/workflows/cc-auto-fire.yml
MERGE=.github/workflows/owner-on-merge.yml
SLACK=.github/workflows/calvin-slack-alert.yml
BUILD=.github/ai-routines/BUILD.md
REVIEW=.github/ai-routines/CC.md
OWNER=.github/ai-routines/OWNER.md

# One-outcome admission is repo-wide and explicit, covering the #188 and
# #352/#353/#354 duplicate classes before any worker fire.
require "$ROUTER" 'group: cf-build-admission' 'repo-wide BUILD admission serialization'
require "$ROUTER" 'runtime_admission_decision' 'OUTCOME-ID admission classifier'
require "$ROUTER" 'issues\?state=open' 'repo-wide open artifact inventory'

# CF-FIRE-RETRY-01: the #357 workflow-reset hold (issue #357, closed
# 2026-09-28) is over; its temporary gate must not linger in the router
# or in OWNER's own prose.
forbid "$ROUTER" '#357' 'obsolete reset-hold enforcement removed'
forbid "$OWNER" '#357' 'obsolete reset-hold prose removed'

# Liveness is detect-only: live workflows may watch but never call the old
# automatic recovery guards.
require "$ROUTER" 'terminal-watch\.sh' 'detect-only child/parent liveness'
require "$MERGE" 'terminal-watch\.sh' 'detect-only merge parent liveness'
forbid "$ROUTER" 'worker-liveness-guard\.sh|owner-liveness-guard\.sh' 'automatic worker/OWNER recovery fire'
forbid "$MERGE" 'owner-liveness-guard\.sh' 'automatic OWNER recovery fire'
forbid "$ROUTER" 'RECOVERY_ATTEMPT|recovery-1' 'bounded blind recovery path'
forbid "$MERGE" 'RECOVERY_ATTEMPT|recovery-1' 'bounded blind recovery path'

# Protected evaluator + tiered review are durable worker rules, not copied
# into the router.
require "$BUILD" 'Never weaken, delete, rewrite or bypass an evaluator' 'protected evaluator'
require "$BUILD" '^### LIGHT$' 'LIGHT fast path'
require "$BUILD" '^### NORMAL$' 'NORMAL path'
require "$BUILD" '^### HEAVY$' 'HEAVY path'
require "$REVIEW" '^### LIGHT$' 'tiered review LIGHT'
require "$REVIEW" '^### NORMAL$' 'tiered review NORMAL'
require "$REVIEW" '^### HEAVY$' 'tiered review HEAVY'

# Parent controller is constrained to exactly the approved terminal family.
require "$OWNER" '^### CONTINUE$' 'CONTINUE parent terminal'
require "$OWNER" '^### COMPLETE$' 'COMPLETE parent terminal'
require "$OWNER" '^### BLOCKED$' 'BLOCKED parent terminal'
require "$OWNER" '^### CALVIN REQUIRED$' 'CALVIN REQUIRED parent terminal'
forbid "$OWNER" 'WAIT:|DISPATCHED:' 'legacy parent terminal vocabulary'

# Slack is terminal-driven: genuine ask / actionable block only (never
# COMPLETE — CF-SLACK-ACTION-ONLY-01).
require "$SLACK" 'calvin-slack-notify\.sh' 'shared Slack payload/send, reused by direct relay call sites'
forbid "$SLACK" 'WORKFLOW BLOCKED|OWNER LIVENESS EXHAUSTED' 'legacy liveness-specific notification vocabulary'
forbid "$SLACK" "'COMPLETE:'" 'CF-SLACK-ACTION-ONLY-01: job-level gate no longer admits COMPLETE'

# CF-WORKFLOW-RESET-TERMINAL-HANDOFF-REPAIR-02: a workflow-authored
# (GH_TOKEN-authored) terminal comment cannot recursively trigger the
# issue_comment-based OWNER wake or Slack notify those paths would
# otherwise depend on (the #361/#362 defect this outcome repairs). Every
# place a fire/observe step posts one of its own such comments must relay
# it directly in the same job instead of only posting and hoping.
require "$ROUTER" 'terminal-relay\.sh' 'direct in-job OWNER relay for workflow-authored terminals'
require "$ROUTER" 'terminal_relay_owner' 'OWNER relay actually invoked, not just sourced'
require "$ROUTER" 'calvin_slack_send' 'direct in-job Slack relay for workflow-authored terminals'
require "$MERGE" 'calvin-slack-notify\.sh' 'merge-path OWNER fire also relays its own ACTIONABLE failures to Slack'

# The relay must never fire OWNER over OWNER's own transport failure (that
# would loop a fresh OWNER attempt over infra, not a real child
# transition) — only Slack, on both admission entry points that can post
# such a failure.
forbid "$ROUTER" 'terminal_relay_owner.*OWNER transport' 'OWNER-relay self-loop on OWNER'\''s own transport failure'

# CF-FIRE-RETRY-01: every fire transport call goes through one shared,
# bounded-retry primitive instead of duplicated one-shot curl blocks, and
# a BUILD/REVIEW fire step's own transport failure is never relayed into
# OWNER — that double-fire-over-infra is exactly the #387 dead end this
# outcome closes (OWNER is still reachable through Slack and, once BUILD/
# REVIEW exhaust their own retries, a deterministic re-drive label).
require "$ROUTER" 'fire_post' 'shared bounded-retry fire transport primitive'
require "$MERGE" 'fire_post' 'merge-path OWNER fire also uses the shared retry primitive'
forbid "$ROUTER" 'terminal_relay_owner "\$REPO" "\$NUMBER" "\$LINE" fire-build-fire' 'BUILD transport failure no longer relays into OWNER'
forbid "$ROUTER" 'terminal_relay_owner "\$REPO" "\$NUMBER" "\$LINE" fire-review-fire' 'REVIEW transport failure no longer relays into OWNER'

# Terminal destination is now an explicit contract, not implied convention
# (the concrete #361/#362 gap: a BUILD terminal landing somewhere other
# than the exact watched wake target).
require "$BUILD" '\*\*Destination\*\*.*exact wake target' 'BUILD terminal destination is explicit'
require "$REVIEW" '\*\*Destination\*\*.*exact wake target' 'REVIEW terminal destination is explicit'
require "$OWNER" '\*\*Destination\*\*.*exact wake target' 'OWNER terminal destination is explicit'


# CF-REVIEW-BIND-01: PR-body contract fields are BUILD's own responsibility,
# not only inherited from the source issue — REVIEW/runtime binding is
# deterministic only when the PR body itself carries them, and TIER must
# survive correction rather than silently defaulting.
require "$BUILD" 'must itself carry' 'BUILD writes canonical OUTCOME-ID/TIER into every PR body it opens/updates'
require "$BUILD" '^OUTCOME-ID: `<value>`$' 'BUILD PR-body contract names the exact OUTCOME-ID field shape'
require "$BUILD" '^TIER: <LIGHT\|NORMAL\|HEAVY>$' 'BUILD PR-body contract names the exact TIER field shape'
require "$BUILD" 'TIER must stay exactly' 'TIER preserved verbatim across correction, never silently defaulted'

# REVIEW may bind to the DONE-source issue's OUTCOME-ID only when that
# relation is unambiguous and current; ambiguity or a closed/superseded
# source issue fails closed rather than guessing — and the router actually
# implements that fallback and its dead-contract guard.
require "$REVIEW" 'unambiguous .*and current' 'source-issue OUTCOME-ID fallback is explicitly bounded, not a blind lookup'
require "$ROUTER" 'runtime_closing_issue_number' 'source-issue fallback resolution wired into REVIEW admission'
require "$ROUTER" 'DEAD CONTRACT' 'closed/superseded contract guard stops routing/repair under a dead contract'

# The dead-contract guard must cover the PR-scoped repair/review paths too,
# not only an issue-kind BUILD wake — a bare 'DEAD CONTRACT' string match
# would pass even if only the issue-kind path checked it.
require "$ROUTER" 'PR-scoped dead-contract guard \(KIND=pr\)' 'fire-build dead-contract guard also covers KIND=pr (CORRECT-triggered repair), not only KIND=issue wakes'
require "$ROUTER" 'PR-scoped dead-contract guard covers a PR that carries its own OUTCOME-ID' 'fire-review dead-contract guard also covers a PR carrying its own OUTCOME-ID, not only the source-issue fallback'

# CF-REVIEW-BIND-01: the already-approved bounded-repair intent (3 CORRECT
# cycles without ACCEPT) is enforced at BUILD admission, not left to
# REVIEW's own prose discipline alone.
require "$ROUTER" 'runtime_correct_cycles_exhausted' 'runtime enforces the approved 3-CORRECT-cycle repair bound'
require "$REVIEW" '3 .CORRECT. cycles without .ACCEPT' 'REVIEW documents the deterministic runtime repair-cycle backstop'

# An unreproduced ordinary failure is never manufactured into Calvin work.
require "$BUILD" 'cannot be reproduced' 'unreproduced bounded diagnosis completes without manufacturing CALVIN REQUIRED'

# CF-CONTRACT-FENCE-01 (issue #384): a worker must not route, merge or
# alert once the canonical contract it loaded at START no longer matches
# the current one — documented in each actor's own contract, and the
# CONTRACT fingerprint is actually threaded through the router that fires
# BUILD/REVIEW/OWNER, not only described in prose.
require "$BUILD" 'Stale contract fence' 'BUILD documents the stale-contract fence'
require "$REVIEW" 'Stale contract fence' 'REVIEW documents the stale-contract fence'
require "$OWNER" 'Stale contract fence' 'OWNER documents the stale-contract fence'
require "$BUILD" 'STALE_CONTRACT' 'BUILD names the typed stale-contract exit'
require "$REVIEW" 'STALE_CONTRACT' 'REVIEW names the typed stale-contract exit'
require "$OWNER" 'STALE_CONTRACT' 'OWNER names the typed stale-contract exit'
require "$ROUTER" 'runtime_contract_hash' 'router computes the contract fingerprint for BUILD/REVIEW/OWNER fires'
require "$MERGE" 'runtime_contract_hash' 'merge-path OWNER fire also stamps a contract fingerprint'
require "$ROUTER" '\[CONTRACT: \$\{CONTRACT\}\]' 'START receipts carry the CONTRACT fingerprint marker'

echo "runtime-wiring: PASS"
