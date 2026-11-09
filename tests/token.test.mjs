import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Keypair} from '@solana/web3.js';
import {TOKEN_PROGRAM_ID, decodeMintToCheckedInstruction, decodeSetAuthorityInstruction,
  decodeInitializeMint2Instruction, AuthorityType} from '@solana/spl-token';
import {validateConfig, creationTransaction, base58} from '../scripts/token.mjs';
import {METADATA_PROGRAM} from '../scripts/metadata.mjs';
import {getCreateV1InstructionDataSerializer} from '@metaplex-foundation/mpl-token-metadata';
const config = JSON.parse(fs.readFileSync(new URL('../felizcoin.config.json', import.meta.url)));
test('rejects mainnet and changes to approved distribution', () => {
  assert.throws(() => validateConfig({...config, test_network_proposal: 'mainnet'}));
  assert.throws(() => validateConfig({...config, founder_allocation: {percent: 50}}));
  assert.throws(() => validateConfig({...config, production_supply: '21000001'}));
});
test('signed atomic transaction fits and fixes supply with correct distribution', () => {
  const keys = Object.fromEntries(['payer','mint','founder','treasury'].map(n => [n,Keypair.generate()]));
  const amounts = validateConfig(config);
  const {tx, founder, treasury} = creationTransaction(keys, 1461600, amounts);
  assert.equal(tx.instructions.length, 8);
  const initialization = decodeInitializeMint2Instruction(tx.instructions[1]);
  assert.equal(initialization.data.freezeAuthority, null);
  const a = decodeMintToCheckedInstruction(tx.instructions[4]);
  const b = decodeMintToCheckedInstruction(tx.instructions[5]);
  assert.ok(a.keys.destination.pubkey.equals(founder));
  assert.ok(b.keys.destination.pubkey.equals(treasury));
  assert.equal(a.data.amount, 5_250_000_000_000_000n);
  assert.equal(b.data.amount, 15_750_000_000_000_000n);
  assert.equal(a.data.amount + b.data.amount, amounts.total);
  assert.ok(tx.instructions[6].programId.equals(METADATA_PROGRAM));
  const [metadata] = getCreateV1InstructionDataSerializer().deserialize(tx.instructions[6].data);
  assert.equal(metadata.name, 'FELIZCOIN');
  assert.equal(metadata.symbol, 'FELIZ');
  assert.equal(metadata.tokenStandard, 2);
  const revoke = decodeSetAuthorityInstruction(tx.instructions[7]);
  assert.equal(revoke.data.authorityType, AuthorityType.MintTokens);
  assert.equal(revoke.data.newAuthority, null);
  assert.ok(tx.instructions[7].programId.equals(TOKEN_PROGRAM_ID));
  tx.feePayer = keys.payer.publicKey;
  tx.recentBlockhash = Keypair.generate().publicKey.toBase58();
  tx.sign(keys.payer, keys.mint);
  assert.ok(tx.serialize().length <= 1232);
  assert.ok(tx.verifySignatures());
});
test('signature encoding preserves leading zero bytes', () => {
  assert.equal(base58(Uint8Array.from([0,0,1])), '112');
  assert.equal(base58(Uint8Array.from([57])), 'z');
  assert.equal(base58(Uint8Array.from([58])), '21');
});
