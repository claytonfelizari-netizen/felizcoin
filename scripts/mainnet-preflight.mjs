import fs from 'node:fs';
import {Connection, PublicKey} from '@solana/web3.js';

const config = JSON.parse(fs.readFileSync(new URL('../felizcoin.config.json', import.meta.url)));
const plan = JSON.parse(fs.readFileSync(new URL('../vesting-plan.json', import.meta.url)));
const wallet = new PublicKey(config.production_wallet_public_address);
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
const lamports = await connection.getBalance(wallet);
const checks = {
  name_symbol: config.name === 'FELIZCOIN' && config.symbol_proposal === 'FELIZ',
  production_supply: config.production_supply === '25000000',
  founder_percent: config.founder_allocation.percent === 15,
  vesting_plan: plan.locked_amount === 3375000 && plan.cliff_months === 12 && plan.linear_release_months === 24,
  metadata_uri: config.metadata_uri === 'https://delicate-kringle-99b7e9.netlify.app/felizcoin.json',
  wallet_valid: wallet.toBase58() === config.production_wallet_public_address,
  balance_sol: lamports / 1e9,
  enough_for_mint_and_vesting: lamports / 1e9 >= 0.25,
};
console.log(JSON.stringify({network: 'mainnet-beta', wallet: wallet.toBase58(), checks, ready_for_wallet_review: Object.values(checks).every(v => v === true || typeof v === 'number')}, null, 2));
