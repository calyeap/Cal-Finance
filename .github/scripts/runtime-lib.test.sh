#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=runtime-lib.sh
source "${SCRIPT_DIR}/runtime-lib.sh"

fail() { echo "FAIL: $*" >&2; exit 1; }
assert_eq() { [ "$1" = "$2" ] || fail "expected '$2', got '$1' — ${3:-}"; }

# Contract parsing.
BODY=$'OUTCOME-ID: `CF-ONE-01`\nTIER: heavy\n## OUTCOME\nSomething'
assert_eq "$(runtime_outcome_id "$BODY")" "CF-ONE-01" "OUTCOME-ID parsing"
assert_eq "$(runtime_tier "$BODY")" "HEAVY" "tier parsing"
assert_eq "$(runtime_tier $'OUTCOME-ID: X')" "NORMAL" "missing tier defaults safely"
assert_eq "$(runtime_tier $'TIER: turbo')" "INVALID" "invalid tier rejected"

# First-line-only routing keeps quoted/examples from waking machinery.
assert_eq "$(runtime_is_correct $'\n  ## CORRECT: fix one thing\nmore')" true "heading-normalized CORRECT"
assert_eq "$(runtime_is_correct $'Explanation\nCORRECT: quoted later')" false "later CORRECT rejected"
assert_eq "$(runtime_done_pr_number 'DONE: https://github.com/calyeap/Cal-Finance/pull/321')" 321 "DONE PR binding"
assert_eq "$(runtime_done_pr_number $'DONE: evidence below\nhttps://github.com/calyeap/Cal-Finance/pull/999')" "" "later PR link rejected"

# OWNER never wakes itself; child terminal still reaches parent.
assert_eq "$(runtime_is_child_terminal 'BLOCKED: AI — child stopped [BUILD_ATTEMPT_ID: B1]')" true "child block routes parent"
assert_eq "$(runtime_is_child_terminal 'BLOCKED: AI — parent stopped [OWNER_ATTEMPT_ID: O1]')" false "parent block does not recurse"
assert_eq "$(runtime_parent_terminal_kind 'CONTINUE: existing authorised issue #9 [OWNER_ATTEMPT_ID: O1]')" CONTINUE
assert_eq "$(runtime_parent_terminal_kind 'COMPLETE: parent outcome done [OWNER_ATTEMPT_ID: O1]')" COMPLETE

# Slack is an interrupt/inform channel. CF-SLACK-ACTION-ONLY-01 (issue #377)
# made CALVIN REQUIRED/BLOCKED: ACTIONABLE the only eligible kinds.
# CF-TERMINAL-NOTIFY-RELIABILITY-01 (issue #408) explicitly supersedes that
# for OWNER's own final delegated-task outcome: COMPLETE is now one
# informational `finished` notification, and OWNER's own definitively
# terminal BLOCKED: AI/BLOCKED: EXTERNAL is now `stopped` — neither is an
# action gate.
assert_eq "$(runtime_slack_kind 'CALVIN REQUIRED: choose A or B')" calvin_required
assert_eq "$(runtime_slack_kind 'BLOCKED: ACTIONABLE — refresh secret')" actionable_blocked
assert_eq "$(runtime_slack_kind 'BLOCKED: AI — worker timed out [BUILD_ATTEMPT_ID: B1]')" none "transient child BLOCKED stays silent pending OWNER reconciliation"
assert_eq "$(runtime_slack_kind 'BLOCKED: AI — worker timed out')" none "an untagged BLOCKED fails closed to silent rather than guessing it is OWNER's own"
assert_eq "$(runtime_slack_kind 'COMPLETE: meaningful parent outcome [OWNER_ATTEMPT_ID: O1]')" finished "OWNER's own COMPLETE is one informational FINISHED notification"
assert_eq "$(runtime_slack_kind 'COMPLETE: meaningful parent outcome')" finished "COMPLETE is OWNER-only vocabulary, so it classifies even without a tag"
assert_eq "$(runtime_parent_terminal_kind 'COMPLETE: meaningful parent outcome')" COMPLETE "COMPLETE remains a valid parent terminal"
assert_eq "$(runtime_slack_kind 'BLOCKED: AI — no viable path [OWNER_ATTEMPT_ID: O1]')" stopped "OWNER's own definitively terminal BLOCKED: AI is one informational STOPPED notification"
assert_eq "$(runtime_slack_kind 'BLOCKED: EXTERNAL — third-party outage [OWNER_ATTEMPT_ID: O1]')" stopped "OWNER's own definitively terminal BLOCKED: EXTERNAL is one informational STOPPED notification"
assert_eq "$(runtime_slack_kind 'CONTINUE: next child')" none

