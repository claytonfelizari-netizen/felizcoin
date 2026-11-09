import { readFile, writeFile } from 'node:fs/promises';

const key = process.env.DEEPL_API_KEY;
if (!key) throw new Error('DEEPL_API_KEY não está configurada nesta sessão do Terminal.');
const questions = JSON.parse(await readFile('netlify-deploy/questions.json', 'utf8'));
const start = Number(process.env.TRANSLATE_START || 0);
const endpoint = key.endsWith(':fx') ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';

for (let offset = start; offset < questions.length; offset += 20) {
  const batch = questions.slice(offset, offset + 20);
  const texts = batch.flatMap(item => [item.question, ...item.options]);
  const body = new URLSearchParams({ source_lang: 'EN', target_lang: 'PT-BR' });
  texts.forEach(text => body.append('text', text));
  const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!response.ok) throw new Error(`DeepL HTTP ${response.status}: ${await response.text()}`);
  const translated = (await response.json()).translations.map(item => item.text);
  batch.forEach((item, index) => {
    const values = translated.slice(index * 5, index * 5 + 5);
    item.question = values[0];
    item.options = values.slice(1);
  });
  await writeFile('netlify-deploy/questions.json', JSON.stringify(questions));
  console.log(`translated ${Math.min(offset + batch.length, questions.length)}/${questions.length}`);
}
console.log('DeepL translation complete.');
