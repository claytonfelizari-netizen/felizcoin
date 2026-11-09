// Read-only retrieval of the public Metaplex executable from Solana devnet.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {Connection, PublicKey} from '@solana/web3.js';
import {RPC, GENESIS} from './token.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const program = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const loader = 'BPFLoaderUpgradeab1e11111111111111111111111';
const connection = new Connection(RPC, {commitment: 'finalized', disableRetryOnRateLimit: true,
  fetch: (url, options) => fetch(url, {...options, signal: AbortSignal.timeout(30000)})});
assert.equal(await connection.getGenesisHash(), GENESIS);
const account = await connection.getAccountInfo(program);
assert.ok(account?.executable);
assert.equal(account.owner.toBase58(), loader);
assert.equal(account.data.readUInt32LE(0), 2);
const programData = new PublicKey(account.data.subarray(4, 36));
const {context, value: data} = await connection.getAccountInfoAndContext(programData);
assert.equal(data.owner.toBase58(), loader);
assert.equal(data.data.readUInt32LE(0), 3);
const executable = data.data.subarray(45);
assert.equal(executable.subarray(0, 4).toString('hex'), '7f454c46');
const directory = path.join(root, '.programs');
fs.mkdirSync(directory, {recursive: true});
fs.writeFileSync(path.join(directory, 'token-metadata.so'), executable);
const manifest = {program: program.toBase58(), network: 'devnet', rpc: RPC,
  program_data: programData.toBase58(), observed_slot: context.slot,
  sha256: createHash('sha256').update(executable).digest('hex'), bytes: executable.length,
  downloaded_at: new Date().toISOString()};
fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
