#!/usr/bin/env bash
# CF-WORKFLOW-RESET-TERMINAL-HANDOFF-REPAIR-02
#
# Deterministic, network-free unit tests for calvin-slack-notify.sh.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=calvin-slack-notify.sh
source "${SCRIPT_DIR}/calvin-slack-notify.sh"

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

assert_status() {
  local desc="$1" expected_rc="$2" actual_rc="$3"
  if [ "$expected_rc" = "$actual_rc" ]; then
    echo "ok - $desc"
  else
    echo "not ok - $desc (expected rc $expected_rc, got $actual_rc)"
    FAILURES=$((FAILURES + 1))
  fi
}

# --- payload eligibility mirrors runtime_slack_kind -----------------------

payload=$(calvin_slack_payload "BLOCKED: ACTIONABLE — refresh OWNER_FIRE_TOKEN" "o/r" "https://x/1")
rc=$?
assert_status "actionable_blocked is eligible" 0 "$rc"
assert_eq "actionable payload carries the ACTIONABLE BLOCKED header" "ACTIONABLE BLOCKED" "$(jq -r '.text' <<<"$payload" | head -n1 | sed -E 's/ — .*//')"

payload=$(calvin_slack_payload "CALVIN REQUIRED: pick A or B" "o/r" "https://x/1")
assert_eq "calvin_required payload carries the CALVIN REQUIRED header" "CALVIN REQUIRED" "$(jq -r '.text' <<<"$payload" | head -n1 | sed -E 's/ — .*//')"

payload=$(calvin_slack_payload "COMPLETE: meaningful parent outcome" "o/r" "https://x/1")
assert_eq "complete payload carries the COMPLETE header" "COMPLETE" "$(jq -r '.text' <<<"$payload" | head -n1 | sed -E 's/ — .*//')"

set +e
calvin_slack_payload "BLOCKED: AI — worker timed out" "o/r" "https://x/1" >/dev/null
rc=$?
set -e
assert_status "BLOCKED: AI (not ACTIONABLE) is not eligible" 1 "$rc"

set +e
calvin_slack_payload "CONTINUE: next child" "o/r" "https://x/1" >/dev/null
rc=$?
set -e
assert_status "CONTINUE is not eligible" 1 "$rc"

# --- the internal OWNER_ATTEMPT_ID tag never reaches the Slack message ----

payload=$(calvin_slack_payload $'BLOCKED: ACTIONABLE — refresh OWNER_FIRE_TOKEN [OWNER_ATTEMPT_ID: TERMINAL-9-1]' "o/r" "https://x/1")
case "$(jq -r '.text' <<<"$payload")" in
  *"[OWNER_ATTEMPT_ID:"*)
    echo "not ok - OWNER_ATTEMPT_ID tag leaked into the Slack message"
    FAILURES=$((FAILURES + 1))
    ;;
  *)
    echo "ok - OWNER_ATTEMPT_ID tag is stripped from the Slack message"
    ;;
esac

# --- a heading-wrapped/multi-line comment still classifies on its own
# first, trimmed line -------------------------------------------------------

payload=$(calvin_slack_payload $'## BLOCKED: ACTIONABLE — refresh secret\nmore context below' "o/r" "https://x/1")
rc=$?
assert_status "heading-normalized first line still classifies" 0 "$rc"

# --- calvin_slack_send is a silent no-op (rc 0, no request) when the line
# is not Slack-eligible, so every call site can call it unconditionally ---

CURL_CALLED=0
curl() { CURL_CALLED=1; }
export -f curl

set +e
calvin_slack_send "BLOCKED: AI — worker timed out" "o/r" "https://x/1"
rc=$?
set -e
assert_status "calvin_slack_send no-ops on an ineligible line" 0 "$rc"
assert_eq "calvin_slack_send never calls curl for an ineligible line" 0 "$CURL_CALLED"

# --- calvin_slack_send does send, and fails closed on a bad webhook
# response, for an eligible line -------------------------------------------

curl() { echo -n '500'; }
export -f curl
export SLACK_WEBHOOK_URL=https://hooks.example/test

set +e
calvin_slack_send "BLOCKED: ACTIONABLE — refresh secret" "o/r" "https://x/1" >/dev/null 2>&1
rc=$?
set -e
assert_status "calvin_slack_send fails closed on a non-2xx webhook response" 1 "$rc"

curl() { echo -n '200'; }
export -f curl

set +e
calvin_slack_send "BLOCKED: ACTIONABLE — refresh secret" "o/r" "https://x/1"
rc=$?
set -e
assert_status "calvin_slack_send succeeds on a 2xx webhook response" 0 "$rc"

unset -f curl
unset SLACK_WEBHOOK_URL

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "calvin-slack-notify.test.sh: all checks passed"
  exit 0
else
  echo "calvin-slack-notify.test.sh: $FAILURES check(s) failed"
  exit 1
fi
