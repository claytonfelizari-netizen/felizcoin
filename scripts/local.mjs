import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {LiteSVM, FailedTransactionMetadata} from 'litesvm';
import {Keypair, Transaction} from '@solana/web3.js';
import {MINT_SIZE, MintLayout, AccountLayout, TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction, createMintToCheckedInstruction,
  createSetAuthorityInstruction, AuthorityType} from '@solana/spl-token';
import {validateConfig, creationTransaction, base58} from './token.mjs';
import {METADATA_PROGRAM, decodeMetadata} from './metadata.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function runLocal() {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'felizcoin.config.json')));
  const amounts = validateConfig(config);
  const svm = new LiteSVM();
  const manifest = JSON.parse(fs.readFileSync(path.join(root, '.programs/manifest.json')));
  const program = fs.readFileSync(path.join(root, '.programs/token-metadata.so'));
  assert.equal(manifest.program, METADATA_PROGRAM.toBase58());
  assert.equal(createHash('sha256').update(program).digest('hex'), manifest.sha256);
  svm.addProgram(METADATA_PROGRAM.toBase58(), program);
  const keys = Object.fromEntries(['payer','mint','founder','treasury','recipient']
    .map(name => [name, Keypair.generate()]));
  const funding = svm.airdrop(keys.payer.publicKey.toBase58(), 1_000_000_000n);
  assert.ok(!(funding instanceof FailedTransactionMetadata));
  const records = [];
  function send(label, tx, signers, expectedError) {
    svm.expireBlockhash();
    tx.feePayer = keys.payer.publicKey;
    tx.recentBlockhash = svm.latestBlockhash();
    tx.sign(...signers);
    // Convert the same signed legacy transaction to the public Kit representation.
    const result = svm.sendTransaction({messageBytes: tx.serializeMessage(),
      signatures: Object.fromEntries(tx.signatures.map(s => [s.publicKey.toBase58(), s.signature]))});
    const failed = result instanceof FailedTransactionMetadata;
    const meta = failed ? result.meta() : result;
    const logs = meta.logs();
    if (expectedError) {
      assert.ok(failed, label + ' deveria falhar');
      assert.match(logs.join('\n'), expectedError, label);
    } else {
      assert.ok(!failed, label + ': ' + logs.join('\n'));
    }
    records.push({test: label, passed: true, expected_rejection: Boolean(expectedError),
      signature_local_only: base58(meta.signature()), compute_units: meta.computeUnitsConsumed().toString(), logs});
  }
  function read(address, layout) {
    const account = svm.getAccount(address.toBase58());
    assert.ok(account.exists, 'Conta deveria existir');
    assert.equal(account.programAddress, TOKEN_PROGRAM_ID.toBase58());
    return layout.decode(Buffer.from(account.data));
  }
  const rent = Number(svm.minimumBalanceForRentExemption(BigInt(MINT_SIZE)));
  const {tx, founder, treasury, metadata} = creationTransaction(keys, rent, amounts);
  send('Emissão e distribuição atômicas', tx, [keys.payer, keys.mint]);
  const metadataAccount = svm.getAccount(metadata.toBase58());
  assert.ok(metadataAccount.exists);
  assert.equal(metadataAccount.programAddress, METADATA_PROGRAM.toBase58());
  const decoded = decodeMetadata(metadataAccount.data);
  assert.equal(decoded.name, 'FELIZCOIN');
  assert.equal(decoded.symbol, 'FELIZ');
  assert.equal(decoded.mint, keys.mint.publicKey.toBase58());
  assert.equal(decoded.updateAuthority, keys.payer.publicKey.toBase58());
  assert.equal(decoded.sellerFeeBasisPoints, 0);
  assert.equal(decoded.isMutable, true);
  assert.equal(decoded.tokenStandard.__option, 'Some');
  assert.equal(decoded.tokenStandard.value, 2); // Metaplex TokenStandard.Fungible
  const mint = read(keys.mint.publicKey, MintLayout);
  assert.equal(mint.supply, amounts.total);
  assert.equal(mint.decimals, 9);
  assert.equal(mint.mintAuthorityOption, 0);
  assert.equal(mint.freezeAuthorityOption, 0);
  assert.equal(read(founder, AccountLayout).amount, amounts.founder);
  assert.equal(read(treasury, AccountLayout).amount, amounts.treasury);
  assert.ok(read(founder, AccountLayout).owner.equals(keys.founder.publicKey));
  assert.ok(read(treasury, AccountLayout).owner.equals(keys.treasury.publicKey));

  const recipient = getAssociatedTokenAddressSync(keys.mint.publicKey, keys.recipient.publicKey);
  const quantity = 100n * 10n ** 9n;
  send('Transferência de 100 FELIZCOIN', new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(keys.payer.publicKey, recipient, keys.recipient.publicKey, keys.mint.publicKey),
    createTransferCheckedInstruction(founder, keys.mint.publicKey, recipient, keys.founder.publicKey, quantity, 9),
  ), [keys.payer, keys.founder]);
  assert.equal(read(recipient, AccountLayout).amount, quantity);
  assert.equal(read(founder, AccountLayout).amount, amounts.founder - quantity);
  send('Devolução de 100 FELIZCOIN', new Transaction().add(
    createTransferCheckedInstruction(recipient, keys.mint.publicKey, founder, keys.recipient.publicKey, quantity, 9)
  ), [keys.payer, keys.recipient]);
  assert.equal(read(recipient, AccountLayout).amount, 0n);
  assert.equal(read(founder, AccountLayout).amount, amounts.founder);

  send('Emissão adicional rejeitada', new Transaction().add(
    createMintToCheckedInstruction(keys.mint.publicKey, founder, keys.payer.publicKey, 1n, 9)
  ), [keys.payer], /fixed supply|0x5/i);
  send('Saldo insuficiente rejeitado', new Transaction().add(
    createTransferCheckedInstruction(founder, keys.mint.publicKey, recipient, keys.founder.publicKey, amounts.founder + 1n, 9)
  ), [keys.payer, keys.founder], /insufficient funds|0x1\b/i);
  send('Transferência sem autoridade rejeitada', new Transaction().add(
    createTransferCheckedInstruction(founder, keys.mint.publicKey, recipient, keys.payer.publicKey, 1n, 9)
  ), [keys.payer], /owner does not match|owner mismatch|0x4/i);
  send('Recuperação da autoridade de emissão rejeitada', new Transaction().add(
    createSetAuthorityInstruction(keys.mint.publicKey, keys.payer.publicKey, AuthorityType.MintTokens, keys.payer.publicKey)
  ), [keys.payer], /fixed supply|0x5/i);
  send('Segunda criação do mesmo mint rejeitada', creationTransaction(keys, rent, amounts).tx,
    [keys.payer, keys.mint], /already in use|0x0/i);

  const invalidKeys = {...keys, mint: Keypair.generate()};
  const invalid = creationTransaction(invalidKeys, rent,
    {...amounts, metadata: {...amounts.metadata, name: 'X'.repeat(40)}});
  send('Metadados inválidos anulam toda a criação', invalid.tx,
    [keys.payer, invalidKeys.mint], /Name too long|0xb\b/i);
  for (const address of [invalidKeys.mint.publicKey, invalid.founder, invalid.treasury, invalid.metadata]) {
    assert.equal(svm.getAccount(address.toBase58()).exists, false, 'Conta parcial não deve persistir');
  }

  assert.equal(read(keys.mint.publicKey, MintLayout).supply, amounts.total);
  assert.equal(read(founder, AccountLayout).amount, amounts.founder);
  assert.equal(read(treasury, AccountLayout).amount, amounts.treasury);
  assert.equal(read(recipient, AccountLayout).amount, 0n);

  const directory = path.join(root, '.localnet');
  fs.mkdirSync(directory, {recursive: true, mode: 0o700});
  fs.chmodSync(directory, 0o700);
  for (const [name, key] of Object.entries(keys)) {
    const location = path.join(directory, name + '-keypair.json');
    fs.writeFileSync(location, JSON.stringify(Array.from(key.secretKey)), {mode: 0o600});
    fs.chmodSync(location, 0o600);
  }
  const snapshot = path.join(directory, 'verified.snapshot');
  svm.saveToFile(snapshot);
  fs.chmodSync(snapshot, 0o600);
  const restored = LiteSVM.loadFromFile(snapshot);
  assert.equal(MintLayout.decode(Buffer.from(restored.getAccount(keys.mint.publicKey.toBase58()).data)).supply, amounts.total);
  const report = {status: 'local_svm_verified', network: 'local_litesvm_only',
    created_at: new Date().toISOString(), spent_gbp: 0,
    mint_local_only: keys.mint.publicKey.toBase58(), total_tokens: '21000000',
    founder_tokens: '5250000', unallocated_tokens: '15750000',
    mint_authority: null, freeze_authority: null, metadata_published: false,
    metadata_verified_locally: {name: decoded.name, symbol: decoded.symbol,
      uri: decoded.uri, mutable: decoded.isMutable, address: metadata.toBase58(),
      update_authority: decoded.updateAuthority, royalties_basis_points: decoded.sellerFeeBasisPoints},
    metadata_program_provenance: manifest,
    snapshot_restored_and_verified: true, transactions: records,
    limitations: ['Programa SPL Token executado em LiteSVM local; não publicado na devnet ou mainnet.',
      'Endereço e assinaturas deste relatório existem somente no ambiente local.',
      'Não há mercado, preço, compradores ou liquidez.', 'Reserva de 25% sem bloqueio de prazo.',
      'Teste técnico, não auditoria independente.']};
  fs.writeFileSync(path.join(root, 'local-svm-result.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = runLocal();
  console.log(`${report.transactions.length} verificações no programa real passaram; estado salvo e restaurado. Gasto: £0. Rede: SOMENTE LOCAL.`);
}
