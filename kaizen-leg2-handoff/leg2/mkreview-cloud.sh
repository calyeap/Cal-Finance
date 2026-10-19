#!/usr/bin/env bash
# mkreview-cloud.sh <dir> <pr_number> <head_sha> <issue_number> <db_name> <with_pr_body:yes|no>
# Linux/cloud port of mkreview.sh: builds an isolated exact-head review
# workspace. Read-only GitHub GETs only (git fetch + REST via curl; no gh).
# Postgres is the container's own cluster on 127.0.0.1:5432 (postgres/postgres).
set -euo pipefail
DIR="$1"; PR="$2"; HEAD="$3"; ISSUE="$4"; DB="$5"; BODY="$6"
R=calyeap/Cal-Finance
API="https://api.github.com/repos/$R"
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$DIR"
( cd "$DIR" && rm -rf repo && mkdir repo && cd repo && git init -q && git fetch -q --depth 1 "https://github.com/$R.git" "$HEAD" && git checkout -q FETCH_HEAD )
BASE=$(curl -fsS "$API/pulls/$PR" | jq -r .base.sha)
curl -fsS -H "Accept: application/vnd.github.diff" "$API/compare/${BASE}...${HEAD}" > "$DIR/pr.diff"
curl -fsS "$API/issues/$ISSUE" | jq -r '"# Issue #\(.number): \(.title)\n\n\(.body)"' > "$DIR/contract.md"
if [ "$BODY" = yes ]; then curl -fsS "$API/pulls/$PR" | jq -r '.body' > "$DIR/pr-body.md"; fi
cp "$HERE/../rubrics/heavy-slim.md" "$DIR/RUBRIC.md"
PGPASSWORD=postgres createdb -h 127.0.0.1 -U postgres "$DB"
( cd "$DIR/repo" && npm ci --no-audit --no-fund --loglevel=error > ../npmci.log 2>&1 )
echo "ready $DIR head=$(git -C "$DIR/repo" rev-parse --short HEAD) commits=$(git -C "$DIR/repo" rev-list --count HEAD) diff_lines=$(wc -l < "$DIR/pr.diff")"
