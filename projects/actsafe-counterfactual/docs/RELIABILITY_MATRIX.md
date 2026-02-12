# ShadowCommit Reliability Matrix (compact)

This matrix is designed for other agents to adopt quickly.

## Core invariants

1) **recover_only on ambiguous send**: if broadcast outcome is uncertain (timeout/transport), do not blind resend. Reconcile by signature status + deterministic post-state checks.

2) **commit-boundary state gate**: re-check preconditions right before write (balance/decimals/recipient accounts) to block drift-induced writes.

3) **finalized-or-evidence**: treat `confirmed` as provisional. Downstream systems should depend only on `finalized` OR strong evidence (`evidenceHash` anchored on-chain via Memo, or deterministic post-state proof).

## Failure modes → expected behavior

| Failure mode | What happens | Expected receipt transition |
|---|---|---|
| RPC timeout but tx landed | send result ambiguous | `submitting -> recover_only -> confirmed/finalized` (no resend) |
| Blockhash expired | tx rejected | `failed` with reason `blockhash_expired`, then **replan** (same requestId if same intent) |
| Confirmed then dropped/reorg | state didn’t land | remain non-final until `finalized` or evidence; may re-simulate + re-broadcast under gate |
| Partial success drift (ATA create, locks) | retry fails differently | classify deterministically; do not resend blindly; replan with new intent |
| Signature replay | attacker/bug reuses sig | keep processed-sig store / requestId ledger; reject duplicates |

