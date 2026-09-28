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

set +e
calvin_slack_payload "COMPLETE: meaningful parent outcome" "o/r" "https://x/1" >/dev/null
rc=$?
set -e
assert_status "COMPLETE is not Slack-eligible (CF-SLACK-ACTION-ONLY-01)" 1 "$rc"

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

# --- issue #375 (CF-WORKFLOW-TERMINAL-NORMALIZE-01): a standalone
# [BUILD_ATTEMPT_ID: ...] metadata line preceding the real typed terminal
# must not hide it from Slack eligibility -----------------------------------

payload=$(calvin_slack_payload $'[BUILD_ATTEMPT_ID: BUILD-9-1]\nCALVIN REQUIRED: pick A or B' "o/r" "https://x/1")
rc=$?
assert_status "metadata-first CALVIN REQUIRED is still Slack eligible" 0 "$rc"
assert_eq "metadata-first payload carries the CALVIN REQUIRED header" "CALVIN REQUIRED" "$(jq -r '.text' <<<"$payload" | head -n1 | sed -E 's/ — .*//')"

set +e
calvin_slack_payload $'Some narrative update.\n\nCALVIN REQUIRED: quoted later, not a terminal' "o/r" "https://x/1" >/dev/null
rc=$?
set -e
assert_status "prose followed later by CALVIN REQUIRED stays ineligible" 1 "$rc"

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

# --- CF-WORKFLOW-PROOF-SLACK-DEDUPE-01: an OWNER terminal that merely
# restates an already-alerted child blocker (the #365 class) is
# suppressed; a distinct new OWNER blocker still sends -------------------
#
# curl runs inside calvin_slack_send's own command substitution
# (code=$(curl ...)), a subshell, so a plain variable assignment inside
# the curl() stub never reaches this outer shell (same caveat
# terminal-relay.test.sh documents for its own mocks) — use a file marker
# instead.

DEDUPE_TMP="$(mktemp -d)"
trap 'rm -rf "$DEDUPE_TMP"' EXIT

curl() { touch "$DEDUPE_TMP/curl_called"; echo -n '200'; }
export -f curl
export SLACK_WEBHOOK_URL=https://hooks.example/test

CHILD_COMMENTS=$(jq -n '[
  {body: "BLOCKED: ACTIONABLE — sandbox denies commit [BUILD_ATTEMPT_ID: B1]", created_at: "2026-09-28T15:10:00Z"},
  {body: "OWNER START: wake=TERMINAL [OWNER_ATTEMPT_ID: O1]", created_at: "2026-09-28T15:11:00Z"}
]')

rm -f "$DEDUPE_TMP/curl_called"
calvin_slack_send \
  'BLOCKED: ACTIONABLE — child BUILD run (B1) reports the same sandbox denial [OWNER_ATTEMPT_ID: O1]' \
  "o/r" "https://x/2" "$CHILD_COMMENTS" "2026-09-28T15:12:00Z"
[ -f "$DEDUPE_TMP/curl_called" ] && CALLED=1 || CALLED=0
assert_eq "OWNER restating an already-alerted child blocker never calls curl" 0 "$CALLED"

rm -f "$DEDUPE_TMP/curl_called"
calvin_slack_send \
  'BLOCKED: ACTIONABLE — separate, unrelated permission is needed for the payments export [OWNER_ATTEMPT_ID: O1]' \
  "o/r" "https://x/2" "$CHILD_COMMENTS" "2026-09-28T15:12:00Z"
[ -f "$DEDUPE_TMP/curl_called" ] && CALLED=1 || CALLED=0
assert_eq "a distinct new OWNER blocker still calls curl" 1 "$CALLED"

rm -f "$DEDUPE_TMP/curl_called"
calvin_slack_send \
  'BLOCKED: ACTIONABLE — sandbox denies commit [BUILD_ATTEMPT_ID: B1]' \
  "o/r" "https://x/1" "$CHILD_COMMENTS" "2026-09-28T15:10:00Z"
[ -f "$DEDUPE_TMP/curl_called" ] && CALLED=1 || CALLED=0
assert_eq "the first (child) alert still calls curl even with prior comments supplied" 1 "$CALLED"

rm -f "$DEDUPE_TMP/curl_called"
calvin_slack_send \
  'BLOCKED: ACTIONABLE — child BUILD run (B1) reports the same sandbox denial [OWNER_ATTEMPT_ID: O1]' \
  "o/r" "https://x/2"
[ -f "$DEDUPE_TMP/curl_called" ] && CALLED=1 || CALLED=0
assert_eq "omitting comments_json/created_at skips the duplicate check (always eligible)" 1 "$CALLED"

rm -rf "$DEDUPE_TMP"
trap - EXIT
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
