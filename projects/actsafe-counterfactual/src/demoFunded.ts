import { Keypair, PublicKey } from '@solana/web3.js';
import { loadKeypairFromFile, getBalanceLamports, getRpcUrl, buildSolTransferTx, sendTxSignatureOnly, confirmSignature } from './solana.js';
import { makeRequestId } from './requestId.js';
import { loadPolicy } from './policy.js';
import { loadReceipt, saveReceipt, type ActionReceipt } from './receiptStore.js';

function nowIso() {
  return new Date().toISOString();
}

function mustKeypairPath() {
  const p = process.env.SOLANA_KEYPAIR;
  if (!p) throw new Error('Missing SOLANA_KEYPAIR env var (path to json keypair)');
  return p;
}

function explorerUrl(signature: string) {
  // default cluster assumption: devnet
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

async function main() {
  const payer = loadKeypairFromFile(mustKeypairPath());
  const policy = loadPolicy();

  const balance = await getBalanceLamports(payer.publicKey);
  const lamports = 1_000_000n; // 0.001 SOL

  if (balance < lamports) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          reason: 'insufficient_balance_for_demo',
          rpc: getRpcUrl(),
          pubkey: payer.publicKey.toBase58(),
          balanceLamports: balance.toString(),
          requiredLamports: lamports.toString(),
          hint: 'Fund this keypair on devnet (https://faucet.solana.com) then rerun.'
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const to = payer.publicKey; // self-transfer for demo
  const params = {
    from: payer.publicKey.toBase58(),
    to: to.toBase58(),
    lamports: lamports.toString(),
    cluster: getRpcUrl(),
  };
  const requestId = makeRequestId('sol_transfer', params);

  const existing = await loadReceipt(requestId);
  if (existing?.status === 'committed') {
    console.log(
      JSON.stringify(
        {
          ok: true,
          alreadyCommitted: true,
          requestId,
          signature: existing.commit?.signature,
          explorer: existing.commit?.signature ? explorerUrl(existing.commit.signature) : undefined,
          receipt: existing,
        },
        null,
        2,
      ),
    );
    return;
  }

  const receipt: ActionReceipt = {
    requestId,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
    status: 'planned',
    kind: 'sol_transfer',
    params,
  };
  await saveReceipt(receipt);

  const memoPrefix = policy.memoPrefix ?? 'shadowcommit';
  const memo = policy.attachMemoEvidence ? `${memoPrefix}:${receipt.requestId}:${receipt.evidenceHash ?? ''}` : undefined;
  const memoArg = memo ? { memo } : {};

  const tx = await buildSolTransferTx({ from: payer.publicKey, to, lamports, ...memoArg });
  tx.sign([payer]);

  const sig = await sendTxSignatureOnly(tx);
  receipt.status = 'submitting';
  receipt.updatedAt = nowIso();
  receipt.commit = { signature: sig };
  await saveReceipt(receipt);

  const conf = await confirmSignature(sig);
  receipt.status = conf.value.err ? 'failed' : 'committed';
  receipt.updatedAt = nowIso();
  receipt.commit = { signature: sig, err: conf.value.err ?? undefined };
  await saveReceipt(receipt);

  console.log(
    JSON.stringify(
      {
        ok: !conf.value.err,
        requestId,
        signature: sig,
        explorer: explorerUrl(sig),
        memo,
        receipt,
      },
      null,
      2,
    ),
  );
}

await main();

