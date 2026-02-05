import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  type Commitment,
} from '@solana/web3.js';
import { readFileSync } from 'node:fs';

export function getRpcUrl() {
  return process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
}

export function getCommitment(): Commitment {
  return (process.env.SOLANA_COMMITMENT as Commitment) ?? 'confirmed';
}

export function connection() {
  return new Connection(getRpcUrl(), { commitment: getCommitment() });
}

export function loadKeypairFromFile(filePath: string): Keypair {
  const raw = readFileSync(filePath, 'utf8');
  const arr = JSON.parse(raw) as number[];
  return Keypair.fromSecretKey(new Uint8Array(arr));
}

export async function buildSolTransferTx(params: {
  from: PublicKey;
  to: PublicKey;
  lamports: bigint;
}) {
  const conn = connection();
  const { blockhash } = await conn.getLatestBlockhash();

  const ix = SystemProgram.transfer({
    fromPubkey: params.from,
    toPubkey: params.to,
    lamports: Number(params.lamports),
  });

  const msg = new TransactionMessage({
    payerKey: params.from,
    recentBlockhash: blockhash,
    instructions: [ix],
  }).compileToV0Message();

  return new VersionedTransaction(msg);
}

export async function simulateTx(tx: VersionedTransaction, opts?: { sigVerify?: boolean }) {
  const conn = connection();
  return conn.simulateTransaction(tx, {
    sigVerify: opts?.sigVerify ?? false,
    commitment: getCommitment(),
  });
}

export async function sendTx(tx: VersionedTransaction) {
  const conn = connection();
  const sig = await conn.sendTransaction(tx, {
    skipPreflight: false,
    maxRetries: 3,
  });
  const conf = await conn.confirmTransaction(sig, getCommitment());
  return { signature: sig, confirmation: conf };
}

export async function getBalanceLamports(pubkey: PublicKey) {
  const conn = connection();
  return BigInt(await conn.getBalance(pubkey, getCommitment()));
}

