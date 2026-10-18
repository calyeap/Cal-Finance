#!/usr/bin/env bash
# CF-CONTINUE-SCRIPT-01 (issue #402)
#
# Behavioral coverage for owner-continue.sh, OWNER's deterministic CONTINUE
# handoff. Replaces the prose-grep-only owner-continue-wake-verify.test.sh
# (CF-CONTINUE-WAKE-VERIFY-01, issue #396): instead of asserting OWNER.md
# wording, each case runs the real helper against a stubbed `gh` on PATH
# (state kept in plain files, every call logged) and a stubbed `sleep`, so
# the apply / read-back / retry / terminal decisions are exercised without
# network access or real waits.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPER="${SCRIPT_DIR}/owner-continue.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

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

REPO=o/r
TARGET=9
WAKE=5
OID=CF-NEXT-01
OWNER_ATTEMPT=OWNER-1-1
CONTINUE_LINE="CONTINUE: #${TARGET} / ${OID} [OWNER_ATTEMPT_ID: ${OWNER_ATTEMPT}]"

# Stub gh. State lives in $STATE: target.json (state/body), labels (one per
# line), comments.json (target thread), open.json (open issues/PRs). Every
# label POST runs $STATE/on_apply (if present) with the 1-based apply count,
# so a case decides whether/how each wake lands. Posted comments on the
# OWNER wake item append to posted.log.
mkdir -p "$TMP/bin"
cat > "$TMP/bin/gh" <<'STUB'
#!/usr/bin/env bash
set -uo pipefail
echo "gh $*" >> "$STATE/calls.log"
[ "$1" = api ] || exit 1
shift
method=GET path="" body=""
while [ $# -gt 0 ]; do
  case "$1" in
    --method) method="$2"; shift 2 ;;
    --paginate) shift ;;
    -f) case "$2" in body=*) body="${2#body=}" ;; esac; shift 2 ;;
    *) path="$1"; shift ;;
  esac
done
case "$method $path" in
  "GET repos/o/r/issues/9")
    labels="$(jq -R . < "$STATE/labels" | jq -s '[.[] | select(. != "") | {name: .}]')"
    jq --argjson labels "$labels" '. + {labels: $labels}' "$STATE/target.json" ;;
  "GET repos/o/r/issues/9/comments") cat "$STATE/comments.json" ;;
  "GET repos/o/r/issues?state=open&per_page=100") cat "$STATE/open.json" ;;
  "POST repos/o/r/issues/9/labels")
    n=$(( $(cat "$STATE/applies" 2>/dev/null || echo 0) + 1 ))
    echo "$n" > "$STATE/applies"
    if [ -x "$STATE/on_apply" ]; then "$STATE/on_apply" "$n"; else echo needs-build-wake >> "$STATE/labels"; fi ;;
  "POST repos/o/r/issues/5/comments") printf '%s\n' "$body" >> "$STATE/posted.log"; echo '{}' ;;
  *) echo "unexpected gh call: $method $path" >&2; exit 1 ;;
esac
STUB
cat > "$TMP/bin/sleep" <<'STUB'
#!/usr/bin/env bash
echo "$1" >> "$STATE/sleeps.log"
STUB
chmod +x "$TMP/bin/gh" "$TMP/bin/sleep"

# new_case <name> — fresh state: open contract issue for $OID, no labels,
# one older unrelated comment (id 100), no other open items.
new_case() {
  export STATE="$TMP/$1"
  mkdir -p "$STATE"
  jq -n --arg body "OUTCOME-ID: \`${OID}\`"$'\nTIER: NORMAL' \
    '{number: 9, state: "open", body: $body}' > "$STATE/target.json"
  : > "$STATE/labels"
  jq -n '[{id: 100, body: "context comment", created_at: "2026-10-01T00:00:00Z"}]' > "$STATE/comments.json"
  jq -n --slurpfile t "$STATE/target.json" '$t' > "$STATE/open.json"
}

run_helper() {
  OUT="$(PATH="$TMP/bin:$PATH" bash "$HELPER" "$REPO" "$TARGET" "$OID" "$WAKE" "$OWNER_ATTEMPT" 2>"$STATE/stderr")"
  RC=$?
}
applies() { cat "$STATE/applies" 2>/dev/null || echo 0; }
posted() { cat "$STATE/posted.log" 2>/dev/null; }
sleeps() { cat "$STATE/sleeps.log" 2>/dev/null; }
posted_count() { grep -c . "$STATE/posted.log" 2>/dev/null || echo 0; }

# add_comment <id> <body> — appends a comment to the target thread.
add_comment() {
  jq --argjson id "$1" --arg body "$2" \
    '. + [{id: $id, body: $body, created_at: "2026-10-18T00:00:00Z"}]' \
    "$STATE/comments.json" > "$STATE/c.tmp" && mv "$STATE/c.tmp" "$STATE/comments.json"
}

