# Arquitetura e escala

Este documento descreve como a Camps está preparada para crescer até **1 milhão de utilizadores registados**. Explica também como pôr isso em produção e o que já foi medido.

## Resumo

- A aplicação Next.js **não guarda estado** entre pedidos: as sessões estão no Postgres, e as caches, limites e bloqueios estão no Redis. Por isso escala-se adicionando servidores atrás de um balanceador.
- **A base de dados quase não sente o tráfego de leitura.** As páginas públicas e o placar ao vivo vêm de caches curtas. Nos testes, cada página custou entre 0,01 e 0,05 transações ao Postgres.
- **O trabalho lento corre em segundo plano**, fora dos pedidos dos utilizadores: confirmar pagamentos e reembolsos, recalcular rankings e limpar sessões.
- **O gargalo passa a ser o CPU dos servidores da aplicação** (renderizar React). Resolve-se com mais réplicas e um CDN à frente.

## Topologia de produção

```
                    ┌──────────────┐
  utilizadores ───▶ │     CDN      │  cache do placar (1 s), ficheiros estáticos, compressão
                    └──────┬───────┘
                           ▼
                    ┌──────────────┐
                    │ Balanceador  │  verifica /api/health
                    └──────┬───────┘
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌────────────┐   ┌────────────┐   ┌────────────┐
   │ Next.js #1 │   │ Next.js #2 │   │ Next.js #N │   (sem estado, 1 processo por vCPU)
   └─────┬──────┘   └─────┬──────┘   └─────┬──────┘
         └──────┬─────────┴───────┬────────┘
                ▼                 ▼
         ┌────────────┐    ┌────────────┐
         │   Redis    │    │ PgBouncer  │
         └────────────┘    └─────┬──────┘
                                 ▼
                          ┌─────────────┐
                          │  Postgres   │  primário (+ réplica de leitura e backups)
                          └─────────────┘
```

## Como cada parte aguenta a escala

| Parte | Mecanismo | Onde está |
|---|---|---|
| Placar ao vivo (ecrãs de TV, sobreposições, espectadores) | O estado de cada área fica 1 s em cache partilhada (Redis), e pedidos iguais em simultâneo esperam pelo mesmo cálculo. A resposta leva `s-maxage=1` para o CDN. Cada alteração do placar apaga a entrada. Se a base falhar, serve-se o último estado bom (até 5 min). | `src/server/scoreboard.ts`, `src/server/kv.ts`, `src/app/api/mats/[matId]/scoreboard/route.ts` |
| Páginas públicas (eventos, evento, categoria, academias, atletas, transmissões) | `"use cache"` com os perfis `public` (15 s) e `live` (5 s) definidos em `next.config.ts`. As ações do organizador apagam as etiquetas certas (`updateTag`), para quem muda dados ver o resultado logo. | `src/server/events.ts`, `src/server/community.ts`, `src/server/cache-tags.ts` |
| Ranking de academias e ordenação por popularidade | São pré-calculados por duas instruções SQL na tarefa de fundo, de 5 em 5 minutos. As páginas só leem colunas indexadas. | `src/server/stats.ts` |
| Pesquisas "contém" | Índices trigram (`pg_trgm`) nos nomes de eventos, academias e atletas. | `prisma/schema.prisma` |
| Listas grandes | Paginação: 24 eventos ou 48 academias por página. O mapa traz no máximo 500 pontos, com poucos campos. | `src/components/pager.tsx` |
| Pagamentos e reembolsos | Uma tarefa de fundo confirma os pendentes junto dos provedores, com no máximo 5 chamadas em paralelo. Cada pagamento é consultado no máximo uma vez a cada 3 s, venha o pedido de onde vier. As páginas do organizador não esperam pelos provedores. Pendentes há mais de 6 h são dados como expirados. | `src/server/jobs.ts`, `src/server/registrations.ts` |
| Abuso e ataques por força bruta | Limites de pedidos partilhados no Redis para registo, login, inscrição, pagamento e tentativas de cupão. O login bloqueia 15 min após 10 falhas. | `src/server/limits.ts`, `src/server/login-throttle.ts` |
| Formatação de datas e valores | Os formatadores `Intl` são criados uma vez e reutilizados (criá-los é ~80× mais caro do que usá-los). | `src/lib/format.ts` |
| Observabilidade | Erros do servidor em JSON numa linha (`onRequestError`), prontos para um serviço de registos. `/api/health` para o balanceador. | `src/instrumentation.ts`, `src/app/api/health/route.ts` |

## Medições

As medições foram feitas na build de produção (`next build` + `next start`), com **um único processo Node**, num portátil Intel i7-8565U de 4 núcleos. O gerador de carga corria na mesma máquina e competia pelo CPU, por isso os números são pessimistas.

