import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  type Signer,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getMint,
} from '@solana/spl-token';
import { connection } from './solana.js';

export async function buildSplTransferTx(params: {
  payer: PublicKey;
  owner: PublicKey;
  toOwner: PublicKey;
  mint: PublicKey;
  amountBaseUnits: bigint;
  decimals: number;
}) {
  const conn = connection();
  const { blockhash } = await conn.getLatestBlockhash();

  const ownerAta = getAssociatedTokenAddressSync(params.mint, params.owner, false, TOKEN_PROGRAM_ID);
  const toAta = getAssociatedTokenAddressSync(params.mint, params.toOwner, false, TOKEN_PROGRAM_ID);

  const ixs = [];

  const toAtaInfo = await conn.getAccountInfo(toAta);
  if (!toAtaInfo) {
    ixs.push(
      createAssociatedTokenAccountInstruction(
        params.payer,
        toAta,
        params.toOwner,
        params.mint,
        TOKEN_PROGRAM_ID,
      ),
    );
  }

  ixs.push(
    createTransferCheckedInstruction(
      ownerAta,
      params.mint,
      toAta,
      params.owner,
      params.amountBaseUnits,
      params.decimals,
      [],
      TOKEN_PROGRAM_ID,
    ),
  );

  const msg = new TransactionMessage({
    payerKey: params.payer,
    recentBlockhash: blockhash,
    instructions: ixs,
  }).compileToV0Message();

  return new VersionedTransaction(msg);
}

export async function splPreconditions(params: {
  owner: PublicKey;
  toOwner: PublicKey;
  mint: PublicKey;
  amountBaseUnits: bigint;
  expectedDecimals: number;
}) {
  const conn = connection();
  const mintInfo = await getMint(conn as any, params.mint, undefined, TOKEN_PROGRAM_ID);
  if (mintInfo.decimals !== params.expectedDecimals) {
    throw new Error(`Precondition failed: mint decimals mismatch (expected=${params.expectedDecimals}, onchain=${mintInfo.decimals})`);
  }

  const ownerAta = getAssociatedTokenAddressSync(params.mint, params.owner, false, TOKEN_PROGRAM_ID);
  const ownerAccount = await getAccount(conn as any, ownerAta, undefined, TOKEN_PROGRAM_ID);
  const bal = ownerAccount.amount;
  if (bal < params.amountBaseUnits) {
    throw new Error(
      `Precondition failed: insufficient token balance (have=${bal.toString()} need=${params.amountBaseUnits.toString()})`,
    );
  }

  // Recipient ATA may not exist; tx builder will include creation if missing.
  const toAta = getAssociatedTokenAddressSync(params.mint, params.toOwner, false, TOKEN_PROGRAM_ID);
  const toAtaInfo = await conn.getAccountInfo(toAta);
  return { ownerAta, toAtaExists: Boolean(toAtaInfo) };
}

export function signTx(tx: VersionedTransaction, signers: Signer[]) {
  tx.sign(signers);
  return tx;
}
