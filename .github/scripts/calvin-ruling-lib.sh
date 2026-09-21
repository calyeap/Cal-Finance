#!/usr/bin/env bash
# CF-OWNER-SINGLE-WRITER-01 addendum (issue #197 ADDENDUM, posted
# 2026-09-21T11:09:44Z — before this outcome's original DONE, so it was in
# force at build time).
#
# Pure, network-free helpers shared by cc-auto-fire.yml's
# fire-owner-on-terminal job (its `Resolve target` step, on the
# issue_comment path) and its unit tests (calvin-ruling-lib.test.sh /
# calvin-ruling-reachability.test.sh). No gh/curl calls happen in this
# file, so the classification contract can be exercised deterministically
# in CI.
#
# Closes the addendum's observed gap: after Calvin answered #196 with
# `CALVIN RULING — APPROVE OPTION B`, the ruling was durably recorded on
# GitHub but woke nothing — OWNER's own CALVIN REQUIRED terminal output
# never re-arms its own wake path (see cc-auto-fire.yml's
# fire-owner-on-terminal header comment), so Project Home stayed
# `NEXT MOVE: CALVIN` until a human intervened by hand. The rule: a
# non-bot comment whose own first line is a `CALVIN RULING` marker must
# wake OWNER, but only when the target's current typed gate — its most
# recent BUILD/REVIEW/OWNER state-changing terminal marker — is still an
# unanswered `CALVIN REQUIRED:`, so this never fires on arbitrary comments
# or on an item with no open gate. (An earlier version of this fix routed
# a qualifying ruling through a re-applied needs-owner-wake label instead
# of straight into fire-owner-on-terminal; that label write, performed by
# a workflow step under GITHUB_TOKEN, never actually re-triggered anything
# — GitHub Actions does not start a new run from an event its own
# GITHUB_TOKEN produced — so fire-owner-on-terminal now classifies and
# admits the issue_comment path directly instead.)

set -uo pipefail

# calvin_ruling_first_line <text>
# Drops leading blank/all-whitespace lines, then prints the first
# remaining line with its own leading/trailing whitespace trimmed. Mirrors
# the TRIMMED/first-line convention used for the other terminal markers
# elsewhere in this repo's workflows (CORRECT/DONE/OWNER RECONCILED/BUILD
# duplicate detection).
calvin_ruling_first_line() {
  local body="$1"
  printf '%s' "$body" \
    | sed -e '/[^[:space:]]/,$!d' -e 's/^[[:space:]]*//' \
    | head -n1 \
    | sed -e 's/[[:space:]]*$//'
}

# calvin_ruling_is_ruling_first_line <first_line>
# True (exit 0) when the first line is a CALVIN RULING marker: "CALVIN
# RULING" followed by a colon, or an em dash / hyphen separator (with
# optional leading spaces) — e.g. "CALVIN RULING — APPROVE OPTION B" (the
# live #196 evidence) or "CALVIN RULING: approve".
calvin_ruling_is_ruling_first_line() {
  local first_line="$1"
  printf '%s' "$first_line" | grep -Eq '^CALVIN RULING(:| *[—-])'
}

# calvin_ruling_gate_status <comments_json>
# comments_json: a JSON array of {"body":..,"created_at":..} comment
# objects for one target (issue or PR), already fetched by the caller, any
# order. Finds the most recent comment whose first line is one of BUILD's/
# REVIEW's/OWNER's own state-changing terminal markers (DONE:, BLOCKED:,
# STOP:, CALVIN REQUIRED: — the same set BUILD.md's terminal rule defines,
# which REVIEW and OWNER also emit verbatim). Echoes "open" only when that
# latest terminal marker is CALVIN REQUIRED: and no "OWNER ATTEMPT START: "
# receipt exists after it (i.e. no admission has fired for this exact gate
# yet — OWNER's own restated CALVIN REQUIRED: from the original terminal
# wake is what counts as "current" once it lands). Echoes "closed"
# otherwise, including when no terminal marker exists at all.
calvin_ruling_gate_status() {
  local comments_json="$1"
  jq -r '
    def first_nonblank_line:
      (. // "")
      | split("\n")
      | map(select(test("[^\\s]")))
      | (.[0] // "")
      | sub("^\\s+"; "");

    (map(. + {first_line: (.body | first_nonblank_line)})) as $all
    | ($all
        | map(select(.first_line | test("^(DONE:|BLOCKED:|STOP:|CALVIN REQUIRED:)")))
        | sort_by(.created_at)
        | (.[-1] // null)
      ) as $latest_terminal
    | if ($latest_terminal == null) or (($latest_terminal.first_line | startswith("CALVIN REQUIRED:")) | not) then
        "closed"
      else
        (
          $all
          | map(select(.created_at > $latest_terminal.created_at))
          | map(select(.first_line | startswith("OWNER ATTEMPT START: ")))
          | length
        ) as $admitted_since
        | if $admitted_since > 0 then "closed" else "open" end
      end
  ' <<<"$comments_json"
}

# calvin_ruling_should_wake <comments_json> <comment_body> <is_bot>
# is_bot: "true" or "false" (github.event.comment.user.type == 'Bot').
# Echoes "wake" only when is_bot is "false", the comment's own first line
# is a CALVIN RULING marker, and calvin_ruling_gate_status is "open" for
# comments_json (the target's comments, including or excluding this one —
# it does not matter, since a ruling comment's own first line never
# matches a state-changing terminal marker). Echoes "skip" otherwise.
calvin_ruling_should_wake() {
  local comments_json="$1" comment_body="$2" is_bot="$3"
  local first_line
  first_line="$(calvin_ruling_first_line "$comment_body")"

  if [ "$is_bot" = "true" ]; then
    echo "skip"
    return
  fi

  if ! calvin_ruling_is_ruling_first_line "$first_line"; then
    echo "skip"
    return
  fi

  if [ "$(calvin_ruling_gate_status "$comments_json")" = "open" ]; then
    echo "wake"
  else
    echo "skip"
  fi
}