# CF-WORKFLOW-TERMINAL-NORMALIZE-01 (issue #375): a standalone attempt-
# metadata line preceding the real typed terminal must not hide it from
# classification — for BUILD, REVIEW and OWNER terminal families alike —
# while a canonical (terminal-first) comment keeps working unchanged, and
# arbitrary prose followed later by a terminal keyword still never counts.
assert_eq "$(runtime_is_calvin_required 'CALVIN REQUIRED: pick A or B [BUILD_ATTEMPT_ID: BUILD-1-1]')" true "canonical first-line CALVIN REQUIRED still recognised"
assert_eq "$(runtime_slack_kind 'CALVIN REQUIRED: pick A or B [BUILD_ATTEMPT_ID: BUILD-1-1]')" calvin_required "canonical first-line CALVIN REQUIRED still Slack-eligible"
assert_eq "$(runtime_is_calvin_required $'[BUILD_ATTEMPT_ID: BUILD-1-1]\nCALVIN REQUIRED: pick A or B')" true "metadata-first BUILD terminal recognised"
assert_eq "$(runtime_slack_kind $'[BUILD_ATTEMPT_ID: BUILD-1-1]\nCALVIN REQUIRED: pick A or B')" calvin_required "metadata-first BUILD terminal still Slack-eligible"
assert_eq "$(runtime_is_correct $'[REVIEW_ATTEMPT_ID: REVIEW-2-1]\nCORRECT: fix one thing')" true "metadata-first REVIEW terminal recognised"
assert_eq "$(runtime_parent_terminal_kind $'[OWNER_ATTEMPT_ID: OWNER-3-1]\nCOMPLETE: parent outcome done')" COMPLETE "metadata-first OWNER terminal recognised"
assert_eq "$(runtime_slack_kind $'[OWNER_ATTEMPT_ID: OWNER-3-1]\nCOMPLETE: parent outcome done')" finished "metadata-first OWNER COMPLETE terminal is Slack-eligible as an informational FINISHED"
assert_eq "$(runtime_slack_kind $'[OWNER_ATTEMPT_ID: OWNER-3-1]\nBLOCKED: AI — no viable path')" stopped "metadata-first OWNER BLOCKED: AI terminal is Slack-eligible as an informational STOPPED"
assert_eq "$(runtime_slack_kind $'[BUILD_ATTEMPT_ID: BUILD-3-1]\nBLOCKED: AI — worker timed out')" none "metadata-first child BLOCKED: AI terminal stays silent pending OWNER reconciliation"
assert_eq "$(runtime_is_child_terminal $'[OWNER_ATTEMPT_ID: OWNER-3-1]\nCALVIN REQUIRED: needs a call')" false "metadata-first OWNER receipt still excluded from child-terminal routing"
assert_eq "$(runtime_is_calvin_required $'Some narrative update.\n\nCALVIN REQUIRED: quoted later, not a terminal')" false "prose followed later by CALVIN REQUIRED remains ineligible"
assert_eq "$(runtime_slack_kind $'Some narrative update.\n\nCALVIN REQUIRED: quoted later, not a terminal')" none "prose followed later by CALVIN REQUIRED remains Slack-ineligible"
assert_eq "$(runtime_is_calvin_required $'[BUILD_ATTEMPT_ID: BUILD-1-1] not standalone\nCALVIN REQUIRED: pick A or B')" false "a metadata line with trailing text is not tolerated as metadata-only"

