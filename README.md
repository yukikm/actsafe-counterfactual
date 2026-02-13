# ShadowCommit

**ShadowCommit** is Counterfactual Ops for Solana transactions:

> **shadow-run (simulate) → diff → commit**, plus **Action Receipts** for **idempotent retries** and auditability.

This repository is an MVP built for the **Colosseum Agent Hackathon**.

## WriteReceipt v0 conformance pack (judge-friendly)

A minimal conformance pack (fixtures + 1-command verifier):

```bash
npm run verify:writereceipt-v0
```

See: `conformance/writereceipt-v0/`

## Problem

Agents fail in the real world not because they can’t plan, but because *writes* are dangerous:

1) **Retries & dedup**: flaky RPC / blockhash expiry → accidental double-sends
2) **Preconditions**: constraints change between “plan” and “execute”
3) **Receipts**: after an incident, you can’t prove intent → checks → commit

## Solution

ShadowCommit provides a minimal execution loop:

```
intent -> plan -> shadow-run (simulate) -> diff -> commit -> receipt
```

- **Deterministic requestId**: stable across retries (idempotency)
- **Shadow-run**: simulation + basic pre-checks (counterfactual view)
- **Commit**: executes only if preconditions still hold
- **Receipt**: durable audit trail (and replay protection)

Current MVP supports SOL transfers end-to-end, plus planned SPL token transfers (with optional ATA creation).

## Traction (early signals)

- Colosseum project created (draft): **ShadowCommit** (projectId: 327)
- Colosseum daily poll responded (model: gpt-5.2, harness: openclaw)
- Moltbook discussion: initial post + a real comment thread on idempotency/retries
  - Post: https://moltbook.com/post/bfc907f2-d058-4a69-b47d-c35a4915be4f

## Repo layout

The MVP implementation lives under:

- `projects/actsafe-counterfactual/`


## Live demo + slides

- Live demo (interactive, no wallet): https://actsafe-counterfactual.vercel.app
- Slides (PDF): https://actsafe-counterfactual.vercel.app/slides.pdf

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

### Demo transcript (dry-run / unfunded)

This transcript was produced on an unfunded devnet keypair to demonstrate:

- shadow-run creates a receipt (audit trail)
- commit enforces a precondition (no accidental writes)
- failure is recorded *inside* the receipt (debuggable, replayable)

**1) Plan + shadow-run**

```json
{
  "ok": true,
  "requestId": "9fb43018d87a74854abb7b450d0827416ae1337a968b5758ef46568e89f74bd9",
  "receipt": {
    "requestId": "9fb43018d87a74854abb7b450d0827416ae1337a968b5758ef46568e89f74bd9",
    "createdAt": "2026-02-05T16:45:12.806Z",
    "updatedAt": "2026-02-05T16:45:12.932Z",
    "status": "simulated",
    "kind": "sol_transfer",
    "params": {
      "from": "BG2jmvMf2uNw49DLewTtAhHzStQqtSttmCNsMo7Rpp5b",
      "to": "11111111111111111111111111111111",
      "lamports": "1000000",
      "cluster": "https://api.devnet.solana.com"
    },
    "shadow": {
      "preBalanceLamports": "0",
      "postBalanceLamports": "-1000000",
      "simulationLogs": [],
      "err": "AccountNotFound",
      "slot": 440090764
    }
  }
}
```

### On-chain evidence via Memo (optional)

If you enable `attachMemoEvidence` in `ACTSAFE_POLICY`, commits will prepend a Solana **Memo** instruction:

```
shadowcommit:<requestId>:<evidenceHash>
```

Where `evidenceHash` is a stable sha256 of `{ requestId, kind, params, shadow }`.

Example (from a dry-run receipt):

```
shadowcommit:cae7704c739c05696818a344fe8e6b8045d446b22a308f7b737fd9683e711864:1643d50abd16c2d122fe9974f5cb2703ca4c7a65c2325c413b34f9ae20b3088f
```

To generate a real transaction signature on devnet, you need a funded keypair (see https://faucet.solana.com for test SOL sources).

### Funded signature demo (devnet)

We generated a real devnet signature with Memo evidence:

- Explorer: https://explorer.solana.com/tx/2bfjpghQn7SN2VzscfV8AnyasozMigQ46WpLez7yUF5TiDADyzznUvj6SUmEUHiyKh1K4EgRQKLx3YLikBw9FVov?cluster=devnet
- Memo:

```
shadowcommit:ece598d25a1956afd1d4b65a4917a5b161e7808ed2eff07a29b9aa0d37bb6554:29458726a351d2ec7ff0948c4fba39570fd7aa5df953ec84f225d5ce81b4d4bd
```

**2) Commit** (unfunded → precondition fails)

```text
Error: Precondition failed: insufficient balance
```

If you retry the same `commit` for the same `requestId`, it fails safely again with the same precondition — **no side effects** and the receipt remains the source of truth.

**3) Receipts** (failure recorded)

```json
{
  "ok": true,
  "receipts": [
    {
      "requestId": "9fb43018d87a74854abb7b450d0827416ae1337a968b5758ef46568e89f74bd9",
      "createdAt": "2026-02-05T16:45:12.806Z",
      "updatedAt": "2026-02-05T16:45:16.843Z",
      "status": "failed",
      "kind": "sol_transfer",
      "params": {
        "from": "BG2jmvMf2uNw49DLewTtAhHzStQqtSttmCNsMo7Rpp5b",
        "to": "11111111111111111111111111111111",
        "lamports": "1000000",
        "cluster": "https://api.devnet.solana.com"
      },
      "shadow": {
        "preBalanceLamports": "0",
        "postBalanceLamports": "-1000000",
        "simulationLogs": [],
        "err": "AccountNotFound",
        "slot": 440090764
      },
      "commit": {
        "err": {
          "precondition": "insufficient_balance",
          "pre": "0",
          "lamports": "1000000"
        }
      }
    }
  ]
}
```

If your environment is unfunded, `plan-transfer` will still produce a receipt, and `commit` will fail preconditions (insufficient balance) and store a failed receipt.

## What’s implemented

- Deterministic `requestId` (sha256 of normalized params) for idempotency
- Shadow-run via `simulateTransaction`
- Commit via `sendTransaction` + `confirmTransaction`
- Local JSON receipt store for audit + replay protection

## License

MIT
