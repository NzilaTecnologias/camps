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

O seed cria a conta `organizador@camps.local` com a palavra-passe `camps-demo`, só para desenvolvimento local. O painel do organizador fica em `/manage`. Cria também o administrador da Camps `admin@camps.local` (palavra-passe `camps-admin`), que vê a fila de repasses em `/admin/payouts`.

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
| Faturação e repasses | Extrato do evento: cobrado online − reembolsos − taxa Camps − transferências já feitas = saldo a receber (ou em dívida). IBAN da organização para os repasses |
| Pesagem | Peso de cada atleta confirmado; quem fica acima do limite sai da chave quando ela é gerada |
| Chaves | Estado de cada categoria, gerar ou regerar, e gerar de uma vez as que faltam |
| Placar e áreas | Áreas de luta, a luta em cada placar e as lutas prontas para chamar |
| Transmissão | Endereço do YouTube/Facebook por área, pôr e tirar do ar, sobreposição para o OBS |

Um reembolso confirmado passa o pagamento a `REFUNDED` e cancela a inscrição. Uma inscrição paga só se cancela reembolsando-a.

## Modelo de negócio

Inspirado nos créditos do Smoothcomp: atletas e público usam a Camps de graça e o organizador paga uma **taxa por atleta confirmado** em cada evento (`PLATFORM_FEE_PER_ATHLETE_KZ`, por omissão 500 Kz). Cada atleta conta uma vez por evento, seja em quantas categorias for, e continua a contar se desistir ou for reembolsado. Cada evento grava a taxa em vigor quando é criado.

As inscrições pagas online entram na conta da Camps (Multicaixa Express / PayPal). A taxa é descontada delas e o saldo é transferido para o IBAN da organização: os administradores (`PLATFORM_ADMIN_EMAILS`) veem a fila em `/admin/payouts` e registam cada transferência com a referência bancária. Eventos só com inscrições manuais ou gratuitas ficam com saldo negativo (em dívida à Camps).

### Plano Federação

Federações e ligas têm uma página própria em `/f/<identificador>` e um painel em `/manage/federations/<id>`. Funciona com uma assinatura anual, ativada por um administrador da Camps em `/admin/federations` depois do pagamento (preços em `FEDERATION_BASIC_KZ` e `FEDERATION_PREMIUM_KZ`):

| | Básico | Premium |
|---|---|---|
| Página da federação com os eventos das organizações autorizadas | ✓ | ✓ |
| Filiação de academias com validade | ✓ | ✓ |
| Filiação individual de atletas, paga online (Multicaixa Express / PayPal) | | ✓ |
| Eventos que só aceitam atletas com filiação em dia no dia da prova | | ✓ |
| Ranking nacional de atletas e academias (pódios: 9 / 3 / 1 pontos) | | ✓ |
| Notícias na página da federação | | ✓ |

As organizações dão o seu identificador (no painel, por baixo do nome) à federação, que as autoriza; depois escolhem a federação na Página do evento. As quotas de filiação vão inteiras para a federação, pelo mesmo sistema de repasses: a Camps é paga pela assinatura, não pelas quotas. A federação pode reembolsar uma quota (sempre o valor total, pelo provedor que cobrou ou registando uma devolução feita fora da plataforma): a filiação é cancelada e o valor sai do extrato; se a quota já tinha sido transferida, a federação fica em dívida. O seed cria a "Federação Demo de Jiu-Jitsu de Angola" (`/f/federacao-demo`), Premium, com a Copa Camps sob ela.

Ainda não implementado (precisa de decisão): transmissão paga (exige contratar alojamento de vídeo, por exemplo Mux ou Cloudflare Stream) e gestão de academias (produto à parte).

Antes de cobrar em produção, confirmar com um jurista e com a ProxyPay o enquadramento de receber pagamentos em nome dos organizadores e a faturação da taxa com IVA.

## Pagamentos

A plataforma opera em Angola: preços em kwanzas (AOA), fuso de Luanda.

