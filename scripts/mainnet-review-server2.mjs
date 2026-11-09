import http from 'node:http';
import fs from 'node:fs';
import {Connection, Keypair, PublicKey} from '@solana/web3.js';
import {creationTransaction} from './token.mjs';
const c = new Connection('https://api.mainnet-beta.solana.com','confirmed');
const page = fs.readFileSync(new URL('../mainnet-review.html', import.meta.url));
const server = http.createServer(async (req,res)=>{
  if(req.url==='/mainnet-review.html'){res.setHeader('content-type','text/html');return res.end(page)}
  if(req.url==='/send'&&req.method==='POST'){let b='';req.on('data',x=>b+=x);req.on('end',async()=>{try{const sig=await c.sendRawTransaction(Buffer.from(JSON.parse(b).raw,'base64'),{skipPreflight:false,maxRetries:3});res.end(JSON.stringify({signature:sig}))}catch(e){res.statusCode=400;res.end(JSON.stringify({error:e.message}))}});return}
  if(req.url==='/build')try{const payer=new PublicKey(req.headers['x-payer']);const mint=Keypair.generate(),treasury=Keypair.generate();const a={total:25000000n*10n**9n,founder:3750000n*10n**9n,treasury:21250000n*10n**9n,decimals:9,metadata:{name:'FELIZCOIN',symbol:'FELIZ',uri:'https://delicate-kringle-99b7e9.netlify.app/felizcoin.json'}};const rent=await c.getMinimumBalanceForRentExemption(82);const {tx}=creationTransaction({payer:{publicKey:payer},mint,founder:{publicKey:payer},treasury},rent,a);const bh=await c.getLatestBlockhash();tx.feePayer=payer;tx.recentBlockhash=bh.blockhash;tx.partialSign(mint);res.end(JSON.stringify({transaction:tx.serialize({requireAllSignatures:false}).toString('base64')}));return}catch(e){res.statusCode=400;return res.end(JSON.stringify({error:e.message}))}
  res.statusCode=404;res.end();
}); server.listen(8766,'127.0.0.1');
