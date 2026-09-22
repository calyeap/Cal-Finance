#!/usr/bin/env bash
# CF-GATE-PUSH-01 (issue #221)
#
# Deterministic, network-free tests for calvin-gate-push-lib.sh's dedupe
# key/marker and payload contract. Covers the outcome's own DONE WHEN:
# one OPEN gate -> one push attempt, duplicate/retry of the same
# unchanged gate -> no duplicate push, and the message contains only
# Project / Gate ID / Ask.
#
# Run directly with `bash .github/scripts/calvin-gate-push-lib.test.sh`;
# wired into CI (.github/workflows/ci.yml) alongside the other .test.sh
# scripts.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=calvin-gate-push-lib.sh
source "${SCRIPT_DIR}/calvin-gate-push-lib.sh"

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
  local desc="$1"
  if "${@:2}"; then
    echo "ok - $desc"
  else
    echo "not ok - $desc"
    FAILURES=$((FAILURES + 1))
  fi
}

assert_false() {
  local desc="$1"
  if ! "${@:2}"; then
    echo "ok - $desc"
  else
    echo "not ok - $desc"
    FAILURES=$((FAILURES + 1))
  fi
}

# --- dedupe key: stable for the same (gate, ask), distinct otherwise -----

key_a=$(calvin_gate_push_dedupe_key "GATE-1" "Approve provider X")
key_a_again=$(calvin_gate_push_dedupe_key "GATE-1" "Approve provider X")
assert_eq "dedupe key is stable for the same gate id + ask" "$key_a" "$key_a_again"

key_b=$(calvin_gate_push_dedupe_key "GATE-1" "Approve provider Y")
if [ "$key_a" != "$key_b" ]; then
  echo "ok - dedupe key changes when the ask changes on the same gate id"
else
  echo "not ok - dedupe key changes when the ask changes on the same gate id"
  FAILURES=$((FAILURES + 1))
fi

key_c=$(calvin_gate_push_dedupe_key "GATE-2" "Approve provider X")
if [ "$key_a" != "$key_c" ]; then
  echo "ok - dedupe key changes when the gate id changes for the same ask"
else
  echo "not ok - dedupe key changes when the gate id changes for the same ask"
  FAILURES=$((FAILURES + 1))
fi

# --- marker format ---------------------------------------------------------

marker=$(calvin_gate_push_marker "$key_a")
assert_eq "marker is prefixed with the CALVIN GATE PUSH SENT: literal" "CALVIN GATE PUSH SENT: $key_a" "$marker"

# --- already-sent detection: keyed off a fresh comment's own first line --

no_comments=$(jq -n '[]')
result=$(calvin_gate_push_already_sent "$no_comments" "$key_a")
assert_eq "no comments at all reads not-already-sent" "false" "$result"

unrelated=$(jq -n '[{body: "BUILD FIRED: HTTP 200 · session x"}]')
result=$(calvin_gate_push_already_sent "$unrelated" "$key_a")
assert_eq "an unrelated comment reads not-already-sent" "false" "$result"

sent=$(jq -n --arg marker "$marker" '[{body: $marker}]')
result=$(calvin_gate_push_already_sent "$sent" "$key_a")
assert_eq "the exact marker as a comment's first line reads already-sent" "true" "$result"

sent_with_trailer=$(jq -n --arg marker "$marker" '[{body: ($marker + "\n\nOK.")}]')
result=$(calvin_gate_push_already_sent "$sent_with_trailer" "$key_a")
assert_eq "the marker as the first line, with trailing prose, still reads already-sent" "true" "$result"

quoted=$(jq -n --arg marker "$marker" '[{body: ("saw this earlier: " + $marker)}]')
result=$(calvin_gate_push_already_sent "$quoted" "$key_a")
assert_eq "the marker text quoted mid-comment (not the first line) does not read already-sent" "false" "$result"

different_key_sent=$(jq -n '[{body: "CALVIN GATE PUSH SENT: GATE-9:aaaaaaaaaaaaaaaa"}]')
result=$(calvin_gate_push_already_sent "$different_key_sent" "$key_a")
assert_eq "a marker for a different dedupe key does not suppress this one" "false" "$result"

# --- payload: exactly Project / Gate ID / Ask, nothing else --------------

