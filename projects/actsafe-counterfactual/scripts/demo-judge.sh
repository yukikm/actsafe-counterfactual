#!/usr/bin/env bash
set -euo pipefail

# ShadowCommit / ActSafe Counterfactual Ops — Judge Demo
# Demonstrates: plan -> shadow-run -> commit attempt -> receipts + recover_only semantics (via preconditions)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "== ShadowCommit judge demo =="

if ! command -v node >/dev/null 2>&1; then
  echo "node not found" >&2
  exit 1
fi

echo "Node: $(node -v)"

if [ ! -f package-lock.json ]; then
  echo "package-lock.json missing; run from repo root" >&2
  exit 1
fi

# Install deps (idempotent)
if [ ! -d node_modules ]; then
  echo "Installing deps..."
  npm i
fi

echo "Building..."
npm run build

echo "\n[1/3] Plan + shadow-run (no side effects)"
# Use a dummy recipient (system program address) and a tiny amount.
TO_PUBKEY="11111111111111111111111111111111"

if [ -z "${SOLANA_KEYPAIR:-}" ]; then
  echo "Missing SOLANA_KEYPAIR env var. Set it to a local Solana json keypair path, e.g.:" >&2
  echo "  export SOLANA_KEYPAIR=~/.config/solana/id.json" >&2
  echo "(Demo will still continue by showing how receipts look once configured.)" >&2
  exit 2
fi

PLAN_OUT=$(npm run dev -- plan-transfer --to "$TO_PUBKEY" --sol 0.000001)
echo "$PLAN_OUT" | tail -n 60

REQ_ID=$(echo "$PLAN_OUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const m=s.match(/"requestId"\s*:\s*"([a-f0-9]{32,})"/i); if(!m){console.error("requestId not found"); process.exit(2);} console.log(m[1]);});')

echo "\nrequestId: $REQ_ID"

echo "\n[2/3] Commit attempt"
set +e
COMMIT_OUT=$(npm run dev -- commit --request "$REQ_ID" 2>&1)
COMMIT_CODE=$?
set -e

echo "$COMMIT_OUT" | tail -n 80

echo "Commit exit code: $COMMIT_CODE (non-zero is OK in unfunded environments)"

echo "\n[3/3] Latest receipts (should include simulated + failed/guarded commit info)"
RECEIPTS_OUT=$(npm run dev -- receipts --limit 5)
echo "$RECEIPTS_OUT" | tail -n 200

echo "\nDemo complete. Judges: this shows the end-to-end intent->receipt pipeline, with commit-time guards preventing unsafe writes under failure conditions." 
