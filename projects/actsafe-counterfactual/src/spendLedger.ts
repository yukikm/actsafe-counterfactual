import { promises as fs } from 'node:fs';
import path from 'node:path';

const LEDGER_PATH = path.resolve(process.cwd(), 'receipts', 'spend-ledger.json');

type Ledger = {
  days: Record<
    string,
    {
      solLamportsSpent?: string;
      splBaseUnitsSpentByMint?: Record<string, string>;
      splDecimalsByMint?: Record<string, number>;
    }
  >;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function loadLedger(): Promise<Ledger> {
  try {
    const raw = await fs.readFile(LEDGER_PATH, 'utf8');
    return JSON.parse(raw) as Ledger;
  } catch (e: any) {
    if (e?.code === 'ENOENT') return { days: {} };
    throw e;
  }
}

async function saveLedger(ledger: Ledger) {
  await fs.mkdir(path.dirname(LEDGER_PATH), { recursive: true });
  await fs.writeFile(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}

export async function checkAndRecordSolSpend(opts: { lamports: bigint; maxSolPerDay?: number }) {
  if (typeof opts.maxSolPerDay !== 'number') return;
  const maxLamports = BigInt(Math.floor(opts.maxSolPerDay * 1_000_000_000));
  const ledger = await loadLedger();
  const day = todayKey();
  const entry = (ledger.days[day] ??= {});
  const cur = BigInt(entry.solLamportsSpent ?? '0');
  const next = cur + opts.lamports;
  if (next > maxLamports) {
    throw new Error(`Policy violation: maxSolPerDay exceeded (spent=${cur.toString()} next=${next.toString()} max=${maxLamports.toString()})`);
  }
  entry.solLamportsSpent = next.toString();
  await saveLedger(ledger);
}

export async function checkAndRecordSplSpend(opts: {
  mint: string;
  amountBaseUnits: bigint;
  decimals: number;
  maxUiAmountPerSplMintPerDay?: Record<string, number>;
}) {
  if (!opts.maxUiAmountPerSplMintPerDay) return;
  const maxUi = opts.maxUiAmountPerSplMintPerDay[opts.mint];
  if (typeof maxUi !== 'number') return;

  const maxBase = BigInt(Math.floor(maxUi * 10 ** opts.decimals));
  const ledger = await loadLedger();
  const day = todayKey();
  const entry = (ledger.days[day] ??= {});
  entry.splBaseUnitsSpentByMint ??= {};
  entry.splDecimalsByMint ??= {};
  entry.splDecimalsByMint[opts.mint] = opts.decimals;

  const cur = BigInt(entry.splBaseUnitsSpentByMint[opts.mint] ?? '0');
  const next = cur + opts.amountBaseUnits;
  if (next > maxBase) {
    throw new Error(`Policy violation: maxUiAmountPerSplMintPerDay exceeded for mint=${opts.mint} (next=${next.toString()} max=${maxBase.toString()})`);
  }
  entry.splBaseUnitsSpentByMint[opts.mint] = next.toString();
  await saveLedger(ledger);
}

