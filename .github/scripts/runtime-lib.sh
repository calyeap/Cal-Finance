#!/usr/bin/env bash
# CF-WORKFLOW-RESET-RUNTIME-01
# Network-free classification helpers for the simplified Cal Finance runtime.
# Keep policy here mechanical: parse one task contract, admit one outcome,
# classify typed terminals. Product/finance semantics never belong here.

set -uo pipefail

runtime_trim() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

runtime_nth_nonblank_line() {
  local body="$1" n="$2" line count=0
  while IFS= read -r line || [ -n "$line" ]; do
    if [[ "$line" =~ [^[:space:]] ]]; then
      count=$((count + 1))
      if [ "$count" -eq "$n" ]; then
        runtime_trim "$line"
        return 0
      fi
    fi
  done <<< "$body"
  printf ''
}

runtime_first_line() {
  runtime_nth_nonblank_line "$1" 1
}

runtime_strip_heading() {
  local line="$1"
  printf '%s' "$line" | sed -E 's/^#{1,6}[[:space:]]+//'
}

# runtime_is_attempt_meta_line <line>
# True when <line> (already heading-stripped) is nothing but a standalone
# attempt-metadata marker, e.g. "[BUILD_ATTEMPT_ID: BUILD-1-1]".
runtime_is_attempt_meta_line() {
  [[ "$1" =~ ^\[(BUILD|REVIEW|OWNER)_ATTEMPT_ID:\ [^]]+\]$ ]]
}

# runtime_terminal_line <body>
# Shared terminal-line normalization (issue #375 /
# CF-WORKFLOW-TERMINAL-NORMALIZE-01). A canonical terminal — the typed
# terminal itself is the first nonblank line — is returned unchanged. The
# one tolerated exception: when the first nonblank line is nothing but a
# standalone attempt-metadata marker, the immediately following nonblank
# line is treated as the semantic terminal instead. This never scans past
# that second line and never treats arbitrary prose as a terminal — only
# every classifier below (and Slack eligibility, via runtime_slack_kind)
# routes through this one function, so they cannot disagree.
runtime_terminal_line() {
  local body="$1" line1 line2
  line1="$(runtime_strip_heading "$(runtime_nth_nonblank_line "$body" 1)")"
  if runtime_is_attempt_meta_line "$line1"; then
    line2="$(runtime_strip_heading "$(runtime_nth_nonblank_line "$body" 2)")"
    if [ -n "$line2" ]; then
      printf '%s' "$line2"
      return 0
    fi
  fi
  printf '%s' "$line1"
}

# runtime_terminal_tag_text <body>
# Text to search for an attempt-ID tag ("[BUILD_ATTEMPT_ID: X]" etc): the
# terminal line runtime_terminal_line would classify, plus the standalone
# metadata line preceding it when one was tolerated — that is where the
# tag actually lives in that shape. Keeps tag correlation on exactly the
# same normalization as classification so a mismatched/missing attempt ID
# is never silently accepted as the watched attempt.
runtime_terminal_tag_text() {
  local body="$1" line1 line2
  line1="$(runtime_strip_heading "$(runtime_nth_nonblank_line "$body" 1)")"
  if runtime_is_attempt_meta_line "$line1"; then
    line2="$(runtime_strip_heading "$(runtime_nth_nonblank_line "$body" 2)")"
    printf '%s %s' "$line1" "$line2"
    return 0
  fi
  printf '%s' "$line1"
}

# runtime_terminal_is_typed <actor> <line>
# Same typed-terminal vocabulary each actor's contract file requires,
# kept in one place so correlation (runtime_attempt_status) can't drift
# from it.
runtime_terminal_is_typed() {
  local actor="$1" line="$2"
  case "$actor" in
    BUILD) case "$line" in DONE:*|BLOCKED:*|STOP:*|"CALVIN REQUIRED:"*) return 0 ;; *) return 1 ;; esac ;;
    REVIEW) case "$line" in ACCEPT:*|CORRECT:*|BLOCKED:*|STOP:*|"CALVIN REQUIRED:"*) return 0 ;; *) return 1 ;; esac ;;
    OWNER) case "$line" in CONTINUE:*|COMPLETE:*|BLOCKED:*|"CALVIN REQUIRED:"*) return 0 ;; *) return 1 ;; esac ;;
    *) return 1 ;;
  esac
}

runtime_extract_field() {
  local body="$1" field="$2" line value
  while IFS= read -r line || [ -n "$line" ]; do
    line="$(runtime_trim "$line")"
    if [[ "$line" =~ ^${field}:[[:space:]]*(.*)$ ]]; then
      value="${BASH_REMATCH[1]}"
      value="$(runtime_trim "$value")"
      value="${value#\`}"
      value="${value%\`}"
      runtime_trim "$value"
      return 0
    fi
  done <<< "$body"
  printf ''
}

