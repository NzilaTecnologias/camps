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

O slideshow da abertura usa três fotografias de uso livre do Wikimedia Commons, em `public/hero/`. São provisórias: troque-as por fotografias dos próprios eventos (mesmos nomes de ficheiro, ou altere a lista `SLIDES` em `src/app/page.tsx`; são precisas pelo menos três).

| Ficheiro | Origem | Licença |
|---|---|---|
| `torneio.jpg` | [Championnats de France CFJJB 2013 (1)](https://commons.wikimedia.org/wiki/File:Championnats_de_France_CFJJB_2013_(1).jpg), por Jgui | CC0 |
| `luta.jpg` | [Jiu-jitsu tournament with local Australians, 150725-M-BX631-117](https://commons.wikimedia.org/wiki/File:Jiu-jitsu_tournament_with_local_Australians,_U.S._Marine_150725-M-BX631-117.jpg), por Staff Sgt. Jose O. Nava (U.S. Marine Corps) | Domínio público |
| `finalizacao.jpg` | [Jiu-jitsu tournament with local Australians, 150725-M-BX631-070](https://commons.wikimedia.org/wiki/File:Jiu-jitsu_tournament_with_local_Australians,_U.S._Marine_150725-M-BX631-070.jpg), por Staff Sgt. Jose O. Nava (U.S. Marine Corps) | Domínio público |

## Comandos

| Comando | O que faz |
|---|---|
| `npm test` | Testes unitários (motor de chaves, palavra-passe, pagamentos) |
| `npm run test:e2e` | Percorre registo, painel, chave, resultados, inscrição e pagamento pelo HTTP. Precisa do app rodando e grava dados de teste no banco; `npm run db:seed` limpa depois |
| `npm run typecheck` | Checagem de tipos |
| `npm run lint` | ESLint |

## Estrutura

- `prisma/schema.prisma` — modelo de dados
- `src/lib/brackets/` — motor de chaves (eliminação simples e round robin), sem dependência de banco
- `src/server/` — acesso a dados e regras que gravam no banco
- `src/server/auth.ts` — cadastro, login e sessões (cookie httpOnly, token guardado como hash no banco)
- `src/server/manage.ts` — operações do painel, sempre restritas às organizações do usuário logado
- `src/server/scoreboard.ts` — placar, cronómetro, áreas de luta e transmissão
- `src/app/(main)/` — página inicial e, em `(site)/`, páginas públicas, login/registo e painel (`/manage`)
- `src/app/(bare)/` — ecrãs de placar sem cabeçalho nem rodapé
