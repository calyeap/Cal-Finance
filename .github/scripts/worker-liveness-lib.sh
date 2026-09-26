#!/usr/bin/env bash
# CF-HANDOFF-FAIL-CLOSED-01
#
# Pure, network-free terminal-correlation engine shared by every post-fire
# liveness guard in this repo: owner-liveness-lib.sh (BUILD/REVIEW/OWNER's
# common ancestor — see CF-OWNER-LIVENESS-01) and the new
# build-liveness-lib.sh / review-liveness-lib.sh. No gh/curl calls happen
# here, so the correlation contract can be exercised deterministically in
# CI, exactly like the actor-specific libs built on top of it.
#
# The shape every actor's liveness contract shares (OWNER.md's "Liveness
# correlation" rule and its BUILD/REVIEW analogues): an attempt is complete
# only once the wake target carries a comment, created after that
# attempt's own start receipt, whose first non-empty line is one of that
# actor's typed terminal forms AND also carries that actor's exact
# "[<ACTOR>_ATTEMPT_ID: <id>]" tag on that same line. What differs between
# actors is only: the terminal-form regex, and how the start receipt itself
# is shaped (OWNER posts a dedicated "OWNER ATTEMPT START: <id>" comment;
# BUILD/REVIEW reuse their existing "BUILD FIRED:"/"REVIEW FIRED:" fire
# receipt and embed the tag in it instead of adding a second comment). This
# file covers the shared terminal-correlation half; each actor-specific lib
# supplies its own start-receipt lookup and its own regex/tag via the
# functions below.

set -uo pipefail

# worker_liveness_find_terminal_by_tag <comments_json> <tag> <terminal_regex> <after_iso>
# comments_json: a JSON array of {"body":..,"created_at":..} comment
# objects, already fetched by the caller, any order.
# tag: the exact literal substring that must co-occur on the same comment
# as the typed terminal line, e.g. "[BUILD_ATTEMPT_ID: BUILD-123-1]".
# terminal_regex: an extended regex (jq `test`) matched against the
# comment's own first non-blank line (after left-trim only — heading
# stripping, if an actor wants it, is the caller's job before this).
# after_iso: only comments created strictly after this ISO-8601 timestamp
# qualify (binds the search to one specific attempt's observation window).
#
# Prints the earliest qualifying comment, or nothing if none qualifies.
worker_liveness_find_terminal_by_tag() {
  local comments_json="$1" tag="$2" terminal_regex="$3" after_iso="$4"
  jq -c --arg after "$after_iso" --arg tag "$tag" --arg regex "$terminal_regex" '
    def first_nonblank_line:
      (. // "")
      | split("\n")
      | map(select(test("[^\\s]")))
      | (.[0] // "")
      | sub("^\\s+"; "");
    map(select(.created_at > $after))
    | map(select(.body | contains($tag)))
    | map(select(.body | first_nonblank_line | test($regex)))
    | sort_by(.created_at)
    | (.[0] // empty)
  ' <<<"$comments_json"
}

# worker_liveness_status_by_tag <comments_json> <tag> <terminal_regex> <after_iso>
# Echoes "complete" or "missing" — the same two-value contract every
# actor-specific *_liveness_status wrapper exposes.
worker_liveness_status_by_tag() {
  local comments_json="$1" tag="$2" terminal_regex="$3" after_iso="$4"
  local match
  match="$(worker_liveness_find_terminal_by_tag "$comments_json" "$tag" "$terminal_regex" "$after_iso")"
  if [ -n "$match" ]; then
    echo "complete"
  else
    echo "missing"
  fi
}

# worker_liveness_find_start_by_tag <comments_json> <start_body_prefix> <tag>
# Prints the earliest comment whose body both starts with
# start_body_prefix (e.g. "BUILD FIRED:") and contains tag (e.g.
# "[BUILD_ATTEMPT_ID: BUILD-123-1]"), or nothing if none exists. This is
# the shape BUILD/REVIEW's start receipts use — a fire receipt they were
# already posting, now also carrying the attempt tag — as opposed to
# OWNER's own dedicated "OWNER ATTEMPT START: <id>" comment, which
# owner-liveness-lib.sh keeps finding its own way for backward
# compatibility with its existing tests.
worker_liveness_find_start_by_tag() {
  local comments_json="$1" start_body_prefix="$2" tag="$3"
  jq -c --arg prefix "$start_body_prefix" --arg tag "$tag" '
    map(select((.body | startswith($prefix)) and (.body | contains($tag))))
    | sort_by(.created_at)
    | (.[0] // empty)
  ' <<<"$comments_json"
}
