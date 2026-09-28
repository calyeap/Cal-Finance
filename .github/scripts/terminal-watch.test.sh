#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }

run_case() {
  local actor="$1" mock_terminal="$2" expect_rc="$3" expect_block="$4"
  local mock_tag mock_attempt mock_start
  case "$actor" in
    BUILD) mock_tag=BUILD_ATTEMPT_ID; mock_attempt=B1; mock_start='BUILD START:' ;;
    REVIEW) mock_tag=REVIEW_ATTEMPT_ID; mock_attempt=R1; mock_start='REVIEW START:' ;;
    OWNER) mock_tag=OWNER_ATTEMPT_ID; mock_attempt=O1; mock_start='OWNER START:' ;;
  esac

  export GH_TOKEN=dummy TARGET_REPO=x/y TARGET_NUMBER=1 ACTOR="$actor" ATTEMPT_ID="$mock_attempt"
  export TERMINAL_LEASE_MINUTES=0 TERMINAL_POLL_SECONDS=1
  # shellcheck source=terminal-watch.sh
  source "${SCRIPT_DIR}/terminal-watch.sh"

  # mock_* names intentionally avoid terminal-watch main() locals; bash uses
  # dynamic scope for functions defined here.
  fetch_comments() {
    if [ -n "$mock_terminal" ]; then
      jq -n --arg start "$mock_start" --arg tag "$mock_tag" --arg id "$mock_attempt" --arg terminal "$mock_terminal" '[
        {body: ($start + " OUTCOME-ID=TEST [" + $tag + ": " + $id + "]"), created_at:"2026-09-28T01:00:00Z"},
        {body: ($terminal + " [" + $tag + ": " + $id + "]"), created_at:"2026-09-28T01:00:01Z"}
      ]'
    else
      jq -n --arg start "$mock_start" --arg tag "$mock_tag" --arg id "$mock_attempt" '[
        {body: ($start + " OUTCOME-ID=TEST [" + $tag + ": " + $id + "]"), created_at:"2026-09-28T01:00:00Z"}
      ]'
    fi
  }
  post_comment() { printf '%s' "$1" > "$TMP/block"; }

  rm -f "$TMP/block"
  set +e
  main >/dev/null 2>&1
  rc=$?
  set -e
  [ "$rc" -eq "$expect_rc" ] || fail "$actor rc expected $expect_rc got $rc"
  if [ "$expect_block" = yes ]; then
    [ -f "$TMP/block" ] || fail "$actor timeout did not post BLOCKED"
    grep -q '^BLOCKED: AI —' "$TMP/block" || fail "$actor timeout was not AI-owned BLOCKED"
    grep -q 'No automatic re-fire was attempted' "$TMP/block" || fail "$actor timeout does not prove no re-fire"
  else
    [ ! -f "$TMP/block" ] || fail "$actor healthy completion posted BLOCKED"
  fi
}

run_case BUILD 'DONE: https://example/pull/1' 0 no
run_case REVIEW 'ACCEPT: exact head verified' 0 no
run_case OWNER 'COMPLETE: parent complete' 0 no
run_case BUILD '' 1 yes
run_case REVIEW '' 1 yes
run_case OWNER '' 1 yes

# Structural tripwire: the watcher must never contain worker fire transport.
if grep -Eq 'curl .*FIRE|FIRE_URL|FIRE_TOKEN|recovery.*fire|RECOVERY_ATTEMPT' "${SCRIPT_DIR}/terminal-watch.sh"; then
  fail "terminal-watch contains re-fire/recovery transport"
fi

echo "terminal-watch: PASS"