# CF-SLACK-DEDUPE-02 (issue #391): dedupe keys on the still-open Calvin
# gate — canonical item (implicit: one thread) + Slack kind + open/resolved
# state — never on a worker BUILD_/REVIEW_/OWNER_ATTEMPT_ID or on which
# actor/wording restated it. The prior CF-WORKFLOW-PROOF-SLACK-DEDUPE-01
# version required the later comment to literally reference an earlier
# alerted comment's own attempt ID, which is not a guaranteed convention —
# these cases have no shared attempt ID at all and must still dedupe.
CHILD_COMMENTS=$(jq -n '[
  {body: "BLOCKED: ACTIONABLE — sandbox denies commit [BUILD_ATTEMPT_ID: B1]", created_at: "2026-09-28T15:10:00Z"},
  {body: "OWNER START: wake=TERMINAL [OWNER_ATTEMPT_ID: O1]", created_at: "2026-09-28T15:11:00Z"}
]')
assert_eq "$(runtime_slack_is_duplicate "$CHILD_COMMENTS" "2026-09-28T15:12:00Z" 'BLOCKED: ACTIONABLE — child BUILD run reports the same sandbox denial')" true "restating the same still-open gate is a duplicate, with no shared attempt-ID tag at all"
assert_eq "$(runtime_slack_is_duplicate "$CHILD_COMMENTS" "2026-09-28T15:12:00Z" 'CALVIN REQUIRED: child BUILD run needs a scope decision')" false "a different Slack kind (calvin_required vs actionable_blocked) is a distinct gate, not a duplicate"
assert_eq "$(runtime_slack_is_duplicate "$CHILD_COMMENTS" "2026-09-28T15:09:59Z" 'BLOCKED: ACTIONABLE — sandbox denies commit [BUILD_ATTEMPT_ID: B1]')" false "the first alert for a gate is never itself a duplicate"
assert_eq "$(runtime_slack_is_duplicate '[]' "2026-09-28T15:12:00Z" 'BLOCKED: ACTIONABLE — child BUILD run reports the same sandbox denial')" false "no prior Slack-eligible comment means nothing to duplicate"

# REVIEW CORRECT (CF-TERMINAL-NOTIFY-RELIABILITY-01 re-review): an earlier
# metadata-first OWNER BLOCKED: AI — the [OWNER_ATTEMPT_ID: ...] tag on its
# own line above the terminal — must still classify as `stopped` when
# scanned for dedupe, not fall through to `none` and let a replay resend.
METADATA_FIRST_STOPPED=$(cat <<'JSON'
[
  {"body":"[OWNER_ATTEMPT_ID: O1]\nBLOCKED: AI — final stop, no viable path","created_at":"2026-09-28T15:10:00Z"}
]
JSON
)
assert_eq "$(runtime_slack_is_duplicate "$METADATA_FIRST_STOPPED" "2026-09-28T15:12:00Z" $'[OWNER_ATTEMPT_ID: O2]\nBLOCKED: AI — final stop, no viable path (restated)')" true "a replayed metadata-first OWNER BLOCKED: AI is a duplicate"

# A Calvin ruling/resolution closes the prior gate: the same textual kind
# afterwards is a genuinely new gate and is eligible again.
RESOLVED_THEN_NEW=$(jq -n '[
  {body: "BLOCKED: ACTIONABLE — sandbox denies commit [BUILD_ATTEMPT_ID: B1]", created_at: "2026-09-28T15:10:00Z"},
  {body: "CALVIN RULING - approve the workaround", created_at: "2026-09-28T15:11:00Z"}
]')
assert_eq "$(runtime_slack_is_duplicate "$RESOLVED_THEN_NEW" "2026-09-28T15:12:00Z" 'BLOCKED: ACTIONABLE — a new, later sandbox denial')" false "a Calvin ruling resolves the prior gate; the same kind afterwards is a new gate"

# Without a resolution in between, an intervening different-kind alert
# neither resolves nor restates the original gate: the original kind is
# still deduped against its own still-open predecessor.
MIXED_KIND_NO_RESOLUTION=$(jq -n '[
  {body: "CALVIN REQUIRED: pick A or B for the export path", created_at: "2026-09-28T15:10:00Z"},
  {body: "BLOCKED: ACTIONABLE — separate permission needed for the export path", created_at: "2026-09-28T15:11:00Z"}
]')
assert_eq "$(runtime_slack_is_duplicate "$MIXED_KIND_NO_RESOLUTION" "2026-09-28T15:12:00Z" 'CALVIN REQUIRED: pick A or B for the export path (still open)')" true "restating the original kind past an unrelated different-kind alert, with no resolution, is still deduped"

