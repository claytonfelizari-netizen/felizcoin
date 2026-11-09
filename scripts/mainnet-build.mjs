import fs from 'node:fs';
import path from 'node:path';
import {Keypair, PublicKey} from '@solana/web3.js';
import {creationTransaction} from './token.mjs';

const config = JSON.parse(fs.readFileSync(new URL('../felizcoin.config.json', import.meta.url)));
const payer = new PublicKey(config.production_wallet_public_address);
const mint = Keypair.generate();
const treasury = Keypair.generate();
const payerSigner = {publicKey: payer};
const founder = {publicKey: payer};
const amounts = {total: 25000000n * 10n ** 9n, founder: 3750000n * 10n ** 9n,
  treasury: 21250000n * 10n ** 9n, decimals: 9,
  metadata: {name: 'FELIZCOIN', symbol: 'FELIZ', uri: config.metadata_uri}};
const {tx} = creationTransaction({payer:payerSigner, mint, founder, treasury}, 0, amounts);
const dir = path.resolve('.mainnet-pending'); fs.mkdirSync(dir, {recursive: true, mode: 0o700}); fs.chmodSync(dir, 0o700);
fs.writeFileSync(path.join(dir, 'mint-keypair.json'), JSON.stringify(Array.from(mint.secretKey)), {mode: 0o600});
fs.writeFileSync(path.join(dir, 'treasury-keypair.json'), JSON.stringify(Array.from(treasury.secretKey)), {mode: 0o600});
fs.writeFileSync(path.join(dir, 'review.json'), JSON.stringify({network:'mainnet-beta', payer:payer.toBase58(), mint:mint.publicKey.toBase58(), treasury:treasury.publicKey.toBase58(), supply:'25000000', founder:'3750000', uri:config.metadata_uri, instructions:tx.instructions.length}, null, 2));
console.log(fs.readFileSync(path.join(dir, 'review.json'), 'utf8'));
