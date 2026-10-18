#!/usr/bin/env bash
# mkreview.sh <dir> <pr_number> <head_sha> <issue_number> <db_name> <with_pr_body:yes|no>
# Builds an isolated exact-head review workspace (read-only GitHub GETs only).
set -euo pipefail
DIR="$1"; PR="$2"; HEAD="$3"; ISSUE="$4"; DB="$5"; BODY="$6"
R=calyeap/Cal-Finance
L2="/c/Users/Calvin/AppData/Local/Temp/claude/C--Users-Calvin-Projects-Cal-Finance/db85d179-02bc-4928-8a16-d6663764a037/scratchpad/leg2"
mkdir -p "$DIR"
( cd "$DIR" && rm -rf repo && mkdir repo && cd repo && git init -q && git fetch -q --depth 1 https://github.com/$R.git "$HEAD" && git checkout -q FETCH_HEAD )
BASE=$(gh api --method GET repos/$R/pulls/$PR --jq .base.sha)
gh api --method GET "repos/$R/compare/${BASE}...${HEAD}" -H "Accept: application/vnd.github.diff" > "$DIR/pr.diff"
gh api --method GET repos/$R/issues/$ISSUE --jq '"# Issue #\(.number): \(.title)\n\n\(.body)"' > "$DIR/contract.md"
if [ "$BODY" = yes ]; then gh api --method GET repos/$R/pulls/$PR --jq '.body' > "$DIR/pr-body.md"; fi
cp "$L2/../rubrics/heavy-slim.md" "$DIR/RUBRIC.md"
MSYS_NO_PATHCONV=1 docker exec kaizen-leg2-pg psql -U postgres -qc "create database $DB" >/dev/null
( cd "$DIR/repo" && npm ci --no-audit --no-fund --loglevel=error > ../npmci.log 2>&1 )
echo "ready $DIR head=$(git -C "$DIR/repo" rev-parse --short HEAD) commits=$(git -C "$DIR/repo" rev-list --count HEAD) diff_lines=$(wc -l < "$DIR/pr.diff")"
