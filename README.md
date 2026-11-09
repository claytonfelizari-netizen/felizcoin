# FELIZCOIN — desenvolvimento

Projeto de token SPL com execução local concluída e publicação na Solana **devnet**
verificada em 07/11/2026. Não é uma blockchain
própria, não tem mineração e não está listado em corretora. Este repositório não
contém um procedimento de lançamento em mainnet.

## Especificação aceita

- Oferta de produção: 25.000.000, com 9 casas decimais.
- Reserva do fundador: 3.750.000 (15%); venda máxima de 375.000 no primeiro ano, com 3.375.000 bloqueados e liberação linear em 24 meses.
- Restante de produção: 21.250.000 (85%), destinação pendente.
- O token já criado na devnet mantém a oferta histórica de 21.000.000.
- Emissão inicial única, seguida da remoção da autoridade de emissão.
- Sem autoridade de congelamento.
- Orçamento máximo de todo o projeto: £500. Gasto monetário até aqui: £0.

O símbolo de teste é FELIZ; símbolo e rede definitivos de produção continuam
pendentes. O procedimento inclui nome e símbolo em metadados Metaplex antes de
remover a autoridade de emissão, na mesma transação. A URI está vazia: imagem e
descrição públicas ainda não foram hospedadas. Os metadados permanecem editáveis
pela carteira de teste pagadora; esse poder não permite emitir novos tokens.

## Executar

