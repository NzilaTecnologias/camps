#!/bin/sh
# Atualiza a Camps neste servidor: vai buscar o código, constrói as imagens, aplica as migrações
# e substitui as réplicas da aplicação. Correr dentro de deploy/: ./deploy.sh [ramo]
set -eu
cd "$(dirname "$0")"

BRANCH="${1:-main}"
[ -f .env ] || { echo "Falta deploy/.env (copiar de env.production.example)" >&2; exit 1; }

git fetch --quiet origin "$BRANCH"
git checkout --quiet "$BRANCH"
git pull --quiet --ff-only origin "$BRANCH"

# A versão identifica a implantação: o navegador recarrega quando muda.
DEPLOYMENT_ID="$(git rev-parse --short HEAD)"
export DEPLOYMENT_ID
echo "deploy: versão $DEPLOYMENT_ID"

docker compose build
# O serviço migrate corre antes da aplicação (depends_on); se falhar, a versão antiga continua.
docker compose run --rm migrate
docker compose up -d --remove-orphans
docker image prune -f >/dev/null

echo "deploy: a verificar o estado…"
sleep 10
docker compose ps
curl -fsS "https://$(grep '^DOMAIN=' .env | cut -d= -f2)/api/health" && echo && echo "deploy: concluído"
