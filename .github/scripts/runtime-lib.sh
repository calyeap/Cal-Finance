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


# runtime_contract_hash <body>
# CF-CONTRACT-FENCE-01: deterministic fingerprint (SHA-256, first 12 hex
# chars) of a canonical task-contract body. V1 deliberately hashes the
# whole body — no section-level parsing. Stamped into an attempt's own
# START receipt (CONTRACT: <hash>) and recomputed later, at a consequential
# routing/merge/Slack seam, against the current canonical body to detect a
# contract that changed after this attempt loaded it.
runtime_contract_hash() {
  printf '%s' "$1" | sha256sum | cut -c1-12
}

# runtime_contract_is_stale <loaded_hash> <current_body>
# True when <current_body>'s fingerprint no longer matches <loaded_hash> —
# the canonical contract changed since this attempt's own START. An empty
# <loaded_hash> (no fingerprint was recorded for this attempt) is never
# treated as stale: there is nothing to compare against, so the fence only
# fails closed on an actual, evidenced mismatch.
runtime_contract_is_stale() {
  local loaded_hash="$1" current_body="$2"
  if [ -z "$loaded_hash" ]; then
    echo false
  elif [ "$loaded_hash" = "$(runtime_contract_hash "$current_body")" ]; then
    echo false
  else
    echo true
  fi
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

# runtime_slack_kind <body>
# Slack is an interrupt/inform channel for genuine Calvin-visible terminal
# outcomes. CF-SLACK-ACTION-ONLY-01 (issue #377) made it an action-only
# channel: `calvin_required`/`actionable_blocked` are real human gates.
# CF-TERMINAL-NOTIFY-RELIABILITY-01 (issue #408) explicitly supersedes that
# choice for final delegated-task outcomes: OWNER's own `COMPLETE:` is now
# `finished`, and OWNER's own definitively terminal `BLOCKED: AI`/
# `BLOCKED: EXTERNAL` (no continuing owner/worker) is now `stopped` — both
# one-time informational notifications, never an action gate.
#
# A transient child `BLOCKED: AI`/`BLOCKED: EXTERNAL` (BUILD/REVIEW, not yet
# reconciled by OWNER) stays `none`: OWNER is still reconciling it, so it
# is distinguished from OWNER's own terminal the same way
# runtime_is_child_terminal does — by the absence of an OWNER_ATTEMPT_ID tag
# (via runtime_terminal_tag_text, which also covers a metadata-first tag
# line). An untagged BLOCKED fails closed to `none` rather than guessing it
# is OWNER's own. A stale-contract fence exit (body contains
# `STALE_CONTRACT`) stays `none` regardless of actor — it carries no
# product signal about the outcome (see BUILD.md's Stale contract fence).
runtime_slack_kind() {
  local body="$1" line tag_text
  line="$(runtime_terminal_line "$body")"
  case "$line" in
    "CALVIN REQUIRED:"*) echo calvin_required; return ;;
    "BLOCKED: ACTIONABLE"*) echo actionable_blocked; return ;;
    "COMPLETE:"*) echo finished; return ;;
  esac
  case "$line" in
    *STALE_CONTRACT*) echo none; return ;;
  esac
  case "$line" in
    "BLOCKED: AI"*|"BLOCKED: EXTERNAL"*)
      tag_text="$(runtime_terminal_tag_text "$body")"
      case "$tag_text" in
        *"[OWNER_ATTEMPT_ID: "*) echo stopped; return ;;
      esac
      ;;
  esac
  echo none
}

# runtime_is_calvin_ruling_line <line>
# True when <line> is a CALVIN RULING marker: "CALVIN RULING" followed by a
# colon, or an em dash / hyphen separator (with optional leading spaces) —
# e.g. "CALVIN RULING — APPROVE OPTION B" or "CALVIN RULING: approve".
# Mirrors calvin-ruling-lib.sh's own marker check (which delegates here so
# the two can't drift apart); kept in runtime-lib.sh, not sourced from
# calvin-ruling-lib.sh, because that file itself sources this one and a
# cycle would loop. Used by runtime_slack_is_duplicate to find the most
# recent Calvin resolution on a thread (CF-SLACK-DEDUPE-02).
runtime_is_calvin_ruling_line() {
  printf '%s' "$1" | grep -Eq '^CALVIN RULING(:| *[—-])'
}

