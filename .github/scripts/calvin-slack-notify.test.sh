#!/usr/bin/env bash
# CF-WORKFLOW-RESET-TERMINAL-HANDOFF-REPAIR-02
#
# Deterministic, network-free unit tests for calvin-slack-notify.sh.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=calvin-slack-notify.sh
source "${SCRIPT_DIR}/calvin-slack-notify.sh"

FAILURES=0

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "ok - $desc"
  else
    echo "not ok - $desc (expected [$expected], got [$actual])"
    FAILURES=$((FAILURES + 1))
  fi
}

assert_status() {
  local desc="$1" expected_rc="$2" actual_rc="$3"
  if [ "$expected_rc" = "$actual_rc" ]; then
    echo "ok - $desc"
  else
    echo "not ok - $desc (expected rc $expected_rc, got $actual_rc)"
    FAILURES=$((FAILURES + 1))
  fi
}

# --- payload eligibility mirrors runtime_slack_kind -----------------------

payload=$(calvin_slack_payload "BLOCKED: ACTIONABLE — refresh OWNER_FIRE_TOKEN" "o/r" "https://x/1")
rc=$?
assert_status "actionable_blocked is eligible" 0 "$rc"
assert_eq "actionable payload carries the ACTIONABLE BLOCKED header" "ACTIONABLE BLOCKED" "$(jq -r '.text' <<<"$payload" | head -n1 | sed -E 's/ — .*//')"

payload=$(calvin_slack_payload "CALVIN REQUIRED: pick A or B" "o/r" "https://x/1")
assert_eq "calvin_required payload carries the CALVIN REQUIRED header" "CALVIN REQUIRED" "$(jq -r '.text' <<<"$payload" | head -n1 | sed -E 's/ — .*//')"

# CF-TERMINAL-NOTIFY-RELIABILITY-01 (issue #408) explicitly supersedes
# CF-SLACK-ACTION-ONLY-01's blanket COMPLETE exclusion for OWNER's own
# final delegated-task outcome: COMPLETE is now one informational FINISHED
# notification (COMPLETE is OWNER-only vocabulary, so no tag is required).
payload=$(calvin_slack_payload "COMPLETE: meaningful parent outcome [OWNER_ATTEMPT_ID: O1]" "o/r" "https://x/1")
rc=$?
assert_status "OWNER's own COMPLETE is Slack-eligible as an informational FINISHED" 0 "$rc"
assert_eq "COMPLETE payload carries the FINISHED header" "FINISHED" "$(jq -r '.text' <<<"$payload" | head -n1 | sed -E 's/ — .*//')"
case "$(jq -r '.text' <<<"$payload")" in
  *"<!channel>"*)
    echo "not ok - an informational FINISHED must not @channel-ping Calvin"
    FAILURES=$((FAILURES + 1))
    ;;
  *) echo "ok - an informational FINISHED carries no <!channel> ping" ;;
esac
case "$(jq -r '.text' <<<"$payload")" in
  *"Action: none"*) echo "ok - an informational FINISHED states Action: none" ;;
  *)
    echo "not ok - an informational FINISHED must state Action: none"
    FAILURES=$((FAILURES + 1))
    ;;
esac

payload=$(calvin_slack_payload "COMPLETE: meaningful parent outcome" "o/r" "https://x/1")
rc=$?
assert_status "a bare COMPLETE with no attempt tag still classifies as FINISHED" 0 "$rc"

# OWNER's own definitively terminal BLOCKED: AI/BLOCKED: EXTERNAL (no
# continuing owner/worker) is now one informational STOPPED notification.
payload=$(calvin_slack_payload "BLOCKED: AI — final stop, no viable path [OWNER_ATTEMPT_ID: O1]" "o/r" "https://x/1")
rc=$?
assert_status "OWNER's own definitively terminal BLOCKED: AI is Slack-eligible as an informational STOPPED" 0 "$rc"
assert_eq "OWNER's own BLOCKED: AI payload carries the STOPPED header" "STOPPED" "$(jq -r '.text' <<<"$payload" | head -n1 | sed -E 's/ — .*//')"
case "$(jq -r '.text' <<<"$payload")" in
  *"<!channel>"*)
    echo "not ok - an informational STOPPED must not @channel-ping Calvin"
    FAILURES=$((FAILURES + 1))
    ;;
  *) echo "ok - an informational STOPPED carries no <!channel> ping" ;;
