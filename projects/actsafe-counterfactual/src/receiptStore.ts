import { promises as fs } from 'node:fs';
import path from 'node:path';

export type ActionReceiptStatus = 'planned' | 'simulated' | 'submitting' | 'committed' | 'failed';

export type ActionReceipt = {
  requestId: string;
  createdAt: string;
  updatedAt: string;
  status: ActionReceiptStatus;

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

export async function ensureReceiptsDir() {
  await fs.mkdir(RECEIPTS_DIR, { recursive: true });
}

export function receiptPath(requestId: string) {
  return path.join(RECEIPTS_DIR, `${requestId}.json`);
}

export async function loadReceipt(requestId: string): Promise<ActionReceipt | null> {
  try {
    const raw = await fs.readFile(receiptPath(requestId), 'utf8');
    return JSON.parse(raw) as ActionReceipt;
  } catch (e: any) {
    if (e?.code === 'ENOENT') return null;
    throw e;
  }
}

export async function saveReceipt(receipt: ActionReceipt) {
  await ensureReceiptsDir();
  await fs.writeFile(receiptPath(receipt.requestId), JSON.stringify(receipt, null, 2));
}

export async function listReceipts(limit = 20): Promise<ActionReceipt[]> {
  await ensureReceiptsDir();
  const files = (await fs.readdir(RECEIPTS_DIR))
    .filter((f: string) => f.endsWith('.json'))
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
