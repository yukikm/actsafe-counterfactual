import crypto from 'node:crypto';
import type { ReceiptEnvelope } from './envelope.js';

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: string };

export type VerifyOptions = {
  requireEvidenceHash?: boolean;
  requirePolicyVersionHash?: boolean;
  // Treat confirmed as provisional unless you have other proof.
  requireFinalizedOrEvidence?: boolean;
};

export function sha256Hex(input: string | Buffer): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

// Minimal verifier: checks shape + invariants that prevent unsafe downstream dependence.
export function verifyReceiptEnvelope(env: ReceiptEnvelope, opts: VerifyOptions = {}): VerifyResult {
  if (!env.requestId || env.requestId.length < 16) return { ok: false, reason: 'missing_requestId' };
  if (!env.kind) return { ok: false, reason: 'missing_kind' };
  if (!env.finalityState) return { ok: false, reason: 'missing_finalityState' };
  if (!env.createdAt || !env.updatedAt) return { ok: false, reason: 'missing_timestamps' };

  if (opts.requireEvidenceHash && !env.evidenceHash) return { ok: false, reason: 'missing_evidenceHash' };
  if (opts.requirePolicyVersionHash && !env.policyVersionHash) return { ok: false, reason: 'missing_policyVersionHash' };

  if (opts.requireFinalizedOrEvidence) {
    const okFinal = env.finalityState === 'finalized';
    const okEvidence = !!env.evidenceHash;
    if (!okFinal && !okEvidence) return { ok: false, reason: 'not_finalized_or_evidenced' };
  }

  // If we have a signature, state should not be purely planned.
  if (env.signature && env.finalityState === 'planned') return { ok: false, reason: 'sig_with_planned_state' };

  return { ok: true };
}
