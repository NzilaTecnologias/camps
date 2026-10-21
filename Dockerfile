# Imagem de produção da Camps. Três alvos:
#   runner  — o servidor (node server.js), só com os ficheiros que a build precisa
#   migrate — aplica as migrações (`prisma migrate deploy`) antes de o servidor arrancar
# Guia completo em docs/PRODUCAO.md.

ARG NODE_IMAGE=node:24-bookworm-slim

# ---------- base: o Prisma (migrações) precisa do OpenSSL, que a imagem slim não traz ----------
FROM ${NODE_IMAGE} AS base
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# ---------- dependências ----------
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# Os scripts têm de correr: o do @prisma/engines descarrega o motor das migrações e o
# postinstall gera o cliente. A cache do npm fica entre builds e as falhas de rede repetem-se:
# uma build interrompida a meio não volta a descarregar tudo.
RUN --mount=type=cache,target=/root/.npm \
    DATABASE_URL="postgres://build@localhost:5432/build" \
    npm ci --fetch-retries=5 --fetch-retry-mintimeout=10000 --fetch-retry-maxtimeout=120000

# ---------- build ----------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# As variáveis NEXT_PUBLIC_* ficam gravadas no JavaScript do navegador durante a build.
ARG NEXT_PUBLIC_MAP_TILE_URL=""
ARG NEXT_PUBLIC_MAP_ATTRIBUTION=""
# Identifica a versão: o navegador recarrega a página quando o servidor muda de versão.
ARG NEXT_DEPLOYMENT_ID=""
ENV NEXT_PUBLIC_MAP_TILE_URL=$NEXT_PUBLIC_MAP_TILE_URL \
    NEXT_PUBLIC_MAP_ATTRIBUTION=$NEXT_PUBLIC_MAP_ATTRIBUTION \
    NEXT_DEPLOYMENT_ID=$NEXT_DEPLOYMENT_ID \
    NEXT_TELEMETRY_DISABLED=1

# O prisma.config.ts pede um DATABASE_URL, mas gerar o cliente e compilar não falam com a base.
RUN DATABASE_URL="postgres://build@localhost:5432/build" npx prisma generate \
 && DATABASE_URL="postgres://build@localhost:5432/build" npx next build

# ---------- migrações ----------
FROM base AS migrate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

# ---------- servidor ----------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# Cache das imagens otimizadas pelo next/image: o servidor escreve aqui.
RUN mkdir -p .next/cache && chown -R node:node .next/cache

USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# O server.js termina os pedidos em curso quando recebe SIGTERM (docker stop).
CMD ["node", "server.js"]
