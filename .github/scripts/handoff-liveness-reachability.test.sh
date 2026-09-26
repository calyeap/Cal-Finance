#!/usr/bin/env bash
# CF-HANDOFF-FAIL-CLOSED-01
#
# Deterministic, network-free structural checks on cc-auto-fire.yml and
# owner-on-merge.yml — the same class of coverage
# terminal-owner-direct-reachability.test.sh already gives the OWNER
# terminal-routing edge: the pure classifiers in fire-auth-lib.sh,
# build-liveness-lib.sh, and review-liveness-lib.sh can be fully correct in
# isolation while still being unreachable in production if the workflow
# never calls them, or if the deterministic re-drive (removing a consumed
# wake label on an AUTH-classified failure) isn't actually wired to the
# classification that detects it.
#
# Specifically guards DONE WHEN #6 ("stale-label/re-drive semantics") and
# #4/#7 (every fire path classifies auth and names the actor+secret) by
# checking, not running, the committed YAML.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKFLOWS_DIR="$(cd "${SCRIPT_DIR}/../workflows" && pwd)"
CC_AUTO_FIRE="${WORKFLOWS_DIR}/cc-auto-fire.yml"
OWNER_ON_MERGE="${WORKFLOWS_DIR}/owner-on-merge.yml"

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
# Mirrors terminal-owner-direct-reachability.test.sh's helper.
extract_job_block() {
  local file="$1" job_name="$2"
  awk -v job="  ${job_name}:" '
    $0 == job { found = 1; print; next }
    found && /^  [A-Za-z]/ { exit }
    found { print }
  ' "$file"
}

check_job_wires_auth_and_redrive() {
  local job_block="$1" job_label="$2" wake_label="$3"

  local sources_lib="false"
  if printf '%s\n' "$job_block" | grep -q 'source .github/scripts/fire-auth-lib.sh'; then
    sources_lib="true"
  fi
  assert_true "$job_label sources fire-auth-lib.sh" "$sources_lib"

  local calls_classifier="false"
  if printf '%s\n' "$job_block" | grep -q 'fire_auth_status'; then
    calls_classifier="true"
  fi
  assert_true "$job_label calls fire_auth_status" "$calls_classifier"

  local sets_auth_blocked="false"
  if printf '%s\n' "$job_block" | grep -q 'auth_blocked='; then
    sets_auth_blocked="true"
  fi
  assert_true "$job_label sets an auth_blocked output" "$sets_auth_blocked"

  if [ -n "$wake_label" ]; then
    local redrive_wired="false"
    if printf '%s\n' "$job_block" | grep -A3 -- "$wake_label" | grep -q "steps.fire.outputs.auth_blocked == 'true'"; then
      redrive_wired="true"
    fi
    assert_true "$job_label's wake-label removal step condition includes auth_blocked (deterministic re-drive)" "$redrive_wired"
  fi

  local posts_blocked_body="false"
  if printf '%s\n' "$job_block" | grep -q 'fire_auth_blocked_body'; then
    posts_blocked_body="true"
  fi
  assert_true "$job_label posts fire_auth_blocked_body on an auth-classified failure" "$posts_blocked_body"
}

# --- fire-build --------------------------------------------------------

build_block="$(extract_job_block "$CC_AUTO_FIRE" "fire-build")"
if [ -z "$build_block" ]; then
  echo "not ok - found the fire-build job block in cc-auto-fire.yml"
  FAILURES=$((FAILURES + 1))
else
  echo "ok - found the fire-build job block in cc-auto-fire.yml"
  check_job_wires_auth_and_redrive "$build_block" "fire-build" "Remove BUILD wake label"

  runs_liveness_guard="false"
  if printf '%s\n' "$build_block" | grep -q 'worker-liveness-guard.sh'; then
    runs_liveness_guard="true"
  fi
  assert_true "fire-build runs worker-liveness-guard.sh" "$runs_liveness_guard"

  sets_actor_build="false"
  if printf '%s\n' "$build_block" | grep -q 'ACTOR: BUILD'; then
    sets_actor_build="true"
  fi
  assert_true "fire-build's liveness guard step sets ACTOR: BUILD" "$sets_actor_build"

  embeds_tag="false"
  if printf '%s\n' "$build_block" | grep -q '\[BUILD_ATTEMPT_ID:'; then
    embeds_tag="true"
  fi
  assert_true "fire-build embeds [BUILD_ATTEMPT_ID: ...] in its fire receipt" "$embeds_tag"
