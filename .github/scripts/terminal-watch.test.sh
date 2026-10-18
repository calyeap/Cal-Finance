#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }

# Mocks below run inside terminal-watch's own $(...) command substitutions,
# so every observation they make goes through a file under $TMP rather than
# a shell variable a subshell could not propagate back.
#   $TMP/comments.json — the watched thread; post_comment appends to it.
#   $TMP/block         — the last comment terminal-watch posted.
#   $TMP/slack-calls   — one line per Slack webhook POST (curl).
#   $TMP/slack-payload — the last Slack payload sent.
#   $TMP/owner-relay   — touched if anything tries to relay to OWNER.

# setup_actor <actor> — exports the env terminal-watch.sh requires and seeds
# the thread with only this attempt's START receipt.
setup_actor() {
  local actor="$1"
  case "$actor" in
    BUILD) mock_tag=BUILD_ATTEMPT_ID; mock_attempt=BUILD-1-1; mock_start='BUILD START: OUTCOME-ID=TEST TIER=NORMAL' ;;
    REVIEW) mock_tag=REVIEW_ATTEMPT_ID; mock_attempt=REVIEW-1-1; mock_start='REVIEW START: OUTCOME-ID=TEST TIER=NORMAL' ;;
    OWNER) mock_tag=OWNER_ATTEMPT_ID; mock_attempt=OWNER-1-1; mock_start='OWNER START: wake=TERMINAL' ;;
  esac
  export GH_TOKEN=dummy TARGET_REPO=x/y TARGET_NUMBER=7 ACTOR="$actor" ATTEMPT_ID="$mock_attempt"
  export TERMINAL_LEASE_MINUTES=0 TERMINAL_POLL_SECONDS=1
  export SLACK_WEBHOOK_URL=https://hooks.example/test
  rm -f "$TMP/block" "$TMP/slack-calls" "$TMP/slack-payload" "$TMP/owner-relay"
  jq -n --arg body "${mock_start} · session cse_1 (${2:-https://claude.ai/code/cse_1}) [${mock_tag}: ${mock_attempt}]" \
    '[{body: $body, created_at: "2026-09-28T01:00:00Z"}]' > "$TMP/comments.json"
  install_mocks
}

# add_comment <body> <created_at>
add_comment() {
  jq --arg body "$1" --arg at "$2" '. + [{body: $body, created_at: $at}]' "$TMP/comments.json" > "$TMP/comments.next"
  mv "$TMP/comments.next" "$TMP/comments.json"
}

# install_mocks — (re)sources terminal-watch.sh for the current ACTOR (it
# derives its tag/start prefix at source time) and then overrides its I/O.
install_mocks() {
# shellcheck source=terminal-watch.sh
source "${SCRIPT_DIR}/terminal-watch.sh"

fetch_comments() { cat "$TMP/comments.json"; }
post_comment() {
  printf '%s' "$1" > "$TMP/block"
  add_comment "$1" "2026-09-28T02:31:00Z"
  printf '2026-09-28T02:31:00Z'
}
curl() {
  local arg prev=""
  for arg in "$@"; do
    [ "$prev" = --data ] && printf '%s' "$arg" > "$TMP/slack-payload"
    prev="$arg"
  done
  echo call >> "$TMP/slack-calls"
  printf '200'
}
terminal_relay_owner() { touch "$TMP/owner-relay"; }
fire_post() { touch "$TMP/owner-relay"; printf '200'; }
}

run_watch() {
  set +e
  main >/dev/null 2>&1
  rc=$?
  set -e
}

slack_calls() { [ -f "$TMP/slack-calls" ] && wc -l < "$TMP/slack-calls" | tr -d ' ' || echo 0; }

