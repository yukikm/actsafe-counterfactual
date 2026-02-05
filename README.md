# ShadowCommit

Counterfactual Ops for Solana transactions:

**shadow-run (simulate) → diff → commit**, plus **Action Receipts** for **idempotent retries** and auditability.

This repo contains the MVP implementation under:

- `projects/actsafe-counterfactual/`

## Demo (CLI)

> This MVP stores receipts locally under `projects/actsafe-counterfactual/receipts/`.

```bash
cd projects/actsafe-counterfactual
npm i
npm run build

# Configure
export SOLANA_RPC_URL=https://api.devnet.solana.com
export SOLANA_KEYPAIR=~/.config/solana/id.json

# 1) Plan + shadow-run (no side effects)
npm run dev -- plan-transfer --to <RECIPIENT_PUBKEY> --sol 0.001

# 2) Commit (sends tx)
npm run dev -- commit --request <REQUEST_ID>

# 3) Inspect receipts
npm run dev -- receipts --limit 20
```

If your environment is unfunded, `plan-transfer` will still produce a receipt, and `commit` will fail preconditions (insufficient balance) and store a failed receipt.

## What’s implemented

- Deterministic `requestId` (sha256 of normalized params) for idempotency
- Shadow-run via `simulateTransaction`
- Commit via `sendTransaction` + `confirmTransaction`
- Local JSON receipt store for audit + replay protection

## License

MIT