| Método | Como funciona | Variáveis |
|---|---|---|
| Multicaixa Express | Via API OPG da ProxyPay (GPO da EMIS). O atleta indica o telemóvel e confirma o pedido na app | `PROXYPAY_API_URL`, `PROXYPAY_TOKEN`, `PROXYPAY_POS_ID` |
| PayPal | Orders API v2. Como o PayPal não cobra em kwanzas, o valor é convertido para `PAYPAL_CURRENCY` à taxa fixa `PAYPAL_EXCHANGE_RATE` | `PAYPAL_API_URL`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` |
| Simulador | Só para desenvolvimento: aprova ou recusa à mão, sem cobrar. **Nunca ligar em produção** | `PAYMENTS_SIMULATOR=1` |

Um método só aparece ao atleta quando as suas variáveis estão preenchidas. O estado de um pagamento é sempre confirmado junto do provedor; callbacks e retornos do navegador servem apenas de aviso. `APP_URL` tem de ser o endereço público (https) para o callback do Multicaixa Express e o retorno do PayPal funcionarem.

Cada provedor é um ficheiro em `src/server/payments/`; trocar a ProxyPay por outro agregador ou pelo GPO direto da EMIS é reescrever `multicaixa-express.ts`.

## Contas e e-mails

- **Registo:** pede a aceitação dos [Termos](/terms) e da [Política de privacidade](/privacy) (data gravada em `User.termsAcceptedAt`) e envia um link para confirmar o e-mail. Até confirmar, a conta entra mas não paga inscrições ou quotas nem cria organizações e eventos, e um aviso no topo permite reenviar o link.
- **Nova palavra-passe:** "Esqueceu-se da palavra-passe?" no login. O link vale 60 minutos e uma só vez; ao usá-lo, todas as sessões abertas terminam. A resposta é a mesma quer o e-mail exista quer não.
- **Avisos por e-mail:** inscrição confirmada, inscrição reembolsada, filiação ativa e quota reembolsada.
- **Limites:** no máximo 5 links por hora para o mesmo e-mail e 30 por IP.

Os e-mails saem pela [Resend](https://resend.com) (`RESEND_API_KEY`, `EMAIL_FROM` com domínio verificado, `EMAIL_REPLY_TO` opcional). Cada e-mail é gravado na tabela `EmailOutbox` antes de sair, e a tarefa de fundo volta a tentar os que falharam (até 6 vezes, de 1 minuto a 12 horas). Os links de acesso não ficam guardados depois de enviados. Sem `RESEND_API_KEY`, em desenvolvimento, nada sai: os e-mails aparecem em `/dev/mailbox`.

Os dados da empresa nos textos legais estão em `src/lib/legal.ts` e **têm de ser preenchidos** antes de abrir ao público; os textos devem ser revistos por um advogado.

Erros do servidor e da tarefa de fundo vão para o Sentry quando `SENTRY_DSN` está preenchido (sem SDK: `src/server/error-report.ts`).

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
| `images/taekwondo.jpg` | [Img notipGO5DLrPzS](https://commons.wikimedia.org/wiki/File:Img_notipGO5DLrPzS.jpg), por Tomas Peruzzo | CC0 |
| `images/torneio-infantil.jpg` | [Karate tournament for Kids](https://commons.wikimedia.org/wiki/File:Karate_tournament_for_Kids.jpg), por Samson Ssemakadde | CC0 |
| `images/combate.jpg` | [MenFight](https://commons.wikimedia.org/wiki/File:MenFight.jpg), por 12019 | CC0 |
| `images/pavilhao.jpg` | [Ramstein holds youth martial arts tournament 150228-F-EN010-254](https://commons.wikimedia.org/wiki/File:Ramstein_holds_youth_martial_arts_tournament_150228-F-EN010-254.jpg), por Senior Airman Timothy Moore (U.S. Air Force) | Domínio público |

## Escala e produção

A arquitetura está preparada para 1 milhão de utilizadores: caches partilhadas, tarefa de fundo, limites de pedidos, índices e paginação. Topologia, medições e plano de capacidade estão em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

**Implantação:** [docs/PRODUCAO.md](docs/PRODUCAO.md) é o guia passo a passo. Os ficheiros são:

- `Dockerfile`: imagem com o servidor autónomo do Next e um alvo para as migrações;
- `deploy/docker-compose.yml`: Caddy com HTTPS automático, réplicas da aplicação, Postgres 17, Redis e cópias de segurança diárias;
- `deploy/deploy.sh`: atualizações;
- `.github/workflows/ci.yml`: tipos, lint, testes, build, testes ponta a ponta e imagem Docker em cada push.

Em produção, o servidor recusa-se a arrancar com configuração perigosa ou incompleta (`src/server/env-check.ts`).

## Comandos

| Comando | O que faz |
|---|---|
| `npm test` | Testes unitários (motor de chaves, palavra-passe, pagamentos) |
| `npm run test:e2e` | Percorre registo, confirmação de e-mail, nova palavra-passe, painel, chave, resultados, inscrição e pagamento pelo HTTP (`scripts/e2e.mjs`, `scripts/e2e-extra.mjs` e `scripts/e2e-auth.mjs`). Precisa do app rodando sem `RESEND_API_KEY` e grava dados de teste no banco; `npm run db:seed` limpa depois |
| `node scripts/load-test.mjs <url> [clientes] [segundos]` | Teste de carga simples; com `--pg=<DATABASE_URL>` conta as transações no Postgres |
| `npx tsx scripts/seed-live.ts [eventos] [áreas]` · `node scripts/load-test-live.mjs <origem> <DATABASE_URL>` | Vários eventos em direto e espectadores a seguir os placares (nunca numa base real) |
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
