#!/usr/bin/env bash
# CF-OWNER-FASTPATH-SHADOW-01
#
# Deterministic, network-free control-flow tests for
# execution-ledger-guard.sh: stubs fetch_ledger_comments/post_ledger_comment
# with an in-memory comment list (append-only, exactly like the real
# tracking issue) so the record-intent -> complete-intent outbox flow, and
# its stale-intent reconciliation, can be exercised without gh/curl —
# mirroring owner-liveness-guard.test.sh's approach for the sibling guard.
#
# Output is always captured via a temp file rather than `$(...)` command
# substitution: cmd_record_intent/cmd_complete_intent both print to stdout
# AND mutate the (stubbed) LEDGER_COMMENTS global through post_ledger_
# comment, and `$(...)` would run the call in a subshell that silently
# drops that mutation once it exits.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

assert_contains() {
  local desc="$1" haystack="$2" needle="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "ok - $desc"
  else
    echo "not ok - $desc (expected to find [$needle] in [$haystack])"
    FAILURES=$((FAILURES + 1))
  fi
}

# Required env for the script's own `: "${VAR:?}"` guards inside main() —
# dummies, since fetch/post are stubbed below and main() is never actually
# invoked (sourcing only, exactly like owner-liveness-guard.test.sh).
export GH_TOKEN=dummy
export LEDGER_ISSUE_REPO=x/y
export LEDGER_ISSUE_NUMBER=213
export EVENT_KIND=OWNER_FIRE
export EVENT_KEY=MERGE-1000-1

# shellcheck source=execution-ledger-guard.sh
source "${SCRIPT_DIR}/execution-ledger-guard.sh"

# Ledger comment store backed by a real file rather than a bash variable —
# fetch_ledger_comments/post_ledger_comment are always called from inside a
# `$(...)` capture somewhere in the call chain (they return a string
# result the caller assigns), which runs them in a subshell; a plain bash
# variable mutation there would vanish exactly like it would not for the
# real gh api call this stands in for. A file, like the real tracking
# issue, persists across that subshell boundary.
LEDGER_STORE="$(mktemp)"
echo '[]' >"$LEDGER_STORE"

fetch_ledger_comments() {
  cat "$LEDGER_STORE"
}

post_ledger_comment() {
  local body="$1"
  jq -c --arg body "$body" --arg now "$(now_iso)" \
    '. + [{body:$body, created_at:$now}]' "$LEDGER_STORE" >"${LEDGER_STORE}.tmp"
  mv "${LEDGER_STORE}.tmp" "$LEDGER_STORE"
}

OUT_FILE="$(mktemp)"
trap 'rm -f "$OUT_FILE" "$LEDGER_STORE" "${LEDGER_STORE}.tmp"' EXIT

# run <fn> [args...]
# Runs fn directly in the current shell — never inside `$(...)`, which
# would fork a subshell and silently drop fn's LEDGER_COMMENTS mutation —
# redirecting its stdout+stderr into OUT_FILE. Read OUT_FILE separately
# (a plain `cat` substitution has no side effect of its own) to get the
# captured text.
run() {
  "$@" >"$OUT_FILE" 2>&1
}

# --- record-intent seeds a fresh ledger when the tracking issue is empty ---

run cmd_record_intent OWNER_FIRE "https://github.com/x/y/issues/9" 9
out="$(cat "$OUT_FILE")"
assert_contains "record-intent on an empty ledger reports it applied" "$out" "execution-ledger: applied"
intent_id_1="$(sed -n 's/^INTENT_ID=//p' <<<"$out")"
if [ -n "$intent_id_1" ]; then
  echo "ok - record-intent prints a non-empty INTENT_ID"
else
  echo "not ok - record-intent prints a non-empty INTENT_ID"
  FAILURES=$((FAILURES + 1))
fi

