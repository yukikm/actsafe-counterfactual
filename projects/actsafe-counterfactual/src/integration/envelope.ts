// Minimal “receipt envelope” types for downstream verification.
// Goal: other agents can depend on receipts without re-simulating or re-verifying everything.

export type FinalityState = 'planned' | 'simulated' | 'submitting' | 'confirmed' | 'finalized' | 'failed' | 'recover_only';

export type DisclosurePolicy =
  | 'public_minimal'
  | 'shared_with_counterparty'
  | 'encrypted_for_auditor';

export type EncryptionRef = {
  alg: string;            // e.g. age, x25519-xsalsa20-poly1305, pgp
  recipient: string;      // key id / pubkey / recipient label
  ciphertextHash: string; // sha256 hex of ciphertext blob
};

export type ReceiptEnvelope = {
  requestId: string;              // deterministic idempotency key
  kind: string;                   // e.g. sol_transfer, spl_transfer
  intentHash?: string;            // optional: hash of canonical intent payload
  evidenceHash?: string;          // optional: hash of {requestId, kind, params, shadow}
  policyVersionHash?: string;     // optional: hash of the policy used at commit

  // Privacy-compatible receipt pattern:
  // - publish minimal fields + hashes
  // - keep sensitive trace/details off-chain, committed by hash (selective disclosure)
  traceHash?: string;             // sha256 hex of redacted trace blob
  disclosurePolicy?: DisclosurePolicy;
  encryption?: EncryptionRef;

  finalityState: FinalityState;
  signature?: string;             // tx sig if broadcast
  slot?: number;

  createdAt: string;
  updatedAt: string;

  // Optional pointers for “proof of reasoning” systems.
  reasoningProofHash?: string;
};