# A re-driven BUILD START:/REVIEW START: admission receipt is the documented
# "reapply the wake label" recovery Calvin uses for a transport-failure
# BLOCKED: ACTIONABLE, and leaves no CALVIN RULING comment behind. It must
# still reset the gate — otherwise every genuinely new BLOCKED: ACTIONABLE
# on the same item is silently dropped forever after one re-drive.
REDRIVEN_THEN_NEW=$(jq -n '[
  {body: "BLOCKED: ACTIONABLE — BUILD transport did not recover; reapply `needs-build-wake` to retry [BUILD_ATTEMPT_ID: B1]", created_at: "2026-09-20T10:00:00Z"},
  {body: "BUILD START: OUTCOME-ID=CF-X TIER=NORMAL [BUILD_ATTEMPT_ID: B2]", created_at: "2026-09-21T10:00:00Z"},
  {body: "DONE: EVIDENCE — resolved on retry [BUILD_ATTEMPT_ID: B2]", created_at: "2026-09-22T10:00:00Z"}
]')
assert_eq "$(runtime_slack_is_duplicate "$REDRIVEN_THEN_NEW" "2026-09-29T10:00:00Z" 'BLOCKED: ACTIONABLE — Supabase service-role key must be granted by Calvin')" false "a re-driven BUILD START: resets the gate; a later genuinely new BLOCKED: ACTIONABLE still sends"

REDRIVEN_VIA_REVIEW=$(jq -n '[
  {body: "BLOCKED: ACTIONABLE — same still-open gate [BUILD_ATTEMPT_ID: B1]", created_at: "2026-09-20T10:00:00Z"},
  {body: "REVIEW START: OUTCOME-ID=CF-X TIER=NORMAL [REVIEW_ATTEMPT_ID: R1]", created_at: "2026-09-21T10:00:00Z"}
]')
assert_eq "$(runtime_slack_is_duplicate "$REDRIVEN_VIA_REVIEW" "2026-09-22T10:00:00Z" 'BLOCKED: ACTIONABLE — a new, later gate')" false "a re-driven REVIEW START: also resets the gate"

runtime_is_calvin_ruling_line 'CALVIN RULING — APPROVE OPTION B' || fail "em-dash CALVIN RULING marker recognised"
runtime_is_calvin_ruling_line 'CALVIN RULING: approve' || fail "colon CALVIN RULING marker recognised"
runtime_is_calvin_ruling_line 'quoting: CALVIN RULING — APPROVE OPTION B was mentioned earlier' && fail "CALVIN RULING not at line start is not a marker"
true

# CF-SLACK-REVIEW-GATE-DEDUPE-01 (issue #422): runtime_gate_action_ref
# extraction itself — explicit ref=/ticker= tokens win; otherwise the first
# bare commit-SHA-looking token (must contain a letter, so a plain decimal
# number never false-positives as a ref); empty when neither shape exists.
assert_eq "$(runtime_gate_action_ref 'BLOCKED: ACTIONABLE — proof needed (ref=8930faa79d7f7567777c1b57d7701a5a20a2c120, ticker=MSFT)')" "ref=8930faa79d7f7567777c1b57d7701a5a20a2c120;ticker=msft;" "explicit ref=/ticker= tokens extracted"
assert_eq "$(runtime_gate_action_ref 'BLOCKED: ACTIONABLE — Analyzer live proof FAIL at 8930faa (MSFT FAIL)')" "8930faa" "bare commit-SHA-looking token extracted when no ref=/ticker= label exists"
assert_eq "$(runtime_gate_action_ref 'BLOCKED: ACTIONABLE — PR #37873636301 needs attention')" "" "a plain decimal number is never mistaken for a ref"
assert_eq "$(runtime_gate_action_ref 'BLOCKED: ACTIONABLE — Supabase service-role key must be granted by Calvin')" "" "free text with no ref/ticker shape extracts nothing"

