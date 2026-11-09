import fs from 'node:fs';
import {Connection, PublicKey} from '@solana/web3.js';
import {getMint} from '@solana/spl-token';
import {RPC, GENESIS} from './token.mjs';
import {metadataAddress, METADATA_PROGRAM, decodeMetadata} from './metadata.mjs';
const report = JSON.parse(fs.readFileSync(new URL('../devnet-result.json', import.meta.url)));
const connection = new Connection(RPC, {commitment: 'confirmed', disableRetryOnRateLimit: true,
  fetch: (url, options) => fetch(url, {...options, signal: AbortSignal.timeout(20000)})});
if (await connection.getGenesisHash() !== GENESIS) throw Error('Rede incorreta.');
const balance = await connection.getBalance(new PublicKey(report.payer));
const info = await connection.getAccountInfo(new PublicKey(report.mint));
const output = {network: 'devnet', test_sol: balance / 1e9, mint_exists: Boolean(info), payer: report.payer};
if (info) {
  const mint = await getMint(connection, new PublicKey(report.mint));
  Object.assign(output, {mint: report.mint, supply_base_units: mint.supply.toString(),
    decimals: mint.decimals, mint_authority: mint.mintAuthority?.toBase58() ?? null,
    freeze_authority: mint.freezeAuthority?.toBase58() ?? null});
  const metadata = await connection.getAccountInfo(metadataAddress(new PublicKey(report.mint)));
  output.metadata_exists = Boolean(metadata);
  if (metadata?.owner.equals(METADATA_PROGRAM)) {
    const decoded = decodeMetadata(metadata.data);
    output.name = decoded.name;
    output.symbol = decoded.symbol;
    output.metadata_mutable = decoded.isMutable;
  }
}
console.log(JSON.stringify(output, null, 2));