# runtime_is_gate_reset_line <line>
# True when <line> is an admission receipt that Calvin's own re-drive action
# produces: reapplying a wake label posts a fresh "BUILD START:" / "REVIEW
# START:" comment with no CALVIN RULING text at all (the documented recovery
# path for a transport-failure BLOCKED: ACTIONABLE — see CC.md's CORRECT
# backstop). That re-drive is itself evidence the prior gate was cleared, so
# it resets the gate exactly like a CALVIN RULING would. "OWNER START:" is
# deliberately excluded: that marks the #365 reconciliation wake, which does
# not indicate the underlying gate was resolved.
runtime_is_gate_reset_line() {
  case "$1" in
    "BUILD START:"*|"REVIEW START:"*) return 0 ;;
    *) return 1 ;;
  esac
}

# runtime_gate_reset_cause <line>
# CF-SLACK-REVIEW-GATE-DEDUPE-01 (Calvin's bounded-repair authorisation,
# PR #423 issuecomment-6074231232): extracts the `[CAUSE: <value>]` marker
# cc-auto-fire.yml's fire-build/fire-review jobs stamp onto their own
# "BUILD START:"/"REVIEW START:" receipt — `label-redrive` when the fire
# was triggered by (re)applying the needs-build-wake/needs-cc-rereview
# wake label (the documented deliberate re-drive mechanism: OWNER.md's own
# CONTINUE handoff, a transport-failure recovery, or Calvin reapplying it
# by hand — this marker only records which GitHub event fired the run, not
# who caused it, since a worker's own label-apply call and a human's are
# indistinguishable in the event payload), or `comment-rereview` when it
# was an ordinary same-head continuation (REVIEW's CORRECT: comment firing
# another BUILD round, or BUILD's DONE: comment firing the next REVIEW
# round). Derived there only from trusted github.event_name/label context,
# never from worker-authored comment text, so a worker cannot forge this
# value into its own DONE:/CORRECT:/BLOCKED: comment — that text is never a
# "BUILD START:"/"REVIEW START:" line to begin with, so
# runtime_is_gate_reset_line already excludes it before this is ever
# called. Empty when the line carries no such marker (every START receipt
# posted before this marker existed), so an older, unmarked reset-line
# receipt keeps the exact pre-existing behaviour (see
# runtime_slack_is_duplicate) instead of being treated as a proven
# deliberate re-drive it never claimed to be.
runtime_gate_reset_cause() {
  printf '%s' "$1" | sed -nE 's/.*\[CAUSE: ([^]]+)\].*/\1/p'
}

