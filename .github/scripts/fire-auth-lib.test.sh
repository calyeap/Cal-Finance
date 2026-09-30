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

# --- CF-FIRE-RETRY-01: transient classification -----------------------

assert_eq "curl_error is transient" true "$(fire_transient_status "curl_error")"
assert_eq "HTTP 429 is transient" true "$(fire_transient_status "429")"
assert_eq "HTTP 502 is transient" true "$(fire_transient_status "502")"
assert_eq "HTTP 503 is transient" true "$(fire_transient_status "503")"
assert_eq "HTTP 504 is transient" true "$(fire_transient_status "504")"

assert_eq "HTTP 200 is not transient" false "$(fire_transient_status "200")"
assert_eq "HTTP 401 is not transient (auth's job, not retry's)" false "$(fire_transient_status "401")"
assert_eq "HTTP 403 is not transient" false "$(fire_transient_status "403")"
assert_eq "HTTP 404 is not transient" false "$(fire_transient_status "404")"
assert_eq "HTTP 409 is not transient" false "$(fire_transient_status "409")"
assert_eq "HTTP 422 is not transient" false "$(fire_transient_status "422")"
assert_eq "HTTP 500 is not transient (application error, not transport)" false "$(fire_transient_status "500")"
assert_eq "missing_secret is not transient" false "$(fire_transient_status "missing_secret")"

echo

# --- CF-FIRE-RETRY-01: fire_post bounded retry --------------------------
#
# fire_post is invoked as `code="$(fire_post ...)"` — a command
# substitution subshell. A plain variable a mocked curl/sleep increments
# never survives back out of that subshell (the same gotcha
# terminal-relay.test.sh documents for its own mocks), so call counts and
# delays are recorded to files instead.

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

CURL_LOG="$TMP/curl.log"
SLEEP_LOG="$TMP/sleep.log"

curl_call_count() { wc -l < "$CURL_LOG" | tr -d ' '; }
sleep_calls() { cat "$SLEEP_LOG" 2>/dev/null; }

# sleep is mocked so the 10s/30s/60s bounded schedule doesn't actually
# stall this test.
sleep() { echo "$1" >> "$SLEEP_LOG"; }

# A 2xx on the first attempt calls curl exactly once and never sleeps.
: > "$CURL_LOG"; : > "$SLEEP_LOG"
curl() { echo call >> "$CURL_LOG"; echo -n '200'; }
code="$(fire_post "https://example/fire" dummy prompt "$TMP/out1.json")"
assert_eq "an immediate 200 returns 200" "200" "$code"
assert_eq "an immediate 200 calls curl exactly once" 1 "$(curl_call_count)"
assert_eq "an immediate 200 never sleeps" "" "$(sleep_calls)"

# A transient 503 then a 200 recovers on the second attempt after one
# 10s backoff — the #387 self-recovery case this outcome exists for.
: > "$CURL_LOG"; : > "$SLEEP_LOG"
curl() {
  local n; n=$(curl_call_count)
  echo call >> "$CURL_LOG"
  if [ "$n" -eq 0 ]; then echo -n '503'; else echo -n '200'; fi
}
code="$(fire_post "https://example/fire" dummy prompt "$TMP/out2.json")"
assert_eq "503 then 200 returns 200" "200" "$code"
assert_eq "503 then 200 calls curl exactly twice" 2 "$(curl_call_count)"
assert_eq "503 then 200 sleeps once, 10s" "10" "$(sleep_calls)"

# Repeated transient failures exhaust at exactly 4 total attempts (the
# bounded immediate/10s/30s/60s schedule), returning the last transient
# code rather than looping forever.
: > "$CURL_LOG"; : > "$SLEEP_LOG"
curl() { echo call >> "$CURL_LOG"; echo -n '503'; }
code="$(fire_post "https://example/fire" dummy prompt "$TMP/out3.json")"
assert_eq "repeated 503s return the last transient code" "503" "$code"
assert_eq "repeated 503s call curl exactly 4 times total" 4 "$(curl_call_count)"
assert_eq "repeated 503s use the 10s/30s/60s schedule, 3 sleeps" "$(printf '10\n30\n60')" "$(sleep_calls)"

# A curl_error (the request itself never completed) is retried exactly
# like an HTTP 503 would be.
: > "$CURL_LOG"; : > "$SLEEP_LOG"
curl() { echo call >> "$CURL_LOG"; return 1; }
code="$(fire_post "https://example/fire" dummy prompt "$TMP/out4.json")"
assert_eq "repeated curl errors return curl_error" "curl_error" "$code"
assert_eq "repeated curl errors call curl exactly 4 times total" 4 "$(curl_call_count)"

# A non-transient failure (401, and separately 500) never retries: one
# attempt, no sleep, immediate return — 401/403 are fire_auth_status's
# job and 500 is an application error, neither is a transport blip.
: > "$CURL_LOG"; : > "$SLEEP_LOG"
curl() { echo call >> "$CURL_LOG"; echo -n '401'; }
code="$(fire_post "https://example/fire" dummy prompt "$TMP/out5.json")"
assert_eq "a 401 returns 401" "401" "$code"
assert_eq "a 401 calls curl exactly once (no retry)" 1 "$(curl_call_count)"
assert_eq "a 401 never sleeps" "" "$(sleep_calls)"

: > "$CURL_LOG"; : > "$SLEEP_LOG"
curl() { echo call >> "$CURL_LOG"; echo -n '500'; }
code="$(fire_post "https://example/fire" dummy prompt "$TMP/out6.json")"
assert_eq "a 500 returns 500" "500" "$code"
assert_eq "a 500 calls curl exactly once (no retry)" 1 "$(curl_call_count)"
assert_eq "a 500 never sleeps" "" "$(sleep_calls)"

unset -f curl sleep

if [ "$FAILURES" -eq 0 ]; then
  echo "fire-auth-lib.test.sh: all checks passed"
  exit 0
else
  echo "fire-auth-lib.test.sh: $FAILURES check(s) failed"
  exit 1
fi