# CF-SLACK-REVIEW-GATE-DEDUPE-01 (issue #422): the real PR #420 failure
# shape — independent REVIEW and OWNER both restate the exact same
# still-unresolved live-proof action for the exact same commit, with an
# ordinary same-head "REVIEW START:" (no Calvin ruling, no documented
# re-drive) and an "OWNER START:" reconciliation wake in between. Neither
# is resolution of the prior human gate, so the restated blocker must stay
# deduped — the bug this outcome fixes: the pre-existing code treated any
# "REVIEW START:"/"BUILD START:" as an unconditional reset regardless of
# whether the required action (here, the exact ref+ticker) ever changed.
PR_420_SHAPE=$(jq -n '[
  {body: "BLOCKED: ACTIONABLE — same exact manual live proof needed (ref=8930faa79d7f7567777c1b57d7701a5a20a2c120, ticker=MSFT) [REVIEW_ATTEMPT_ID: R1]", created_at: "2026-10-08T10:00:00Z"},
  {body: "REVIEW START: OUTCOME-ID=CF-420 TIER=NORMAL [REVIEW_ATTEMPT_ID: R2]", created_at: "2026-10-08T10:05:00Z"},
  {body: "OWNER START: wake=TERMINAL [OWNER_ATTEMPT_ID: O1]", created_at: "2026-10-08T10:06:00Z"}
]')
assert_eq "$(runtime_slack_is_duplicate "$PR_420_SHAPE" "2026-10-08T10:07:00Z" 'BLOCKED: ACTIONABLE — same exact manual live proof needed (ref=8930faa79d7f7567777c1b57d7701a5a20a2c120, ticker=MSFT) [OWNER_ATTEMPT_ID: O1]')" true "PR #420 regression: an ordinary same-head REVIEW START and OWNER reconciliation do not reset a still-open, identifiable gate — the restated blocker stays deduped"

# Same shape but via the bare-commit-SHA fallback (no explicit ref=/ticker=
# labels) — the exact wording analyzer-live-proof.yml itself posts.
LIVE_PROOF_SHAPE=$(jq -n '[
  {body: "BLOCKED: ACTIONABLE — Analyzer live proof FAIL at 8930faa (MSFT FAIL) — the cause of every failure is printed below; fix only those, then rerun once. [REVIEW_ATTEMPT_ID: R1]", created_at: "2026-10-08T10:00:00Z"},
  {body: "REVIEW START: OUTCOME-ID=CF-420 TIER=NORMAL [REVIEW_ATTEMPT_ID: R2]", created_at: "2026-10-08T10:05:00Z"}
]')
assert_eq "$(runtime_slack_is_duplicate "$LIVE_PROOF_SHAPE" "2026-10-08T10:06:00Z" 'BLOCKED: ACTIONABLE — Analyzer live proof FAIL at 8930faa (MSFT FAIL) — the cause of every failure is printed below; fix only those, then rerun once. [REVIEW_ATTEMPT_ID: R2]')" true "bare-SHA live-proof shape: an ordinary REVIEW START on the same unchanged commit still dedupes"

# A genuinely distinct later gate — a different ref AND a different
# ticker — must still alert once, even though it shares the exact same
# Slack kind as the still-open prior gate and nothing resolved it.
DISTINCT_REF_SHAPE=$(jq -n '[
  {body: "BLOCKED: ACTIONABLE — same exact manual live proof needed (ref=8930faa79d7f7567777c1b57d7701a5a20a2c120, ticker=MSFT) [REVIEW_ATTEMPT_ID: R1]", created_at: "2026-10-08T10:00:00Z"}
]')
assert_eq "$(runtime_slack_is_duplicate "$DISTINCT_REF_SHAPE" "2026-10-08T11:00:00Z" 'BLOCKED: ACTIONABLE — a new, later live proof needed (ref=aa11bb22cc33dd44ee55ff66aa77bb88cc99dd00, ticker=NVDA) [REVIEW_ATTEMPT_ID: R3]')" false "a different ref/ticker is a genuinely new human gate, eligible once, even with no intervening resolution or re-drive at all"

# When only the newer comment names a specific ref but the earlier
# same-kind alert does not, there is no way to confirm they are the same
# gate — fail open (not a duplicate) rather than risk silently dropping a
# genuinely new actionable gate.
AMBIGUOUS_REF_SHAPE=$(jq -n '[
  {body: "BLOCKED: ACTIONABLE — Supabase service-role key must be granted by Calvin [REVIEW_ATTEMPT_ID: R1]", created_at: "2026-10-08T10:00:00Z"}
]')
assert_eq "$(runtime_slack_is_duplicate "$AMBIGUOUS_REF_SHAPE" "2026-10-08T11:00:00Z" 'BLOCKED: ACTIONABLE — live proof needed (ref=8930faa79d7f7567777c1b57d7701a5a20a2c120, ticker=MSFT) [REVIEW_ATTEMPT_ID: R3]')" false "fail-open: an earlier same-kind alert with no identifiable ref of its own never confirms a match against a ref-bearing later one"

