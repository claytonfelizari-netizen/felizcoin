import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { Connection, Keypair, Transaction } from '@solana/web3.js';
import {
  MINT_SIZE, getMint, getAccount, getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction,
  createMintToCheckedInstruction,
} from '@solana/spl-token';
import { RPC, GENESIS, validateConfig, creationTransaction, base58 } from './token.mjs';
import {METADATA_PROGRAM, decodeMetadata} from './metadata.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const privateDir = path.join(root, '.devnet');
const reportPath = path.join(root, 'devnet-result.json');
const config = JSON.parse(fs.readFileSync(path.join(root, 'felizcoin.config.json')));
const amounts = validateConfig(config);
fs.mkdirSync(privateDir, { recursive: true, mode: 0o700 });
fs.chmodSync(privateDir, 0o700);
function key(name) {
  const location = path.join(privateDir, name + '-keypair.json');
  if (!fs.existsSync(location)) {
    fs.writeFileSync(location, JSON.stringify(Array.from(Keypair.generate().secretKey)),
      { mode: 0o600, flag: 'wx' });
  }
  fs.chmodSync(location, 0o600);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(location))));
}
const keys = Object.fromEntries(['payer', 'mint', 'founder', 'treasury', 'recipient'].map(n => [n, key(n)]));
let report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath)) : {};
if (report.mint && report.mint !== keys.mint.publicKey.toBase58()) throw Error('Carteira e relatório divergentes.');
report = {...report, status: 'preparing_devnet', network: 'devnet', spent_gbp: 0,
  name_local: 'FELIZCOIN', metadata_published: false,
  mint: keys.mint.publicKey.toBase58(), payer: keys.payer.publicKey.toBase58(),
  founder_wallet: keys.founder.publicKey.toBase58(),
  unallocated_wallet: keys.treasury.publicKey.toBase58(),
  supply_tokens: '21000000', founder_tokens: '5250000', unallocated_tokens: '15750000',
  founder_lockup: null, signatures: report.signatures || {},
  notes: ['Somente teste; sem valor real.', 'Os 75% restantes estão separados, sem destinação decidida.',
    'Carteiras locais exclusivas de teste; não usar com fundos reais.',
    'O nome ainda não está registrado nos metadados da blockchain.']};
