#!/usr/bin/env bash
# CF-OUTCOME-LOOP-LEAN-01 / CF-CORRECT-ROUTER-01
#
# Pure, network-free helpers shared by cc-auto-fire.yml's fire-review and
# fire-build jobs and their unit tests (terminal-routing-lib.test.sh). No
# gh/curl calls happen here, so the routing/parsing contract can be
# exercised deterministically in CI.
#
# Closes two observed holes (issue CF-OUTCOME-LOOP-LEAN-01):
#
# 1. A `DONE: EVIDENCE` comment (BUILD's evidence-only completion, see
#    BUILD.md) has no PR to review. Left to the old whole-body `/pull/N`
#    scrape, it fell through to "REVIEW FIRE SKIPPED" and dead-ended
#    instead of waking OWNER. BUILD now applies `needs-owner-wake` itself
#    for that outcome, so the fire-review job's only job for it is to
#    recognise it and skip cleanly (see terminal_first_line's DONE:
#    EVIDENCE case in the caller).
# 2. The PR reference for a normal `DONE: <PR link>` completion must bind
#    to that terminal line itself, not to the first `/pull/N` found
#    anywhere in the comment body — a quoted example or an earlier aside
#    could otherwise redirect REVIEW to the wrong PR.

set -uo pipefail

# terminal_first_line <comment_body>
# Drops leading blank/all-whitespace lines, then prints the first
# remaining line with its own leading/trailing whitespace trimmed. Mirrors
# the TRIMMED/first-line convention already used for the CORRECT/DONE/
# OWNER RECONCILED terminal markers elsewhere in this repo's workflows.
terminal_first_line() {
  local body="$1"
  printf '%s' "$body" \
    | sed -e '/[^[:space:]]/,$!d' -e 's/^[[:space:]]*//' \
    | head -n1 \
    | sed -e 's/[[:space:]]*$//'
}

# terminal_pr_number_from_first_line <comment_body>
# Prints the pull request number referenced on the comment's first
# non-blank line only, or nothing if that line carries no /pull/N
# reference. Never scrapes a /pull/N from later prose, examples, or
# quoted text in the rest of the comment.
terminal_pr_number_from_first_line() {
  local body="$1" first_line
  first_line="$(terminal_first_line "$body")"
  printf '%s' "$first_line" | grep -oE '/pull/[0-9]+' | head -n1 | grep -oE '[0-9]+' || true
}

# CF-CORRECT-ROUTER-01
#
# terminal_strip_markdown_heading <line>
# Strips one leading ATX Markdown heading prefix (one to six '#'
# characters followed by required whitespace) from a single line, e.g.
# "## CORRECT" -> "CORRECT". A line with no heading prefix passes through
# unchanged. This is harmless-syntax normalization only — it never
# touches anything past the first line, so a quoted/example marker
# elsewhere in a comment still cannot match.
terminal_strip_markdown_heading() {
  local line="$1"
  printf '%s' "$line" | sed -E 's/^#{1,6}[[:space:]]+//'
}

# terminal_is_correct_marker <comment_body>
# True ("true") when the comment's first non-blank line — after dropping
# leading blank lines, trimming whitespace, and stripping a harmless
# Markdown heading prefix — is exactly CORRECT or begins with CORRECT:.
# Fixes the PR #218 failure shape (REVIEW's first line was "## CORRECT")
# while keeping the existing bare CORRECT / CORRECT: contract, the
# first-line-only binding, and rejection of quoted/example CORRECT text
# appearing later in the comment.
terminal_is_correct_marker() {
  local body="$1" first_line normalized
  first_line="$(terminal_first_line "$body")"
  normalized="$(terminal_strip_markdown_heading "$first_line")"
  case "$normalized" in
    CORRECT|CORRECT:*) echo true ;;
    *) echo false ;;
  esac
}