runtime_outcome_id() { runtime_extract_field "$1" "OUTCOME-ID"; }

runtime_tier() {
  local raw
  raw="$(runtime_extract_field "$1" "TIER")"
  raw="$(printf '%s' "$raw" | tr '[:lower:]' '[:upper:]')"
  case "$raw" in
    LIGHT|NORMAL|HEAVY) printf '%s' "$raw" ;;
    "") printf 'NORMAL' ;;
    *) printf 'INVALID' ;;
  esac
}

runtime_is_correct() {
  local line
  line="$(runtime_terminal_line "$1")"
  case "$line" in CORRECT|CORRECT:*) echo true ;; *) echo false ;; esac
}

runtime_is_calvin_required() {
  local line
  line="$(runtime_terminal_line "$1")"
  case "$line" in "CALVIN REQUIRED:"*) echo true ;; *) echo false ;; esac
}

runtime_done_pr_number() {
  local line
  line="$(runtime_terminal_line "$1")"
  case "$line" in DONE:*) ;; *) return 0 ;; esac
  printf '%s' "$line" | grep -oE '/pull/[0-9]+' | head -n1 | grep -oE '[0-9]+' || true
}

# Child terminals that require parent reconciliation. OWNER receipts carry an
# OWNER_ATTEMPT_ID (on the terminal line itself, or on a metadata line
# runtime_terminal_line tolerated ahead of it — runtime_terminal_tag_text
# covers both) and are deliberately excluded so OWNER never wakes itself.
runtime_is_child_terminal() {
  local body="$1" line tag_text
  line="$(runtime_terminal_line "$body")"
  tag_text="$(runtime_terminal_tag_text "$body")"
  case "$tag_text" in *"[OWNER_ATTEMPT_ID: "*) echo false; return ;; esac
  case "$line" in
    "DONE: EVIDENCE"*|STOP:*|BLOCKED:*|"CALVIN REQUIRED:"*) echo true ;;
    *) echo false ;;
  esac
}

runtime_parent_terminal_kind() {
  local line
  line="$(runtime_terminal_line "$1")"
  case "$line" in
    CONTINUE:*) echo CONTINUE ;;
    COMPLETE:*) echo COMPLETE ;;
    BLOCKED:*) echo BLOCKED ;;
    "CALVIN REQUIRED:"*) echo CALVIN_REQUIRED ;;
    *) echo NONE ;;
  esac
}

# runtime_slack_kind <line>
# Slack is an interrupt channel for genuine Calvin action, not a progress
# feed (CF-SLACK-ACTION-ONLY-01, issue #377): only a real human gate is
# Slack-eligible. `COMPLETE:` remains a valid parent terminal
# (runtime_parent_terminal_kind) — it is simply never Slack-eligible.
runtime_slack_kind() {
  local line
  line="$(runtime_terminal_line "$1")"
  case "$line" in
    "CALVIN REQUIRED:"*) echo calvin_required ;;
    "BLOCKED: ACTIONABLE"*) echo actionable_blocked ;;
    *) echo none ;;
  esac
}

# runtime_slack_is_duplicate <comments_json> <this_created_at> <this_raw>
# Pure. True only for an OWNER terminal (carries [OWNER_ATTEMPT_ID: ...])
# that restates an already-Slack-alerted child (or prior OWNER) blocker:
# the most recent earlier comment in <comments_json> that is itself
# Slack-eligible (runtime_slack_kind != none) has the same kind as
# <this_raw>, and <this_raw> literally references that earlier comment's
# own BUILD_/REVIEW_/OWNER_ATTEMPT_ID value — i.e. OWNER is reconciling
# that exact attempt, not reporting a distinct one. A non-OWNER terminal,
# an ineligible terminal, or one that doesn't correlate to a same-kind
# predecessor is never a duplicate, so the first alert for any blocker
# — and any genuinely new OWNER blocker — always sends.
runtime_slack_is_duplicate() {
  local comments_json="$1" before="$2" this_raw="$3" this_tag_text kind
  this_tag_text="$(runtime_terminal_tag_text "$this_raw")"
  case "$this_tag_text" in *"[OWNER_ATTEMPT_ID: "*) ;; *) echo false; return ;; esac
  kind="$(runtime_slack_kind "$this_raw")"
  if [ "$kind" = none ]; then echo false; return; fi

  local earlier_bodies body term k prev_kind="" prev_tag_text="" prev_tag
  earlier_bodies="$(jq -c --arg before "$before" '
    [ .[] | select(.created_at < $before) ] | sort_by(.created_at) | reverse | .[].body
  ' <<< "$comments_json")"

  while IFS= read -r body; do
    [ -z "$body" ] && continue
    body="$(jq -r . <<< "$body")"
    term="$(runtime_terminal_line "$body")"
    k="$(runtime_slack_kind "$term")"
    if [ "$k" != none ]; then
      prev_kind="$k"
      prev_tag_text="$(runtime_terminal_tag_text "$body")"
      break
    fi
  done <<< "$earlier_bodies"
  if [ -z "$prev_kind" ]; then echo false; return; fi
  if [ "$prev_kind" != "$kind" ]; then echo false; return; fi

  prev_tag="$(printf '%s' "$prev_tag_text" | sed -nE 's/.*\[(BUILD|REVIEW|OWNER)_ATTEMPT_ID: ([^]]+)\].*/\2/p')"
  if [ -n "$prev_tag" ] && [[ "$this_tag_text" == *"$prev_tag"* ]]; then
    echo true
  else
    echo false
  fi
}