# --- VERIFY 1: wake lands first try → exactly one CONTINUE, no retry -------
new_case lands-first
run_helper
assert_eq "1: exit 0" 0 "$RC"
assert_eq "1: label applied exactly once" 1 "$(applies)"
assert_eq "1: no retry sleep" "" "$(sleeps)"
assert_eq "1: exactly one CONTINUE posted on the OWNER wake item" "$CONTINUE_LINE" "$(posted)"
assert_eq "1: the same line is emitted on stdout" "$CONTINUE_LINE" "$OUT"

# --- VERIFY 2: label consumed quickly, but a newer BUILD receipt exists ----
# fire-build admits, posts BUILD START and clears the label before the
# helper's read-back: the receipt proves the wake was consumed.
new_case consumed
cat > "$STATE/on_apply" <<STUB
#!/usr/bin/env bash
jq '. + [{id: 200, body: "BUILD START: OUTCOME-ID=${OID} TIER=NORMAL · session s (u) [BUILD_ATTEMPT_ID: BUILD-7-1] [CONTRACT: abc] [CAUSE: label-redrive]", created_at: "2026-10-18T00:00:01Z"}]' "\$STATE/comments.json" > "\$STATE/c.tmp" && mv "\$STATE/c.tmp" "\$STATE/comments.json"
STUB
chmod +x "$STATE/on_apply"
run_helper
assert_eq "2: exit 0" 0 "$RC"
assert_eq "2: label not re-applied after the receipt proved consumption" 1 "$(applies)"
assert_eq "2: no retry sleep" "" "$(sleeps)"
assert_eq "2: exactly one CONTINUE" "$CONTINUE_LINE" "$(posted)"

# A wake consumed into an admission receipt (e.g. SUPPRESSED) or a
# fire-build admission terminal also counts as landed.
new_case consumed-admission
cat > "$STATE/on_apply" <<'STUB'
#!/usr/bin/env bash
jq '. + [{id: 201, body: "BUILD ADMISSION: SUPPRESSED — CF-NEXT-01 already has an active BUILD attempt; no second worker fired.", created_at: "2026-10-18T00:00:01Z"}]' "$STATE/comments.json" > "$STATE/c.tmp" && mv "$STATE/c.tmp" "$STATE/comments.json"
STUB
chmod +x "$STATE/on_apply"
run_helper
assert_eq "2b: admission receipt counts as consumed" "0 1 $CONTINUE_LINE" "$RC $(applies) $(posted)"

# An older BUILD receipt (before this handoff) is not evidence of this wake.
new_case stale-receipt
add_comment 150 "BUILD ADMISSION: SUPPRESSED — CF-NEXT-01 already has an active BUILD attempt; no second worker fired."
echo '#!/usr/bin/env bash' > "$STATE/on_apply"; chmod +x "$STATE/on_apply"
run_helper
assert_eq "2c: a pre-existing receipt never proves this wake" 1 "$RC"
assert_eq "2c: and no CONTINUE is posted" 0 "$(posted | grep -c '^CONTINUE:')"

# --- VERIFY 3: active execution already → no duplicate wake ---------------
new_case in-flight
add_comment 150 "BUILD START: OUTCOME-ID=${OID} TIER=NORMAL · session s (u) [BUILD_ATTEMPT_ID: BUILD-6-1] [CONTRACT: abc] [CAUSE: label-redrive]"
run_helper
assert_eq "3: exit 0" 0 "$RC"
assert_eq "3: no wake applied over an active BUILD attempt" 0 "$(applies)"
assert_eq "3: exactly one CONTINUE" "$CONTINUE_LINE" "$(posted)"

# A wake label already present (not yet consumed) is also not re-applied.
new_case label-present
echo needs-build-wake > "$STATE/labels"
run_helper
assert_eq "3b: pending wake label is not duplicated" "0 0 $CONTINUE_LINE" "$RC $(applies) $(posted)"

# --- VERIFY 4: ambiguous apply/read-back → retry only after a re-read -----
# First apply fails and does not land; the retry re-reads, sees nothing,
# applies again, and the second apply lands.
new_case ambiguous-retry
cat > "$STATE/on_apply" <<'STUB'
#!/usr/bin/env bash
[ "$1" -ge 2 ] && echo needs-build-wake >> "$STATE/labels"
[ "$1" -ge 2 ]
STUB
chmod +x "$STATE/on_apply"
run_helper
assert_eq "4: exit 0" 0 "$RC"
assert_eq "4: second apply after one bounded retry" 2 "$(applies)"
assert_eq "4: first retry waits 10s" 10 "$(sleeps)"
assert_eq "4: exactly one CONTINUE" "$CONTINUE_LINE" "$(posted)"
# The read before the retry's apply must come after the sleep: the stub
# logs GET target reads; between the first and second label POST there is
# at least one target read.
between="$(awk '/POST.*labels/{n++} n==1 && /api repos\/o\/r\/issues\/9$/{c++} END{print c+0}' "$STATE/calls.log")"
assert_eq "4: target re-read between the first apply and the retry" true "$([ "$between" -ge 2 ] && echo true || echo false)"

