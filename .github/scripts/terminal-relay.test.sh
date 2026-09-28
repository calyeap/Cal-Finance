#!/usr/bin/env bash
# CF-WORKFLOW-RESET-TERMINAL-HANDOFF-REPAIR-02
#
# Deterministic, network-free unit tests for terminal-relay.sh. Mocks
# terminal_relay_fetch_comments/terminal_relay_post_comment (the same
# dependency-injection pattern terminal-watch.test.sh uses for its own
# fetch_comments/post_comment) plus curl, so the admission-and-fire
# decision is exercised without any network access.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# shellcheck source=terminal-relay.sh
source "${SCRIPT_DIR}/terminal-relay.sh"

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

assert_true() {
  local desc="$1" cond="$2"
  if [ "$cond" = "true" ]; then
    echo "ok - $desc"
  else
    echo "not ok - $desc"
    FAILURES=$((FAILURES + 1))
  fi
}

# calvin_slack_send is unit-tested on its own in calvin-slack-notify.test.sh;
# here it is a no-op stub by default so tests that don't care about Slack
# relay don't need a real SLACK_WEBHOOK_URL. Tests that do care override it.
SLACK_CALLED=0
calvin_slack_send() { SLACK_CALLED=1; }

# --- pure predicate mirrors runtime_is_child_terminal ---------------------

assert_eq "a BUILD BLOCKED is owner-relay-needed" true "$(terminal_relay_owner_needed 'BLOCKED: AI — BUILD attempt B1 timed out [BUILD_ATTEMPT_ID: B1]')"
assert_eq "an OWNER's own BLOCKED is not (would loop OWNER into itself)" false "$(terminal_relay_owner_needed 'BLOCKED: AI — OWNER attempt O1 timed out [OWNER_ATTEMPT_ID: O1]')"
assert_eq "BUILD ADMISSION: SUPPRESSED is not a child terminal" false "$(terminal_relay_owner_needed 'BUILD ADMISSION: SUPPRESSED — already active')"

# --- no-op when the line is not a child terminal: no fetch, no fire ------

FETCH_CALLED=0
terminal_relay_fetch_comments() { FETCH_CALLED=1; echo '[]'; }
POSTED=""
terminal_relay_post_comment() { POSTED="$3"; }

terminal_relay_owner "o/r" 1 "BUILD ADMISSION: SUPPRESSED — already active" test-source
assert_eq "an ineligible line never fetches comments" 0 "$FETCH_CALLED"
assert_eq "an ineligible line never posts anything" "" "$POSTED"

# --- no-op when OWNER already has an open attempt (idempotent admission) -

# Both mocks below run inside terminal_relay_owner's own $(...) command
# substitutions (comments="$(terminal_relay_fetch_comments ...)",
# code=$(curl ...)), which are subshells: a plain variable assignment
# inside them never reaches this outer shell. A file write does.
rm -f "$TMP/fetch_called" "$TMP/fire_called"
terminal_relay_fetch_comments() {
  touch "$TMP/fetch_called"
  jq -n '[{body: "OWNER START: wake=TERMINAL [OWNER_ATTEMPT_ID: T1]", created_at: "2026-09-28T01:00:00Z"}]'
}
POSTED=""
curl() { touch "$TMP/fire_called"; echo -n '200'; }
export -f curl

terminal_relay_owner "o/r" 1 "BLOCKED: AI — BUILD attempt B1 timed out [BUILD_ATTEMPT_ID: B1]" test-source
[ -f "$TMP/fetch_called" ] && FETCHED=1 || FETCHED=0
[ -f "$TMP/fire_called" ] && FIRED=1 || FIRED=0
assert_eq "a child terminal still fetches comments to check admission" 1 "$FETCHED"
assert_eq "an already-open OWNER attempt suppresses the relay fire" 0 "$FIRED"
assert_eq "an already-open OWNER attempt posts nothing" "" "$POSTED"

# --- missing secrets: BLOCKED: ACTIONABLE, no fire attempted --------------

terminal_relay_fetch_comments() { echo '[]'; }
POSTED=""
rm -f "$TMP/fire_called"
unset OWNER_FIRE_URL OWNER_FIRE_TOKEN 2>/dev/null || true

