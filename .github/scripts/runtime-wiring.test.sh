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
require "$ROUTER" 'product work is paused by Calvin ruling #357' 'canonical reset hold enforcement'

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

# Slack is terminal-driven: genuine ask/actionable block/one parent COMPLETE.
require "$SLACK" 'runtime_slack_kind' 'shared terminal classifier'
require "$SLACK" 'ACTIONABLE BLOCKED' 'actionable blocker notification'
require "$SLACK" 'HEADER="COMPLETE"' 'meaningful parent completion notification'
forbid "$SLACK" 'WORKFLOW BLOCKED|OWNER LIVENESS EXHAUSTED' 'legacy liveness-specific notification vocabulary'

echo "runtime-wiring: PASS"
