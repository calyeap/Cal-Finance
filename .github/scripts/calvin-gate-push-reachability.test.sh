#!/usr/bin/env bash
# CF-GATE-PUSH-01 (issue #221)
#
# Deterministic, network-free structural check on cc-auto-fire.yml.
# calvin-gate-push-lib.test.sh and calvin-gate-push.test.sh cover the pure
# classification and the orchestrator's own control flow in isolation;
# neither can prove the push is actually wired to fire from the job that
# admits a genuine CALVIN REQUIRED boundary, rather than sitting inert
# (the exact class of defect calvin-ruling-reachability.test.sh guards
# against for the ruling-wake edge). This asserts the committed YAML text
# directly for the properties that matter:
#   - the push step lives inside fire-owner-on-terminal, the job the fresh
#     needs-owner-wake label admits;
#   - it is excluded from the issue_comment/CALVIN RULING admission path
#     (a ruling answers an existing gate; it must never open a new one —
#     "Resolution must not send a second alert");
#   - a push failure can never fail the job or block the OWNER fire
#     (continue-on-error is set, and the two secrets are wired through
#     env: rather than interpolated into a run: script body).
#
# Run directly with
# `bash .github/scripts/calvin-gate-push-reachability.test.sh`; wired
# into CI (.github/workflows/ci.yml) alongside the other .test.sh scripts.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKFLOWS_DIR="$(cd "${SCRIPT_DIR}/../workflows" && pwd)"
CC_AUTO_FIRE="${WORKFLOWS_DIR}/cc-auto-fire.yml"

FAILURES=0

assert_true() {
  local desc="$1" cond="$2"
  if [ "$cond" = "true" ]; then
    echo "ok - $desc"
  else
    echo "not ok - $desc"
    FAILURES=$((FAILURES + 1))
  fi
}

# extract_job_block <file> <job_name>
# Mirrors calvin-ruling-reachability.test.sh's helper.
extract_job_block() {
  local file="$1" job_name="$2"
  awk -v job="  ${job_name}:" '
    $0 == job { found = 1; print; next }
    found && /^  [A-Za-z]/ { exit }
    found { print }
  ' "$file"
}

if [ ! -f "$CC_AUTO_FIRE" ]; then
  echo "not ok - $CC_AUTO_FIRE exists"
  echo "calvin-gate-push-reachability.test.sh: 1 check(s) failed"
  exit 1
fi

terminal_block="$(extract_job_block "$CC_AUTO_FIRE" "fire-owner-on-terminal")"

if [ -z "$terminal_block" ]; then
  echo "not ok - found the fire-owner-on-terminal job block in cc-auto-fire.yml"
  echo "calvin-gate-push-reachability.test.sh: 1 check(s) failed"
  exit 1
fi
echo "ok - found the fire-owner-on-terminal job block in cc-auto-fire.yml"

# --- the push is actually invoked from inside this job --------------------

invokes_push="false"
if printf '%s\n' "$terminal_block" | grep -q 'bash .github/scripts/calvin-gate-push.sh'; then
  invokes_push="true"
fi
assert_true "fire-owner-on-terminal invokes calvin-gate-push.sh" "$invokes_push"

# --- excluded from the issue_comment/CALVIN RULING admission path: the
# "Resolve Calvin Gate push target" step's own condition must rule out
# issue_comment events, so a ruling never opens a second gate ------------

push_target_step="$(printf '%s\n' "$terminal_block" | awk '
  /- name: Resolve Calvin Gate push target/ { found = 1 }
  found { print }
  found && /run: \|/ { exit }
')"

excludes_issue_comment="false"
if printf '%s\n' "$push_target_step" | grep -q "github.event_name != 'issue_comment'"; then
  excludes_issue_comment="true"
fi
assert_true "the Calvin Gate push target step excludes the issue_comment/CALVIN RULING admission path" "$excludes_issue_comment"

# --- regression guard: this exact step crashed the whole job live on
# PR #222 (the outcome's own PR) because the job's checkout step pins to
# the default branch — which pre-merge does not yet have
# calvin-gate-push-lib.sh — and this step had no continue-on-error and no
# existence guard, so sourcing a missing file failed the step and aborted
# the job before "Fire CALBOARD-OWNER" ever ran. Both fixes must hold. ---

target_step_continue_on_error="false"
if printf '%s\n' "$push_target_step" | grep -q 'continue-on-error: true'; then
  target_step_continue_on_error="true"
fi
assert_true "the Calvin Gate push target step sets continue-on-error: true (regression: PR #222 crashed the job without this)" "$target_step_continue_on_error"

full_terminal_block="$(extract_job_block "$CC_AUTO_FIRE" "fire-owner-on-terminal")"
guards_missing_lib="false"
if printf '%s\n' "$full_terminal_block" | grep -q '\[ ! -f .github/scripts/calvin-gate-push-lib.sh \]'; then
  guards_missing_lib="true"
fi
assert_true "the Calvin Gate push target step checks calvin-gate-push-lib.sh exists before sourcing it (regression: PR #222 crashed on a pre-merge checkout missing the file)" "$guards_missing_lib"

# --- a push failure can never fail the job or block the OWNER fire -------

send_push_step="$(printf '%s\n' "$terminal_block" | awk '
  /- name: Send Calvin Gate push/ { found = 1 }
  found { print }
  found && /run:/ && !/^ *#/ { exit }
')"

has_continue_on_error="false"
if printf '%s\n' "$send_push_step" | grep -q 'continue-on-error: true'; then
  has_continue_on_error="true"
fi
assert_true "the Send Calvin Gate push step sets continue-on-error: true" "$has_continue_on_error"

not_gated_on_owner_fire="true"
if printf '%s\n' "$send_push_step" | grep -q 'steps.fire.outputs'; then
  not_gated_on_owner_fire="false"
fi
assert_true "the Send Calvin Gate push step's condition does not depend on the OWNER fire step's outcome" "$not_gated_on_owner_fire"

# --- the two push secrets are wired through env:, never interpolated
# directly into a run: script body (that would be a shell-injection risk
# via an attacker-influenced secret value; env: assignment is safe) ------

uses_url_secret="false"
if printf '%s\n' "$send_push_step" | grep -q 'CALVIN_PUSH_WEBHOOK_URL: \${{ secrets.CALVIN_PUSH_WEBHOOK_URL }}'; then
  uses_url_secret="true"
fi
assert_true "CALVIN_PUSH_WEBHOOK_URL is wired from a repository secret via env:" "$uses_url_secret"

uses_token_secret="false"
if printf '%s\n' "$send_push_step" | grep -q 'CALVIN_PUSH_WEBHOOK_TOKEN: \${{ secrets.CALVIN_PUSH_WEBHOOK_TOKEN }}'; then
  uses_token_secret="true"
fi
assert_true "CALVIN_PUSH_WEBHOOK_TOKEN is wired from a repository secret via env:" "$uses_token_secret"

no_run_interpolation="true"
if printf '%s\n' "$send_push_step" | grep -A1 'run:' | grep -q '\${{ secrets\.CALVIN_PUSH'; then
  no_run_interpolation="false"
fi
assert_true "the push secrets are never interpolated directly into the run: script body" "$no_run_interpolation"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "calvin-gate-push-reachability.test.sh: all checks passed"
  exit 0
else
  echo "calvin-gate-push-reachability.test.sh: $FAILURES check(s) failed"
  exit 1
fi
