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
import { loadPolicy, enforcePolicyForSolTransfer } from './policy.js';
import { buildSplTransferTx, signTx } from './spl.js';

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
  const policy = loadPolicy();
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

async function planSplTransfer(args: { to: string; mint: string; amount: number; decimals: number }) {
  const payer = loadKeypairFromFile(mustKeypairPath());
  const toOwner = new PublicKey(args.to);
  const mint = new PublicKey(args.mint);
  const amountBaseUnits = BigInt(Math.floor(args.amount * 10 ** args.decimals));

  const params = {
    from: payer.publicKey.toBase58(),
    to: toOwner.toBase58(),
    mint: mint.toBase58(),
    amountBaseUnits: amountBaseUnits.toString(),
    decimals: args.decimals,
    cluster: getRpcUrl(),
  };
  const requestId = makeRequestId('spl_transfer', params);

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
    kind: 'spl_transfer',
    params,
  };

  const tx = await buildSplTransferTx({
    payer: payer.publicKey,
    owner: payer.publicKey,
    toOwner,
    mint,
    amountBaseUnits,
    decimals: args.decimals,
  });
  signTx(tx, [payer]);
  const sim = await simulateTx(tx);

  receipt.status = 'simulated';
  receipt.updatedAt = nowIso();
  receipt.shadow = {
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
  if (receipt.kind !== 'sol_transfer' && receipt.kind !== 'spl_transfer') throw new Error(`Unsupported kind: ${receipt.kind}`);

  const payer = loadKeypairFromFile(mustKeypairPath());
  const from = payer.publicKey.toBase58();
  if (from !== (receipt.params as any).from) {
    throw new Error(`Keypair mismatch: receipt.from=${receipt.params.from} but SOLANA_KEYPAIR is ${from}`);
  }

  const policy = loadPolicy();

  if (policy.requireSimulationSuccess && receipt.shadow?.err) {
    throw new Error('Policy violation: simulation must succeed before commit');
  }

  if (receipt.kind === 'sol_transfer') {
    const to = new PublicKey((receipt.params as any).to);
    const lamports = BigInt((receipt.params as any).lamports);

    enforcePolicyForSolTransfer(policy, { to: to.toBase58(), lamports });

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
    return;
  }

  // SPL transfer commit: currently relies on simulation + send; does not implement balance precondition.
  if (receipt.kind === 'spl_transfer') {
    const toOwner = new PublicKey((receipt.params as any).to);
    const mint = new PublicKey((receipt.params as any).mint);
    const amountBaseUnits = BigInt((receipt.params as any).amountBaseUnits);
    const decimals = Number((receipt.params as any).decimals);

    const tx = await buildSplTransferTx({
      payer: payer.publicKey,
      owner: payer.publicKey,
      toOwner,
      mint,
      amountBaseUnits,
      decimals,
    });
    signTx(tx, [payer]);

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
    (y: any) =>
      y
        .option('to', { type: 'string', demandOption: true, describe: 'Recipient pubkey' })
        .option('sol', { type: 'number', demandOption: true, describe: 'Amount in SOL' }),
    async (argv: any) => {
      await planTransfer({ to: argv.to as string, sol: argv.sol as number });
    },
  )
  .command(
    'plan-spl-transfer',
    'Plan + shadow-run an SPL token transfer (may include ATA creation), store receipt',
    (y: any) =>
      y
        .option('to', { type: 'string', demandOption: true, describe: 'Recipient owner pubkey' })
        .option('mint', { type: 'string', demandOption: true, describe: 'Token mint pubkey' })
        .option('amount', { type: 'number', demandOption: true, describe: 'UI amount (e.g. 1.5)' })
        .option('decimals', { type: 'number', demandOption: true, describe: 'Token decimals' }),
    async (argv: any) => {
      await planSplTransfer({
        to: argv.to as string,
        mint: argv.mint as string,
        amount: argv.amount as number,
        decimals: argv.decimals as number,
      });
    },
  )
  .command(
    'commit',
    'Commit a previously planned requestId (will send tx)',
    (y: any) => y.option('request', { type: 'string', demandOption: true }),
    async (argv: any) => {
      await commit({ request: argv.request as string });
    },
  )
  .command(
    'receipts',
    'List recent receipts',
    (y: any) => y.option('limit', { type: 'number', default: 20 }),
    async (argv: any) => {
      await receipts({ limit: argv.limit as number });
    },
  )
  .demandCommand(1)
  .strict()
  .help().argv;