esac
case "$(jq -r '.text' <<<"$payload")" in
  *"Action: none"*) echo "ok - an informational STOPPED states Action: none" ;;
  *)
    echo "not ok - an informational STOPPED must state Action: none"
    FAILURES=$((FAILURES + 1))
    ;;
esac

payload=$(calvin_slack_payload "CALVIN REQUIRED: pick A or B" "o/r" "https://x/1")
case "$(jq -r '.text' <<<"$payload")" in
  *"Action: none"*)
    echo "not ok - a real action gate (CALVIN REQUIRED) must not say Action: none"
    FAILURES=$((FAILURES + 1))
    ;;
  *) echo "ok - a real action gate (CALVIN REQUIRED) carries no Action: none" ;;
esac

# A transient child BLOCKED: AI (BUILD/REVIEW, not OWNER's own) stays
# Slack-silent while OWNER is still reconciling it.
set +e
calvin_slack_payload "BLOCKED: AI — worker timed out [BUILD_ATTEMPT_ID: B1]" "o/r" "https://x/1" >/dev/null
rc=$?
set -e
assert_status "a transient child BLOCKED: AI stays Slack-ineligible pending OWNER reconciliation" 1 "$rc"

set +e
calvin_slack_payload "BLOCKED: AI — worker timed out" "o/r" "https://x/1" >/dev/null
rc=$?
set -e
assert_status "an untagged BLOCKED: AI fails closed to Slack-ineligible" 1 "$rc"

# A stale-contract fence exit stays Slack-ineligible even from OWNER's own
# terminal — it carries no product signal about the outcome.
set +e
calvin_slack_payload "BLOCKED: AI — STALE_CONTRACT: canonical contract changed since START (loaded abc, current def); no route/merge/alert taken. [OWNER_ATTEMPT_ID: O1]" "o/r" "https://x/1" >/dev/null
rc=$?
set -e
assert_status "a stale-contract fence exit stays Slack-ineligible even from OWNER's own terminal" 1 "$rc"

set +e
calvin_slack_payload "CONTINUE: next child" "o/r" "https://x/1" >/dev/null
rc=$?
set -e
assert_status "CONTINUE is not eligible" 1 "$rc"

# --- the internal OWNER_ATTEMPT_ID tag never reaches the Slack message ----

payload=$(calvin_slack_payload $'BLOCKED: ACTIONABLE — refresh OWNER_FIRE_TOKEN [OWNER_ATTEMPT_ID: TERMINAL-9-1]' "o/r" "https://x/1")
case "$(jq -r '.text' <<<"$payload")" in
  *"[OWNER_ATTEMPT_ID:"*)
    echo "not ok - OWNER_ATTEMPT_ID tag leaked into the Slack message"
    FAILURES=$((FAILURES + 1))
    ;;
  *)
    echo "ok - OWNER_ATTEMPT_ID tag is stripped from the Slack message"
    ;;
esac

# --- a heading-wrapped/multi-line comment still classifies on its own
# first, trimmed line -------------------------------------------------------

payload=$(calvin_slack_payload $'## BLOCKED: ACTIONABLE — refresh secret\nmore context below' "o/r" "https://x/1")
rc=$?
assert_status "heading-normalized first line still classifies" 0 "$rc"

# --- issue #375 (CF-WORKFLOW-TERMINAL-NORMALIZE-01): a standalone
# [BUILD_ATTEMPT_ID: ...] metadata line preceding the real typed terminal
# must not hide it from Slack eligibility -----------------------------------

payload=$(calvin_slack_payload $'[BUILD_ATTEMPT_ID: BUILD-9-1]\nCALVIN REQUIRED: pick A or B' "o/r" "https://x/1")
rc=$?
assert_status "metadata-first CALVIN REQUIRED is still Slack eligible" 0 "$rc"
assert_eq "metadata-first payload carries the CALVIN REQUIRED header" "CALVIN REQUIRED" "$(jq -r '.text' <<<"$payload" | head -n1 | sed -E 's/ — .*//')"

set +e
calvin_slack_payload $'Some narrative update.\n\nCALVIN REQUIRED: quoted later, not a terminal' "o/r" "https://x/1" >/dev/null
rc=$?
set -e
assert_status "prose followed later by CALVIN REQUIRED stays ineligible" 1 "$rc"

# --- calvin_slack_send no-ops (rc 0, no request) when the line is not
# Slack-eligible, so every call site can call it unconditionally. Per
# CF-TERMINAL-NOTIFY-RELIABILITY-01 (issue #408) requirement 7, this is no
# longer silent: it prints a distinct "skipped" line so a green step here
# is never mistaken for a proven send. -------------------------------------

