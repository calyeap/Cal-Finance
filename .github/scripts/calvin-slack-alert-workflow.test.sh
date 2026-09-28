#!/usr/bin/env bash
# CF-WORKFLOW-PROOF-SLACK-FAILOPEN-01
#
# Regression guard for the exact "Send Slack terminal" step wiring in
# calvin-slack-alert.yml, not just the calvin-slack-notify.sh functions it
# calls. #368 REVIEW (REVIEW-36444948457-1) found that step's own prior-
# comments `gh api` fetch ran ahead of calvin_slack_send under
# `set -euo pipefail`: a transient fetch failure aborted the whole step
# before the send, silently dropping the terminal. #368 fixed it with
# `... || comments=""` so a failed fetch degrades to "skip the duplicate
# check", never "skip the alert". Unit-testing calvin-slack-notify.sh alone
# cannot catch a regression of that fallback, because the fallback lives in
# the workflow step's own inline script, not in that sourced file.
#
# This test extracts the live "Send Slack terminal" run: block straight out
# of the workflow YAML (no YAML-parsing dependency — the block is plain,
# consistently indented text) and executes that exact script with a failing
# `gh` stub, so a future edit that drops the fallback (or otherwise makes
# the send unreachable after a fetch failure) fails this test without
# needing to be duplicated by hand.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

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

WORKFLOW=.github/workflows/calvin-slack-alert.yml

# Extract the "Send Slack terminal" step's run: block verbatim. The step is
# a fixed, plainly-indented block scalar (10-space content under an 8-space
# `run: |`), so a small awk pass is enough — no yq/YAML-library dependency
# is added to prove this.
RUN_SCRIPT="$(awk '
  /^      - name: Send Slack terminal$/ { instep=1 }
  instep && /^        run: \|$/ { inrun=1; next }
  instep && inrun {
    if ($0 ~ /^          /) { print substr($0, 11) }
    else { exit }
  }
' "$WORKFLOW")"

if [ -z "$RUN_SCRIPT" ]; then
  echo "not ok - extracted the live 'Send Slack terminal' run: block (got nothing — step renamed/reshaped?)"
  FAILURES=$((FAILURES + 1))
  echo
  echo "calvin-slack-alert-workflow.test.sh: $FAILURES check(s) failed"
  exit 1
fi
case "$RUN_SCRIPT" in
  *"gh api"*"calvin_slack_send"*)
    echo "ok - extracted the live 'Send Slack terminal' run: block"
    ;;
  *)
    echo "not ok - extracted run: block missing expected gh api / calvin_slack_send wiring"
    FAILURES=$((FAILURES + 1))
    ;;
esac

MARKER_DIR="$(mktemp -d)"
trap 'rm -rf "$MARKER_DIR"' EXIT
CURL_MARKER="$MARKER_DIR/curl_called"

run_step() {
  # Runs the extracted script exactly as the workflow would, from repo
  # root, with only the two network boundaries (gh, curl) stubbed.
  env -i \
    PATH="$PATH" \
    BASH_FUNC_gh%%="$GH_STUB" \
    BASH_FUNC_curl%%="$CURL_STUB" \
    SLACK_WEBHOOK_URL="$1" SLACK_LINE="$2" SLACK_REPO="$3" \
    SLACK_NUMBER="$4" SLACK_COMMENT_URL="$5" SLACK_CREATED_AT="$6" \
    GH_TOKEN="x" \
    bash -c "$RUN_SCRIPT"
}

# --- scenario 1: the prior-comments fetch fails outright (the #368 class)
# -- the send must still happen -------------------------------------------

GH_STUB='() { return 1
}'
CURL_STUB='() { touch "'"$CURL_MARKER"'"; echo -n 200
}'

rm -f "$CURL_MARKER"
set +e
run_step "https://hooks.example/test" \
  "COMPLETE: workflow proof regression guard" \
  "o/r" "1" "https://x/1" "2026-09-28T16:00:00Z"
rc=$?
set -e
assert_eq "step does not abort when the prior-comments fetch fails" 0 "$rc"
[ -f "$CURL_MARKER" ] && CALLED=1 || CALLED=0
assert_eq "Slack send still reached (fail-open) after the fetch fails" 1 "$CALLED"

# --- scenario 2: the fetch succeeds and returns the same-blocker restated
# by OWNER (the #365 dedupe class) -- duplicate suppression must still work
# through the live wiring, not just in the sourced function -------------

GH_STUB='() { echo '"'"'[{"body": "BLOCKED: ACTIONABLE - sandbox denies commit [BUILD_ATTEMPT_ID: B1]", "created_at": "2026-09-28T15:10:00Z"}, {"body": "OWNER START: wake=TERMINAL [OWNER_ATTEMPT_ID: O1]", "created_at": "2026-09-28T15:11:00Z"}]'"'"'
}'

rm -f "$CURL_MARKER"
set +e
run_step "https://hooks.example/test" \
  'BLOCKED: ACTIONABLE — child BUILD run (B1) reports the same sandbox denial [OWNER_ATTEMPT_ID: O1]' \
  "o/r" "2" "https://x/2" "2026-09-28T15:12:00Z"
rc=$?
set -e
assert_eq "step does not abort when the prior-comments fetch succeeds" 0 "$rc"
[ -f "$CURL_MARKER" ] && CALLED=1 || CALLED=0
assert_eq "a successful fetch still lets duplicate suppression block the send" 0 "$CALLED"

# --- scenario 3: same successful fetch, but a genuinely distinct new
# blocker -- suppression must not be over-broad; the send must go out ----

rm -f "$CURL_MARKER"
set +e
run_step "https://hooks.example/test" \
  'BLOCKED: ACTIONABLE — separate, unrelated permission is needed for the payments export [OWNER_ATTEMPT_ID: O1]' \
  "o/r" "2" "https://x/2" "2026-09-28T15:12:00Z"
rc=$?
set -e
assert_eq "step does not abort for a distinct new blocker" 0 "$rc"
[ -f "$CURL_MARKER" ] && CALLED=1 || CALLED=0
assert_eq "a distinct new blocker still sends through the live wiring" 1 "$CALLED"

rm -rf "$MARKER_DIR"
trap - EXIT

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "calvin-slack-alert-workflow.test.sh: all checks passed"
  exit 0
else
  echo "calvin-slack-alert-workflow.test.sh: $FAILURES check(s) failed"
  exit 1
fi
