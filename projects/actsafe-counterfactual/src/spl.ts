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

export function signTx(tx: VersionedTransaction, signers: Signer[]) {
  tx.sign(signers);
  return tx;
}

