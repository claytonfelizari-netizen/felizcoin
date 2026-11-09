import { readFile, writeFile } from 'node:fs/promises';

const decode = (value) => String(value)
  .replace(/&#39;|&#x27;/g, "'").replace(/&quot;|&#x22;/g, '"').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const primary = JSON.parse(await readFile('/private/tmp/open-trivia-dataset/data/all_questions.json', 'utf8'));
const secondary = JSON.parse(await readFile('/private/tmp/opentriviaqa/util/CategorisedQuestionList.json', 'utf8'));
const unique = new Map();
const add = (question, options, correct, category, difficulty='medium') => {
  const q = decode(question).trim();
  const answers = options.map(decode);
  const key = q.toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
  if (answers.length === 4 && !unique.has(key)) unique.set(key, { question: q, options: answers, correct, category: decode(category || 'general'), difficulty });
};
for (const item of primary) add(item.question, [item.correct_answer, ...item.incorrect_answers], 0, item.category, item.difficulty);
for (const list of Object.values(secondary)) for (const item of list) {
  const correct = item.choices.indexOf(item.answer);
  if (correct >= 0) add(item.question, item.choices, correct, 'general', 'medium');
}
const questions = [...unique.values()].slice(0, 4995).map((item, index) => ({ ...item, id: index + 1, phase: Math.floor(index / 5) + 2 }));
if (questions.length !== 4995) throw new Error(`Only ${questions.length} unique questions available`);
await writeFile('netlify-deploy/questions.json', JSON.stringify(questions));
console.log(`Saved ${questions.length} unique general questions for phases 2-1000`);
