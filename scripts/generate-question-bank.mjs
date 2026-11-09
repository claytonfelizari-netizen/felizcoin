import { writeFile } from 'node:fs/promises';

const facts = [
  ['Qual é a capital da França?', ['Madrid','Paris','Roma','Berlim'], 1],
  ['Qual planeta é conhecido como planeta vermelho?', ['Vênus','Marte','Júpiter','Mercúrio'], 1],
  ['Quem pintou a Mona Lisa?', ['Van Gogh','Michelangelo','Leonardo da Vinci','Picasso'], 2],
  ['Qual é o maior oceano da Terra?', ['Atlântico','Índico','Ártico','Pacífico'], 3],
  ['Qual é o resultado de 9 × 7?', ['54','63','72','81'], 1],
  ['Qual gás as plantas absorvem na fotossíntese?', ['Oxigênio','Nitrogênio','Dióxido de carbono','Hélio'], 2],
  ['Em que país ficam as pirâmides de Gizé?', ['Egito','Grécia','México','Peru'], 0],
  ['Qual instrumento mede a temperatura?', ['Barômetro','Termômetro','Higrômetro','Bússola'], 1],
  ['Qual é o maior planeta do Sistema Solar?', ['Terra','Saturno','Júpiter','Urano'], 2],
  ['Qual é o símbolo químico do ouro?', ['Ag','Au','Fe','O'], 1],
  ['Em que continente fica o Brasil?', ['África','Europa','América do Sul','Ásia'], 2],
  ['Quantos lados tem um hexágono?', ['5','6','7','8'], 1],
  ['Qual é a moeda oficial do Japão?', ['Yuan','Won','Iene','Rupia'], 2],
  ['Qual órgão bombeia o sangue pelo corpo?', ['Pulmão','Coração','Fígado','Rim'], 1],
  ['Qual é o processo da água líquida para vapor?', ['Condensação','Evaporação','Solidificação','Fusão'], 1],
  ['Qual país é conhecido pelo formato de uma bota?', ['Itália','Portugal','Chile','Noruega'], 0]
];
const variants = ['Escolha a resposta correta:', 'Teste seus conhecimentos:', 'Desafio rápido:', 'Pergunta de conhecimentos gerais:', 'Você sabe responder?'];
const questions = [];
for (let phase = 2; phase <= 10000; phase++) {
  for (let slot = 0; slot < 5; slot++) {
    const n = (phase - 2) * 5 + slot;
    const fact = facts[n % facts.length];
    questions.push({ id: n + 1, phase, question: `${variants[n % variants.length]} ${fact[0]}`, options: fact[1], correct: fact[2], category: 'conhecimentos-gerais' });
  }
}
await writeFile('netlify-deploy/questions.json', JSON.stringify(questions));
console.log(`Generated ${questions.length} questions`);