CURL_CALLED=0
curl() { CURL_CALLED=1; }
export -f curl

set +e
SEND_OUT="$(calvin_slack_send "BLOCKED: AI — worker timed out" "o/r" "https://x/1")"
rc=$?
set -e
assert_status "calvin_slack_send no-ops on an ineligible line" 0 "$rc"
assert_eq "calvin_slack_send never calls curl for an ineligible line" 0 "$CURL_CALLED"
case "$SEND_OUT" in
  *"skipped"*) echo "ok - calvin_slack_send logs a distinct skipped line for an ineligible line" ;;
  *)
    echo "not ok - calvin_slack_send must log a distinct skipped line for an ineligible line"
    FAILURES=$((FAILURES + 1))
    ;;
esac

# --- calvin_slack_send does send, and fails closed on a bad webhook
# response, for an eligible line -------------------------------------------

curl() { echo -n '500'; }
export -f curl
export SLACK_WEBHOOK_URL=https://hooks.example/test

set +e
calvin_slack_send "BLOCKED: ACTIONABLE — refresh secret" "o/r" "https://x/1" >/dev/null 2>&1
rc=$?
set -e
assert_status "calvin_slack_send fails closed on a non-2xx webhook response" 1 "$rc"

curl() { echo -n '200'; }
export -f curl

set +e
SEND_OUT="$(calvin_slack_send "BLOCKED: ACTIONABLE — refresh secret" "o/r" "https://x/1")"
rc=$?
set -e
assert_status "calvin_slack_send succeeds on a 2xx webhook response" 0 "$rc"
case "$SEND_OUT" in
  *"sent (200)"*) echo "ok - calvin_slack_send logs a verifiable receipt line with the response code on a 2xx send" ;;
  *)
    echo "not ok - calvin_slack_send must log a verifiable receipt line with the response code on a 2xx send"
    FAILURES=$((FAILURES + 1))
    ;;
esac

# --- CF-SLACK-DEDUPE-02 (issue #391): dedupe by the underlying still-open
# Calvin gate — canonical item + Slack kind + open/resolved state — never
# by a worker BUILD_/REVIEW_/OWNER_ATTEMPT_ID or by which actor/wording
# restated it -------------------------------------------------------------
#
# curl runs inside calvin_slack_send's own command substitution
# (code=$(curl ...)), a subshell, so a plain variable assignment inside
# the curl() stub never reaches this outer shell (same caveat
# terminal-relay.test.sh documents for its own mocks) — use a file marker
# instead.

DEDUPE_TMP="$(mktemp -d)"
trap 'rm -rf "$DEDUPE_TMP"' EXIT

curl() { touch "$DEDUPE_TMP/curl_called"; echo -n '200'; }
export -f curl
export SLACK_WEBHOOK_URL=https://hooks.example/test

# 1) child alert + restatement, with no attempt-ID tag shared at all (the
# exact structural gap #391 reports) — still deduped, for both eligible
# kinds.
ACTIONABLE_CHILD=$(jq -n '[
  {body: "BLOCKED: ACTIONABLE — sandbox denies commit", created_at: "2026-09-28T15:10:00Z"}
]')

rm -f "$DEDUPE_TMP/curl_called"
calvin_slack_send \
  'BLOCKED: ACTIONABLE — the sandbox still denies the commit' \
  "o/r" "https://x/2" "$ACTIONABLE_CHILD" "2026-09-28T15:12:00Z"
[ -f "$DEDUPE_TMP/curl_called" ] && CALLED=1 || CALLED=0
assert_eq "BLOCKED: ACTIONABLE restated with no shared attempt-ID tag is still deduped" 0 "$CALLED"

CALVIN_REQUIRED_CHILD=$(jq -n '[
  {body: "CALVIN REQUIRED: pick A or B for the export path", created_at: "2026-09-28T15:10:00Z"}
]')

rm -f "$DEDUPE_TMP/curl_called"
calvin_slack_send \
  'CALVIN REQUIRED: pick A or B for the export path (restated)' \
  "o/r" "https://x/2" "$CALVIN_REQUIRED_CHILD" "2026-09-28T15:12:00Z"
[ -f "$DEDUPE_TMP/curl_called" ] && CALLED=1 || CALLED=0
assert_eq "CALVIN REQUIRED restated with no shared attempt-ID tag is still deduped" 0 "$CALLED"

