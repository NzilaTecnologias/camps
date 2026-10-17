# Camps

Plataforma de gestão de torneios de esportes de combate: eventos, categorias, inscrições, chaves e resultados.

Stack: Next.js 16 (App Router), TypeScript, Tailwind, Prisma 7 e PostgreSQL.

## Rodando localmente

```bash
npm install
npm run db:up        # Postgres local do Prisma (não precisa de Docker)
npm run db:migrate   # aplica as migrações
npm run db:seed      # cria um evento de demonstração
npm run dev          # http://localhost:3000
```

`npm run db:up` imprime a URL de conexão. Se a porta for diferente da que está em `.env`, atualize `DATABASE_URL`.

O seed cria a conta `organizador@camps.local` com a palavra-passe `camps-demo`, só para desenvolvimento local. O painel do organizador fica em `/manage`.

## Área do organizador

Cada evento tem um painel próprio em `/manage/events/<id>`, com um menu por secção:

| Secção | O que faz |
|---|---|
| Visão geral | Indicadores (inscrições, receita, pesagem, chaves, direto) e lista de próximos passos |
| Página do evento | Nome, modalidade, descrição, datas, janela de inscrições, local e ponto no mapa; cancelar o evento |
| Categorias | Criar categorias e abrir cada uma (chave, pódio, inscrição manual) |
| Inscrições | Lista com filtros por estado, categoria e pesquisa; cancelar inscrições por pagar ou gratuitas |
| Descontos e cupões | Desconto antecipado (percentagem até uma data) e cupões de percentagem ou valor fixo, com limite de usos e validade. Os dois acumulam |
| Pagamentos e reembolsos | Totais cobrados e reembolsados; reembolso total pelo provedor (ProxyPay `type: refund`, PayPal refund da captura) ou registo de devolução feita fora da plataforma |
| Pesagem | Peso de cada atleta confirmado; quem fica acima do limite sai da chave quando ela é gerada |
| Chaves | Estado de cada categoria, gerar ou regerar, e gerar de uma vez as que faltam |
| Placar e áreas | Áreas de luta, a luta em cada placar e as lutas prontas para chamar |
| Transmissão | Endereço do YouTube/Facebook por área, pôr e tirar do ar, sobreposição para o OBS |

Um reembolso confirmado passa o pagamento a `REFUNDED` e cancela a inscrição. Uma inscrição paga só se cancela reembolsando-a.

## Pagamentos

A plataforma opera em Angola: preços em kwanzas (AOA), fuso de Luanda.

