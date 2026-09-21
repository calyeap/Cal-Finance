#!/usr/bin/env bash
# CF-OWNER-SINGLE-WRITER-01
#
# Pure, network-free classification helpers that detect whether an OWNER
# attempt is currently active anywhere in the repository — not just on one
# wake target. Closes issue #197's observed failure: multiple
# CALBOARD-OWNER attempts (fired from owner-on-merge.yml's merge wake and
# cc-auto-fire.yml's terminal wake, on different issues/PRs) overlapped and
# raced the same Cal Finance Project Home write.
#
# These functions consume a JSON array of comments already fetched
# repo-wide (not scoped to one issue), each shaped
# {"body":..,"created_at":..,"issue_number":..} — the caller is responsible
# for turning the GitHub REST "list issue comments for a repository"
# response's issue_url into issue_number before calling in. No gh/curl
# calls happen in this file, so the classification/holder logic can be
# exercised deterministically in CI.
#
# This reuses the exact terminal-receipt contract owner-liveness-lib.sh
# already enforces (OWNER.md's "Liveness correlation" rule: a typed
# terminal first line carrying "[OWNER_ATTEMPT_ID: <id>]"), plus the
# "OWNER LIVENESS EXHAUSTED" durable receipt that also ends an attempt's
# hold without a normal terminal result. An attempt is the active holder
# only while none of those have appeared yet on its own issue, and only
# within a bounded max age — an orphaned START (e.g. from an undiscovered
# bug) must not deadlock admission forever.

set -uo pipefail

# owner_single_writer_holder <comments_json> <now_iso> [<max_age_minutes>]
# Finds the most recently started "OWNER ATTEMPT START: <id>" (an original
# or "-recovery-N" attempt id) that has no correlated resolution after it
# on the SAME issue_number, and that started no more than max_age_minutes
# (default 50 — two 20-minute lease windows plus a buffer, matching
# owner-liveness-guard.sh's own bound) before now_iso. Prints that holder
# as compact JSON ({"id":..,"issue_number":..,"created_at":..}), or nothing
# if no unresolved, non-stale holder exists.
owner_single_writer_holder() {
  local comments_json="$1" now_iso="$2" max_age_minutes="${3:-50}"

  jq -c \
    --arg now "$now_iso" \
    --argjson max_age_minutes "$max_age_minutes" \
    '
    def first_nonblank_line:
      (. // "")
      | split("\n")
      | map(select(test("[^\\s]")))
      | (.[0] // "")
      | sub("^\\s+"; "");

    def is_resolution($tag):
      first_nonblank_line as $line
      | ($line | startswith("OWNER LIVENESS EXHAUSTED"))
        or (($line | contains($tag))
            and ($line | test("^(DISPATCHED:|WAIT: (AI|EXTERNAL|PARKED)\\s*[—-]|CALVIN REQUIRED:)")));

    (. ) as $all
    | ($all
        | map(select(.body | first_nonblank_line | startswith("OWNER ATTEMPT START: ")))
        | map(. + {
            attempt_id: (.body | first_nonblank_line | sub("^OWNER ATTEMPT START: "; ""))
          })
      ) as $starts
    | ($starts
        | map(
            . as $start
            | ($start.attempt_id) as $id
            | ($all
                | map(select(.issue_number == $start.issue_number and .created_at > $start.created_at))
                | map(select(.body | is_resolution("[OWNER_ATTEMPT_ID: " + $id + "]")))
                | length
              ) as $resolved_count
            | $start + {resolved: ($resolved_count > 0)}
          )
        | map(select(.resolved == false))
        | map(select(
            (($now | strptime("%Y-%m-%dT%H:%M:%SZ") | mktime)
             - (.created_at | strptime("%Y-%m-%dT%H:%M:%SZ") | mktime)) <= ($max_age_minutes * 60)
          ))
        | sort_by(.created_at)
        | (.[-1] // empty)
        | if . == null then empty else {id: .attempt_id, issue_number: .issue_number, created_at: .created_at} end
      )
    ' <<<"$comments_json"
}

# owner_single_writer_status <comments_json> <now_iso> [<max_age_minutes>]
# Echoes "active" or "clear".
owner_single_writer_status() {
  local comments_json="$1" now_iso="$2" max_age_minutes="${3:-50}"
  local holder
  holder="$(owner_single_writer_holder "$comments_json" "$now_iso" "$max_age_minutes")"
  if [ -n "$holder" ]; then
    echo "active"
  else
    echo "clear"
  fi
}
