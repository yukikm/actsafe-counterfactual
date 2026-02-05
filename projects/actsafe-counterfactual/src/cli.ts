#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { PublicKey } from '@solana/web3.js';
import { makeRequestId } from './requestId.js';
import {
  buildSolTransferTx,
  getBalanceLamports,
  loadKeypairFromFile,
  sendTx,
  simulateTx,
  getRpcUrl,
} from './solana.js';
import { listReceipts, loadReceipt, saveReceipt, type ActionReceipt } from './receiptStore.js';

function nowIso() {
  return new Date().toISOString();
}

function mustKeypairPath() {
  const p = process.env.SOLANA_KEYPAIR;
  if (!p) throw new Error('Missing SOLANA_KEYPAIR env var (path to json keypair)');
  return p;
}

async function planTransfer(args: { to: string; sol: number }) {
  const payer = loadKeypairFromFile(mustKeypairPath());
  const to = new PublicKey(args.to);
  const lamports = BigInt(Math.floor(args.sol * 1_000_000_000));

  const params = {
    from: payer.publicKey.toBase58(),
    to: to.toBase58(),
    lamports: lamports.toString(),
    cluster: getRpcUrl(),
  };
  const requestId = makeRequestId('sol_transfer', params);

  // Idempotency: if already committed, refuse.
  const existing = await loadReceipt(requestId);
  if (existing?.status === 'committed') {
    throw new Error(`Already committed: requestId=${requestId} signature=${existing.commit?.signature ?? ''}`);
  }

  const createdAt = existing?.createdAt ?? nowIso();
  const receipt: ActionReceipt = {
    requestId,
    createdAt,
    updatedAt: nowIso(),
    status: 'planned',
    kind: 'sol_transfer',
    params,
  };

  // Shadow-run: capture pre/post balance by simulation + optional balance read.
  const pre = await getBalanceLamports(payer.publicKey);
  const tx = await buildSolTransferTx({ from: payer.publicKey, to, lamports });
  tx.sign([payer]);

  const sim = await simulateTx(tx);

  // Approximate post-balance: pre - lamports (fees ignored in MVP)
  const post = pre - lamports;

  receipt.status = 'simulated';
  receipt.updatedAt = nowIso();
  receipt.shadow = {
    preBalanceLamports: pre.toString(),
    postBalanceLamports: post.toString(),
    ...(sim.value.logs ? { simulationLogs: sim.value.logs } : {}),
    ...(sim.value.err ? { err: sim.value.err } : {}),
    slot: sim.context.slot,
  };

  await saveReceipt(receipt);

  console.log(JSON.stringify({ ok: true, requestId, receipt }, null, 2));
}

async function commit(args: { request: string }) {
  const receipt = await loadReceipt(args.request);
  if (!receipt) throw new Error(`Unknown requestId: ${args.request}`);
  if (receipt.status === 'committed') {
    console.log(JSON.stringify({ ok: true, alreadyCommitted: true, receipt }, null, 2));
    return;
  }
  if (receipt.kind !== 'sol_transfer') throw new Error(`Unsupported kind: ${receipt.kind}`);

  const payer = loadKeypairFromFile(mustKeypairPath());
  const from = payer.publicKey.toBase58();
  if (from !== receipt.params.from) {
    throw new Error(`Keypair mismatch: receipt.from=${receipt.params.from} but SOLANA_KEYPAIR is ${from}`);
  }

  const to = new PublicKey(receipt.params.to);
  const lamports = BigInt(receipt.params.lamports);

  // Preconditions (MVP): balance must still cover lamports.
  const pre = await getBalanceLamports(payer.publicKey);
  if (pre < lamports) {
    receipt.status = 'failed';
    receipt.updatedAt = nowIso();
    receipt.commit = { err: { precondition: 'insufficient_balance', pre: pre.toString(), lamports: lamports.toString() } };
    await saveReceipt(receipt);
    throw new Error('Precondition failed: insufficient balance');
  }

  const tx = await buildSolTransferTx({ from: payer.publicKey, to, lamports });
  tx.sign([payer]);

  try {
    const sent = await sendTx(tx);
    receipt.status = 'committed';
    receipt.updatedAt = nowIso();
    receipt.commit = {
      signature: sent.signature,
      err: sent.confirmation.value.err ?? undefined,
    };
    await saveReceipt(receipt);
    console.log(JSON.stringify({ ok: true, receipt }, null, 2));
  } catch (err) {
    receipt.status = 'failed';
    receipt.updatedAt = nowIso();
    receipt.commit = { err: err instanceof Error ? { message: err.message } : err };
    await saveReceipt(receipt);
    throw err;
  }
}

async function receipts(args: { limit: number }) {
  const rs = await listReceipts(args.limit);
  console.log(JSON.stringify({ ok: true, receipts: rs }, null, 2));
}

await yargs(hideBin(process.argv))
  .scriptName('actsafe')
  .command(
    'plan-transfer',
    'Plan + shadow-run a SOL transfer (no side effects), store receipt',
    (y) =>
      y
        .option('to', { type: 'string', demandOption: true, describe: 'Recipient pubkey' })
        .option('sol', { type: 'number', demandOption: true, describe: 'Amount in SOL' }),
    async (argv) => {
      await planTransfer({ to: argv.to as string, sol: argv.sol as number });
    },
  )
  .command(
    'commit',
    'Commit a previously planned requestId (will send tx)',
    (y) => y.option('request', { type: 'string', demandOption: true }),
    async (argv) => {
      await commit({ request: argv.request as string });
    },
  )
  .command(
    'receipts',
    'List recent receipts',
    (y) => y.option('limit', { type: 'number', default: 20 }),
    async (argv) => {
      await receipts({ limit: argv.limit as number });
    },
  )
  .demandCommand(1)
  .strict()
  .help().argv;