| Método | Como funciona | Variáveis |
|---|---|---|
| Multicaixa Express | Via API OPG da ProxyPay (GPO da EMIS). O atleta indica o telemóvel e confirma o pedido na app | `PROXYPAY_API_URL`, `PROXYPAY_TOKEN`, `PROXYPAY_POS_ID` |
| PayPal | Orders API v2. Como o PayPal não cobra em kwanzas, o valor é convertido para `PAYPAL_CURRENCY` à taxa fixa `PAYPAL_EXCHANGE_RATE` | `PAYPAL_API_URL`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` |
| Simulador | Só para desenvolvimento: aprova ou recusa à mão, sem cobrar. **Nunca ligar em produção** | `PAYMENTS_SIMULATOR=1` |

Um método só aparece ao atleta quando as suas variáveis estão preenchidas. O estado de um pagamento é sempre confirmado junto do provedor; callbacks e retornos do navegador servem apenas de aviso. `APP_URL` tem de ser o endereço público (https) para o callback do Multicaixa Express e o retorno do PayPal funcionarem.

Cada provedor é um ficheiro em `src/server/payments/`; trocar a ProxyPay por outro agregador ou pelo GPO direto da EMIS é reescrever `multicaixa-express.ts`.

## Placar e transmissão em direto

Cada evento tem **áreas de luta** (geridas na página do evento, no painel). Cada área tem:

| Ecrã | Endereço | Para quê |
|---|---|---|
| Controlo | `/manage/matches/<luta>/scoreboard` | O mesário marca pontos, vantagens e punições, controla o cronómetro e termina a luta. Abre-se a partir de uma luta pronta, na chave |
| TV | `/scoreboard/<área>` | Placar em ecrã inteiro para a televisão ou projetor junto ao tatami |
| Sobreposição | `/overlay/<área>` | Placar compacto com fundo transparente, para usar como fonte de navegador no OBS ou programa semelhante |

Os endereços de TV e de sobreposição são fixos por área: mostram sempre a luta que estiver no placar dessa área e atualizam de segundo a segundo. Terminar a luta no placar grava o resultado na chave e liberta a área.

A plataforma **não transporta vídeo**. A transmissão faz-se pelo YouTube ou pelo Facebook: o organizador cola o endereço na área e carrega em "Pôr em direto", e o leitor aparece na página pública do evento. Só são aceites endereços `https` desses dois serviços.

O placar segue o modelo do jiu-jitsu (pontos +2/+3/+4, vantagens, punições); outros desportos ainda não têm regras próprias.

## Fotografias da página inicial

A página inicial usa fotografias de uso livre do Wikimedia Commons, em `public/hero/` e `public/images/`. São provisórias: troque-as por fotografias dos próprios eventos (mesmos nomes de ficheiro, ou altere as listas `SLIDES`, `AUDIENCES` e `SPORT_TILES` em `src/app/(main)/page.tsx`; o slideshow precisa de pelo menos três).

| Ficheiro | Origem | Licença |
|---|---|---|
| `hero/torneio.jpg` | [Championnats de France CFJJB 2013 (1)](https://commons.wikimedia.org/wiki/File:Championnats_de_France_CFJJB_2013_(1).jpg), por Jgui | CC0 |
| `hero/luta.jpg` | [Jiu-jitsu tournament with local Australians, 150725-M-BX631-117](https://commons.wikimedia.org/wiki/File:Jiu-jitsu_tournament_with_local_Australians,_U.S._Marine_150725-M-BX631-117.jpg), por Staff Sgt. Jose O. Nava (U.S. Marine Corps) | Domínio público |
| `hero/finalizacao.jpg` | [Jiu-jitsu tournament with local Australians, 150725-M-BX631-070](https://commons.wikimedia.org/wiki/File:Jiu-jitsu_tournament_with_local_Australians,_U.S._Marine_150725-M-BX631-070.jpg), por Staff Sgt. Jose O. Nava (U.S. Marine Corps) | Domínio público |
| `images/atleta.jpg` | [Athlète de Sambo 03](https://commons.wikimedia.org/wiki/File:Athl%C3%A8te_de_Sambo_03.jpg), por Kani Beat | CC0 |
| `images/grappling.jpg` | [USMC-110124-M-2306T-163](https://commons.wikimedia.org/wiki/File:USMC-110124-M-2306T-163.jpg), por Lance Cpl. Lisa M. Tourtelot | Domínio público |
| `images/jiu-jitsu.jpg` | [USMC-110122-M-9595T-067](https://commons.wikimedia.org/wiki/File:USMC-110122-M-9595T-067.jpg), por Lance Cpl. Andrew D. Thorburn | Domínio público |
| `images/karate-combate.jpg` | [Karate tournament combat](https://commons.wikimedia.org/wiki/File:Karate_tournament_combat.jpg), por Miguel Angel Omaña Rojas | CC0 |
| `images/karate-placar.jpg` | [Karate International tournament](https://commons.wikimedia.org/wiki/File:Karate_International_tournament.jpg), por Miguel Angel Omaña Rojas | CC0 |
| `images/podio.jpg` | [Shirin Sharmin Chaudhury At Karate Tournament Shaheed Suhrawardi Stadium Dhaka 2015-10-23 (PID-0057606)](https://commons.wikimedia.org/wiki/File:Shirin_Sharmin_Chaudhury_At_Karate_Tournament_Shaheed_Suhrawardi_Stadium_Dhaka_2015-10-23_(PID-0057606).jpg), por Press Information Department (Bangladesh) | Domínio público |
| `images/taekwondo.jpg` | [Img notipGO5DLrPzS](https://commons.wikimedia.org/wiki/File:Img_notipGO5DLrPzS.jpg), por Tomas Peruzzo | CC0 |
| `images/torneio-infantil.jpg` | [Karate tournament for Kids](https://commons.wikimedia.org/wiki/File:Karate_tournament_for_Kids.jpg), por Samson Ssemakadde | CC0 |

## Escala e produção

A arquitetura está preparada para 1 milhão de utilizadores: caches partilhadas, tarefa de fundo, limites de pedidos, índices e paginação. Topologia, medições, plano de capacidade e passos de implantação estão em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Comandos

| Comando | O que faz |
|---|---|
| `npm test` | Testes unitários (motor de chaves, palavra-passe, pagamentos) |
| `npm run test:e2e` | Percorre registo, painel, chave, resultados, inscrição e pagamento pelo HTTP (`scripts/e2e.mjs` e `scripts/e2e-extra.mjs`). Precisa do app rodando e grava dados de teste no banco; `npm run db:seed` limpa depois |
| `node scripts/load-test.mjs <url> [clientes] [segundos]` | Teste de carga simples; com `--pg=<DATABASE_URL>` conta as transações no Postgres |
| `npx tsx scripts/seed-scale.ts [utilizadores]` | Dados em massa para testes de carga (nunca numa base real) |
| `npx tsx scripts/explain.ts` · `npx tsx scripts/check-stats.ts` | Tempos e planos das consultas pesadas · conferência dos rankings pré-calculados |
| `npm run typecheck` | Checagem de tipos |
| `npm run lint` | ESLint |

## Estrutura

- `prisma/schema.prisma` — modelo de dados
- `src/lib/brackets/` — motor de chaves (eliminação simples e round robin), sem dependência de banco
- `src/server/` — acesso a dados e regras que gravam no banco
- `src/server/auth.ts` — cadastro, login e sessões (cookie httpOnly, token guardado como hash no banco)
- `src/server/manage.ts` — operações do painel, sempre restritas às organizações do usuário logado
- `src/server/scoreboard.ts` — placar, cronómetro, áreas de luta e transmissão
- `src/server/kv.ts` — cache, limites e bloqueios partilhados (Redis ou memória)
- `src/server/jobs.ts` — trabalho de fundo (pagamentos, reembolsos, rankings, sessões)
- `src/app/(main)/` — página inicial e, em `(site)/`, páginas públicas, login/registo e painel (`/manage`)
- `src/app/(bare)/` — ecrãs de placar sem cabeçalho nem rodapé
