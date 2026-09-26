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

# CF-TERMINAL-HANDOFF-REPAIR-01
#
# terminal_is_owner_direct_marker <comment_body>
# True ("true") when the comment's first non-blank line — after dropping
# leading blank lines, trimming whitespace, and stripping a harmless
# Markdown heading prefix — begins with one of the four terminal outcomes
# that must route straight into cc-auto-fire.yml's fire-owner-on-terminal
# job, without a worker also needing to apply the needs-owner-wake label:
# DONE: EVIDENCE, STOP:, BLOCKED:, or CALVIN REQUIRED:. An ordinary
# DONE: <PR link> completion never matches — it keeps routing through
# fire-review, unchanged.
#
# Fixes the exact #256 failure this outcome diagnoses: BUILD posted a valid
# first-line `DONE: EVIDENCE` terminal receipt, but no OWNER wake followed
# because BUILD.md previously required the worker itself to additionally
# apply needs-owner-wake, and nothing else consumed the terminal comment on
# its own.
#
# CORRECT (PR #259 review): a CALVIN REQUIRED: line that also carries a
# same-line `[OWNER_ATTEMPT_ID: ...]` tag is never a fresh gate raise — per
# OWNER.md's liveness-correlation rule, that tag is mandatory on every fired
# OWNER run's own terminal receipt, including the case where OWNER restates
# an unresolved CALVIN REQUIRED gate as its own outcome. Admitting that
# shape here would (a) re-fire OWNER for the wake it just finished, and
# (b) let terminal_owner_admission_status treat it as the "latest" gate
# marker, which posts a fresh "OWNER ATTEMPT START: " receipt that
# calvin_ruling_gate_status (calvin-ruling-lib.sh) reads as the gate having
# closed — before Calvin ever ruled on it. BUILD/REVIEW's own
# CALVIN REQUIRED: comments never carry this tag and keep routing directly.
# CF-HANDOFF-FAIL-CLOSED-01
#
# terminal_is_workflow_blocked_marker <comment_body>
# True ("true") when the comment's first non-blank line — after dropping
# leading blank lines, trimming whitespace, and stripping a harmless
# Markdown heading prefix — begins with `WORKFLOW BLOCKED` (the AUTH/
# LIVENESS-exhaustion receipts fire-*-lib.sh's callers post; see
# fire-auth-lib.sh and worker-liveness-guard.sh) or with the pre-existing
# `OWNER LIVENESS EXHAUSTED` marker (CF-OWNER-LIVENESS-01, left unrenamed
# for backward compatibility). calvin-slack-alert.yml uses this to decide
# whether a comment should alert Calvin once through the existing Slack
# webhook, alongside its existing CALVIN REQUIRED: trigger.
terminal_is_workflow_blocked_marker() {
  local body="$1" first_line normalized
  first_line="$(terminal_first_line "$body")"
  normalized="$(terminal_strip_markdown_heading "$first_line")"
  case "$normalized" in
    "WORKFLOW BLOCKED"*|"OWNER LIVENESS EXHAUSTED"*) echo true ;;
    *) echo false ;;
  esac
}

terminal_is_owner_direct_marker() {
  local body="$1" first_line normalized
  first_line="$(terminal_first_line "$body")"
  normalized="$(terminal_strip_markdown_heading "$first_line")"
  case "$normalized" in
    "DONE: EVIDENCE"*|STOP:*|BLOCKED:*) echo true ;;
    "CALVIN REQUIRED:"*)
      case "$normalized" in
        *"[OWNER_ATTEMPT_ID: "*) echo false ;;
        *) echo true ;;
      esac
      ;;
    *) echo false ;;
  esac
}

# terminal_owner_admission_status <comments_json>
# comments_json: a JSON array of {"body":..,"created_at":..} comment
# objects for one target (issue or PR), already fetched by the caller, any
# order.
#
# Finds the most recent comment whose first non-blank line (after Markdown
# heading stripping) matches terminal_is_owner_direct_marker's marker set
# (the same CALVIN REQUIRED: + same-line [OWNER_ATTEMPT_ID: ...] exclusion
# applies here — OWNER's own restated-gate receipt is never itself a fresh
# terminal transition to admit). Echoes "admit" when such a marker exists
# and no "OWNER ATTEMPT START: " receipt has been posted after it yet —
# i.e. no OWNER fire has been admitted for this exact terminal transition.
# Echoes "skip" when a marker exists but has already been admitted (a
# genuine duplicate — the other path got here first). Echoes "no-marker"
# when the target carries no such marker at all.
#
# CORRECT (PR #259 review): "skip" and "no-marker" used to collapse into a
# single "skip" result. The needs-owner-wake label branch in
# cc-auto-fire.yml treated both alike and then unconditionally deleted the
# label, which made a manually-applied label a silent no-op on any target
# whose terminal outcome isn't a first-line marker comment (e.g. stated in
# a PR body) — exactly the manual/recovery case the label exists for. The
# caller now fires on "no-marker" (nothing to dedupe against) and only
# skips + cleans up the label on a genuine "skip" duplicate.
#
# This is the shared, target-local dedupe between the direct-comment route
# above and the needs-owner-wake label kept as manual/recovery
# compatibility (BUILD.md, OWNER.md, CC.md): both paths call this before
# firing, both run inside the same cf-owner-single-writer concurrency group
# (CF-OWNER-SINGLE-WRITER-01), so whichever one reaches this job first for
# a given terminal comment posts the "OWNER ATTEMPT START: " admission and
# the other — reading freshly fetched comments that now include it —
# resolves "skip" instead of firing a second OWNER session for the same
# transition. No new queue, lock, or service; this reuses the same
# admission-receipt convention calvin_ruling_gate_status already applies to
# the CALVIN RULING wake path (calvin-ruling-lib.sh).
terminal_owner_admission_status() {
  local comments_json="$1"
  jq -r '
    def strip_heading: sub("^#{1,6}[ \t]+"; "");
    def first_nonblank_line:
      (. // "")
      | split("\n")
      | map(select(test("[^\\s]")))
      | (.[0] // "")
      | sub("^\\s+"; "")
      | sub("\\s+$"; "");
    def is_owner_direct_marker:
      if test("^(DONE: EVIDENCE|STOP:|BLOCKED:)") then true
      elif test("^CALVIN REQUIRED:") then (test("\\[OWNER_ATTEMPT_ID: ") | not)
      else false
      end;

    (map(. + {first_line: (.body | first_nonblank_line | strip_heading)})) as $all
    | ($all
        | map(select(.first_line | is_owner_direct_marker))
        | sort_by(.created_at)
        | (.[-1] // null)
      ) as $latest
    | if $latest == null then
        "no-marker"
      else
        (
          $all
          | map(select(.created_at > $latest.created_at))
          | map(select(.first_line | startswith("OWNER ATTEMPT START: ")))
          | length
        ) as $admitted_since
        | if $admitted_since > 0 then "skip" else "admit" end
      end
  ' <<<"$comments_json"
}
