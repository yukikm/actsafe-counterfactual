import { promises as fs } from 'node:fs';
import path from 'node:path';
import { sha256Hex, stableStringify } from './hash.js';

export type ActionReceiptStatus = 'planned' | 'simulated' | 'submitting' | 'committed' | 'failed';

export type ActionReceipt = {
  requestId: string;
  createdAt: string;
  updatedAt: string;
  status: ActionReceiptStatus;

  // Tamper-evidence for local receipts (best-effort MVP):
  // - receiptHash is sha256 of a canonical JSON representation of the receipt (excluding receiptHash)
  // - prevReceiptHash links to the previous receipt in the local store (hash chain)
  receiptHash?: string;
  prevReceiptHash?: string;

  kind: 'sol_transfer' | 'spl_transfer';
  params:
    | {
        from: string;
        to: string;
        lamports: string;
        cluster: string;
      }
    | {
        from: string;
        to: string;
        mint: string;
        amountBaseUnits: string;
        decimals: number;
        cluster: string;
      };

  shadow?: {
    preBalanceLamports?: string;
    postBalanceLamports?: string;
    simulationLogs?: string[];
    err?: unknown;
    slot?: number;
  };

  commit?: {
    signature?: string;
    slot?: number;
    err?: unknown;
  };
};

const RECEIPTS_DIR = path.resolve(process.cwd(), 'receipts');

const RECEIPT_INDEX_PATH = path.join(RECEIPTS_DIR, 'index.json');

type ReceiptIndex = {
  lastReceiptHash?: string;
};

export async function ensureReceiptsDir() {
  await fs.mkdir(RECEIPTS_DIR, { recursive: true });
}

async function loadIndex(): Promise<ReceiptIndex> {
  await ensureReceiptsDir();
  try {
    const raw = await fs.readFile(RECEIPT_INDEX_PATH, 'utf8');
    return JSON.parse(raw) as ReceiptIndex;
  } catch (e: any) {
    if (e?.code === 'ENOENT') return {};
    throw e;
  }
}

async function saveIndex(idx: ReceiptIndex) {
  await ensureReceiptsDir();
  await fs.writeFile(RECEIPT_INDEX_PATH, JSON.stringify(idx, null, 2));
}

function computeReceiptHash(receipt: ActionReceipt): string {
  const clone: any = { ...receipt };
  delete clone.receiptHash;
  return sha256Hex(stableStringify(clone));
}

export function verifyReceiptHash(receipt: ActionReceipt): { ok: boolean; expected?: string } {
  if (!receipt.receiptHash) return { ok: true };
  const expected = computeReceiptHash(receipt);
  return { ok: expected === receipt.receiptHash, expected };
}

export function receiptPath(requestId: string) {
  return path.join(RECEIPTS_DIR, `${requestId}.json`);
}

export async function loadReceipt(requestId: string): Promise<ActionReceipt | null> {
  try {
    const raw = await fs.readFile(receiptPath(requestId), 'utf8');
    const r = JSON.parse(raw) as ActionReceipt;
    const v = verifyReceiptHash(r);
    if (!v.ok) {
      throw new Error(`Receipt hash mismatch for requestId=${requestId}`);
    }
    return r;
  } catch (e: any) {
    if (e?.code === 'ENOENT') return null;
    throw e;
  }
}

export async function saveReceipt(receipt: ActionReceipt) {
  await ensureReceiptsDir();
  const idx = await loadIndex();

  // Link to previous receipt hash (hash chain)
  if (idx.lastReceiptHash) receipt.prevReceiptHash = idx.lastReceiptHash;
  receipt.receiptHash = computeReceiptHash(receipt);

  await fs.writeFile(receiptPath(receipt.requestId), JSON.stringify(receipt, null, 2));

  idx.lastReceiptHash = receipt.receiptHash;
  await saveIndex(idx);
}

export async function listReceipts(limit = 20): Promise<ActionReceipt[]> {
  await ensureReceiptsDir();
  const files = (await fs.readdir(RECEIPTS_DIR))
    .filter((f: string) => f.endsWith('.json'))
    .filter((f: string) => f !== 'index.json')
    .sort()
    .slice(-limit)
    .reverse();

  const receipts: ActionReceipt[] = [];
  for (const f of files) {
    const raw = await fs.readFile(path.join(RECEIPTS_DIR, f), 'utf8');
    receipts.push(JSON.parse(raw) as ActionReceipt);
  }
  return receipts;
}