fi

# --- fire-review ---------------------------------------------------------

review_block="$(extract_job_block "$CC_AUTO_FIRE" "fire-review")"
if [ -z "$review_block" ]; then
  echo "not ok - found the fire-review job block in cc-auto-fire.yml"
  FAILURES=$((FAILURES + 1))
else
  echo "ok - found the fire-review job block in cc-auto-fire.yml"
  check_job_wires_auth_and_redrive "$review_block" "fire-review" "Remove REVIEW wake label"

  runs_liveness_guard="false"
  if printf '%s\n' "$review_block" | grep -q 'worker-liveness-guard.sh'; then
    runs_liveness_guard="true"
  fi
  assert_true "fire-review runs worker-liveness-guard.sh" "$runs_liveness_guard"

  sets_actor_review="false"
  if printf '%s\n' "$review_block" | grep -q 'ACTOR: REVIEW'; then
    sets_actor_review="true"
  fi
  assert_true "fire-review's liveness guard step sets ACTOR: REVIEW" "$sets_actor_review"

  embeds_tag="false"
  if printf '%s\n' "$review_block" | grep -q '\[REVIEW_ATTEMPT_ID:'; then
    embeds_tag="true"
  fi
  assert_true "fire-review embeds [REVIEW_ATTEMPT_ID: ...] in its fire receipt" "$embeds_tag"
fi

# --- fire-owner-on-terminal -----------------------------------------------

owner_terminal_block="$(extract_job_block "$CC_AUTO_FIRE" "fire-owner-on-terminal")"
if [ -z "$owner_terminal_block" ]; then
  echo "not ok - found the fire-owner-on-terminal job block in cc-auto-fire.yml"
  FAILURES=$((FAILURES + 1))
else
  echo "ok - found the fire-owner-on-terminal job block in cc-auto-fire.yml"
  check_job_wires_auth_and_redrive "$owner_terminal_block" "fire-owner-on-terminal" "OWNER terminal-wake label"
fi

# --- owner-on-merge.yml's fire-owner-on-merge (no wake label to redrive:
# this path is merge-event triggered, not label triggered) ----------------

merge_block="$(extract_job_block "$OWNER_ON_MERGE" "fire-owner-on-merge")"
if [ -z "$merge_block" ]; then
  echo "not ok - found the fire-owner-on-merge job block in owner-on-merge.yml"
  FAILURES=$((FAILURES + 1))
else
  echo "ok - found the fire-owner-on-merge job block in owner-on-merge.yml"
  check_job_wires_auth_and_redrive "$merge_block" "fire-owner-on-merge" ""

  never_prints_body_on_auth="false"
  if printf '%s\n' "$merge_block" | grep -A4 -- 'steps.fire.outputs.auth_blocked }}" = "true"' | grep -q 'fire_auth_blocked_body'; then
    never_prints_body_on_auth="true"
  fi
  assert_true "fire-owner-on-merge's auth branch never falls through to printing the raw response body" "$never_prints_body_on_auth"
fi

# --- owner-liveness-guard.sh's own recovery fire also classifies auth ----

owner_guard_sources_lib="false"
if grep -q 'source .*fire-auth-lib.sh' "${SCRIPT_DIR}/owner-liveness-guard.sh"; then
  owner_guard_sources_lib="true"
fi
assert_true "owner-liveness-guard.sh sources fire-auth-lib.sh" "$owner_guard_sources_lib"

owner_guard_classifies="false"
if grep -q 'fire_auth_status' "${SCRIPT_DIR}/owner-liveness-guard.sh"; then
  owner_guard_classifies="true"
fi
assert_true "owner-liveness-guard.sh's recovery fire classifies auth failures" "$owner_guard_classifies"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "handoff-liveness-reachability.test.sh: all checks passed"
  exit 0
else
  echo "handoff-liveness-reachability.test.sh: $FAILURES check(s) failed"
  exit 1
fi
