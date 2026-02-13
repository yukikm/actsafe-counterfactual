# WriteReceipt v0 — Conformance Pack (ShadowCommit)

This folder is a **minimal conformance pack** for the *WriteReceipt v0* concept used by ShadowCommit.

Goal: make “reliable writes” testable via **fixtures** (portable, redacted) + a **tiny verifier** you can run in ~60 seconds.

## Quickstart (60s)

From repo root:

```bash
npm run verify:writereceipt-v0
```

## What this is

- **Fixtures** live in `fixtures/*.json`
- Each fixture is a small, redacted scenario you can replay mentally or in your own implementation.
- The verifier is intentionally lightweight: it checks that fixtures are well-formed and that required receipt fields exist.

## Fixture format (v0)

Each fixture is JSON:

```json
{
  "id": "string",
  "title": "string",
  "scenario": {
    "kind": "rpc_ambiguity | reorg_confirmed_drop | toctou_revoke | constraints_drift | other",
    "notes": "string"
  },
  "receipt": {
    "receiptVersion": "writereceipt-v0",
    "requestId": "<deterministic idempotency key>",
    "intentHash": "<sha256(preimage)>",
    "policyVersionHash": "<sha256(policy/authorization snapshot)>",
    "checkedAtSlot": 0,
    "status": "simulated | committed | finalized | failed | unknown",
    "evidence": {
      "traceHash": "<sha256(trace or trace-root)>"
    }
  },
  "expected": {
    "verifierRule": "string",
    "result": "pass | fail"
  }
}
```

Notes:
- `constraints` canonicalization is still being finalized with AIoOS; once confirmed, we’ll add `constraintsFormat` + `constraintsHash` fixtures.
- `checkedAtSlot` is the **TOCTOU boundary marker** for “simulate → commit”.

## Planned fixtures (next)

- `reorg_confirmed_drop`: confirmed then dropped/reorged → receipt must transition to UNKNOWN and reconcile.
- `rpc_ambiguity_unknown`: RPC says accepted/confirmed but durable outcome cannot be proven → reconcile-before-rebroadcast.
- `toctou_revoke`: authorization/license revoked between simulate and commit → fail-closed.
- `constraints_drift`: constraints bytes/serialization drift → fail-closed.

## Why judges should care

This is the “judge-friendly artifact”:
- **portable fixtures** (redacted, shareable)
- **runnable verifier** (one command)
- demonstrates “ShadowCommit → generalizable reliability layer”