# --- 5. a normal terminal before the lease completes silently -------------
for actor in BUILD REVIEW OWNER; do
  setup_actor "$actor"
  case "$actor" in
    BUILD) add_comment "DONE: https://github.com/x/y/pull/9 [${mock_tag}: ${mock_attempt}]" "2026-09-28T01:30:00Z" ;;
    REVIEW) add_comment "ACCEPT: exact head verified [${mock_tag}: ${mock_attempt}]" "2026-09-28T01:30:00Z" ;;
    OWNER) add_comment "COMPLETE: parent complete [${mock_tag}: ${mock_attempt}]" "2026-09-28T01:30:00Z" ;;
  esac
  run_watch
  [ "$rc" -eq 0 ] || fail "$actor healthy completion rc expected 0 got $rc"
  [ ! -f "$TMP/block" ] || fail "$actor healthy completion posted a timeout receipt"
  [ "$(slack_calls)" = 0 ] || fail "$actor healthy completion sent Slack"
  [ ! -f "$TMP/owner-relay" ] || fail "$actor healthy completion relayed to OWNER"
done

# --- 1/2/3. every actor's timeout: one typed BLOCKED: ACTIONABLE, one direct
# Slack alert, no OWNER relay ----------------------------------------------
for actor in BUILD REVIEW OWNER; do
  setup_actor "$actor"
  run_watch
  [ "$rc" -eq 1 ] || fail "$actor timeout rc expected 1 got $rc"
  [ -f "$TMP/block" ] || fail "$actor timeout did not post a receipt"
  line="$(cat "$TMP/block")"
  case "$actor" in
    BUILD) label=needs-build-wake ;;
    REVIEW) label=needs-cc-rereview ;;
    OWNER) label=needs-owner-wake ;;
  esac
  grep -q '^BLOCKED: ACTIONABLE — ' <<< "$line" || fail "$actor timeout is not a typed BLOCKED: ACTIONABLE: $line"
  [ "$(grep -c '' <<< "$line")" = 1 ] || fail "$actor timeout receipt is not exactly one line"
  grep -qF "${actor} attempt ${mock_attempt}" <<< "$line" || fail "$actor timeout does not name actor + attempt id"
  grep -qF "[${mock_tag}: ${mock_attempt}]" <<< "$line" || fail "$actor timeout does not carry its attempt tag"
  grep -qF "0-minute lease" <<< "$line" || fail "$actor timeout does not name the configured lease"
  grep -qF "Session: https://claude.ai/code/cse_1" <<< "$line" || fail "$actor timeout does not carry the START session URL"
  grep -qF "https://github.com/x/y/issues/7" <<< "$line" || fail "$actor timeout does not link the watched item"
  grep -qF "\`${label}\` label to #7" <<< "$line" || fail "$actor timeout does not name its own re-drive label"
  grep -qF "not confirmed worker death" <<< "$line" || fail "$actor timeout must not claim the worker is dead"
  grep -qF "If it is still working, do nothing and do not re-drive" <<< "$line" || fail "$actor timeout must say a still-working worker is left alone"
  grep -qF "confirm no worker is active" <<< "$line" || fail "$actor timeout must make re-drive conditional on no active worker"
  grep -qF "If status is unknown, do not blindly re-drive" <<< "$line" || fail "$actor timeout must forbid blind re-drive on unknown status"
  grep -qF "No automatic re-fire" <<< "$line" || fail "$actor timeout does not prove no re-fire"
  ! grep -qiE '\bdead\b|DONE:|CORRECT' <<< "$line" || fail "$actor timeout uses wording a classifier/reader could misread: $line"
  [ "$(slack_calls)" = 1 ] || fail "$actor timeout sent $(slack_calls) Slack alerts, expected exactly 1"
  jq -r .text "$TMP/slack-payload" | head -n1 | grep -q '^ACTIONABLE BLOCKED — x/y$' || fail "$actor Slack alert is not ACTIONABLE BLOCKED"
  jq -r .text "$TMP/slack-payload" | grep -qF "do not blindly re-drive" || fail "$actor Slack alert lost the conditional recovery wording"
  [ ! -f "$TMP/owner-relay" ] || fail "$actor timeout relayed into OWNER"
done

