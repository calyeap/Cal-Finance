#!/usr/bin/env bash
# CF-CONTINUE-WAKE-VERIFY-01 (issue #396)
#
# Structural regression coverage for OWNER.md's CONTINUE wake-verification
# contract. Issue #396: OWNER emitted `CONTINUE: #384` and claimed the
# `needs-build-wake` mutation succeeded, but the label never actually
# landed — no BUILD start, no wake event, a silent stall until the wake
# was manually re-applied. This is a prose-only fix (OWNER runs as an AI
# worker issuing gh api calls directly, not a scripted workflow job), so
# coverage here is the same require/forbid structural-assertion pattern
# runtime-wiring.test.sh already uses for OWNER.md/BUILD.md/CC.md content.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

fail() { echo "FAIL: $*" >&2; exit 1; }
require() { grep -Eq -e "$2" "$1" || fail "$1 missing: $3"; }
forbid() { ! grep -Eq -e "$2" "$1" || fail "$1 still contains forbidden: $3"; }

OWNER=.github/ai-routines/OWNER.md

# DO #2: apply the exact expected wake label/action, read back the target
# state, verify the wake actually exists, only then emit the CONTINUE
# terminal — never a claimed success without a confirmed readback.
require "$OWNER" 'CF-CONTINUE-WAKE-VERIFY-01' 'OWNER documents the CONTINUE wake-verification fix'
require "$OWNER" 'Read back before claiming success' 'OWNER requires a readback before claiming a wake mutation succeeded'
require "$OWNER" 'needs-build-wake.*is actually present' 'OWNER verifies the expected wake label is actually present, not merely requested'
require "$OWNER" 'Only once that readback confirms the wake landed may the .CONTINUE. terminal be emitted' 'CONTINUE terminal is gated on a confirmed readback'
require "$OWNER" 'Terminal \(only after a verified wake\):' 'OWNER'"'"'s CONTINUE terminal line itself is documented as verify-gated'

# DO #1 / #3: reuse the existing bounded transport/retry primitive from
# CF-FIRE-RETRY-01 (fire_post's immediate + 10s/30s/60s schedule) instead
# of a new retry system.
require "$OWNER" 'CF-FIRE-RETRY-01.*immediate attempt, then 10s/30s/60s' 'OWNER reuses fire_post'"'"'s exact bounded retry schedule'
require "$OWNER" 'do not invent a new retry system' 'OWNER explicitly refuses a second retry system'

# DO #5: verification must not create a second wake when the first one
# already landed — idempotent under ambiguous/retried delivery.
require "$OWNER" 'never re-apply the label once it is confirmed present' 'OWNER does not duplicate an already-landed wake mutation'
require "$OWNER" 'verification must not create a second wake when the first mutation actually landed' 'OWNER states the idempotency requirement explicitly'

# DO #4: bounded recovery exhaustion is exactly one BLOCKED: ACTIONABLE
# naming the deterministic re-drive action, never a silent/false CONTINUE.
require "$OWNER" 'BLOCKED: ACTIONABLE — CONTINUE wake mutation to <target> could not be verified after 4 attempts' 'exhausted verification ends in one typed BLOCKED: ACTIONABLE, not a silent stall'
require "$OWNER" 'reapply the .{1,2}needs-build-wake.{1,2} label to <target> to deterministically re-drive' 'BLOCKED: ACTIONABLE names the exact deterministic re-drive action'

# DO #6: Slack semantics unchanged — AI-owned retry/progress stays silent;
# only the exhausted human-actionable re-drive may alert. No new Slack path
# is introduced; this reuses the existing BLOCKED: ACTIONABLE Slack rule
# already documented in OWNER.md's BLOCKED section.
require "$OWNER" 'AI-owned retry/progress up to that point stays silent' 'AI-owned retry/progress before exhaustion is documented as silent'
require "$OWNER" 'BLOCKED: ACTIONABLE.*only for a concrete human-only action' 'the pre-existing BLOCKED: ACTIONABLE Slack-eligibility rule is unchanged'

# DO NOT: no new watcher/polling service/supervisor mechanism introduced
# for this fix (OWNER's pre-existing hard bounds already forbid a queue/
# database/second state store in general — this only checks nothing new
# here adds a polling loop or a second control plane).
forbid "$OWNER" 'polling (loop|service)|second control plane' 'no polling loop/second control plane introduced by the wake-verification fix'

echo "owner-continue-wake-verify: PASS"
