import { writeFile } from 'node:fs/promises';

const decode = (value) => value
  .replace(/&#39;|&#x27;/g, "'")
  .replace(/&quot;|&#x22;/g, '"')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

const unique = new Map();
for (let batch = 0; batch < 110 && unique.size < 4995; batch++) {
  const response = await fetch('https://opentdb.com/api.php?amount=50&type=multiple');
  if (!response.ok) throw new Error(`Open Trivia API HTTP ${response.status}`);
  const payload = await response.json();
  for (const item of payload.results ?? []) {
    const question = decode(item.question).trim();
    const options = [item.correct_answer, ...item.incorrect_answers].map(decode);
    const key = question.toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
    if (!unique.has(key)) unique.set(key, { question, options, correct: 0, category: decode(item.category), difficulty: item.difficulty });
  }
  console.log(`batch ${batch + 1}: ${unique.size} unique questions`);
}
if (unique.size < 4995) throw new Error(`Only collected ${unique.size} unique questions`);
const questions = [...unique.values()].slice(0, 4995).map((item, index) => ({ ...item, id: index + 1, phase: Math.floor(index / 5) + 2 }));
await writeFile('netlify-deploy/questions.json', JSON.stringify(questions));
console.log(`Saved ${questions.length} unique questions`);
