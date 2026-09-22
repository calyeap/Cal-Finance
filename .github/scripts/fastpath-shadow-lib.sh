#!/usr/bin/env bash
# CF-OWNER-FASTPATH-SHADOW-01
#
# Pure, network-free shadow classifiers for issue #212's scope item 6:
# a short hard-coded ALLOWLIST of transition candidates already proven
# routine by the current workflow's own deterministic code — never a
# probabilistic classifier, never a new decision surface. This is
# SHADOW-ONLY: nothing here has execution authority. Callers only ever log
# the result (see fastpath_shadow_format); OWNER still performs every real
# transition in this outcome. Default behaviour for anything unmatched or
# ambiguous is always ESCALATE TO OWNER — fail closed, never guess.
#
# The two rules below mirror logic that already runs for real today:
#   - REVIEW_TERMINAL_ROUTE mirrors cc-auto-fire.yml's fire-review job
#     (terminal-routing-lib.sh): a BUILD "DONE:" terminal either has no PR
#     to review (DONE: EVIDENCE) or names one.
#   - BUILD_DUPLICATE_ADMIT mirrors cc-auto-fire.yml's fire-build job
#     (build-duplicate-lib.sh): a candidate BUILD fire is either suppressed
#     as a duplicate or admitted.
# Both are already fully deterministic in production; shadowing them here
# only proves the fast-path classifier agrees with what already happens,
# per issue #212's scope item 7 (shadow coverage gate).

set -uo pipefail

# fastpath_shadow_classify_review_terminal <first_line> <has_pr_number>
# first_line: the terminal comment's first non-blank line (see
# terminal-routing-lib.sh's terminal_first_line). has_pr_number: "true" or
# "false" — whether a PR number was resolved for it (see
# terminal_pr_number_from_first_line plus the pull_request fallback
# cc-auto-fire.yml's fire-review job also applies).
# Echoes "WOULD_EXECUTE:<rule>" or "ESCALATE:<reason>".
fastpath_shadow_classify_review_terminal() {
  local first_line="$1" has_pr_number="$2"
  case "$first_line" in
    "DONE: EVIDENCE"*)
      echo "WOULD_EXECUTE:SKIP_REVIEW_DONE_EVIDENCE"
      ;;
    DONE:*)
      if [ "$has_pr_number" = "true" ]; then
        echo "WOULD_EXECUTE:FIRE_REVIEW_DONE_PR"
      else
        echo "ESCALATE:DONE_WITH_NO_RESOLVABLE_PR"
      fi
      ;;
    *)
      echo "ESCALATE:UNRECOGNIZED_TERMINAL_SHAPE"
      ;;
  esac
}

# fastpath_shadow_classify_build_duplicate <duplicate_status>
# duplicate_status: build_duplicate_status's own output ("duplicate" or
# "clear" — see build-duplicate-lib.sh).
# Echoes "WOULD_EXECUTE:<rule>" or "ESCALATE:<reason>".
fastpath_shadow_classify_build_duplicate() {
  local duplicate_status="$1"
  case "$duplicate_status" in
    duplicate)
      echo "WOULD_EXECUTE:SUPPRESS_DUPLICATE_BUILD"
      ;;
    clear)
      echo "WOULD_EXECUTE:ADMIT_BUILD_FIRE"
      ;;
    *)
      echo "ESCALATE:UNKNOWN_DUPLICATE_STATUS"
      ;;
  esac
}

# fastpath_shadow_format <event_type> <decision>
# Single log line for durable workflow-receipt evidence (issue #212 scope
# item 8: "Durable workflow receipts/logs are sufficient" — no analytics
# platform). decision is one of the WOULD_EXECUTE:.../ESCALATE:... strings
# the classifiers above return.
fastpath_shadow_format() {
  local event_type="$1" decision="$2"
  printf 'SHADOW: event=%s decision=%s' "$event_type" "$decision"
}