A base usada foi o **PostgreSQL 17**, com:
- 100 000 utilizadores e 200 000 atletas;
- 3 030 eventos e 24 240 categorias;
- 500 000 inscrições.

O gerador desses dados está em `scripts/seed-scale.ts`.

| Pedido | Clientes simultâneos | Débito | Transações no Postgres por pedido |
|---|---|---|---|
| Placar de uma área (API) | 500 | 640 – 1 040 /s | 0,009 – 0,013 |
| Página de um evento | 100 | 37 /s | 0,05 |
| Lista de eventos | 100 | 26 /s | 0,04 |
| Ranking de academias | 100 | 22 /s | 0,03 |
| Página inicial | 100 | 28 /s | 0,04 |

Nenhum destes testes teve erros.

**Placar sem cache:** cada pedido ia à base de dados. Com 500 espectadores seriam cerca de 500 consultas por segundo só para uma área. Com a cache, a base recebe cerca de 1 por segundo.

**Consultas diretas sobre o volume acima** (`scripts/explain.ts`):

| Consulta | Tempo |
|---|---|
| Recálculo de rankings e popularidade | 1,4 s |
| Lista de eventos | 48 ms |
| Ranking de academias | 5 ms |
| Pesquisa de atletas | 11 ms (usa o índice trigram) |
| Inscrições de um evento ou atleta | < 0,1 ms (índices) |

**Memória:** em 3 minutos de pedidos sempre diferentes (eventos, pesquisas, rankings, placares), um processo subiu de 124 MB para ~700 MB enquanto as caches enchiam e depois estabilizou entre 670 e 710 MB. Não há fuga de memória.

Para repetir:

```bash
node scripts/load-test.mjs http://localhost:3000/api/mats/<id>/scoreboard 500 30 --pg=<DATABASE_URL>
npx tsx scripts/explain.ts
npx tsx scripts/check-stats.ts   # confere os rankings pré-calculados
```

### Vários eventos em direto ao mesmo tempo

Cenário: 10 eventos a decorrer à mesma hora, cada um com 4 áreas em direto, ou seja 40 placares. O teste usou a build de produção com um processo, e as mesas marcavam pontos em todas as áreas de 2 em 2 segundos (`scripts/seed-live.ts` e `scripts/load-test-live.mjs`).

| Medida | Resultado |
|---|---|
| Pedidos de placar (cada um com as 4 áreas de um evento) | 820 por segundo, 0 erros, com 1 000 clientes a pedir sem pausa |
| Espectadores servidos por processo | ~800 (cada espectador real faz 1 pedido por segundo) |
| Postgres | ~200 transações por segundo para as 40 áreas, incluindo as escritas das mesas. Não cresce com o número de espectadores. |
| Atraso até uma pontuação nova aparecer | 1,5 s em média, 2,3 s no máximo (1 s de cache + 1 s entre pedidos) |

O que torna isto possível:
- cada página pede **todas as suas áreas num só pedido** por segundo (`/api/scoreboards`), em vez de um pedido por placar;
- os pedidos **param quando o separador está escondido**;
- os ids vão ordenados, por isso **quem vê o mesmo evento faz o mesmo pedido**, e o CDN serve-o a todos;
- o vídeo não passa pela Camps: vai do YouTube ou do Facebook diretamente para o espectador.

Exemplo: 10 eventos com 20 000 espectadores no total.
- **Sem CDN:** cerca de 25 processos só para os placares.
- **Com CDN** (`s-maxage=1`): a origem recebe ~1 pedido por segundo por evento e por ponto de presença. Os espectadores praticamente não pesam.

## Plano de capacidade para 1 milhão de utilizadores

Hipóteses para o pior momento, um dia de grande torneio:

| Hipótese | Valor |
|---|---|
| Utilizadores ativos ao mesmo tempo | 5 % = 50 000 |
| Ritmo de navegação de cada um | 1 página a cada 20 s → **~2 500 páginas/s** |
| Espectadores do placar | 30 000, a pedir 1 vez por segundo → 30 000 pedidos/s. O CDN (`s-maxage=1`) absorve-os: a origem recebe ~1 pedido/s por área e por ponto de presença do CDN. |

| Componente | Dimensionamento sugerido | Porquê |
|---|---|---|
| Aplicação Next.js | 64 – 96 processos (por exemplo 16 – 24 máquinas de 4 vCPU), com escala automática pelo CPU, e ~1 GB de memória por processo | Medimos ~25 – 40 páginas/s por processo, num CPU fraco e com o gerador de carga a competir. Um vCPU de servidor dá mais. |
| Postgres | Primário com 4 – 8 vCPU e 16 – 32 GB, discos SSD, backups contínuos (PITR), mais uma réplica de leitura | ~0,05 transações por página dá ~125 transações/s de leitura, mais as escritas de inscrições e pagamentos. Está muito abaixo do limite de um Postgres deste tamanho. |
| PgBouncer | Modo transaction, ~200 ligações para o Postgres | Muitos processos Node com pools próprios esgotariam as ligações diretas. |
| Redis | 1 instância gerida (1 – 2 GB) com réplica | Cache do placar, limites, bloqueio do login e da tarefa de fundo. Pouca memória. |
| CDN | Obrigatório | Placar, ficheiros estáticos, compressão e proteção contra picos. |