terminal_relay_owner "o/r" 1 "BLOCKED: AI — BUILD attempt B1 timed out [BUILD_ATTEMPT_ID: B1]" test-source
[ -f "$TMP/fire_called" ] && FIRED=1 || FIRED=0
assert_eq "a missing OWNER_FIRE_URL never calls curl" 0 "$FIRED"
case "$POSTED" in
  "BLOCKED: ACTIONABLE — OWNER relay transport unavailable"*"refresh OWNER_FIRE_URL"*)
    echo "ok - missing OWNER_FIRE_URL posts a typed ACTIONABLE receipt naming the secret"
    ;;
  *)
    echo "not ok - missing OWNER_FIRE_URL posts a typed ACTIONABLE receipt naming the secret (got [$POSTED])"
    FAILURES=$((FAILURES + 1))
    ;;
esac

# --- successful fire posts an OWNER START receipt with a relay attempt id -

export OWNER_FIRE_URL=https://example/fire OWNER_FIRE_TOKEN=dummy
POSTED=""
rm -f "$TMP/fire_called"
curl() { touch "$TMP/fire_called"; echo '{"claude_code_session_id":"s1","claude_code_session_url":"https://example/s1"}' > /tmp/terminal-relay-owner.json; echo -n '200'; }
export -f curl

terminal_relay_owner "o/r" 42 "BLOCKED: AI — BUILD attempt B1 timed out [BUILD_ATTEMPT_ID: B1]" observe-build-timeout
[ -f "$TMP/fire_called" ] && FIRED=1 || FIRED=0
assert_eq "a successful fire calls curl exactly once" 1 "$FIRED"
case "$POSTED" in
  "OWNER START: wake=RELAY"*"[OWNER_ATTEMPT_ID: OWNER-RELAY-observe-build-timeout-"*)
    echo "ok - a successful fire posts an OWNER START receipt tagged with a relay attempt id"
    ;;
  *)
    echo "not ok - a successful fire posts an OWNER START receipt tagged with a relay attempt id (got [$POSTED])"
    FAILURES=$((FAILURES + 1))
    ;;
esac

# --- a transport failure posts BLOCKED and relays to Slack for an
# ACTIONABLE (auth) classification, without recursing into another
# OWNER-relay attempt ------------------------------------------------------

POSTED=""
SLACK_CALLED=0
curl() { echo -n '401'; }
export -f curl
calvin_slack_send() { SLACK_CALLED=1; }

terminal_relay_owner "o/r" 7 "BLOCKED: AI — BUILD attempt B1 timed out [BUILD_ATTEMPT_ID: B1]" fire-build-fire
assert_eq "an auth transport failure relays to Slack" 1 "$SLACK_CALLED"
case "$POSTED" in
  "BLOCKED: ACTIONABLE — OWNER relay transport unavailable (401)"*)
    echo "ok - an HTTP 401 fire failure posts a typed ACTIONABLE receipt"
    ;;
  *)
    echo "not ok - an HTTP 401 fire failure posts a typed ACTIONABLE receipt (got [$POSTED])"
    FAILURES=$((FAILURES + 1))
    ;;
esac

unset -f curl calvin_slack_send terminal_relay_fetch_comments terminal_relay_post_comment
unset OWNER_FIRE_URL OWNER_FIRE_TOKEN

# --- structural tripwire: relaying OWNER must never itself be reachable
# for OWNER's own terminals (checked again end-to-end, not just via the
# pure predicate above) ----------------------------------------------------

FIRE_CALLED2=0
terminal_relay_fetch_comments() { echo '[]'; }
terminal_relay_post_comment() { :; }
curl() { FIRE_CALLED2=1; echo -n '200'; }
export -f curl
terminal_relay_owner "o/r" 1 "BLOCKED: AI — OWNER attempt O1 timed out [OWNER_ATTEMPT_ID: O1]" observe-owner-timeout
assert_eq "OWNER's own timeout terminal never triggers a relay fire (no self-loop)" 0 "$FIRE_CALLED2"
unset -f curl terminal_relay_fetch_comments terminal_relay_post_comment

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "terminal-relay.test.sh: all checks passed"
  exit 0
else
  echo "terminal-relay.test.sh: $FAILURES check(s) failed"
  exit 1
fi