function save() {
  report.updated_at = new Date().toISOString();
  fs.writeFileSync(reportPath + '.tmp', JSON.stringify(report, null, 2) + '\n');
  fs.renameSync(reportPath + '.tmp', reportPath);
}
save();
const connection = new Connection(RPC, {commitment: 'confirmed', disableRetryOnRateLimit: true,
  fetch: (url, options) => fetch(url, {...options, signal: AbortSignal.timeout(20000)})});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function confirm(signature) {
  for (let i = 0; i < 30; i++) {
    const {value: [status]} = await connection.getSignatureStatuses([signature], {searchTransactionHistory: true});
    if (status?.err) throw Error('Transação rejeitada: ' + JSON.stringify(status.err));
    if (['confirmed', 'finalized'].includes(status?.confirmationStatus)) return;
    await delay(1500);
  }
  throw Error('Confirmação pendente. Inspecione a assinatura antes de continuar.');
}
async function send(label, tx, signers) {
  tx.feePayer = keys.payer.publicKey;
  const recent = await connection.getLatestBlockhash();
  tx.recentBlockhash = recent.blockhash;
  tx.sign(...signers);
  const raw = tx.serialize();
  const signature = base58(tx.signature);
  report.signatures[label] = {signature, status: 'prepared', ...recent};
  save();
  await connection.sendRawTransaction(raw, {skipPreflight: false, maxRetries: 2});
  await confirm(signature);
  report.signatures[label].status = 'confirmed';
  save();
  console.log(label + ': ' + signature);
}
async function rejected(label, instruction, signer, code) {
  const tx = new Transaction().add(instruction);
  tx.feePayer = keys.payer.publicKey;
  const signers = signer === keys.payer ? [keys.payer] : [keys.payer, signer];
  const result = await connection.simulateTransaction(tx, signers);
  assert.deepEqual(result.value.err, {InstructionError: [0, {Custom: code}]}, label);
  report.checks[label] = {passed: true, method: 'on_chain_simulation', error: result.value.err};
  save();
}
async function main() {
  assert.equal(await connection.getGenesisHash(), GENESIS, 'A rede não é Solana devnet.');
  console.log('Rede devnet confirmada. Carteira de teste: ' + report.payer);
  if (await connection.getBalance(keys.payer.publicKey) < 50_000_000) {
    report.status = 'awaiting_test_sol'; save();
    const signature = await connection.requestAirdrop(keys.payer.publicKey, 1_000_000_000);
    report.signatures.airdrop = {signature, status: 'requested'}; save();
    await confirm(signature);
    report.signatures.airdrop.status = 'confirmed'; save();
  }
  const rent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
  const {tx, founder, treasury, metadata} = creationTransaction(keys, rent, amounts);
  if (!await connection.getAccountInfo(keys.mint.publicKey)) {
    // Atomic creation: repeating this transaction cannot mint twice because mint already exists.
    await send('creation', tx, [keys.payer, keys.mint]);
  }
  const mint = await getMint(connection, keys.mint.publicKey);
  assert.equal(mint.supply, amounts.total);
  assert.equal(mint.decimals, amounts.decimals);
  assert.equal(mint.mintAuthority, null);
  assert.equal(mint.freezeAuthority, null);
  assert.equal((await getAccount(connection, founder)).amount, amounts.founder);
  assert.equal((await getAccount(connection, treasury)).amount, amounts.treasury);
  const metadataAccount = await connection.getAccountInfo(metadata);
  assert.ok(metadataAccount, 'Metadados ausentes; não considerar a implantação concluída.');
  assert.ok(metadataAccount.owner.equals(METADATA_PROGRAM));
  const decoded = decodeMetadata(metadataAccount.data);
  assert.equal(decoded.name, amounts.metadata.name);
  assert.equal(decoded.symbol, amounts.metadata.symbol);
  assert.equal(decoded.uri, amounts.metadata.uri);
  assert.equal(decoded.mint, keys.mint.publicKey.toBase58());
  assert.equal(decoded.updateAuthority, keys.payer.publicKey.toBase58());
  assert.equal(decoded.isMutable, true);
  assert.equal(decoded.sellerFeeBasisPoints, 0);
  assert.equal(decoded.tokenStandard.__option, 'Some');
  assert.equal(decoded.tokenStandard.value, 2);
  report.metadata_published = true;
  report.metadata = {name: decoded.name, symbol: decoded.symbol, uri: decoded.uri,
    address: metadata.toBase58(), mutable: decoded.isMutable, update_authority: decoded.updateAuthority};
  report.notes = ['Somente teste; sem valor real.', 'Os 75% restantes estão separados, sem destinação decidida.',
    'Carteiras exclusivas de teste; não usar com fundos reais.',
    'Nome e símbolo registrados; URI de imagem e descrição ainda em branco. Metadados editáveis.'];
  report.status = 'created_checks_in_progress';
  report.checks = {supply: {passed: true}, distribution: {passed: true},
    no_mint_authority: {passed: true}, no_freeze_authority: {passed: true}, metadata: {passed: true}};
  save();
  const recipient = getAssociatedTokenAddressSync(keys.mint.publicKey, keys.recipient.publicKey);
  if (report.signatures.transfer_round_trip?.status !== 'confirmed') {
    const quantity = 100n * 10n ** 9n;
    await send('transfer_round_trip', new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(keys.payer.publicKey, recipient, keys.recipient.publicKey, keys.mint.publicKey),
      createTransferCheckedInstruction(founder, keys.mint.publicKey, recipient, keys.founder.publicKey, quantity, 9),
      createTransferCheckedInstruction(recipient, keys.mint.publicKey, founder, keys.recipient.publicKey, quantity, 9),
    ), [keys.payer, keys.founder, keys.recipient]);
  }
  assert.equal((await getAccount(connection, recipient)).amount, 0n);
  assert.equal((await getAccount(connection, founder)).amount, amounts.founder);
  report.checks.transfer_round_trip = {passed: true, method: 'confirmed_transaction', tokens: '100'};
  await rejected('extra_mint_rejected', createMintToCheckedInstruction(keys.mint.publicKey,
    founder, keys.payer.publicKey, 1n, 9), keys.payer, 5);
  await rejected('insufficient_funds_rejected', createTransferCheckedInstruction(founder,
    keys.mint.publicKey, recipient, keys.founder.publicKey, amounts.founder + 1n, 9), keys.founder, 1);
  await rejected('wrong_owner_rejected', createTransferCheckedInstruction(founder,
    keys.mint.publicKey, recipient, keys.payer.publicKey, 1n, 9), keys.payer, 4);
  report.status = 'devnet_verified';
  report.explorer = `https://explorer.solana.com/address/${report.mint}?cluster=devnet`;
  delete report.last_error;
  save();
  console.log('Token de teste verificado: ' + report.explorer);
}
main().catch(error => {
  report.last_error = error.message;
  save();
  console.error(error.message);
  process.exitCode = 1;
});
