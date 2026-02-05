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

### Expected output (example)

`plan-transfer` prints a JSON blob containing the `requestId` and the stored receipt. You’ll use that `requestId` for `commit`.

Notes:
- If simulation returns an error (`receipt.shadow.err`), you can still keep the receipt as an audit trail.
- `commit` enforces a basic precondition in this MVP: **balance must cover `lamports`**.

## CLI

- `actsafe plan-transfer --to <pubkey> --sol <amount>`
- `actsafe commit --request <requestId>`
- `actsafe receipts --limit 20`

## Notes

- Uses `@solana/web3.js` for speed; can be migrated to `@solana/kit` later.
- Receipts are local JSON files in this MVP.

## Roadmap (post-MVP)

- Expand from SOL transfer to SPL token transfers + program CPIs
- Store receipt hashes on-chain (tiny receipt program) for tamper-evidence
- Policy-based autopass (bounded budgets, allowlists)
