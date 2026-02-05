import { promises as fs } from 'node:fs';
import path from 'node:path';

// Minimal local replay-protection store for signatures.
// Not meant to be perfect; it gives agents a practical default that survives restarts.

const STORE_PATH = path.resolve(process.cwd(), 'receipts', 'processed-sigs.json');

type Entry = {
  sig: string;
  firstSeenAt: string; // ISO
  expiresAt: string; // ISO
};

type Store = {
  entries: Entry[];
};

function now() {
  return new Date();
}

function iso(d: Date) {
  return d.toISOString();
}

async function load(): Promise<Store> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    return JSON.parse(raw) as Store;
  } catch (e: any) {
    if (e?.code === 'ENOENT') return { entries: [] };
    throw e;
  }
}

async function save(store: Store) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2));
}

export async function markProcessed(sig: string, ttlSeconds: number) {
  const store = await load();
  const t = now();
  const expiresAt = new Date(t.getTime() + ttlSeconds * 1000);
  const existing = store.entries.find((e) => e.sig === sig);
  if (existing) {
    // extend TTL
    existing.expiresAt = iso(expiresAt);
    await save(store);
    return;
  }
  store.entries.push({ sig, firstSeenAt: iso(t), expiresAt: iso(expiresAt) });
  await save(store);
}

export async function isProcessed(sig: string) {
  const store = await load();
  const t = now().getTime();
  // prune expired
  store.entries = store.entries.filter((e) => new Date(e.expiresAt).getTime() > t);
  await save(store);
  return store.entries.some((e) => e.sig === sig);
}

