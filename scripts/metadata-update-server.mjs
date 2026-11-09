import http from 'node:http';
import fs from 'node:fs';
import {Connection, PublicKey, Transaction} from '@solana/web3.js';
import {createUmi} from '@metaplex-foundation/umi-bundle-defaults';
import {createNoopSigner, publicKey} from '@metaplex-foundation/umi';
import {mplTokenMetadata, updateV1} from '@metaplex-foundation/mpl-token-metadata';
import {toWeb3JsInstruction} from '@metaplex-foundation/umi-web3js-adapters';

const RPC = 'https://api.mainnet-beta.solana.com';
const MINT = '6LTbeJQUvvHM4bXmVJFuvNxzUmL4pNQCnyoBqFDyQP89';
const OLD_URI = 'https://delicate-kringle-99b7e9.netlify.app/felizcoin.json';
const NEW_URI = 'https://felizcoin.netlify.app/felizcoin.json';
const c = new Connection(RPC, 'confirmed');
const page = fs.readFileSync(new URL('../metadata-update.html', import.meta.url));

const server = http.createServer(async (req, res) => {
  if (req.url === '/metadata-update.html') {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    return res.end(page);
  }
  if (req.url === '/build') {
    try {
      const payer = new PublicKey(req.headers['x-payer']);
      const umi = createUmi(RPC).use(mplTokenMetadata());
      const signer = createNoopSigner(publicKey(payer.toBase58()));
      const ix = updateV1(umi, {
        mint: publicKey(MINT), authority: signer, payer: signer,
        data: {
          name: 'FELIZCOIN', symbol: 'FELIZ', uri: NEW_URI,
          sellerFeeBasisPoints: 0,
          creators: [{address: publicKey(payer.toBase58()), verified: true, share: 100}],
        }, isMutable: true,
      });
      const tx = new Transaction().add(...ix.getInstructions().map(toWeb3JsInstruction));
      const bh = await c.getLatestBlockhash();
      tx.feePayer = payer; tx.recentBlockhash = bh.blockhash;
      return res.end(JSON.stringify({
        transaction: tx.serialize({requireAllSignatures: false}).toString('base64'),
        mint: MINT, oldUri: OLD_URI, newUri: NEW_URI,
      }));
    } catch (e) {
      res.statusCode = 400; return res.end(JSON.stringify({error: e.message}));
    }
  }
  if (req.url === '/send' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const {raw} = JSON.parse(body);
        const signature = await c.sendRawTransaction(Buffer.from(raw, 'base64'), {skipPreflight: false, maxRetries: 3});
        res.end(JSON.stringify({signature}));
      } catch (e) {
        res.statusCode = 400; res.end(JSON.stringify({error: e.message}));
      }
    });
    return;
  }
  res.statusCode = 404; res.end();
});
server.listen(8767, '127.0.0.1', () => console.log('http://127.0.0.1:8767/metadata-update.html'));