# Admission regression coverage.
assert_eq "$(runtime_admission_decision issue 10 '' '' true)" IN_FLIGHT "#188 same-target duplicate build suppressed"
assert_eq "$(runtime_admission_decision issue 10 '' '12' false)" EXISTING_PR:12 "existing PR suppresses new BUILD"
assert_eq "$(runtime_admission_decision issue 10 '' '12,13' false)" CONFLICT "#352/#353/#354 duplicate PR class fails closed"
assert_eq "$(runtime_admission_decision issue 10 '11' '' false)" CONFLICT "duplicate issues fail closed"
assert_eq "$(runtime_admission_decision pr 12 '10' '' false)" ADMIT "same PR correction allowed"
assert_eq "$(runtime_admission_decision pr 12 '10' '13' false)" CONFLICT "second PR blocks correction fanout"

# Correlated terminal completion: another worker's terminal cannot satisfy this attempt.
COMMENTS=$(cat <<'JSON'
[
  {"body":"BUILD START: OUTCOME-ID=CF-ONE-01 [BUILD_ATTEMPT_ID: B1]","created_at":"2026-09-28T01:00:00Z"},
  {"body":"DONE: https://example/pull/1 [BUILD_ATTEMPT_ID: OTHER]","created_at":"2026-09-28T01:01:00Z"},
  {"body":"DONE: https://example/pull/1 [BUILD_ATTEMPT_ID: B1]","created_at":"2026-09-28T01:02:00Z"}
]
JSON
)
assert_eq "$(runtime_attempt_status "$COMMENTS" BUILD B1 '2026-09-28T01:00:00Z')" complete "exact attempt terminal"
assert_eq "$(runtime_attempt_status "$COMMENTS" BUILD B2 '2026-09-28T01:00:00Z')" missing "wrong attempt cannot complete"
assert_eq "$(runtime_outcome_attempt_open "$COMMENTS" CF-ONE-01)" false "terminal closes outcome attempt"
assert_eq "$(runtime_actor_attempt_open "$COMMENTS" BUILD)" false "closed BUILD attempt admits later bounded work"

# Metadata-first terminals correlate the same way canonical ones do — the
# real failure #375 fixes: the tag lives on the standalone metadata line,
# not the typed-terminal line, but attempt correlation still finds it, and
# a mismatched attempt ID is still never silently accepted.
META_FIRST_COMMENTS=$(cat <<'JSON'
[
  {"body":"BUILD START: OUTCOME-ID=CF-META-01 [BUILD_ATTEMPT_ID: B3]","created_at":"2026-09-28T05:00:00Z"},
  {"body":"[BUILD_ATTEMPT_ID: B3]\nCALVIN REQUIRED: pick A or B","created_at":"2026-09-28T05:01:00Z"}
]
JSON
)
assert_eq "$(runtime_attempt_status "$META_FIRST_COMMENTS" BUILD B3 '2026-09-28T05:00:00Z')" complete "metadata-first terminal still correlates the matching attempt"
assert_eq "$(runtime_attempt_status "$META_FIRST_COMMENTS" BUILD B4 '2026-09-28T05:00:00Z')" missing "metadata-first terminal with a mismatched attempt ID stays uncorrelated"
assert_eq "$(runtime_outcome_attempt_open "$META_FIRST_COMMENTS" CF-META-01)" false "metadata-first CALVIN REQUIRED still closes the outcome attempt"

OPEN_COMMENTS=$(cat <<'JSON'
[
  {"body":"BUILD START: OUTCOME-ID=CF-TWO-01 [BUILD_ATTEMPT_ID: B2]","created_at":"2026-09-28T02:00:00Z"},
  {"body":"ordinary progress","created_at":"2026-09-28T02:01:00Z"}
]
JSON
)
assert_eq "$(runtime_outcome_attempt_open "$OPEN_COMMENTS" CF-TWO-01)" true "open outcome attempt stays exclusive"
assert_eq "$(runtime_actor_attempt_open "$OPEN_COMMENTS" BUILD)" true "open BUILD attempt suppresses another worker"