# runtime_admission_decision <target_kind> <target_number>
#                            <matching_issue_numbers_csv>
#                            <matching_pr_numbers_csv> <attempt_open>
# target_kind = issue|pr. Matching lists exclude the target itself.
# Output is one of: ADMIT, IN_FLIGHT, EXISTING_PR:<n>, CONFLICT.
runtime_admission_decision() {
  local kind="$1" target="$2" issues_csv="$3" prs_csv="$4" attempt_open="$5"
  local issue_count=0 pr_count=0
  [ -n "$issues_csv" ] && issue_count=$(awk -F',' '{print NF}' <<< "$issues_csv")
  [ -n "$prs_csv" ] && pr_count=$(awk -F',' '{print NF}' <<< "$prs_csv")

  case "$kind" in
    issue)
      if [ "$issue_count" -gt 0 ] || [ "$pr_count" -gt 1 ]; then
        echo CONFLICT
      elif [ "$pr_count" -eq 1 ]; then
        echo "EXISTING_PR:${prs_csv}"
      elif [ "$attempt_open" = "true" ]; then
        echo IN_FLIGHT
      else
        echo ADMIT
      fi
      ;;
    pr)
      if [ "$pr_count" -gt 0 ] || [ "$issue_count" -gt 1 ]; then
        echo CONFLICT
      elif [ "$attempt_open" = "true" ]; then
        echo IN_FLIGHT
      else
        echo ADMIT
      fi
      ;;
    *) echo CONFLICT ;;
  esac
}

runtime_attempt_tag() {
  case "$1" in
    BUILD) echo BUILD_ATTEMPT_ID ;;
    REVIEW) echo REVIEW_ATTEMPT_ID ;;
    OWNER) echo OWNER_ATTEMPT_ID ;;
    *) echo UNKNOWN_ATTEMPT_ID ;;
  esac
}

runtime_attempt_start_prefix() {
  case "$1" in
    BUILD) echo "BUILD START:" ;;
    REVIEW) echo "REVIEW START:" ;;
    OWNER) echo "OWNER START:" ;;
    *) echo "UNKNOWN START:" ;;
  esac
}

# runtime_attempt_status <comments_json> <actor> <attempt_id> <started_at>
# Returns complete|missing. A terminal counts only when it is after the start
# and carries this exact attempt tag.
runtime_attempt_status() {
  local comments_json="$1" actor="$2" attempt_id="$3" started_at="$4" tag needle
  tag="$(runtime_attempt_tag "$actor")"
  needle="[${tag}: ${attempt_id}]"
  local rows body term tag_text
  rows="$(jq -c --arg started "$started_at" '
    [ .[] | select(.created_at > $started) ] | sort_by(.created_at) | .[].body
  ' <<< "$comments_json")"
  while IFS= read -r body; do
    [ -z "$body" ] && continue
    body="$(jq -r . <<< "$body")"
    term="$(runtime_terminal_line "$body")"
    if runtime_terminal_is_typed "$actor" "$term"; then
      tag_text="$(runtime_terminal_tag_text "$body")"
      case "$tag_text" in *"$needle"*) echo complete; return ;; esac
    fi
  done <<< "$rows"
  echo missing
}