ledger_after_record="$(current_ledger)"
assert_eq "ledger has an open pending_intent after record-intent" "open" "$(jq -r '.pending_intent.status' <<<"$ledger_after_record")"
assert_eq "pending_intent carries the printed intent_id" "$intent_id_1" "$(jq -r '.pending_intent.intent_id' <<<"$ledger_after_record")"
assert_eq "record-intent's real writer sets state to active (not left at seed 'idle')" "active" "$(jq -r '.state' <<<"$ledger_after_record")"
assert_eq "record-intent's real writer sets active_outcome_id from the outcome_id argument" "9" "$(jq -r '.active_outcome_id' <<<"$ledger_after_record")"
assert_eq "record-intent's real writer sets active_attempt_id from EVENT_KEY" "$EVENT_KEY" "$(jq -r '.active_attempt_id' <<<"$ledger_after_record")"

# --- complete-intent clears it and applies the underlying event ------------

run cmd_complete_intent dispatched
complete_out="$(cat "$OUT_FILE")"
assert_contains "complete-intent reports the intent clear as applied" "$complete_out" "execution-ledger: applied"

ledger_after_complete="$(current_ledger)"
assert_eq "ledger has no pending_intent after complete-intent" "null" "$(jq -r '.pending_intent' <<<"$ledger_after_complete")"
assert_eq "ledger records the OWNER_FIRE event as last applied" "true" "$(jq -r '.recent_event_ids | length > 0' <<<"$ledger_after_complete")"
assert_eq "complete-intent leaves active_outcome_id set (persists until the next record-intent, not cleared just because the fire resolved)" "9" "$(jq -r '.active_outcome_id' <<<"$ledger_after_complete")"

# --- complete-intent with nothing pending is a clean no-op ------------------

run cmd_complete_intent dispatched
noop_out="$(cat "$OUT_FILE")"
assert_contains "complete-intent with no pending_intent is a no-op, not an error" "$noop_out" "nothing to do"

# --- a stale pending_intent is reconciled (abandoned) before a new one is --
# --- recorded, so a crashed prior run can never wedge the ledger -----------

echo '[]' >"$LEDGER_STORE"
export EVENT_KEY=MERGE-2000-1
run cmd_record_intent OWNER_FIRE "https://github.com/x/y/issues/20" 20
stuck_ledger="$(current_ledger)"
old_created_at="2020-01-01T00:00:00Z"
stuck_ledger="$(jq -c --arg t "$old_created_at" '.pending_intent.created_at = $t' <<<"$stuck_ledger")"
jq -nc --arg body "$(ledger_comment_body "$stuck_ledger")" --arg now "$old_created_at" \
  '[{body:$body, created_at:$now}]' >"$LEDGER_STORE"

export EVENT_KEY=MERGE-2000-2
run cmd_record_intent OWNER_FIRE "https://github.com/x/y/issues/21" 21
record_after_stall="$(cat "$OUT_FILE")"
assert_contains "record-intent reconciles an old pending_intent as abandoned first" "$record_after_stall" "reconciling as abandoned"

final_ledger="$(current_ledger)"
assert_eq "after reconciliation, the ledger holds only the new pending_intent" "https://github.com/x/y/issues/21" "$(jq -r '.pending_intent.target' <<<"$final_ledger")"

# --- reviewer-requested coverage: exercise the stall sweep's classifier ----
# --- against a ledger produced by the REAL production writers above, not --
# --- a hand-built fixture (PR #214 review) ----------------------------------

# shellcheck source=stall-sweep-lib.sh
source "${SCRIPT_DIR}/stall-sweep-lib.sh"

echo '[]' >"$LEDGER_STORE"
export EVENT_KEY=MERGE-3000-1
run cmd_record_intent OWNER_FIRE "https://github.com/x/y/issues/30" 30
run cmd_complete_intent dispatched
real_ledger="$(current_ledger)"

real_status="$(stall_sweep_status "$(jq -r '.state' <<<"$real_ledger")" false false false false "$([ -n "$(jq -r '.active_outcome_id // empty' <<<"$real_ledger")" ] && echo true || echo false)")"
assert_eq "a ledger produced end-to-end by record-intent+complete-intent is reachable by stall_sweep_status (not stuck at the seed's idle/null forever)" \
  "stall" "$real_status"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "execution-ledger-guard.test.sh: all checks passed"
  exit 0
else
  echo "execution-ledger-guard.test.sh: $FAILURES check(s) failed"
  exit 1
fi
