#!/usr/bin/env bash
set -euo pipefail

# Jolito Review Commit & Diff Summary Helper
# Usage: ./review-summary.sh [BASE_REF]

BASE_REF="${1:-origin/main}"
BASE_SHA=$(git merge-base "$BASE_REF" HEAD)
HEAD_SHA=$(git rev-parse HEAD)
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)

echo "========================================="
echo " Jolito Review Summary"
echo "========================================="
echo "Branch:   $BRANCH_NAME"
echo "Base Ref: $BASE_REF ($BASE_SHA)"
echo "Head SHA: $HEAD_SHA"
echo "Preview:  https://${BRANCH_NAME//\//-}-jolito.smolkaj.workers.dev"
echo "========================================="
echo ""
echo "=== Commits ==="
git log --oneline "$BASE_SHA..$HEAD_SHA"
echo ""
echo "=== Files Changed ==="
git diff --stat "$BASE_SHA..$HEAD_SHA"
