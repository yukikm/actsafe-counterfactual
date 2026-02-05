import { readFileSync } from 'node:fs';

export type ActSafePolicy = {
  // If set, only allow commits to these destinations (base58 pubkeys).
  allowlistTo?: string[];
  // If set, only allow these SPL mints.
  allowlistMints?: string[];
  // Maximum SOL per single transfer.
  maxSolPerTransfer?: number;
  // Maximum SPL token amount per transfer (UI units) per mint.
  // Example: {"So11111111111111111111111111111111111111112": 5}
  maxUiAmountPerSplMint?: Record<string, number>;
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

export function enforcePolicyForSplTransfer(
  policy: ActSafePolicy,
  params: { to: string; mint: string; amountBaseUnits: bigint; decimals: number },
) {
  if (policy.allowlistTo && policy.allowlistTo.length > 0) {
    if (!policy.allowlistTo.includes(params.to)) {
      throw new Error(`Policy violation: destination not in allowlist (${params.to})`);
    }
  }
  if (policy.allowlistMints && policy.allowlistMints.length > 0) {
    if (!policy.allowlistMints.includes(params.mint)) {
      throw new Error(`Policy violation: mint not in allowlist (${params.mint})`);
    }
  }
  if (policy.maxUiAmountPerSplMint && typeof policy.maxUiAmountPerSplMint[params.mint] === 'number') {
    const maxUi = policy.maxUiAmountPerSplMint[params.mint] as number;
    const maxBase = BigInt(Math.floor(maxUi * 10 ** params.decimals));
    if (params.amountBaseUnits > maxBase) {
      throw new Error(`Policy violation: amount exceeds maxUiAmountPerSplMint for mint=${params.mint} (max=${maxUi})`);
    }
  }
}
