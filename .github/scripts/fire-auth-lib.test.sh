#!/usr/bin/env bash
# CF-HANDOFF-FAIL-CLOSED-01
#
# Deterministic, network-free unit tests for fire-auth-lib.sh. Run directly
# with `bash .github/scripts/fire-auth-lib.test.sh`; wired into CI
# (.github/workflows/ci.yml) alongside the other .test.sh scripts.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=fire-auth-lib.sh
source "${SCRIPT_DIR}/fire-auth-lib.sh"

FAILURES=0

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "ok - $desc"
  else
    echo "not ok - $desc (expected [$expected], got [$actual])"
    FAILURES=$((FAILURES + 1))
  fi
}

# --- the three DONE WHEN #4 auth cases classify "auth" -------------------

assert_eq "missing_secret classifies auth" "auth" "$(fire_auth_status "missing_secret")"
assert_eq "HTTP 401 classifies auth" "auth" "$(fire_auth_status "401")"
assert_eq "HTTP 403 classifies auth" "auth" "$(fire_auth_status "403")"

# --- everything else stays on the existing generic failure path ----------

assert_eq "HTTP 200 classifies not_auth" "not_auth" "$(fire_auth_status "200")"
assert_eq "HTTP 500 classifies not_auth" "not_auth" "$(fire_auth_status "500")"
assert_eq "HTTP 404 classifies not_auth" "not_auth" "$(fire_auth_status "404")"
assert_eq "curl_error classifies not_auth" "not_auth" "$(fire_auth_status "curl_error")"

# --- the blocked-body builder never echoes a credential/response body,
# only actor + secret name + classification ------------------------------

body="$(fire_auth_blocked_body "BUILD" "BUILD_FIRE_TOKEN" "401")"
case "$body" in
  "WORKFLOW BLOCKED — AUTH"*)
    echo "ok - blocked body starts with the typed WORKFLOW BLOCKED — AUTH marker"
    ;;
  *)
    echo "not ok - blocked body starts with the typed WORKFLOW BLOCKED — AUTH marker (got [$body])"
    FAILURES=$((FAILURES + 1))
    ;;
esac

case "$body" in
  *"actor: BUILD"*"secret: BUILD_FIRE_TOKEN"*"classification: 401"*)
    echo "ok - blocked body names actor, secret, and classification"
    ;;
  *)
    echo "not ok - blocked body names actor, secret, and classification (got [$body])"
    FAILURES=$((FAILURES + 1))
    ;;
esac

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "fire-auth-lib.test.sh: all checks passed"
  exit 0
else
  echo "fire-auth-lib.test.sh: $FAILURES check(s) failed"
  exit 1
fi
