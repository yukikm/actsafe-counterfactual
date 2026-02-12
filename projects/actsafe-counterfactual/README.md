# ActSafe Counterfactual Ops (MVP)

Counterfactual Ops + Action Receipts for Solana transactions.

Goal: make *real-world writes* safer for agents by giving them a tight loop:

1. **Plan** an action (e.g., SOL transfer)
2. **Shadow-run** (simulate + precondition checks)
3. Show a **diff** (what would change)
4. **Commit** (send)
5. Persist an **Action Receipt** for audit + idempotency

This is an MVP built for the Colosseum Agent Hackathon.

## What this solves (agent pain)

- **Idempotency / retries**: avoid double-sends when blockhash expires / RPC flakes
- **Auditability**: store intent → checks → commit as a receipt
- **Bounded risk**: re-check preconditions before committing

## Quickstart

Requirements: Node 20+

```bash
npm i
npm run build
```

## Judge demo (3 minutes)

This repo includes a one-shot demo script that runs the full loop:
plan → shadow-run → commit attempt → receipts.

```bash
export SOLANA_RPC_URL=https://api.devnet.solana.com
export SOLANA_KEYPAIR=~/.config/solana/id.json

./scripts/demo-judge.sh
```

> Note: If the keypair is unfunded, the **commit** step will fail safely (precondition) and the failure will be recorded in the receipt — this is expected and demonstrates the safety gates.

## Agent eval (60 seconds, no wallet)

If you just want to sanity-check the **Receipt v0.1** verifier + invariants quickly (no Solana keypair required):

```bash
cd projects/actsafe-counterfactual
./scripts/agent-eval.sh
```

Expected: JSON output with `ok: true` (a “good” envelope passes, and a deliberately-bad envelope fails).

### Configure

- RPC: set `SOLANA_RPC_URL` (default: devnet)
- Keypair: set `SOLANA_KEYPAIR` to a local json keypair file path

Example:

```bash
export SOLANA_RPC_URL=https://api.devnet.solana.com
export SOLANA_KEYPAIR=~/.config/solana/id.json
```

### Demo flow

Plan + shadow-run (no side effects):

```bash
npm run dev -- plan-transfer --to <RECIPIENT_PUBKEY> --sol 0.001
```

Commit (will send):

```bash
npm run dev -- commit --request <REQUEST_ID>
```

Receipts are stored locally under `./receipts/`.

### Funded demo helper (optional)

If you have a funded devnet keypair, you can run:

```bash
npm run demo:funded
```

This will perform a **self-transfer** (0.001 SOL) to generate a real signature and (optionally) attach Memo evidence when enabled in `ACTSAFE_POLICY`.

### Expected output (example)

`plan-transfer` prints a JSON blob containing the `requestId` and the stored receipt. You’ll use that `requestId` for `commit`.

Notes:
- If simulation returns an error (`receipt.shadow.err`), you can still keep the receipt as an audit trail.
- `commit` enforces a basic precondition in this MVP: **balance must cover `lamports`**.

Implementation details:
- Commit uses a 2-phase flow: **send → persist signature as `submitting` → confirm → finalize** (safer against crashes / retries).

## CLI

- `actsafe plan-transfer --to <pubkey> --sol <amount>`
- `actsafe plan-spl-transfer --to <owner_pubkey> --mint <mint_pubkey> --amount <ui_amount> --decimals <decimals>`
- `actsafe commit --request <requestId>`
- `actsafe receipts --limit 20`

## Policy (optional)

You can enforce a minimal policy at commit-time by setting `ACTSAFE_POLICY` to a JSON file path.

Example `policy.json`:

```json
{
  "allowlistTo": ["<RECIPIENT_PUBKEY>"] ,
  "allowlistMints": ["<MINT_PUBKEY>"],
  "maxSolPerTransfer": 0.01,
  "maxSolPerDay": 0.05,
  "maxUiAmountPerSplMint": {
    "<MINT_PUBKEY>": 5
  },
  "maxUiAmountPerSplMintPerDay": {
    "<MINT_PUBKEY>": 20
  },
  "requireSimulationSuccess": true
  ,
  "requireResimulateAtCommit": true
  ,
  "attachMemoEvidence": true,
  "memoPrefix": "shadowcommit"
}
```

If `attachMemoEvidence` is enabled, commits will add a Solana **Memo** instruction containing:

`<memoPrefix>:<requestId>:<evidenceHash>`

This is a lightweight way to make the receipt tamper-evident *on-chain* without deploying a custom program.

## Notes

- Uses `@solana/web3.js` for speed; can be migrated to `@solana/kit` later.
- Receipts are local JSON files in this MVP.

## Copy/paste integration (for other agents)

If you want to depend on ShadowCommit receipts downstream, start with the minimal envelope + verifier:

- `src/integration/envelope.ts`
- `src/integration/verifier.ts`
- `src/integration/receipt.schema.json`

Recommended policy for downstream dependence:
- accept only `finalized` receipts, OR
- accept `confirmed` only when `evidenceHash` is present and anchored (Memo) — **finalized-or-evidence**.

See also: `docs/RELIABILITY_MATRIX.md`.

## Roadmap (post-MVP)

- Expand from SOL transfer to SPL token transfers + program CPIs
- Store receipt hashes on-chain (tiny receipt program) for tamper-evidence
- Policy-based autopass (bounded budgets, allowlists)

## Integration note: replay protection patterns

Several infra/payment flows (e.g. x402-style payment verification) have the same core gotcha: **a valid signature can be replayed** unless you persist a processed-set.

This repo now includes a tiny local helper (`src/processedSigStore.ts`) that stores processed signatures with a TTL under `receipts/processed-sigs.json`.

It’s not a database, but it’s a practical default for agent runtimes.
