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

runtime_first_line() {
  local body="$1" line
  while IFS= read -r line || [ -n "$line" ]; do
    if [[ "$line" =~ [^[:space:]] ]]; then
      runtime_trim "$line"
      return 0
    fi
  done <<< "$body"
  printf ''
}

runtime_strip_heading() {
  local line="$1"
  printf '%s' "$line" | sed -E 's/^#{1,6}[[:space:]]+//'
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

runtime_outcome_id() {
  runtime_extract_field "$1" "OUTCOME-ID"
}

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
  line="$(runtime_strip_heading "$(runtime_first_line "$1")")"
  case "$line" in CORRECT|CORRECT:*) echo true ;; *) echo false ;; esac
}

runtime_is_calvin_required() {
  local line
  line="$(runtime_strip_heading "$(runtime_first_line "$1")")"
  case "$line" in "CALVIN REQUIRED:"*) echo true ;; *) echo false ;; esac
}

runtime_done_pr_number() {
  local line
  line="$(runtime_strip_heading "$(runtime_first_line "$1")")"
  case "$line" in DONE:*) ;; *) return 0 ;; esac
  printf '%s' "$line" | grep -oE '/pull/[0-9]+' | head -n1 | grep -oE '[0-9]+' || true
}

# Child terminals that require parent reconciliation. OWNER receipts carry an
# OWNER_ATTEMPT_ID and are deliberately excluded so OWNER never wakes itself.
runtime_is_child_terminal() {
  local line
  line="$(runtime_strip_heading "$(runtime_first_line "$1")")"
  case "$line" in
    *"[OWNER_ATTEMPT_ID: "*) echo false ;;
    "DONE: EVIDENCE"*|STOP:*|BLOCKED:*|"CALVIN REQUIRED:"*) echo true ;;
    *) echo false ;;
  esac
}

runtime_parent_terminal_kind() {
  local line
  line="$(runtime_strip_heading "$(runtime_first_line "$1")")"
  case "$line" in
    CONTINUE:*) echo CONTINUE ;;
    COMPLETE:*) echo COMPLETE ;;
    BLOCKED:*) echo BLOCKED ;;
    "CALVIN REQUIRED:"*) echo CALVIN_REQUIRED ;;
    *) echo NONE ;;
  esac
}

runtime_slack_kind() {
  local line
  line="$(runtime_strip_heading "$(runtime_first_line "$1")")"
  case "$line" in
    "CALVIN REQUIRED:"*) echo calvin_required ;;
    "BLOCKED: ACTIONABLE"*) echo actionable_blocked ;;
    COMPLETE:*) echo complete ;;
    *) echo none ;;
  esac
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
  local comments_json="$1" actor="$2" attempt_id="$3" started_at="$4" tag
  tag="$(runtime_attempt_tag "$actor")"
  jq -r --arg actor "$actor" --arg tag "$tag" --arg id "$attempt_id" --arg started "$started_at" '
    def first_nonblank:
      (. // "") | split("\n") | map(select(test("[^\\s]"))) | (.[0] // "")
      | sub("^\\s+"; "") | sub("\\s+$"; "") | sub("^#{1,6}[ \\t]+"; "");
    def typed($a):
      if $a == "BUILD" then test("^(DONE:|BLOCKED:|STOP:|CALVIN REQUIRED:)")
      elif $a == "REVIEW" then test("^(ACCEPT:|CORRECT:|BLOCKED:|STOP:|CALVIN REQUIRED:)")
      elif $a == "OWNER" then test("^(CONTINUE:|COMPLETE:|BLOCKED:|CALVIN REQUIRED:)")
      else false end;
    [ .[]
      | select(.created_at > $started)
      | (. + {line: (.body | first_nonblank)})
      | select(.line | typed($actor))
      | select(.line | contains("[" + $tag + ": " + $id + "]"))
    ] | if length > 0 then "complete" else "missing" end
  ' <<< "$comments_json"
}

# Latest BUILD START for this outcome without a later correlated BUILD terminal.
runtime_outcome_attempt_open() {
  local comments_json="$1" outcome_id="$2"
  local start
  start="$(jq -c --arg oid "$outcome_id" '
    def first_nonblank:
      (. // "") | split("\n") | map(select(test("[^\\s]"))) | (.[0] // "")
      | sub("^\\s+"; "") | sub("\\s+$"; "");
    [ .[] | . + {line: (.body | first_nonblank)}
      | select(.line | startswith("BUILD START:"))
      | select(.line | contains("OUTCOME-ID=" + $oid + " "))
    ] | sort_by(.created_at) | (.[-1] // null)
  ' <<< "$comments_json")"
  if [ "$start" = "null" ] || [ -z "$start" ]; then
    echo false
    return
  fi
  local line attempt started status
  line="$(jq -r '.line' <<< "$start")"
  attempt="$(printf '%s' "$line" | sed -nE 's/.*\[BUILD_ATTEMPT_ID: ([^]]+)\].*/\1/p')"
  started="$(jq -r '.created_at' <<< "$start")"
  if [ -z "$attempt" ]; then
    echo true
    return
  fi
  status="$(runtime_attempt_status "$comments_json" BUILD "$attempt" "$started")"
  if [ "$status" = "complete" ]; then echo false; else echo true; fi
}
