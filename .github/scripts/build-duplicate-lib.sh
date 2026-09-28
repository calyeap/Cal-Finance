#!/usr/bin/env bash
# CF-OUTCOME-LOOP-LEAN-01
#
# Pure, network-free BUILD admission helpers.
#
# Two layers protect the one-OUTCOME-ID / one-execution invariant:
# 1. target-local in-flight detection from BUILD FIRED -> terminal comments;
# 2. outcome-level open-PR detection so a new issue wake cannot create a
#    second active PR for an OUTCOME-ID that already has one.
#
# Network/API calls stay in cc-auto-fire.yml; this file only classifies the
# supplied JSON/text so CI can exercise the decision deterministically.

set -uo pipefail

build_duplicate_first_line() {
  local body="$1"
  printf '%s' "$body" \
    | sed -e '/[^[:space:]]/,$!d' -e 's/^[[:space:]]*//' \
    | head -n1 \
    | sed -e 's/[[:space:]]*$//'
}

build_duplicate_is_terminal_first_line() {
  local first_line="$1"
  case "$first_line" in
    DONE:*|BLOCKED:*|STOP:*|"CALVIN REQUIRED:"*) return 0 ;;
    *) return 1 ;;
  esac
}

build_duplicate_status() {
  local comments_json="$1"
  local last_fired_at
  last_fired_at="$(jq -r '
    map(select(.body | startswith("BUILD FIRED:")))
    | sort_by(.created_at)
    | (.[-1].created_at // empty)
  ' <<<"$comments_json")"

  if [ -z "$last_fired_at" ]; then
    echo "clear"
    return
  fi

  local after_json count i body first_line
  after_json="$(jq -c --arg after "$last_fired_at" '
    map(select(.created_at > $after)) | sort_by(.created_at)
  ' <<<"$comments_json")"
  count="$(jq 'length' <<<"$after_json")"

  for ((i = 0; i < count; i++)); do
    body="$(jq -r ".[$i].body" <<<"$after_json")"
    first_line="$(build_duplicate_first_line "$body")"
    if build_duplicate_is_terminal_first_line "$first_line"; then
      echo "clear"
      return
    fi
  done

  echo "duplicate"
}

# build_outcome_id_from_body <markdown>
# Supports both common repo forms:
#   OUTCOME-ID: `ABC-01`
#   ## OUTCOME-ID\n\n`ABC-01`
build_outcome_id_from_body() {
  local body="$1" direct after

  direct="$(printf '%s\n' "$body" \
    | sed -nE 's/.*OUTCOME-ID[[:space:]]*:[[:space:]]*`?([A-Za-z0-9._\/-]+)`?.*/\1/p' \
    | head -n1)"
  if [ -n "$direct" ]; then
    printf '%s\n' "$direct"
    return
  fi

  after="$(printf '%s\n' "$body" \
    | awk '
      found && $0 !~ /^[[:space:]]*$/ {
        gsub(/`/, "", $0)
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", $0)
        print $0
        exit
      }
      /OUTCOME-ID/ { found=1 }
    ')"
  printf '%s\n' "$after"
}

# build_outcome_open_pr_status <search_json> <current_number>
# search_json is the GitHub search/issues response for open PRs containing the
# exact OUTCOME-ID. The current PR is ignored during a correction re-fire.
build_outcome_open_pr_status() {
  local search_json="$1" current_number="${2:-}"
  local count
  count="$(jq --arg current "$current_number" '[.items[]? | select((.number|tostring) != $current)] | length' <<<"$search_json")"
  if [ "$count" -gt 0 ]; then
    echo "duplicate_pr"
  else
    echo "clear"
  fi
}
