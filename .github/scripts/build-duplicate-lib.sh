#!/usr/bin/env bash
# CF-OUTCOME-LOOP-LEAN-01
#
# Pure, network-free classification shared by cc-auto-fire.yml's fire-build
# job and its unit tests (build-duplicate-lib.test.sh). No gh/curl calls
# happen here, so the duplicate-admission decision can be exercised
# deterministically in CI.
#
# Closes issue #188's observed failure: two BUILD sessions fired for the
# same target within ~30 seconds because nothing checked whether an
# already-open BUILD attempt existed first. The rule: if the most recent
# "BUILD FIRED:" receipt on the target has no BUILD terminal marker
# (DONE:/BLOCKED:/STOP:/CALVIN REQUIRED:) after it, an attempt is still in
# flight, so a second fire must be suppressed.

set -uo pipefail

# build_duplicate_first_line <text>
build_duplicate_first_line() {
  local body="$1"
  printf '%s' "$body" \
    | sed -e '/[^[:space:]]/,$!d' -e 's/^[[:space:]]*//' \
    | head -n1 \
    | sed -e 's/[[:space:]]*$//'
}

# build_duplicate_is_terminal_first_line <first_line>
# True (exit 0) when the first line is one of BUILD's own terminal
# markers per BUILD.md's "Terminal rule" (DONE:, including DONE: EVIDENCE;
# BLOCKED:; STOP:; CALVIN REQUIRED:).
build_duplicate_is_terminal_first_line() {
  local first_line="$1"
  case "$first_line" in
    DONE:*|BLOCKED:*|STOP:*|"CALVIN REQUIRED:"*) return 0 ;;
    *) return 1 ;;
  esac
}

# build_duplicate_status <comments_json>
# comments_json: a JSON array of {"body":..,"created_at":..} comment
# objects, already fetched by the caller (oldest/newest order does not
# matter — this sorts internally).
# Echoes "duplicate" when the most recent "BUILD FIRED:" receipt has no
# BUILD terminal marker after it (an attempt is still open); echoes
# "clear" otherwise, including when no BUILD FIRED receipt exists at all.
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
