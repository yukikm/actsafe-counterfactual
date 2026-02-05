import { readFileSync } from 'node:fs';

export type ActSafePolicy = {
  // If set, only allow commits to these destinations (base58 pubkeys).
  allowlistTo?: string[];
  // Maximum SOL per single transfer.
  maxSolPerTransfer?: number;
  // Require simulation to have no error before commit.
  requireSimulationSuccess?: boolean;
};

export function loadPolicy(): ActSafePolicy {
  const p = process.env.ACTSAFE_POLICY;
  if (!p) return {};
  const raw = readFileSync(p, 'utf8');
  return JSON.parse(raw) as ActSafePolicy;
}

export function enforcePolicyForSolTransfer(policy: ActSafePolicy, params: { to: string; lamports: bigint }) {
  if (policy.allowlistTo && policy.allowlistTo.length > 0) {
    if (!policy.allowlistTo.includes(params.to)) {
      throw new Error(`Policy violation: destination not in allowlist (${params.to})`);
    }
  }
  if (typeof policy.maxSolPerTransfer === 'number') {
    const maxLamports = BigInt(Math.floor(policy.maxSolPerTransfer * 1_000_000_000));
    if (params.lamports > maxLamports) {
      throw new Error(`Policy violation: amount exceeds maxSolPerTransfer (${policy.maxSolPerTransfer})`);
    }
  }
}