REVIEW_OPEN=$(cat <<'JSON'
[
  {"body":"REVIEW START: OUTCOME-ID=CF-TWO-01 [REVIEW_ATTEMPT_ID: R1]","created_at":"2026-09-28T03:00:00Z"}
]
JSON
)
assert_eq "$(runtime_actor_attempt_open "$REVIEW_OPEN" REVIEW)" true "one active REVIEW"

OWNER_DONE=$(cat <<'JSON'
[
  {"body":"OWNER START: wake=MERGE [OWNER_ATTEMPT_ID: O1]","created_at":"2026-09-28T04:00:00Z"},
  {"body":"COMPLETE: parent done [OWNER_ATTEMPT_ID: O1]","created_at":"2026-09-28T04:01:00Z"}
]
JSON
)
assert_eq "$(runtime_actor_attempt_open "$OWNER_DONE" OWNER)" false "OWNER terminal releases parent admission"

# CF-REVIEW-BIND-01: deterministic bounded-repair count/threshold — 3
# CORRECT cycles are admitted, a 4th is exhausted.
NO_CORRECT=$(jq -n '[{body:"REVIEW START: OUTCOME-ID=CF-X [REVIEW_ATTEMPT_ID: R1]", created_at:"2026-09-30T00:00:00Z"}]')
assert_eq "$(runtime_correct_cycle_count "$NO_CORRECT")" 0 "no CORRECT terminals yet"
assert_eq "$(runtime_correct_cycles_exhausted "$NO_CORRECT")" false "zero cycles never exhausted"

THREE_CORRECT=$(jq -n '[
  {body:"CORRECT: fix one [REVIEW_ATTEMPT_ID: R1]", created_at:"2026-09-30T00:01:00Z"},
  {body:"CORRECT: fix two [REVIEW_ATTEMPT_ID: R2]", created_at:"2026-09-30T00:02:00Z"},
  {body:"CORRECT: fix three [REVIEW_ATTEMPT_ID: R3]", created_at:"2026-09-30T00:03:00Z"}
]')
assert_eq "$(runtime_correct_cycle_count "$THREE_CORRECT")" 3 "third CORRECT counted"
assert_eq "$(runtime_correct_cycles_exhausted "$THREE_CORRECT")" false "third CORRECT cycle is allowed"

FOUR_CORRECT=$(jq -n '[
  {body:"CORRECT: fix one [REVIEW_ATTEMPT_ID: R1]", created_at:"2026-09-30T00:01:00Z"},
  {body:"CORRECT: fix two [REVIEW_ATTEMPT_ID: R2]", created_at:"2026-09-30T00:02:00Z"},
  {body:"CORRECT: fix three [REVIEW_ATTEMPT_ID: R3]", created_at:"2026-09-30T00:03:00Z"},
  {body:"CORRECT: fix four [REVIEW_ATTEMPT_ID: R4]", created_at:"2026-09-30T00:04:00Z"}
]')
assert_eq "$(runtime_correct_cycle_count "$FOUR_CORRECT")" 4 "fourth CORRECT counted"
assert_eq "$(runtime_correct_cycles_exhausted "$FOUR_CORRECT")" true "fourth attempted cycle is exhausted"

# CF-REVIEW-BIND-01: source-issue fallback resolution is bounded to exactly
# one unambiguous reference; zero or multiple distinct numbers fail closed.
assert_eq "$(runtime_closing_issue_number 'Closes #390')" 390 "single Closes reference resolves"
assert_eq "$(runtime_closing_issue_number 'Fixes #12 and #34')" "" "ambiguous multi-issue reference fails closed"
assert_eq "$(runtime_closing_issue_number 'No linking keyword here, just #390 mentioned')" "" "a bare issue mention without a closing keyword is not a fallback source"
assert_eq "$(runtime_closing_issue_number 'Resolved #77')" 77 "past-tense Resolved keyword recognised"
assert_eq "$(runtime_closing_issue_number 'Closes #77, closes #77')" 77 "repeated identical reference stays unambiguous"


