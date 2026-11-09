import { SystemProgram, Transaction } from '@solana/web3.js';
import {metadataInstruction, metadataAddress} from './metadata.mjs';
import {
  MINT_SIZE, TOKEN_PROGRAM_ID, AuthorityType,
  getAssociatedTokenAddressSync, createInitializeMint2Instruction,
  createAssociatedTokenAccountIdempotentInstruction, createMintToCheckedInstruction,
  createSetAuthorityInstruction,
} from '@solana/spl-token';

export const RPC = 'https://api.devnet.solana.com';
export const GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
export function validateConfig(config) {
  if (config.test_network_proposal !== 'solana-devnet') throw Error('Somente devnet.');
  if (config.test_supply !== '21000000' || config.test_decimals !== 9)
    throw Error('Configuração histórica da devnet incompatível.');
  if (config.production_supply !== '25000000' || config.founder_allocation?.percent !== 15)
    throw Error('Plano de produção incompatível.');
  const total = 21_000_000n * 10n ** 9n;
  if (config.name !== 'FELIZCOIN' || config.symbol_proposal !== 'FELIZ')
    throw Error('Nome ou símbolo de teste inesperado.');
  return { total, founder: total / 4n, treasury: total * 3n / 4n, decimals: 9,
    metadata: {name: config.name, symbol: config.symbol_proposal, uri: ''} };
}

export function creationTransaction(keys, rent, amounts) {
  const payer = keys.payer.publicKey;
  const mint = keys.mint.publicKey;
  const founder = getAssociatedTokenAddressSync(mint, keys.founder.publicKey);
  const treasury = getAssociatedTokenAddressSync(mint, keys.treasury.publicKey);
  const tx = new Transaction().add(
    SystemProgram.createAccount({fromPubkey: payer, newAccountPubkey: mint,
      space: MINT_SIZE, lamports: rent, programId: TOKEN_PROGRAM_ID}),
    createInitializeMint2Instruction(mint, amounts.decimals, payer, null),
    createAssociatedTokenAccountIdempotentInstruction(payer, founder, keys.founder.publicKey, mint),
    createAssociatedTokenAccountIdempotentInstruction(payer, treasury, keys.treasury.publicKey, mint),
    createMintToCheckedInstruction(mint, founder, payer, amounts.founder, amounts.decimals),
    createMintToCheckedInstruction(mint, treasury, payer, amounts.treasury, amounts.decimals),
    metadataInstruction(payer, mint, amounts.metadata),
    createSetAuthorityInstruction(mint, payer, AuthorityType.MintTokens, null),
  );
  return { tx, founder, treasury, metadata: metadataAddress(mint) };
}

export function base58(bytes) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let n = BigInt('0x' + Buffer.from(bytes).toString('hex'));
  let result = '';
  while (n) { result = alphabet[Number(n % 58n)] + result; n /= 58n; }
  for (const byte of bytes) { if (byte !== 0) break; result = '1' + result; }
  return result;
}