# 2) the first alert for a gate still calls curl even with prior
# (unrelated) comments supplied.
rm -f "$DEDUPE_TMP/curl_called"
calvin_slack_send \
  'BLOCKED: ACTIONABLE — sandbox denies commit' \
  "o/r" "https://x/1" "$ACTIONABLE_CHILD" "2026-09-28T15:09:59Z"
[ -f "$DEDUPE_TMP/curl_called" ] && CALLED=1 || CALLED=0
assert_eq "the first alert for a gate still calls curl even with prior comments supplied" 1 "$CALLED"

# 3) a Calvin ruling/resolution closes the prior gate; the same kind
# afterwards is a genuinely new gate and alerts again.
RESOLVED_THEN_NEW=$(jq -n '[
  {body: "CALVIN REQUIRED: pick A or B for the export path", created_at: "2026-09-28T15:10:00Z"},
  {body: "CALVIN RULING - approve option B", created_at: "2026-09-28T15:11:00Z"}
]')

rm -f "$DEDUPE_TMP/curl_called"
calvin_slack_send \
  'CALVIN REQUIRED: pick a retention window for the export logs' \
  "o/r" "https://x/3" "$RESOLVED_THEN_NEW" "2026-09-28T15:12:00Z"
[ -f "$DEDUPE_TMP/curl_called" ] && CALLED=1 || CALLED=0
assert_eq "a new CALVIN REQUIRED after a Calvin ruling resolves the prior gate is not deduped" 1 "$CALLED"

# 4) without a resolution in between, a *different* Slack kind on the same
# item is its own distinct gate and still sends...
rm -f "$DEDUPE_TMP/curl_called"
calvin_slack_send \
  'BLOCKED: ACTIONABLE — separate permission needed for the export path' \
  "o/r" "https://x/4" "$CALVIN_REQUIRED_CHILD" "2026-09-28T15:12:00Z"
[ -f "$DEDUPE_TMP/curl_called" ] && CALLED=1 || CALLED=0
assert_eq "a different Slack kind on the same item is a distinct gate and still sends" 1 "$CALLED"

# ...but restating the *original* kind again afterwards, still with no
# resolution posted, is deduped against the original open gate (the
# different-kind alert in between neither resolves nor restates it).
MIXED_KIND_NO_RESOLUTION=$(jq -n '[
  {body: "CALVIN REQUIRED: pick A or B for the export path", created_at: "2026-09-28T15:10:00Z"},
  {body: "BLOCKED: ACTIONABLE — separate permission needed for the export path", created_at: "2026-09-28T15:11:00Z"}
]')

rm -f "$DEDUPE_TMP/curl_called"
calvin_slack_send \
  'CALVIN REQUIRED: pick A or B for the export path (still open)' \
  "o/r" "https://x/5" "$MIXED_KIND_NO_RESOLUTION" "2026-09-28T15:12:00Z"
[ -f "$DEDUPE_TMP/curl_called" ] && CALLED=1 || CALLED=0
assert_eq "restating the original kind past an unrelated different-kind alert is still deduped" 0 "$CALLED"

# 5) omitting comments_json/created_at skips the duplicate check entirely
# (always eligible on its own terms).
rm -f "$DEDUPE_TMP/curl_called"
calvin_slack_send \
  'BLOCKED: ACTIONABLE — child BUILD run reports the same sandbox denial' \
  "o/r" "https://x/2"
[ -f "$DEDUPE_TMP/curl_called" ] && CALLED=1 || CALLED=0
assert_eq "omitting comments_json/created_at skips the duplicate check (always eligible)" 1 "$CALLED"

# 6) CF-TERMINAL-NOTIFY-RELIABILITY-01 (issue #408), requirement 5:
# replayed/repeated terminal events get at most one same-outcome final
# notification, for the new informational kinds too, through the same
# dedupe mechanism as the actionable kinds.
FINISHED_ALREADY_SENT=$(jq -n '[
  {body: "COMPLETE: shipped the export fix [OWNER_ATTEMPT_ID: O1]", created_at: "2026-09-28T15:10:00Z"}
]')

rm -f "$DEDUPE_TMP/curl_called"
calvin_slack_send \
  'COMPLETE: shipped the export fix (restated) [OWNER_ATTEMPT_ID: O1]' \
  "o/r" "https://x/6" "$FINISHED_ALREADY_SENT" "2026-09-28T15:12:00Z"
[ -f "$DEDUPE_TMP/curl_called" ] && CALLED=1 || CALLED=0
assert_eq "a repeated COMPLETE restatement is deduped to at most one FINISHED notification" 0 "$CALLED"