Requer Node.js 20+ e pnpm. As dependências estão fixadas em `pnpm-lock.yaml`.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm test
pnpm fetch-program
pnpm local
pnpm devnet
pnpm status
```

Neste computador o Node está disponível em:

```text
/Users/claytonfelizari/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
```

Ele pode executar diretamente `scripts/local.mjs`, `scripts/devnet.mjs`, `scripts/status.mjs` e
`--test tests/token.test.mjs` a partir desta pasta, sem instalação global.
`fetch-program` baixa uma cópia pública do programa Metaplex da devnet (somente
leitura); basta executá-lo uma vez antes do teste local. Não depende de saldo.
O hash e o slot de origem ficam em `.programs/manifest.json` e no relatório local.

## Carteiras e retomada

`scripts/devnet.mjs` cria cinco chaves exclusivas de teste em `.devnet/`, com
permissões locais restritas. O diretório está excluído do Git. Não compartilhar
essas chaves, não colocar dinheiro real nelas e não usá-las para produção.

O endereço público para receber saldo fictício está em `devnet-result.json`, no
campo `payer`. O faucet oficial é https://faucet.solana.com/ e deve estar em devnet.
Ele pode pedir verificação humana. Nunca comprar SOL real para resolver falta
de saldo de teste.

Após receber saldo fictício, executar novamente `pnpm devnet`. As mesmas chaves
são reutilizadas. Não apagar `.devnet/` ao retomar: isso perderia os acessos de
teste. A criação, distribuição, metadados e remoção de autoridade são atômicas. Repetir a
criação com o mesmo mint não permite emitir duas vezes. Se a confirmação falhar,
verificar as assinaturas em `devnet-result.json` antes de investigar ou retomar.

`pnpm status` apenas consulta a rede; não solicita saldo nem envia transações.
O script de criação confere o identificador da devnet antes de enviar transações
e não aceita um endereço RPC fornecido pelo usuário ou pelo ambiente.

## Evidência e limites

- `resultado-teste.json`: simulação didática Python anterior, sem blockchain.
- `local-svm-result.json`: nove verificações executadas nos programas SPL Token e
  Metaplex reais em LiteSVM 1.6.0, com assinaturas e estado de contas. Emissão, distribuição,
  transferência e devolução passaram; emissão extra, transferência sem saldo,
  transferência por não titular, recuperação de autoridade e recriação do mint
  foram rejeitadas como esperado. Nome e símbolo foram decodificados e conferidos.
  Metadados inválidos foram rejeitados, sem deixar mint ou contas parciais.
  O estado foi salvo e restaurado com sucesso.
- `.localnet/verified.snapshot`: estado do ambiente local; as chaves de teste
  correspondentes ficam no mesmo diretório, excluído do Git e com acesso restrito.
  Cada execução de `pnpm local` gera um cenário novo e substitui este estado local.
  Não altera as carteiras `.devnet/` nem envia transações pela internet.
- `tests/token.test.mjs`: valida instruções reais, divisão, assinatura e tamanho
  da transação; rejeita configurações incompatíveis.
- `devnet-result.json`: estado da tentativa na rede, assinaturas e verificações.
  Somente o estado `devnet_verified` indica conclusão dos testes na devnet.

O procedimento na rede verifica saldos e autoridades, transfere e devolve 100
tokens em uma transação, e simula as rejeições de emissão adicional, saldo
insuficiente e transferência por pessoa sem autorização. As simulações de erro
não são enviadas como transações.

A Solana devnet pode ser reiniciada pela operadora. Não fornece garantia de
continuidade nem evidência de preço, procura ou viabilidade comercial.

Os endereços e assinaturas do relatório local não existem nos exploradores
públicos. A execução local usa as mesmas instruções de criação preparadas para
devnet, mas não substitui confirmação nessa rede nem auditoria independente.

O faucet público exigiu mais repositórios públicos no GitHub; a API pública
retornou limite de solicitações ou falta de saldo. A alternativa por prova de
trabalho indicada pela Solana também precisa de saldo inicial para a taxa da
transação. Não foram criados repositórios artificiais, usados fundos reais ou
contornados critérios de acesso.

## Antes de qualquer lançamento comercial

O plano interno em `launch-plan.json` separa regras aceitas de propostas ainda
não aprovadas. Ele registra £500 como teto e £0 de gasto. A divisão ilustrativa
de £50 para técnica, £300 para liquidez e £150 de reserva não é cotação: custos
jurídicos e de revisão continuam desconhecidos e podem inviabilizar o lançamento.
Nenhuma carteira bancária ou corretora foi acessada.

Raydium CPMM foi identificado apenas como candidato técnico. A taxa publicada de
criação é 0,15 SOL, além de depósitos de contas, taxas e liquidez; não representa
o preço completo de lançamento nem valida disponibilidade para o usuário UK.
Fonte: https://docs.raydium.io/raydium/protocol/protocol-fees

O procedimento de teste já inclui os metadados antes de revogar a autoridade de
emissão. Não é um script de produção pronto para uso: URI pública, carteira de
produção e política definitiva de atualização dos metadados ainda faltam.

Ainda faltam carteira de produção controlada pelo usuário, rede final, metadados,
distribuição dos 75%, política da reserva do fundador, capital e condições de
liquidez, revisão de segurança e avaliação das exigências do Reino Unido.
Nenhum gasto real, anúncio ou venda pública foi executado. O teto de £500 não
significa que todas essas etapas sejam viáveis com esse valor.

A FCA descreve quatro vias para promoção de criptoativos a consumidores no Reino
Unido. Nenhuma foi selecionada ou validada para este projeto. Apenas adicionar
um aviso de risco não substitui essa avaliação.

Referências consultadas em 11/10/2026:

- https://solana.com/docs/tokens/basics/create-mint
- https://solana.com/docs/tokens/basics/set-authority
- https://solana.com/docs/references/clusters
- https://solana.com/developers/cookbook/development/airdrops-and-faucets
- https://www.fca.org.uk/firms/cryptoassets/marketing-uk-consumers
- https://github.com/LiteSVM/litesvm
- https://www.metaplex.com/docs/smart-contracts/token-metadata/mint

## Arte escolhida e publicação de teste

A imagem escolhida pelo usuário está em `assets/felizcoin.jpeg`. Ainda precisa de hospedagem pública e atualização da URI dos metadados para aparecer nas carteiras.

Token verificado na devnet: https://explorer.solana.com/address/JDHwqnG8gGd5J85Ze9AHxNvs1UBa7SbaNq1hjhfbCeaJ?cluster=devnet

Imagem publicada: https://delicate-kringle-99b7e9.netlify.app/felizcoin.jpeg
Metadados publicados: https://delicate-kringle-99b7e9.netlify.app/felizcoin.json
URI gravada na devnet pela transação 3jPXBs3ZbuSpyWjPXz1qSzpiiYm9jPHHJboCUjHGyMdaq9kaXzNYmR2DTW47q9ThMXE3YK9WRu6eiovJ4wJZHW4b.