# The first apply reports failure, but the label lands late — the re-read
# before the retry sees it and the helper never applies a second time.
new_case ambiguous-landed-late
cat > "$STATE/on_apply" <<'STUB'
#!/usr/bin/env bash
exit 1
STUB
cat > "$TMP/bin/sleep-late" <<'STUB'
#!/usr/bin/env bash
echo "$1" >> "$STATE/sleeps.log"
echo needs-build-wake >> "$STATE/labels"
STUB
chmod +x "$STATE/on_apply" "$TMP/bin/sleep-late"
cp "$TMP/bin/sleep" "$TMP/bin/sleep.orig"; cp "$TMP/bin/sleep-late" "$TMP/bin/sleep"
run_helper
cp "$TMP/bin/sleep.orig" "$TMP/bin/sleep"
assert_eq "4b: exit 0" 0 "$RC"
assert_eq "4b: a late-landing wake is never duplicated" 1 "$(applies)"
assert_eq "4b: exactly one CONTINUE" "$CONTINUE_LINE" "$(posted)"

# --- VERIFY 5: wake never lands → 4 attempts, one BLOCKED: ACTIONABLE -----
new_case never-lands
echo '#!/usr/bin/env bash' > "$STATE/on_apply"; chmod +x "$STATE/on_apply"
run_helper
assert_eq "5: exit 1" 1 "$RC"
assert_eq "5: 4 apply attempts max" 4 "$(applies)"
assert_eq "5: bounded 10s/30s/60s schedule" "$(printf '10\n30\n60')" "$(sleeps)"
assert_eq "5: exactly one terminal posted" 1 "$(posted_count)"
expected_blocked="BLOCKED: ACTIONABLE — CONTINUE wake mutation to #${TARGET} (${OID}) could not be verified after 4 attempts; reapply the \`needs-build-wake\` label to #${TARGET} to deterministically re-drive. [OWNER_ATTEMPT_ID: ${OWNER_ATTEMPT}]"
assert_eq "5: the terminal is BLOCKED: ACTIONABLE naming the re-drive" "$expected_blocked" "$(posted)"
assert_eq "5: the same line is emitted on stdout" "$expected_blocked" "$OUT"

# --- VERIFY 6: no false CONTINUE without a verified handoff ---------------
for c in stale-receipt never-lands; do
  STATE="$TMP/$c"
  assert_eq "6: $c posted no CONTINUE" 0 "$(posted | grep -c '^CONTINUE:')"
done

# Admission refusals: OWNER's precondition does not hold on current state,
# so the helper posts nothing, applies nothing and exits 3 — OWNER must
# end with a non-CONTINUE terminal.
new_case closed-target
jq '.state = "closed"' "$STATE/target.json" > "$STATE/t.tmp" && mv "$STATE/t.tmp" "$STATE/target.json"
run_helper
assert_eq "6: closed target refused" "3 0 0" "$RC $(applies) $(posted_count)"

new_case wrong-outcome
run_helper_oid() { OUT="$(PATH="$TMP/bin:$PATH" bash "$HELPER" "$REPO" "$TARGET" CF-OTHER-01 "$WAKE" "$OWNER_ATTEMPT" 2>"$STATE/stderr")"; RC=$?; }
run_helper_oid
assert_eq "6: OUTCOME-ID mismatch refused" "3 0 0" "$RC $(applies) $(posted_count)"

new_case existing-pr
jq --arg body "OUTCOME-ID: \`${OID}\`" '. + [{number: 12, body: $body, pull_request: {}}]' "$STATE/open.json" > "$STATE/o.tmp" && mv "$STATE/o.tmp" "$STATE/open.json"
run_helper
assert_eq "6: an open PR already owning the outcome is refused" "3 0 0" "$RC $(applies) $(posted_count)"
assert_eq "6: refusal names the reason on stderr" true "$(grep -q 'REFUSED: .*EXISTING_PR:12' "$STATE/stderr" && echo true || echo false)"

new_case bad-args
OUT="$(PATH="$TMP/bin:$PATH" bash "$HELPER" "$REPO" "$TARGET" 2>"$STATE/stderr")"; RC=$?
assert_eq "6: missing arguments are a usage error, not a terminal" "2 0 0" "$RC $(applies) $(posted_count)"

if [ "$FAILURES" -gt 0 ]; then
  echo "owner-continue: $FAILURES FAILURE(S)"
  exit 1
fi
echo "owner-continue: PASS"
