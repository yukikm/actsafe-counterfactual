import { sha256Hex, stableStringify } from './hash.js';

export function makeRequestId(kind: string, params: unknown): string {
  // Deterministic id for idempotency. Intentionally stable across retries.
  return sha256Hex(`${kind}:${stableStringify(params)}`);
}
