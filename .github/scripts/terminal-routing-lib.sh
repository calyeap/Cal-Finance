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

# CF-SLACK-ALERT-RELIABILITY-01
#
# terminal_trim_whitespace <text>
# Trims leading and trailing ASCII whitespace from a string using pure
# bash parameter expansion — no external process, no pipeline. Unlike
# `xargs` (the previous trimming method in calvin-slack-alert.yml), this
# never treats the text as shell-like input: apostrophes, double quotes,
# backticks and brackets pass through as opaque text instead of risking
# an unmatched-quote failure (the second observed CF-SLACK-ALERT-
# RELIABILITY-01 failure class, e.g. an ask containing "Calvin's
# decision").
terminal_trim_whitespace() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

# terminal_first_line <comment_body>
# Drops leading blank/all-whitespace lines, then prints the first
# remaining line with its own leading/trailing whitespace trimmed. Mirrors
# the TRIMMED/first-line convention already used for the CORRECT/DONE/
# OWNER RECONCILED terminal markers elsewhere in this repo's workflows.
#
# CF-SLACK-ALERT-RELIABILITY-01: previously implemented as
# `printf | sed | head -n1 | sed`. Under `set -o pipefail`, `head -n1`
# can close its input after reading the first line and send SIGPIPE to
# the upstream `sed` on a long/multi-line body, which then exits 141
# ("couldn't flush stdout: Broken pipe") and — because pipefail makes
# that the pipeline's exit status — took down any caller running under
# `set -e`, even though the first line it produced was perfectly valid.
# Rewritten as a pure bash loop over a here-string (not a pipe), so there
# is nothing for an early return to SIGPIPE, and long bodies are handled
# in O(lines until the first non-blank one) rather than requiring the
# whole body to be read.
terminal_first_line() {
  local body="$1" line
  while IFS= read -r line || [ -n "$line" ]; do
    if [[ "$line" =~ [^[:space:]] ]]; then
      terminal_trim_whitespace "$line"
      return 0
    fi
  done <<< "$body"
  printf ''
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

# CF-CALVIN-ATTENTION-LEAN-01
#
# terminal_is_calvin_required_marker <comment_body>
# True ("true") when the comment's first non-blank line — after dropping
# leading blank lines, trimming whitespace, and stripping a harmless
# Markdown heading prefix — begins with CALVIN REQUIRED:. Shares the same
# normalization terminal_is_correct_marker applies, so a heading-prefixed
# gate (e.g. "## CALVIN REQUIRED: ...") still alerts instead of silently
# falling through the way PR #218's "## CORRECT" shape once did for the
# CORRECT marker before that normalization existed.
terminal_is_calvin_required_marker() {
  local body="$1" first_line normalized
  first_line="$(terminal_first_line "$body")"
  normalized="$(terminal_strip_markdown_heading "$first_line")"
  case "$normalized" in
    "CALVIN REQUIRED:"*) echo true ;;
    *) echo false ;;
  esac
}