# runtime_gate_action_ref <line>
# CF-SLACK-REVIEW-GATE-DEDUPE-01 (issue #422, corrected per PR #423 REVIEW):
# a deterministic, narrow fingerprint of *which* concrete human action a
# Slack-eligible terminal line names — e.g. the exact commit/ref and ticker
# a live-proof BLOCKED: ACTIONABLE asks Calvin to act on — so a still-open
# gate can be told apart from a genuinely distinct later one even when both
# happen to share a Slack kind. Deliberately narrow: no free-text
# similarity/NLP, no new classifier — only two literal, already-used
# shapes:
#   1. an explicit `ref=<token>` and/or `ticker=<token>` key=value pair
#      (case-insensitive key), tolerating the real wording Calvin-facing
#      BLOCKED: ACTIONABLE lines actually use — each of the key and the
#      value optionally wrapped in a single backtick, and optional spaces
#      around the `=` (e.g. `` `ref` = `<sha>` `` / `` `ticker` = `MSFT` ``,
#      not just the bare `ref=<sha>` the original fixtures assumed), or
#   2. failing that, a bare commit-SHA-looking token (7-40 lowercase hex
#      chars, containing at least one a-f letter so an ordinary decimal
#      issue/attempt number never matches) *anchored to the exact
#      `at <sha> (` context* analyzer-live-proof.yml's own
#      `at ${SHORT} (${joined})` wording uses — not any bare hex-looking
#      token appearing anywhere in the line.
# REVIEW's PR #423 correction: matching shape 2 anywhere in the line (not
# just that anchored context) let a genuinely distinct later BLOCKED:
# ACTIONABLE that merely *mentions* the same commit in passing (e.g. "...
# grant the Supabase service-role secret for head 8930faa...") be
# fingerprinted with the same ref as an earlier, unrelated live-proof
# failure on that commit — silently conflating two different required
# actions into one gate. Anchoring to the literal `at <sha> (` shape keeps
# the fallback scoped to the one workflow wording it was always meant to
# recognize; a free-text mention with no identifiable ref of its own
# correctly falls back to kind-only/reset-line comparison instead (see
# runtime_slack_is_duplicate), which still fails open rather than guessing.
# Empty when neither shape is present — callers must then fall back to
# kind-only comparison (the pre-existing, still-correct behaviour for a
# free-text blocker with no identifying ref/ticker of its own).
# REVIEW's second PR #423 correction (new failure class, not the VERIFY (d)
# re-drive gap): the real analyzer-live-proof.yml BLOCKED: ACTIONABLE
# wording Calvin actually sees backtick-wraps the key and the value and
# spaces the `=` (`` `ref` = `<sha>` ``), which the original
# `(ref|ticker)=[^][ ,()]+` regex never matched — so every restatement of
# that real blocker extracted no ref at all and fell through to the
# ref-less reset path, letting an ordinary REVIEW/OWNER re-review alert
# again even though the required action had not changed. The backticks and
# spacing are stripped before lowercasing/joining so a backtick-wrapped
# restatement and a bare `ref=<sha>` restatement of the same action
# normalize to the identical key.
runtime_gate_action_ref() {
  local line="$1" out match tok
  out="$(printf '%s' "$line" | grep -ioE '`?(ref|ticker)`?[[:space:]]*=[[:space:]]*`?[^][ ,()`]+`?' | tr -d ' `' | tr '[:upper:]' '[:lower:]' | sort -u | tr '\n' ';')"
  if [ -n "$out" ]; then
    printf '%s' "$out"
    return 0
  fi
  match="$(printf '%s' "$line" | grep -oE '\bat [0-9a-f]{7,40} \(' | head -n1)"
  if [ -n "$match" ]; then
    tok="$(printf '%s' "$match" | grep -oE '[0-9a-f]{7,40}')"
    if [[ "$tok" =~ [a-f] ]]; then
      printf '%s' "$tok"
      return 0
    fi
  fi
  printf ''
}

