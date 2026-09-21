#!/usr/bin/env bash
# CF-OWNER-SINGLE-WRITER-01
#
# Runs immediately before either native OWNER fire path (owner-on-merge.yml's
# merge wake, cc-auto-fire.yml's terminal wake) posts its own
# "OWNER ATTEMPT START:" receipt and fires CALBOARD-OWNER. Records, using
# owner-single-writer-lib.sh's repo-wide holder check, whether another
# OWNER attempt is currently unresolved anywhere in the repository — this
# is the exact situation issue #197 documented as overlapping OWNER writes
# racing Cal Finance Project Home.
#
# This script is advisory and always exits 0: it never blocks or retries
# the fire itself. The actual single-writer guarantee — the thing that
# makes overlapping commits impossible — is the `cf-owner-single-writer`
# concurrency group both fire-owner-on-merge (owner-on-merge.yml) and
# fire-owner-on-terminal (cc-auto-fire.yml) declare (see
# owner-single-writer-config.test.sh): GitHub Actions runs at most one job
# in that group at a time, queues a second arrival behind it, and — if a
# third arrives while the second is still queued — cancels the queued one
# in favour of the newest, so a later wake is never lost and a stale wake
# never runs after a newer one. That queuing already fully serializes the
# fire step below; this script exists only to leave a readable audit trail
# explaining *why* a given attempt may have queued, and as the tested,
# reusable holder-detection this repo can reason about (see
# owner-single-writer-lib.test.sh) independent of platform behaviour.
#
# Required env: GH_TOKEN, TARGET_REPO, TARGET_NUMBER, ATTEMPT_ID.
# Optional env: OWNER_SINGLE_WRITER_MAX_AGE_MINUTES (default 50 — two
# 20-minute OWNER liveness lease windows plus a buffer, matching
# owner-liveness-guard.sh's own worst-case bound).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=owner-single-writer-lib.sh
source "${SCRIPT_DIR}/owner-single-writer-lib.sh"

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${TARGET_REPO:?TARGET_REPO is required}"
: "${TARGET_NUMBER:?TARGET_NUMBER is required}"
: "${ATTEMPT_ID:?ATTEMPT_ID is required}"

MAX_AGE_MINUTES="${OWNER_SINGLE_WRITER_MAX_AGE_MINUTES:-50}"

fetch_repo_comments_since() {
  local since="$1"
  gh api --paginate \
    "repos/${TARGET_REPO}/issues/comments?since=${since}&sort=created&direction=asc" \
    --jq '[.[] | {body: .body, created_at: .created_at, issue_number: (.issue_url | capture("/issues/(?<n>[0-9]+)$").n | tonumber)}]' \
    | jq -s 'add // []'
}

main() {
  local now since comments status holder
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  since="$(date -u -d "-${MAX_AGE_MINUTES} minutes" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
    || date -u -v -"${MAX_AGE_MINUTES}"M +%Y-%m-%dT%H:%M:%SZ)"

  comments="$(fetch_repo_comments_since "$since")"
  status="$(owner_single_writer_status "$comments" "$now" "$MAX_AGE_MINUTES")"

  if [ "$status" != "active" ]; then
    echo "owner-single-writer: no other unresolved OWNER attempt found; ${ATTEMPT_ID} is clear to fire."
    exit 0
  fi

  holder="$(owner_single_writer_holder "$comments" "$now" "$MAX_AGE_MINUTES")"
  local holder_id holder_issue
  holder_id="$(jq -r '.id' <<<"$holder")"
  holder_issue="$(jq -r '.issue_number' <<<"$holder")"

  echo "owner-single-writer: attempt ${holder_id} on #${holder_issue} is still unresolved; ${ATTEMPT_ID} will queue behind the cf-owner-single-writer concurrency group."

  gh api --method POST \
    "repos/${TARGET_REPO}/issues/${TARGET_NUMBER}/comments" \
    -f body="$(printf 'OWNER ADMISSION: attempt %s on #%s is still unresolved; this attempt (%s) queues behind the cf-owner-single-writer concurrency group and will fire once it clears — see CF-OWNER-SINGLE-WRITER-01.' \
      "$holder_id" "$holder_issue" "$ATTEMPT_ID")" >/dev/null
  exit 0
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main
fi
