import { verifyReceiptEnvelope, sha256Hex } from '../src/integration/verifier.js';
import type { ReceiptEnvelope } from '../src/integration/envelope.js';

function nowIso() {
  return new Date().toISOString();
}

function mkEnv(overrides: Partial<ReceiptEnvelope> = {}): ReceiptEnvelope {
  const t = nowIso();
  const base: ReceiptEnvelope = {
    receiptVersion: '0.1',
    requestId: sha256Hex('demo:' + t + ':' + Math.random()),
    kind: 'sol_transfer',
    createdAt: t,
    updatedAt: t,
    finalityState: 'finalized',
    evidenceHash: sha256Hex('evidence:' + t),
    policyVersionHash: sha256Hex('policy:v0.1'),
  };
  return { ...base, ...overrides };
}

const good = mkEnv();
const bad = mkEnv({ finalityState: 'confirmed', evidenceHash: undefined });

const r1 = verifyReceiptEnvelope(good, { requireFinalizedOrEvidence: true, requirePolicyVersionHash: true });
const r2 = verifyReceiptEnvelope(bad, { requireFinalizedOrEvidence: true, requirePolicyVersionHash: true });

const out = {
  ok: r1.ok && !r2.ok,
  checks: {
    good: r1,
    bad: r2,
  },
  sample: {
    good,
    bad,
  },
};

console.log(JSON.stringify(out, null, 2));
