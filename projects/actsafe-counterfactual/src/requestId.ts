import { createHash } from 'node:crypto';

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function makeRequestId(kind: string, params: unknown): string {
  // Deterministic id for idempotency. Intentionally stable across retries.
  return sha256Hex(`${kind}:${JSON.stringify(params)}`);
}