Os números da aplicação são estimativas a partir das medições acima. Antes de um grande evento, repetir o teste de carga no ambiente real.

## Pôr em produção

O guia passo a passo, com Docker, está em [PRODUCAO.md](PRODUCAO.md). Esta secção resume o que vale para qualquer infraestrutura.

1. **Base de dados:** `npx prisma migrate deploy`. A migração `20261016150000_scale` cria a extensão `pg_trgm`; o utilizador da base precisa de permissão para isso, ou um administrador cria-a antes.
2. **Variáveis de ambiente** (ver `.env.example`):

   | Variável | Valor em produção |
   |---|---|
   | `DATABASE_URL` | Endereço do PgBouncer |
   | `DATABASE_POOL_MAX` | Ligações por processo (ex.: 5) ou vazio |
   | `REDIS_URL` | **Obrigatório com mais de um servidor.** Sem ele, os limites, o bloqueio do login e a cache do placar valem só por servidor. |
   | `JOBS_INTERVAL_SECONDS` | `30` em todos os servidores (o bloqueio no Redis deixa só um trabalhar), **ou** `0` com um agendador externo a chamar `GET /api/cron/jobs` com `Authorization: Bearer $CRON_SECRET` a cada minuto |
   | `CRON_SECRET` | Segredo longo e aleatório (só se houver agendador externo) |
   | `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_ATTRIBUTION` | Fornecedor de mosaicos contratado (MapTiler, Stadia…). Os do OpenStreetMap não permitem tráfego intenso. |
   | `APP_URL` | Endereço público em `https://` |
   | `PAYMENTS_SIMULATOR` | Vazio. O simulador nunca funciona em produção, mesmo que fique ligado. |
   | `RESEND_API_KEY`, `EMAIL_FROM` | **Obrigatórios.** Chave da Resend e remetente de um domínio verificado lá (registos SPF e DKIM no DNS). Sem eles, os e-mails de confirmação e de nova palavra-passe ficam na fila e ninguém consegue confirmar a conta. |
   | `EMAIL_REPLY_TO` | Opcional: endereço que recebe as respostas aos e-mails. |
   | `SENTRY_DSN`, `SENTRY_ENVIRONMENT` | DSN do projeto no Sentry, para receber os erros do servidor e da tarefa de fundo. |

3. **Proxy ou balanceador:** tem de escrever `X-Forwarded-For` e apagar o que vier do cliente, porque os limites por IP dependem disso. Deve encaminhar `/api/health`.
4. **CDN:**
   - respeitar `Cache-Control` da origem;
   - não guardar em cache respostas com `Set-Cookie`;
   - cache longa para `/_next/static/*`.
5. **Implantação sem interrupção:** a cache das páginas (`"use cache"`) é por versão da build, por isso esvazia-se a cada implantação, o que é esperado. As caches do Redis (placar) usam chaves estáveis e sobrevivem.

## Limitações conhecidas e próximos passos

- **Cache das páginas por servidor:** a cache `"use cache"` fica na memória de cada servidor. Com 20 servidores, uma página pouco visitada pode ir 20 vezes à base em cada intervalo de 15 s, o que continua a ser pouco. Se for preciso, configurar `cacheHandlers` com Redis e usar `"use cache: remote"`.
- **Renovação imediata só no servidor da ação:** quando um organizador muda algo, `updateTag` apaga a cache desse servidor. Os outros veem a mudança em no máximo 5 – 15 s.
- **Réplica de leitura:** ainda não está ligada no código. Quando o primário precisar de alívio, encaminhar as leituras públicas para ela (por exemplo com a extensão `@prisma/extension-read-replicas`).
- **Recálculo dos rankings:** corre por inteiro a cada 5 min (1,4 s com 500 000 inscrições). Acima de ~10 milhões de inscrições, passar a cálculo incremental quando um pódio fecha.
- **Redis:** o adaptador está testado com um duplo nos testes unitários, mas não contra um Redis real. Validar no ambiente de staging.
- **Compressão:** o Node comprime as respostas. Atrás de um CDN que comprime, pode desligar-se (`compress: false`) para poupar CPU.
- **Base local `prisma dev`:** é um Postgres embutido (PGlite) que só aguenta uma ligação de cada vez (`DATABASE_POOL_MAX=1`). Serve para desenvolvimento, nunca para medir carga.
