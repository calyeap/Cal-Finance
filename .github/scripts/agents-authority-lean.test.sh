#!/usr/bin/env bash
# CF-FREEZE-CLOSEOUT-01 (F3)
#
# Deterministic, network-free structural check on AGENTS.md's "Where
# authority lives" router. AGENTS.md previously carried a vague bullet
# claiming Cal Finance Project Home "owns durable semantic authorities not
# covered by the class above and not yet cut over to GitHub" — an
# undefined fallback with no named boundary, while docs/CURRENT-AUTHORITY.md
# already names the actual explicit routes for every class of truth. A
# fresh repo worker following AGENTS.md could be misrouted to that
# undefined fallback instead of the explicit authority map. This asserts
# the vague bullet is gone and every other named route (and the pointer to
# docs/CURRENT-AUTHORITY.md for the current status split) still resolves.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENTS_MD="$(cd "${SCRIPT_DIR}/../.." && pwd)/AGENTS.md"

FAILURES=0

assert_not_contains() {
  local desc="$1" pattern="$2"
  if grep -qF -- "$pattern" "$AGENTS_MD"; then
    echo "not ok - $desc (found [$pattern])"
    FAILURES=$((FAILURES + 1))
  else
    echo "ok - $desc"
  fi
}

assert_contains() {
  local desc="$1" pattern="$2"
  if grep -qF -- "$pattern" "$AGENTS_MD"; then
    echo "ok - $desc"
  else
    echo "not ok - $desc (missing [$pattern])"
    FAILURES=$((FAILURES + 1))
  fi
}

if [ ! -f "$AGENTS_MD" ]; then
  echo "not ok - $AGENTS_MD exists"
  echo "agents-authority-lean.test.sh: 1 check(s) failed"
  exit 1
fi

assert_not_contains "the vague undefined Project Home fallback bullet is gone" \
  "owns durable semantic authorities not covered by the class above"
assert_not_contains "AGENTS.md no longer claims Project Home authority not yet cut over to GitHub" \
  "not yet cut over to GitHub"

assert_contains "current project status / next move still routes to docs/CURRENT-AUTHORITY.md" \
  "docs/CURRENT-AUTHORITY.md"
assert_contains "Cal Finance Methodology route is preserved" \
  "Cal Finance Methodology"
assert_contains "Product Decision Log route is preserved" \
  "docs/product-decisions.md"
assert_contains "Product Roadmap route is preserved" \
  "docs/product-roadmap.md"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "agents-authority-lean.test.sh: all checks passed"
  exit 0
else
  echo "agents-authority-lean.test.sh: $FAILURES check(s) failed"
  exit 1
fi