# A fresh attempt (a new BUILD START: on the same thread) still reopens the
# outcome, so a genuinely new terminal afterwards is not suppressed.
FINISHED_THEN_FRESH_ATTEMPT=$(jq -n '[
  {body: "COMPLETE: shipped the export fix [OWNER_ATTEMPT_ID: O1]", created_at: "2026-09-28T15:10:00Z"},
  {body: "BUILD START: OUTCOME-ID=CF-X TIER=NORMAL [BUILD_ATTEMPT_ID: B2]", created_at: "2026-09-29T09:00:00Z"}
]')

rm -f "$DEDUPE_TMP/curl_called"
calvin_slack_send \
  'COMPLETE: a genuinely new, later completion [OWNER_ATTEMPT_ID: O2]' \
  "o/r" "https://x/7" "$FINISHED_THEN_FRESH_ATTEMPT" "2026-09-29T10:00:00Z"
[ -f "$DEDUPE_TMP/curl_called" ] && CALLED=1 || CALLED=0
assert_eq "a genuinely new terminal outcome following a fresh attempt is not suppressed" 1 "$CALLED"

# --- CF-ESCALATION-QUALITY-REPAIR-01 (issue #473): genuine Calvin gates only
#
# replay_thread <thread_json> prints one receipt line per comment that
# would reach Slack — "<id> <header> ping|noping" — by running the real
# calvin_slack_payload against that comment and the thread history before
# it, exactly as calvin-slack-alert.yml does on each issue_comment event.
replay_thread() {
  local thread="$1" n i id body at payload text ping
  n="$(jq length <<< "$thread")"
  for ((i = 0; i < n; i++)); do
    id="$(jq -r ".[$i].id" <<< "$thread")"
    body="$(jq -r ".[$i].body" <<< "$thread")"
    at="$(jq -r ".[$i].created_at" <<< "$thread")"
    payload="$(calvin_slack_payload "$body" "calyeap/Cal-Finance" "https://x/$id" "$thread" "$at")" || continue
    text="$(jq -r '.text' <<< "$payload")"
    case "$text" in *"<!channel>"*) ping=ping ;; *) ping=noping ;; esac
    echo "$id $(head -n1 <<< "$text" | sed -E 's/ — .*//' | tr ' ' '_') $ping"
  done
}

# (a) The real PR #469 Nucor thread (verbatim first lines): proxy CONNECT
# 403 with cited issuer evidence on the thread. Before this fix it paged
# `<!channel>` twice (REVIEW's and the post-redrive BUILD's ACTIONABLE).
# Now: zero pings; only OWNER's own terminals produce one informational
# STOPPED each (the second follows a label-redrive fresh attempt).
NUCOR_THREAD="$(cat "${SCRIPT_DIR}/fixtures/pr469-nucor-thread.json")"
NUCOR_RECEIPTS="$(replay_thread "$NUCOR_THREAD")"
echo "# Nucor replay receipts:"; sed 's/^/#   /' <<< "$NUCOR_RECEIPTS"
assert_eq "Nucor replay: no @channel page for the AI-owned source-access blocker" 0 "$(grep -c ' ping$' <<< "$NUCOR_RECEIPTS")"
assert_eq "Nucor replay: exactly OWNER's two terminals reach Slack, as informational STOPPED" \
  "6246224733 STOPPED noping
6247039084 STOPPED noping" "$NUCOR_RECEIPTS"

# (b) Source still unverified in every authorised path: BUILD fails closed
# as BLOCKED: AI (silent for OWNER to reconcile); OWNER's own stop is one
# informational STOPPED that carries the worker's line verbatim — the
# payload never adds or asserts a source.
UNVERIFIED_THREAD=$(jq -n '[
  {id: 1, created_at: "2026-10-18T09:00:00Z", body: "BLOCKED: AI — SOURCE_UNAVAILABLE: Nucor Note 6 non-current caption unverified in every authorised path (www.sec.gov CONNECT 403; no issuer capture on the PR); NUE stays INCOMPLETE. [BUILD_ATTEMPT_ID: B1]"},
  {id: 2, created_at: "2026-10-18T09:01:00Z", body: "BLOCKED: AI — SOURCE_UNAVAILABLE: no approved route verifies the Nucor caption; NUE stays INCOMPLETE, no source recorded. [OWNER_ATTEMPT_ID: O1]"}
]')
assert_eq "unverified source: BUILD silent, OWNER one informational STOPPED" "2 STOPPED noping" "$(replay_thread "$UNVERIFIED_THREAD")"
payload="$(calvin_slack_payload "$(jq -r '.[1].body' <<< "$UNVERIFIED_THREAD")" "o/r" "https://x/2")"
assert_eq "unverified-source payload is the worker line verbatim, no fabricated source" \
  "STOPPED — o/r