# runtime_slack_is_duplicate <comments_json> <this_created_at> <this_raw>
# Pure. CF-SLACK-DEDUPE-02: dedupes by the underlying still-open Calvin
# gate — a deterministic key of (canonical item, implicit in <comments_json>
# already being scoped to one thread; Slack kind; current open-gate state)
# — never by a worker BUILD_/REVIEW_/OWNER_ATTEMPT_ID or by which actor or
# wording restated it (the structural gap issue #391 reports: the previous
# version required <this_raw> to literally reference an earlier alerted
# comment's own attempt ID, which is not a guaranteed convention).
#
# True only when <this_raw> is itself Slack-eligible (runtime_slack_kind !=
# none) and, scanning <comments_json> for comments strictly before
# <this_created_at> in most-recent-first order, the first comment that is
# a Calvin resolution (runtime_is_calvin_ruling_line), a gate-reset re-drive
# receipt (runtime_is_gate_reset_line), or itself Slack-eligible decides the
# outcome:
#   - hitting a resolution first means any prior gate was already closed,
#     so <this_raw> opens a fresh gate — not a duplicate, whatever its
#     kind;
#   - hitting a same-kind alert first means an unresolved alert for this
#     exact gate already reached Slack — a duplicate, regardless of which
#     actor authored either comment or how either is worded — UNLESS
#     <this_raw> carries a runtime_gate_action_ref and that alert's own ref
#     differs, in which case it is a genuinely distinct human action and
#     not a duplicate (CF-SLACK-REVIEW-GATE-DEDUPE-01, issue #422);
#   - hitting a gate-reset re-drive receipt (runtime_is_gate_reset_line)
#     closes the prior gate exactly like a resolution does when either
#     <this_raw> has no runtime_gate_action_ref of its own (the
#     pre-existing #391 behaviour: a ref-less gate has no other signal that
#     the prior blocker was cleared), or the reset receipt itself carries a
#     `[CAUSE: label-redrive]` marker (CF-SLACK-REVIEW-GATE-DEDUPE-01,
#     Calvin's bounded-repair authorisation on PR #423 — see
#     runtime_gate_reset_cause) — a deterministic, trusted signal, stamped
#     by cc-auto-fire.yml itself from github.event_name/label and never
#     from worker text, that this particular "BUILD START:"/"REVIEW
#     START:" was fired by (re)applying the needs-build-wake/
#     needs-cc-rereview wake label rather than by an ordinary CORRECT:/
#     DONE:-triggered continuation. That is the one documented deliberate
#     re-drive mechanism (issue #422 VERIFY (d)), so it resets a ref-bearing
#     gate too, even when the restated blocker names the exact same
#     ref/ticker. A reset receipt with no `[CAUSE: ...]` marker at all (an
#     older receipt, posted before this marker existed) or with
#     `[CAUSE: comment-rereview]` does NOT, by itself, reset a ref-bearing
#     gate — a worker simply continuing review/build on an unchanged head
#     posts that same shape and carries no evidence the required action
#     was ever addressed; per issue #422 this must not, on its own, reopen
#     a gate whose required action (ref/ticker) is identifiable and
#     unchanged (the PR #420 bug) — only an actual resolution, a proven
#     label-redrive, or a differing ref does;
#   - hitting a different-kind alert first is a distinct gate; it neither
#     resolves nor restates this one, so the scan continues past it.
# No earlier resolution, re-drive receipt, or alert at all (including an
# empty/omitted history) means this is the first alert for the gate: not a
# duplicate.
runtime_slack_is_duplicate() {
  local comments_json="$1" before="$2" this_raw="$3" kind this_ref
  kind="$(runtime_slack_kind "$this_raw")"
  if [ "$kind" = none ]; then echo false; return; fi
  this_ref="$(runtime_gate_action_ref "$(runtime_terminal_line "$this_raw")")"

  local earlier_bodies body first k body_ref
  earlier_bodies="$(jq -c --arg before "$before" '
    [ .[] | select(.created_at < $before) ] | sort_by(.created_at) | reverse | .[].body
  ' <<< "$comments_json")"

  while IFS= read -r body; do
    [ -z "$body" ] && continue
    body="$(jq -r . <<< "$body")"
    first="$(runtime_first_line "$body")"
    if runtime_is_calvin_ruling_line "$first"; then
      echo false
      return
    fi
    if runtime_is_gate_reset_line "$first"; then
      if [ -z "$this_ref" ] || [ "$(runtime_gate_reset_cause "$first")" = label-redrive ]; then
        echo false
        return
      fi
    fi
    # Classify from the raw body, not a pre-extracted terminal line: an
    # earlier metadata-first OWNER terminal (the [OWNER_ATTEMPT_ID: ...]
    # tag on its own line above the typed terminal) needs runtime_slack_kind
    # to see that tag text to classify as `stopped`, which runtime_terminal_line
    # alone already strips away.
    k="$(runtime_slack_kind "$body")"
    if [ "$k" = "$kind" ]; then
      if [ -n "$this_ref" ]; then
        body_ref="$(runtime_gate_action_ref "$(runtime_terminal_line "$body")")"
        if [ -n "$body_ref" ]; then
          [ "$body_ref" = "$this_ref" ] && echo true || echo false
          return
        fi
        # <this_raw> names a specific action but this earlier same-kind
        # alert does not — ambiguous whether it is the same gate. Fail
        # open per issue #422's VERIFY: never silently swallow a possibly
        # genuinely new actionable gate.
        echo false
        return
      fi
      echo true
      return
    fi
  done <<< "$earlier_bodies"
  echo false
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