# --- session URL is optional: "unknown" START URL is reported as such ------
setup_actor BUILD unknown
run_watch
grep -qF "Session: not available" "$TMP/block" || fail "an unknown START session URL must be reported as not available"

# --- #450 replay: expiry → exactly one alert, zero OWNER relay, no re-fire;
# then a late correlated worker DONE stays valid for normal REVIEW ---------
source "${SCRIPT_DIR}/runtime-lib.sh"
setup_actor BUILD
run_watch
[ "$rc" -eq 1 ] || fail "#450 replay: expiry did not fail the observe job visibly"
[ "$(slack_calls)" = 1 ] || fail "#450 replay: expected exactly one Slack incident"
[ ! -f "$TMP/owner-relay" ] || fail "#450 replay: timeout relayed into OWNER"
[ "$(jq '[.[] | select(.body | startswith("OWNER START:"))] | length' "$TMP/comments.json")" = 0 ] \
  || fail "#450 replay: an OWNER START appeared after expiry"
[ "$(jq '[.[] | select(.body | startswith("BUILD START:"))] | length' "$TMP/comments.json")" = 1 ] \
  || fail "#450 replay: a second BUILD was started on expiry"
TIMEOUT_LINE="$(cat "$TMP/block")"
# The GITHUB_TOKEN-authored timeout cannot wake fire-owner-on-terminal, and
# nothing in-job relays it; a replayed observation of the same attempt is a
# Slack duplicate, not a second incident.
assert_dup="$(runtime_slack_is_duplicate "$(cat "$TMP/comments.json")" "2026-09-28T02:40:00Z" "$TIMEOUT_LINE")"
[ "$assert_dup" = true ] || fail "#450 replay: restating the same attempt's timeout must dedupe"
# A different attempt's later timeout is a distinct incident.
OTHER_TIMEOUT="${TIMEOUT_LINE//BUILD-1-1/BUILD-2-1}"
[ "$(runtime_slack_is_duplicate "$(cat "$TMP/comments.json")" "2026-09-28T02:40:00Z" "$OTHER_TIMEOUT")" = false ] \
  || fail "#450 replay: a different attempt's timeout must not be swallowed as a duplicate"

# The original worker then posts its correlated DONE (#450 → PR #462).
LATE_DONE="DONE: https://github.com/x/y/pull/462 [BUILD_ATTEMPT_ID: BUILD-1-1]"
add_comment "$LATE_DONE" "2026-09-28T02:50:00Z"
[ "$(runtime_terminal_line "$LATE_DONE")" = "$LATE_DONE" ] || fail "#450 replay: late DONE is not its own terminal line"
[ "$(runtime_done_pr_number "$LATE_DONE")" = 462 ] || fail "#450 replay: late DONE no longer binds its PR for fire-review"
[ "$(runtime_actor_attempt_open "$(cat "$TMP/comments.json")" REVIEW)" = false ] \
  || fail "#450 replay: the synthetic timeout blocks REVIEW admission for the late DONE"
[ "$(runtime_is_child_terminal "$LATE_DONE")" = false ] || fail "#450 replay: late DONE would start an OWNER restatement"
[ "$(runtime_slack_kind "$LATE_DONE")" = none ] || fail "#450 replay: late DONE would claim a final Slack outcome"
[ "$(runtime_outcome_attempt_open "$(cat "$TMP/comments.json")" TEST)" = false ] \
  || fail "#450 replay: the outcome is left looking in-flight after the late DONE"

# Structural tripwire: the watcher must never contain worker fire transport
# or an OWNER relay hop.
if grep -Eq 'curl .*FIRE|FIRE_URL|FIRE_TOKEN|recovery.*fire|RECOVERY_ATTEMPT|terminal_relay_owner|terminal-relay\.sh' "${SCRIPT_DIR}/terminal-watch.sh"; then
  fail "terminal-watch contains re-fire/recovery transport or an OWNER relay"
fi

echo "terminal-watch: PASS"