payload=$(calvin_gate_push_payload "Cal Finance" "GATE-1" "Approve provider X")
keys=$(printf '%s' "$payload" | jq -cS 'keys')
assert_eq "payload has exactly the project/gate_id/ask keys" '["ask","gate_id","project"]' "$keys"

project_val=$(printf '%s' "$payload" | jq -r '.project')
gate_id_val=$(printf '%s' "$payload" | jq -r '.gate_id')
ask_val=$(printf '%s' "$payload" | jq -r '.ask')
assert_eq "payload.project carries the exact project" "Cal Finance" "$project_val"
assert_eq "payload.gate_id carries the exact gate id" "GATE-1" "$gate_id_val"
assert_eq "payload.ask carries the exact ask" "Approve provider X" "$ask_val"

# --- config readiness -------------------------------------------------------

assert_true "config is ready when a webhook URL is set" calvin_gate_push_config_ready "https://example.invalid/push"
assert_false "config is not ready when the webhook URL is empty" calvin_gate_push_config_ready ""

# --- latest terminal marker + Ask extraction: how cc-auto-fire.yml tells
# a genuine CALVIN REQUIRED gate apart from a STOP once both are already
# inside the job the needs-owner-wake label admits ------------------------

calvin_required_thread=$(jq -n '
  [
    {body: "BUILD FIRED: HTTP 200 · session x", created_at: "2026-09-22T15:00:00Z"},
    {body: "CALVIN REQUIRED: which provider, exact secret, where to get it?", created_at: "2026-09-22T15:16:00Z"}
  ]
')
latest=$(calvin_gate_push_latest_terminal "$calvin_required_thread")
assert_eq "the latest terminal marker on an open CALVIN REQUIRED thread is CALVIN REQUIRED:" "CALVIN REQUIRED: which provider, exact secret, where to get it?" "$latest"

ask=$(calvin_gate_push_ask_from_first_line "$latest")
assert_eq "the Ask is extracted verbatim after the marker" "which provider, exact secret, where to get it?" "$ask"

stop_thread=$(jq -n '
  [{body: "STOP: TARGET AMBIGUOUS — cannot identify the linked issue", created_at: "2026-09-22T15:16:00Z"}]
')
latest=$(calvin_gate_push_latest_terminal "$stop_thread")
assert_eq "the latest terminal marker on a STOP thread is STOP:, not a gate" "STOP: TARGET AMBIGUOUS — cannot identify the linked issue" "$latest"
ask=$(calvin_gate_push_ask_from_first_line "$latest")
assert_eq "a STOP: first line never yields an Ask (STOP is not a Calvin Gate)" "" "$ask"

no_terminal=$(jq -n '[{body: "Sounds good.", created_at: "2026-09-22T15:16:00Z"}]')
latest=$(calvin_gate_push_latest_terminal "$no_terminal")
assert_eq "no terminal marker at all yields an empty latest terminal" "" "$latest"

tagged=$(jq -n '
  [{body: "CALVIN REQUIRED: approve option A or option B [OWNER_ATTEMPT_ID: TERMINAL-50-1]", created_at: "2026-09-22T15:16:00Z"}]
')
latest=$(calvin_gate_push_latest_terminal "$tagged")
ask=$(calvin_gate_push_ask_from_first_line "$latest")
assert_eq "OWNER's own liveness-correlation tag is stripped from the extracted Ask" "approve option A or option B" "$ask"

superseded=$(jq -n '
  [
    {body: "CALVIN REQUIRED: approve option A or option B", created_at: "2026-09-22T15:16:00Z"},
    {body: "DONE: https://github.com/x/y/pull/12", created_at: "2026-09-22T15:30:00Z"}
  ]
')
latest=$(calvin_gate_push_latest_terminal "$superseded")
assert_eq "a later DONE: superseding an old CALVIN REQUIRED reads as the current terminal marker" "DONE: https://github.com/x/y/pull/12" "$latest"
ask=$(calvin_gate_push_ask_from_first_line "$latest")
assert_eq "a superseded CALVIN REQUIRED never yields an Ask once DONE: supersedes it" "" "$ask"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "calvin-gate-push-lib.test.sh: all checks passed"
  exit 0
else
  echo "calvin-gate-push-lib.test.sh: $FAILURES check(s) failed"
  exit 1
fi
