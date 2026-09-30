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

echo "runtime-wiring: PASS"