# runtime_actor_attempt_open <comments_json> <actor>
# Returns true when the latest start receipt for this actor has no correlated
# terminal. Used for REVIEW/OWNER admission as well as manual safety checks.
runtime_actor_attempt_open() {
  local comments_json="$1" actor="$2" prefix tag start line attempt started status
  prefix="$(runtime_attempt_start_prefix "$actor")"
  tag="$(runtime_attempt_tag "$actor")"
  start="$(jq -c --arg prefix "$prefix" '
    def first_nonblank:
      (. // "") | split("\n") | map(select(test("[^\\s]"))) | (.[0] // "")
      | sub("^\\s+"; "") | sub("\\s+$"; "");
    [ .[] | . + {line: (.body | first_nonblank)} | select(.line | startswith($prefix)) ]
    | sort_by(.created_at) | (.[-1] // null)
  ' <<< "$comments_json")"
  if [ "$start" = "null" ] || [ -z "$start" ]; then echo false; return; fi
  line="$(jq -r '.line' <<< "$start")"
  attempt="$(printf '%s' "$line" | sed -nE "s/.*\\[${tag}: ([^]]+)\\].*/\\1/p")"
  started="$(jq -r '.created_at' <<< "$start")"
  if [ -z "$attempt" ]; then echo true; return; fi
  status="$(runtime_attempt_status "$comments_json" "$actor" "$attempt" "$started")"
  if [ "$status" = complete ]; then echo false; else echo true; fi
}

# runtime_correct_cycle_count <comments_json>
# CF-REVIEW-BIND-01: total REVIEW `CORRECT:` terminal receipts already
# posted on this thread, derived purely from durable comments/receipts —
# no separate state store. Used to enforce the already-approved bounded-
# repair intent (3 CORRECT cycles without ACCEPT) deterministically at
# admission time instead of resting on REVIEW's own prose discipline.
runtime_correct_cycle_count() {
  local comments_json="$1" body term count=0
  while IFS= read -r body; do
    [ -z "$body" ] && continue
    body="$(jq -r . <<< "$body")"
    term="$(runtime_terminal_line "$body")"
    case "$term" in CORRECT|CORRECT:*) count=$((count + 1)) ;; esac
  done < <(jq -c '.[].body' <<< "$comments_json")
  printf '%s' "$count"
}

# runtime_correct_cycles_exhausted <comments_json>
# True once a 4th CORRECT cycle is being attempted (the comment that
# triggered this admission is already included in <comments_json>, so 3
# prior CORRECT terminals plus this one is exactly the bound: the 3rd
# CORRECT is admitted, the 4th is refused).
runtime_correct_cycles_exhausted() {
  local count
  count="$(runtime_correct_cycle_count "$1")"
  if [ "$count" -gt 3 ]; then echo true; else echo false; fi
}

# runtime_closing_issue_number <body>
# The single issue number a PR body's Closes/Fixes/Resolves keyword names,
# or empty when there is none or more than one distinct number. Ambiguity
# must fail closed rather than guess among candidates — this is the only
# safe input to a source-issue OUTCOME-ID fallback.
runtime_closing_issue_number() {
  local body="$1" nums count
  nums="$(printf '%s' "$body" \
    | grep -inoE '(close[sd]?|fix(e[sd])?|resolve[sd]?)[[:space:]]+#[0-9]+.*' \
    | grep -oE '#[0-9]+' | grep -oE '[0-9]+' | sort -u)"
  count=0
  [ -n "$nums" ] && count=$(printf '%s\n' "$nums" | grep -c '.')
  if [ "$count" -eq 1 ]; then printf '%s' "$nums"; else printf ''; fi
}

# Latest BUILD START for this outcome without a later correlated BUILD terminal.
runtime_outcome_attempt_open() {
  local comments_json="$1" outcome_id="$2" start line attempt started status
  start="$(jq -c --arg oid "$outcome_id" '
    def first_nonblank:
      (. // "") | split("\n") | map(select(test("[^\\s]"))) | (.[0] // "")
      | sub("^\\s+"; "") | sub("\\s+$"; "");
    [ .[] | . + {line: (.body | first_nonblank)}
      | select(.line | startswith("BUILD START:"))
      | select(.line | contains("OUTCOME-ID=" + $oid + " "))
    ] | sort_by(.created_at) | (.[-1] // null)
  ' <<< "$comments_json")"
  if [ "$start" = "null" ] || [ -z "$start" ]; then echo false; return; fi
  line="$(jq -r '.line' <<< "$start")"
  attempt="$(printf '%s' "$line" | sed -nE 's/.*\[BUILD_ATTEMPT_ID: ([^]]+)\].*/\1/p')"
  started="$(jq -r '.created_at' <<< "$start")"
  if [ -z "$attempt" ]; then echo true; return; fi
  status="$(runtime_attempt_status "$comments_json" BUILD "$attempt" "$started")"
  if [ "$status" = complete ]; then echo false; else echo true; fi
}
