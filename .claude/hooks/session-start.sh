#!/usr/bin/env bash
# CF-CLOUD-TEST-READY-01 (issue #489)
#
# Makes a fresh Claude Code cloud session test-ready, so `npx tsc --noEmit`
# and `npm test` run green with no manual setup. Cloud environments cache
# files but not running processes, so Postgres has to be started in every
# session; that is why this is a SessionStart hook and not only a setup
# script.
#
# Cloud sessions only: anywhere else (Calvin's PC included) it exits before
# doing anything. It never fails the session. A step that fails is named in
# the one-line summary on stdout, which becomes session context.
#
# 1. Start the preinstalled Postgres and create the disposable
#    `calboard_test` database with ci.yml's credentials.
# 2. Export TEST_DATABASE_URL for the session through $CLAUDE_ENV_FILE.
# 3. `npm ci` only when package-lock.json changed since the last install
#    (npm ci never rewrites the lockfile).
# 4. Migrate the test database (migrations are idempotent).
# 5. The pinned Playwright browser cannot be downloaded here (its CDN is
#    blocked), so point the exact path Playwright asks for at the
#    preinstalled headless shell. CI still installs and tests with the
#    pinned build.

set -uo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

DB_URL="postgresql://postgres:postgres@localhost:5432/calboard_test"
PROBLEMS=""

note_problem() { PROBLEMS="${PROBLEMS:+$PROBLEMS; }$1"; }
as_postgres() { su postgres -c "$1"; }
pg_up() { pg_isready -q -h localhost -p 5432 2>/dev/null; }

# 1. Postgres and the test database.
if ! pg_up; then
  service postgresql start >/dev/null 2>&1
  for _ in $(seq 1 20); do pg_up && break; sleep 0.5; done
fi
if pg_up; then
  as_postgres "psql -qtAc \"ALTER USER postgres PASSWORD 'postgres'\"" >/dev/null 2>&1 \
    || note_problem "could not set the postgres password"
  exists="$(as_postgres "psql -qtAc \"SELECT 1 FROM pg_database WHERE datname = 'calboard_test'\"" 2>/dev/null)"
  if [ "$exists" != "1" ]; then
    as_postgres "createdb calboard_test" >/dev/null 2>&1 || note_problem "could not create calboard_test"
  fi
else
  note_problem "Postgres did not start"
fi

# 2. TEST_DATABASE_URL for every later command in the session.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  line="export TEST_DATABASE_URL=${DB_URL}"
  grep -qxF "$line" "$CLAUDE_ENV_FILE" 2>/dev/null || echo "$line" >> "$CLAUDE_ENV_FILE"
fi

# 3. Dependencies from the lockfile.
lock_hash="$(sha256sum package-lock.json | cut -d' ' -f1)"
marker="node_modules/.cloud-session-lock-hash"
if [ ! -d node_modules ] || [ "$(cat "$marker" 2>/dev/null)" != "$lock_hash" ]; then
  if npm ci --no-audit --no-fund >/tmp/cloud-session-npm-ci.log 2>&1; then
    echo "$lock_hash" > "$marker"
  else
    note_problem "npm ci failed (see /tmp/cloud-session-npm-ci.log)"
  fi
fi

# 4. Schema for the test database.
if [ -d node_modules ] && pg_up; then
  DATABASE_URL="$DB_URL" npm run --silent migrate >/tmp/cloud-session-migrate.log 2>&1 \
    || note_problem "migrations failed (see /tmp/cloud-session-migrate.log)"
fi

# 5. A launchable Playwright browser.
# Prints the launched browser's version, or the launch error.
launch_probe() {
  timeout 60 node -e "require('playwright').chromium.launch().then(async (b) => { console.log(b.version()); await b.close(); process.exit(0); }, (e) => { console.log(e.message); process.exit(1); })" 2>/dev/null
}
browser="not checked"
if [ -d node_modules/playwright ]; then
  if probe="$(launch_probe)"; then
    browser="Chromium $(head -n 1 <<< "$probe")"
  else
    wanted="$(grep -o "Executable doesn't exist at [^[:space:]]*" <<< "$probe" | head -n 1 | sed "s/^Executable doesn't exist at //")"
    preinstalled="$(find "${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}" -maxdepth 3 -type f \( -name headless_shell -o -name chrome-headless-shell \) 2>/dev/null | sort -V | tail -n 1)"
    if [ -n "$wanted" ] && [ -n "$preinstalled" ] && mkdir -p "$(dirname "$wanted")" && ln -sf "$preinstalled" "$wanted" && probe="$(launch_probe)"; then
      browser="Chromium $(head -n 1 <<< "$probe") (preinstalled build at the pinned path)"
    else
      note_problem "no launchable Playwright browser"
    fi
  fi
fi

if [ -z "$PROBLEMS" ]; then
  echo "Cloud test env ready: Postgres up, TEST_DATABASE_URL=${DB_URL} (migrated), dependencies installed, Playwright browser: ${browser}; CI tests the pinned build."
else
  echo "Cloud test env NOT fully ready: ${PROBLEMS}. Fix this before trusting a local test run."
fi
exit 0
