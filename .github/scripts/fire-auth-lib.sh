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
