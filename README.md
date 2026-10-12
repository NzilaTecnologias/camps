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
- `src/app/` — páginas públicas, login/cadastro e painel (`/manage`)
