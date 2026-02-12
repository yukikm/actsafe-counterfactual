#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export NODE_OPTIONS="${NODE_OPTIONS:-}"

# 0) Dependencies (fast if already installed)
if [ ! -d node_modules ]; then
  echo "[agent-eval] installing deps (first run only)..." >&2
  npm ci >&2
fi

# 1) Run verifier quickcheck (no wallet needed)
# Expected: ok=true, good.ok=true, bad.ok=false
npx --yes tsx scripts/agent-eval.ts
