#!/usr/bin/env bash
# CF-HANDOFF-FAIL-CLOSED-01
#
# Pure, network-free classification shared by every fire step in
# cc-auto-fire.yml (fire-build, fire-review, fire-owner-on-terminal),
# owner-on-merge.yml's fire-owner-on-merge job, and the BUILD/REVIEW/OWNER
# liveness guards' own recovery fires. No gh/curl calls happen here, so the
# auth-vs-other-failure decision can be exercised deterministically in CI.
#
# Closes the observed gap in issue CF-HANDOFF-FAIL-CLOSED-01: a missing
# secret or an HTTP 401/403 from a fire endpoint used to fall into the same
# generic "FIRE FAILED: HTTP <code>" bucket as a transient 5xx or curl
# error, so a credential problem read as an ordinary flaky failure instead
# of the "refresh this exact secret" signal it actually is.

set -uo pipefail

# fire_auth_status <http_code_or_special>
# http_code_or_special is whatever a fire step's own curl block already
# produces: "missing_secret" (a required secret was unset before the
# request was even attempted), "curl_error" (the request itself never
# completed), or a numeric HTTP status string.
#
# Echoes "auth" for "missing_secret" or an HTTP 401/403 — the three cases
# DONE WHEN #4 requires classified as WORKFLOW BLOCKED — AUTH. Echoes
# "not_auth" for everything else (2xx, other 4xx/5xx, curl_error) — those
# stay on the existing generic "FIRE FAILED" / liveness-exhaustion path.
fire_auth_status() {
  local code="$1"
  case "$code" in
    missing_secret|401|403) echo "auth" ;;
    *) echo "not_auth" ;;
  esac
}

# fire_auth_blocked_body <actor> <secret_name> <classification>
# actor: BUILD | REVIEW | OWNER. secret_name: the exact repository secret
# key to refresh (e.g. BUILD_FIRE_TOKEN, CC_AUTO_FIRE_URL). classification:
# whatever produced "auth" from fire_auth_status above (missing_secret,
# 401, or 403) — named in the receipt so the reader knows which of the
# three cases occurred, never a response body or credential value.
fire_auth_blocked_body() {
  local actor="$1" secret_name="$2" classification="$3"
  printf 'WORKFLOW BLOCKED — AUTH\n\nactor: %s\nsecret: %s\nclassification: %s\n\nRefresh that repository secret. The consumed wake label (if any) has been removed so re-applying it once the secret is fixed deterministically re-drives this target — no stale label/no-event trap.' \
    "$actor" "$secret_name" "$classification"
}

# CF-FIRE-RETRY-01
#
# Issue #387 hit a transient BUILD transport 503, then the OWNER-relay
# fire it triggered *also* hit a transient 503 — no worker had started
# anywhere, yet the run still ended on a silent `BLOCKED: AI` dead end
# that needed a manual Calvin re-wake. Every fire step (fire-build,
# fire-review, fire-owner-on-terminal, owner-on-merge's
# fire-owner-on-merge, and terminal-relay.sh's own OWNER relay) duplicated
# the same one-shot curl block with no retry at all. fire_post() replaces
# all five: one shared primitive that retries only the approved transient
# transport classes on a bounded schedule before a caller ever has to
# classify a failure as unrecoverable.

# fire_transient_status <http_code_or_special>
# Echoes "true" for the approved transient transport classes — a curl
# error that never reached the server, or HTTP 429/502/503/504 — and
# "false" for everything else (2xx, other 4xx, 500, missing_secret).
# 401/403/404/409/422/500 are deliberately excluded: an auth failure is
# fire_auth_status's job, not a transport blip, and a 500 is a server-side
# application error a blind retry cannot fix.
fire_transient_status() {
  case "$1" in
    curl_error|429|502|503|504) echo true ;;
    *) echo false ;;
  esac
}

# fire_post <url> <token> <prompt> <outfile>
# Network I/O. POSTs the same {text: <prompt>} body and headers every fire
# call site already sent, writing the response body to <outfile> exactly
# like a bare curl -o/-w call would. On a transient failure
# (fire_transient_status = true) it retries on a bounded 4-attempt-total
# schedule (immediate, then 10s/30s/60s) and returns as soon as a 2xx or
# any non-transient status is seen. Echoes the final HTTP status string
# ("curl_error" or a numeric code) — a caller uses that exactly like the
# old inline $(curl ... -w '%{http_code}') result, then still applies
# fire_auth_status/fire_transient_status itself to classify a final
# failure (auth vs. exhausted-transient vs. plain non-transient).
fire_post() {
  local url="$1" token="$2" prompt="$3" outfile="$4"
  local request code
  request=$(jq -n --arg text "$prompt" '{text:$text}')
  local delays=(10 30 60)
  local attempt=0
  while :; do
    code=$(curl -sS -o "$outfile" -w '%{http_code}' --request POST "$url" \
      --header "Authorization: Bearer $token" \
      --header "anthropic-version: 2023-06-01" \
      --header "anthropic-beta: experimental-cc-routine-2026-04-01" \
      --header "Content-Type: application/json" --data "$request") || code=curl_error

    if [ "$(fire_transient_status "$code")" != true ] || [ "$attempt" -ge "${#delays[@]}" ]; then
      echo "$code"
      return 0
    fi
    sleep "${delays[$attempt]}"
    attempt=$((attempt + 1))
  done
}
