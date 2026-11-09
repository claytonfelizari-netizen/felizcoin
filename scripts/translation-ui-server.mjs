import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';

let status = { running: false, done: 0, total: 0, message: 'Ready' };
const page = `<!doctype html><meta charset="utf-8"><title>FELIZCOIN translation</title><style>body{font:16px system-ui;max-width:620px;margin:60px auto;padding:20px;background:#111;color:#eee}input,button{font:inherit;padding:12px;border-radius:8px;border:1px solid #555;margin:8px 0;width:100%}button{background:#e0b95b;cursor:pointer}#status{white-space:pre-wrap;color:#b9d7c0}</style><h1>Translate FELIZCOIN questions</h1><p>Paste your DeepL API key. It stays in local memory and is never saved to the repository.</p><input id="key" type="password" placeholder="DeepL API key"><button onclick="start()">Start translation</button><p id="status">Ready</p><script>async function start(){const key=document.querySelector('#key').value;if(!key)return alert('Paste your API key first.');document.querySelector('#key').value='';await fetch('/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key})});poll()}async function poll(){const s=await (await fetch('/status')).json();document.querySelector('#status').textContent=s.message+'\\n'+s.done+'/'+s.total;if(s.running)setTimeout(poll,1000)}</script>`;
const send = (res, code, body, type='text/plain') => { res.writeHead(code, {'Content-Type': type}); res.end(body); };
const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') return send(res, 200, page, 'text/html');
  if (req.method === 'GET' && req.url === '/status') return send(res, 200, JSON.stringify(status), 'application/json');
  if (req.method === 'POST' && req.url === '/translate') {
    let raw=''; for await (const chunk of req) raw+=chunk;
    const { key } = JSON.parse(raw); if (!key) return send(res, 400, 'Missing key');
    if (status.running) return send(res, 409, 'Already running');
    status={running:true,done:0,total:0,message:'Starting'}; send(res, 202, 'Started');
    (async()=>{try{const questions=JSON.parse(await readFile('netlify-deploy/questions.json','utf8'));status.total=questions.length;const endpoint=key.endsWith(':fx')?'https://api-free.deepl.com/v2/translate':'https://api.deepl.com/v2/translate';for(let i=0;i<questions.length;i+=20){const batch=questions.slice(i,i+20),body=new URLSearchParams({source_lang:'EN',target_lang:'PT-BR'});batch.flatMap(x=>[x.question,...x.options]).forEach(x=>body.append('text',x));const r=await fetch(endpoint,{method:'POST',headers:{Authorization:'DeepL-Auth-Key '+key,'Content-Type':'application/x-www-form-urlencoded'},body});if(!r.ok)throw new Error('DeepL HTTP '+r.status);const out=(await r.json()).translations.map(x=>x.text);batch.forEach((x,j)=>{x.question=out[j*5];x.options=out.slice(j*5+1,j*5+5)});status.done=Math.min(i+batch.length,questions.length);status.message='Translating';await writeFile('netlify-deploy/questions.json',JSON.stringify(questions));}status={running:false,done:status.total,total:status.total,message:'Translation complete. You can close this page.'};}catch(e){status={running:false,done:status.done,total:status.total,message:'Error: '+e.message}}})();return;
  }
  send(res,404,'Not found');
});
server.listen(4178,'127.0.0.1',()=>console.log('Translation UI: http://localhost:4178/'));