BLOCKED: AI — SOURCE_UNAVAILABLE: no approved route verifies the Nucor caption; NUE stays INCOMPLETE, no source recorded.
Action: none
https://x/2" "$(jq -r '.text' <<< "$payload")"

# (c) Genuine indispensable credential / security-permission / policy
# decision: exactly one guided alert per gate, even when BUILD, REVIEW and
# OWNER each restate it.
GENUINE_THREAD=$(jq -n '[
  {id: 1, created_at: "2026-10-18T09:00:00Z", body: "BLOCKED: ACTIONABLE — BUILD transport unavailable (401); refresh CC_BUILD_FIRE_TOKEN. No worker started."},
  {id: 2, created_at: "2026-10-18T09:01:00Z", body: "BLOCKED: ACTIONABLE — CC_BUILD_FIRE_TOKEN is still rejected; refresh CC_BUILD_FIRE_TOKEN. [OWNER_ATTEMPT_ID: O1]"},
  {id: 3, created_at: "2026-10-18T09:02:00Z", body: "CALVIN REQUIRED: Allow www.sec.gov egress for cloud BUILD? A: allow it (all workers can fetch filings; wider egress surface). B: keep egress closed and accept auditable GitHub issuer captures (no new egress; capture-review cost). Recommend B. Evidence: https://github.com/calyeap/Cal-Finance/pull/469#issuecomment-6247031466. Action: reply `CALVIN RULING — A` or `CALVIN RULING — B`. [REVIEW_ATTEMPT_ID: R1]"},
  {id: 4, created_at: "2026-10-18T09:03:00Z", body: "CALVIN REQUIRED: same egress policy decision as above (restated). [OWNER_ATTEMPT_ID: O2]"}
]')
assert_eq "genuine gates: one ping per gate, restatements across actors deduped" \
  "1 ACTIONABLE_BLOCKED ping
3 CALVIN_REQUIRED ping" "$(replay_thread "$GENUINE_THREAD")"
payload="$(calvin_slack_payload "$(jq -r '.[2].body' <<< "$GENUINE_THREAD")" "o/r" "https://x/3")"
case "$(jq -r '.text' <<< "$payload")" in
  *"A: allow it"*"B: keep egress closed"*"Recommend B"*"pull/469"*"CALVIN RULING — B"*"<!channel>"*)
    echo "ok - a genuine CALVIN REQUIRED decision pack reaches Slack intact with options, recommendation, evidence and exact action" ;;
  *) echo "not ok - CALVIN REQUIRED decision pack was not carried intact"; FAILURES=$((FAILURES + 1)) ;;
esac

# (d) The real issue #467 NVDA Option B thread (verbatim first lines): one
# CALVIN REQUIRED page, OWNER's restatement deduped, one FINISHED notice.
# A later worker terminal that simply applies the settled Option B ruling
# raises zero further gates.
NVDA_THREAD="$(jq '. + [{id: 99, created_at: "2026-10-18T09:00:00Z", body: "BLOCKED: AI — NVDA stays INCOMPLETE under Calvin RULING B (#467); no finance-lease evidence, nothing to re-ask. [REVIEW_ATTEMPT_ID: R9]"}]' "${SCRIPT_DIR}/fixtures/issue467-nvda-option-b-thread.json")"
NVDA_RECEIPTS="$(replay_thread "$NVDA_THREAD")"
echo "# NVDA Option B replay receipts:"; sed 's/^/#   /' <<< "$NVDA_RECEIPTS"
assert_eq "NVDA Option B: exactly one CALVIN REQUIRED page across the whole thread" 1 "$(grep -c 'CALVIN_REQUIRED ping$' <<< "$NVDA_RECEIPTS")"
assert_eq "NVDA Option B: post-ruling worker terminal raises zero repeated gates" 0 "$(grep -c '^99 ' <<< "$NVDA_RECEIPTS")"

rm -rf "$DEDUPE_TMP"
trap - EXIT
unset -f curl
unset SLACK_WEBHOOK_URL

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "calvin-slack-notify.test.sh: all checks passed"
  exit 0
else
  echo "calvin-slack-notify.test.sh: $FAILURES check(s) failed"
  exit 1
fi
