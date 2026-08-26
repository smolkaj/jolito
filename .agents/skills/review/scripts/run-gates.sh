#!/usr/bin/env bash
set -euo pipefail

# Jolito Read-Only Quality Gates Runner
# Usage: ./run-gates.sh [--e2e]

RUN_E2E=false
if [[ "${1:-}" == "--e2e" ]]; then
  RUN_E2E=true
fi

echo "========================================="
echo " Jolito Quality Gates Check"
echo "========================================="

echo ""
echo "▶ Running: npm run check (format, lint, types, tests, coverage, build)"
npm run check

echo ""
echo "▶ Running: npm run audit:prod"
npm run audit:prod

if [ "$RUN_E2E" = true ]; then
  echo ""
  echo "▶ Running: npm run test:e2e"
  npm run test:e2e
fi

echo ""
echo "========================================="
echo " ✅ All Quality Gates Passed Successfully!"
echo "========================================="
