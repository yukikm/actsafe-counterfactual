// Minimal “receipt envelope” types for downstream verification.
// Goal: other agents can depend on receipts without re-simulating or re-verifying everything.

export type FinalityState = 'planned' | 'simulated' | 'submitting' | 'confirmed' | 'finalized' | 'failed' | 'recover_only';

export type ReceiptEnvelope = {
  requestId: string;              // deterministic idempotency key
  kind: string;                   // e.g. sol_transfer, spl_transfer
  intentHash?: string;            // optional: hash of canonical intent payload
  evidenceHash?: string;          // optional: hash of {requestId, kind, params, shadow}
  policyVersionHash?: string;     // optional: hash of the policy used at commit

  finalityState: FinalityState;
  signature?: string;             // tx sig if broadcast
  slot?: number;

  createdAt: string;
  updatedAt: string;

  // Optional pointers for “proof of reasoning” systems.
  reasoningProofHash?: string;
};
