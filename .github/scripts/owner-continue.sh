#!/usr/bin/env bash
# CF-CONTINUE-SCRIPT-01 (issue #402)
#
# OWNER's deterministic CONTINUE handoff. OWNER decides *whether* a
# pre-existing authorised next target is ready; this helper guarantees
# *whether the wake actually happened*. It replaces the CF-CONTINUE-WAKE-
# VERIFY-01 (issue #396) prose protocol, which left apply / read-back /
# retry / idempotency to the model and still allowed a claimed CONTINUE
# whose `needs-build-wake` mutation never landed.
#
# Usage: owner-continue.sh <repo> <target_number> <outcome_id>
#                          <owner_wake_number> <owner_attempt_id>
#
# 1. Re-check the target against fire-build's own admission rules
#    (runtime_admission_decision). A closed target, an OUTCOME-ID mismatch,
#    an open PR already owning the outcome or a conflict is a refusal: no
#    wake, no post, exit 3 — OWNER's precondition does not hold, so OWNER
#    ends with a non-CONTINUE terminal itself.
# 2. The wake counts as landed when needs-build-wake is on the target, a
#    BUILD attempt for the outcome is already active, or a BUILD receipt
#    newer than this handoff proves fire-build consumed it
#    (runtime_build_wake_consumed).
# 3. Otherwise apply the label once, read back, and on failure retry on
#    fire_post's CF-FIRE-RETRY-01 schedule (immediate, then 10s/30s/60s; 4
#    attempts total), re-reading state before every retry so a wake that
#    already landed is never applied twice.
# 4. Post exactly one OWNER terminal on <owner_wake_number>, tagged with
#    <owner_attempt_id>, and print it: `CONTINUE:` only after a verified
#    handoff (exit 0), else `BLOCKED: ACTIONABLE` naming the re-drive
#    (exit 1). Exit 4 means that terminal was decided but could not be
#    posted; the printed line is the one to post verbatim.
#
# No new workflow, wake path, state store or poller: it uses the existing
# needs-build-wake label, fire-build admission and durable GitHub receipts.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=runtime-lib.sh
source "${SCRIPT_DIR}/runtime-lib.sh"

if [ "$#" -ne 5 ]; then
  echo "usage: owner-continue.sh <repo> <target_number> <outcome_id> <owner_wake_number> <owner_attempt_id>" >&2
  exit 2
fi
REPO="$1" TARGET="$2" OUTCOME_ID="$3" WAKE="$4" OWNER_ATTEMPT="$5"
LABEL="$(runtime_actor_wake_label BUILD)"
TAG="$(runtime_attempt_tag OWNER)"
DELAYS=(10 30 60)

fetch_target() { gh api "repos/${REPO}/issues/${TARGET}"; }
fetch_comments() {
  gh api --paginate "repos/${REPO}/issues/${TARGET}/comments" \
    | jq -s '[ add // [] | .[] | {id: .id, body: .body, created_at: .created_at} ]'
}

# wake_landed <baseline_id> — re-reads the target; echoes true only on
# positive evidence. A failed read is never evidence.
wake_landed() {
  local baseline="$1" target comments
  target="$(fetch_target)" || { echo false; return; }
  if [ "$(jq --arg l "$LABEL" '[.labels[]?.name] | index($l) != null' <<< "$target")" = true ]; then
    echo true; return
  fi
  comments="$(fetch_comments)" || { echo false; return; }
  if [ "$(runtime_outcome_attempt_open "$comments" "$OUTCOME_ID")" = true ] \
    || [ "$(runtime_build_wake_consumed "$comments" "$OUTCOME_ID" "$baseline")" = true ]; then
    echo true; return
  fi
  echo false
}

# finish <line> <exit_code> — posts the one terminal and prints it.
finish() {
  local line="$1" rc="$2"
  printf '%s\n' "$line"
  if ! gh api --method POST "repos/${REPO}/issues/${WAKE}/comments" -f body="$line" >/dev/null; then
    echo "POST FAILED: terminal not posted on #${WAKE}; post the line above verbatim" >&2
    exit 4
  fi
  exit "$rc"
}

refuse() {
  echo "REFUSED: $1 — no wake applied, no terminal posted" >&2
  exit 3
}

# 1. Admission re-check.
TARGET_JSON="$(fetch_target)" || refuse "could not read #${TARGET}"
[ "$(jq -r '.state // "open"' <<< "$TARGET_JSON")" = open ] || refuse "#${TARGET} is not open"
TARGET_OUTCOME="$(runtime_outcome_id "$(jq -r '.body // ""' <<< "$TARGET_JSON")")"
[ "$TARGET_OUTCOME" = "$OUTCOME_ID" ] || refuse "#${TARGET} carries OUTCOME-ID '${TARGET_OUTCOME}', not '${OUTCOME_ID}'"
COMMENTS="$(fetch_comments)" || refuse "could not read #${TARGET} comments"
BASELINE="$(jq '[.[].id] | max // 0' <<< "$COMMENTS")"
ATTEMPT_OPEN="$(runtime_outcome_attempt_open "$COMMENTS" "$OUTCOME_ID")"

OPEN_ITEMS="$(gh api --paginate "repos/${REPO}/issues?state=open&per_page=100" | jq -s 'add // []')" \
  || refuse "could not list open items"
MATCH_ISSUES=""
MATCH_PRS=""
while IFS= read -r item; do
  [ -z "$item" ] && continue
  number="$(jq -r '.number' <<< "$item")"
  [ "$number" = "$TARGET" ] && continue
  [ "$(runtime_outcome_id "$(jq -r '.body // ""' <<< "$item")")" = "$OUTCOME_ID" ] || continue
  if [ "$(jq -r 'has("pull_request")' <<< "$item")" = true ]; then
    MATCH_PRS="${MATCH_PRS:+${MATCH_PRS},}${number}"
  else
    MATCH_ISSUES="${MATCH_ISSUES:+${MATCH_ISSUES},}${number}"
  fi
done < <(jq -c '.[]' <<< "$OPEN_ITEMS")

DECISION="$(runtime_admission_decision issue "$TARGET" "$MATCH_ISSUES" "$MATCH_PRS" "$ATTEMPT_OPEN")"
case "$DECISION" in
  ADMIT|IN_FLIGHT) ;;
  *) refuse "admission for ${OUTCOME_ID} on #${TARGET} is ${DECISION}" ;;
esac

CONTINUE_LINE="CONTINUE: #${TARGET} / ${OUTCOME_ID} [${TAG}: ${OWNER_ATTEMPT}]"

# 2–3. Verify, apply once when needed, bounded retry with re-read first.
attempt=0
while :; do
  if [ "$attempt" -gt 0 ]; then
    sleep "${DELAYS[$((attempt - 1))]}"
  fi
  [ "$(wake_landed "$BASELINE")" = true ] && finish "$CONTINUE_LINE" 0
  gh api --method POST "repos/${REPO}/issues/${TARGET}/labels" -f "labels[]=${LABEL}" >/dev/null || true
  attempt=$((attempt + 1))
  [ "$(wake_landed "$BASELINE")" = true ] && finish "$CONTINUE_LINE" 0
  [ "$attempt" -ge 4 ] && break
done

# 4. Exhausted without a verified handoff.
finish "BLOCKED: ACTIONABLE — CONTINUE wake mutation to #${TARGET} (${OUTCOME_ID}) could not be verified after 4 attempts; reapply the \`${LABEL}\` label to #${TARGET} to deterministically re-drive. [${TAG}: ${OWNER_ATTEMPT}]" 1
