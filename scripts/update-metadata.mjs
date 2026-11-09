import fs from 'node:fs';
import {Connection, Keypair, PublicKey, Transaction} from '@solana/web3.js';
import {createUmi} from '@metaplex-foundation/umi-bundle-defaults';
import {createNoopSigner, publicKey} from '@metaplex-foundation/umi';
import {mplTokenMetadata} from '@metaplex-foundation/mpl-token-metadata';
import {updateV1} from '@metaplex-foundation/mpl-token-metadata';
import {toWeb3JsInstruction} from '@metaplex-foundation/umi-web3js-adapters';
import {RPC} from './token.mjs';

const root = new URL('..', import.meta.url);
const report = JSON.parse(fs.readFileSync(new URL('../devnet-result.json', import.meta.url)));
const secret = JSON.parse(fs.readFileSync(new URL('../.devnet/payer-keypair.json', import.meta.url)));
const payer = Keypair.fromSecretKey(Uint8Array.from(secret));
if (payer.publicKey.toBase58() !== report.payer) throw Error('Carteira divergente.');
const mint = new PublicKey(report.mint);
const uri = 'https://delicate-kringle-99b7e9.netlify.app/felizcoin.json';
const umi = createUmi(RPC).use(mplTokenMetadata());
const signer = createNoopSigner(publicKey(payer.publicKey.toBase58()));
const builder = updateV1(umi, {mint: publicKey(mint.toBase58()), authority: signer, payer: signer,
  data: {name: 'FELIZCOIN', symbol: 'FELIZ', uri, sellerFeeBasisPoints: 0,
    creators: [{address: publicKey(payer.publicKey.toBase58()), verified: true, share: 100}]}, isMutable: true});
const instruction = toWeb3JsInstruction(builder.getInstructions()[0]);
const connection = new Connection(RPC, {commitment: 'confirmed'});
const tx = new Transaction().add(instruction); tx.feePayer = payer.publicKey;
const bh = await connection.getLatestBlockhash(); tx.recentBlockhash = bh.blockhash; tx.sign(payer);
const signature = await connection.sendRawTransaction(tx.serialize());
await connection.confirmTransaction({signature, ...bh}, 'confirmed');
console.log(JSON.stringify({signature, uri, explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`}, null, 2));