# CF-CONTRACT-FENCE-01 (issue #384): a worker must not route, merge or
# alert once the canonical contract it loaded at START no longer matches
# the current one.
ORIGINAL_BODY=$'OUTCOME-ID: `CF-FENCE-01`\nTIER: NORMAL\n## OUTCOME\nOriginal.'
EDITED_BODY=$'OUTCOME-ID: `CF-FENCE-01`\nTIER: NORMAL\n## OUTCOME\nCalvin materially changed this.'
LOADED_HASH="$(runtime_contract_hash "$ORIGINAL_BODY")"
assert_eq "$(runtime_contract_hash "$ORIGINAL_BODY")" "$LOADED_HASH" "hashing is deterministic"
assert_eq "${#LOADED_HASH}" 12 "fingerprint is a short 12-char hash"
assert_eq "$(runtime_contract_is_stale "$LOADED_HASH" "$ORIGINAL_BODY")" false "same body -> normal route proceeds"
assert_eq "$(runtime_contract_is_stale "$LOADED_HASH" "$EDITED_BODY")" true "changed body before route -> stale"
assert_eq "$(runtime_contract_is_stale "" "$EDITED_BODY")" false "no recorded fingerprint never manufactures staleness"

# A fenced stale exit reuses the existing BLOCKED: AI vocabulary — never a
# literal CALVIN REQUIRED / BLOCKED: ACTIONABLE — so it is Slack-ineligible
# by construction, whatever the underlying gate would otherwise have been,
# and still a valid, correlatable typed terminal for every actor.
STALE_LINE='BLOCKED: AI — STALE_CONTRACT: canonical contract changed since START (loaded abc123def456, current 999999999999); no route/merge/alert taken. [BUILD_ATTEMPT_ID: B9]'
assert_eq "$(runtime_slack_kind "$STALE_LINE")" none "stale exit never reaches Slack, even for a would-be CALVIN REQUIRED/ACTIONABLE gate"
runtime_terminal_is_typed BUILD "$(runtime_terminal_line "$STALE_LINE")" || fail "stale exit is a typed BUILD terminal"
assert_eq "$(runtime_is_child_terminal "$STALE_LINE")" true "stale BUILD/REVIEW exit still reaches OWNER for reconciliation"

# CF-TERMINAL-NOTIFY-RELIABILITY-01 (issue #408): OWNER's own BLOCKED: AI is
# now Slack-eligible as `stopped`, but a stale-contract fence exit must stay
# Slack-silent even when OWNER itself carries the tag — it carries no
# product signal about the outcome, by design.
STALE_LINE_OWNER='BLOCKED: AI — STALE_CONTRACT: canonical contract changed since START (loaded abc123def456, current 999999999999); no route/merge/alert taken. [OWNER_ATTEMPT_ID: O9]'
assert_eq "$(runtime_slack_kind "$STALE_LINE_OWNER")" none "OWNER's own stale-contract fence exit also never reaches Slack, even though it carries an OWNER tag"

# Closing a stale attempt with this terminal releases it exactly like any
# other typed terminal — existing admission/resume machinery then resumes
# the same outcome once, with duplicate suppression intact.
STALE_COMMENTS=$(jq -n '[
  {body: "BUILD START: OUTCOME-ID=CF-FENCE-01 TIER=NORMAL [BUILD_ATTEMPT_ID: B9] [CONTRACT: abc123def456]", created_at: "2026-09-30T09:00:00Z"},
  {body: "BLOCKED: AI — STALE_CONTRACT: canonical contract changed since START (loaded abc123def456, current 999999999999); no route/merge/alert taken. [BUILD_ATTEMPT_ID: B9]", created_at: "2026-09-30T09:05:00Z"}
]')
assert_eq "$(runtime_attempt_status "$STALE_COMMENTS" BUILD B9 '2026-09-30T09:00:00Z')" complete "stale exit correlates and closes its own attempt"
assert_eq "$(runtime_outcome_attempt_open "$STALE_COMMENTS" CF-FENCE-01)" false "closed stale attempt frees the outcome for fresh admission"
assert_eq "$(runtime_admission_decision issue 384 '' '' false)" ADMIT "fresh admission after a stale exit resumes the same outcome"
assert_eq "$(runtime_admission_decision issue 384 '' '' true)" IN_FLIGHT "duplicate suppression stays intact while the stale attempt is still open"
assert_eq "$(runtime_admission_decision issue 384 '' '30' false)" EXISTING_PR:30 "an already-open PR/branch from before the stale exit is still reused, not duplicated"

echo "runtime-lib: PASS"
