# Pôr a Camps em produção

Guia passo a passo para lançar a Camps num servidor com Docker. A configuração está em `deploy/` e
a imagem no `Dockerfile`. A arquitetura e a escala estão descritas em [ARQUITETURA.md](ARQUITETURA.md).

```
Internet ──443──▶ Caddy (HTTPS automático) ──▶ app ×N (Next.js) ──▶ Postgres 17 + Redis
                                                backup ──▶ deploy/backups (pg_dump diário)
```

## 1. Antes de começar

| O quê | Para quê | Onde |
|---|---|---|
| Servidor Linux (Ubuntu 24.04) com 4 vCPU e 8 GB de RAM | Aguenta folgadamente os primeiros milhares de utilizadores e vários eventos em direto | Qualquer fornecedor de VPS (ver "Onde alojar") |
| Domínio | Endereço público e certificado HTTPS | Registo `.ao` ou outro |
| Conta Resend com o domínio verificado | E-mails (confirmação de conta, palavra-passe, recibos) | resend.com |
| Contrato ProxyPay (produção) | Multicaixa Express | proxypay.co.ao |
| Conta PayPal Business (opcional) | Pagamentos do estrangeiro | paypal.com |
| Chave MapTiler (ou semelhante) | Mosaicos do mapa de eventos | maptiler.com |
| Projeto Sentry (recomendado) | Avisos de erros | sentry.io |

### Onde alojar

- **Latência:** os utilizadores estão em Angola. Um servidor na Europa (Lisboa, Frankfurt) ou na África
  do Sul fica a 100–200 ms. É aceitável, porque as páginas são leves e o placar atualiza de segundo a segundo.
- **Dados pessoais:** a Lei 22/11 sujeita a transferência de dados para fora de Angola às regras da
  Agência de Protecção de Dados. Um centro de dados em Angola simplifica isso; confirme com o advogado.
- **Começar simples:** um só servidor com este `docker compose` chega para o lançamento. Quando crescer,
  passe a base de dados para um Postgres gerido e acrescente réplicas ou servidores (secção 8).

## 2. Preparar o servidor

```bash
# Docker e Git
curl -fsSL https://get.docker.com | sh
sudo apt-get install -y git

# Firewall: só SSH e web
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```

No DNS do domínio, crie registos **A** para `camps.ao` e `www.camps.ao` com o IP do servidor. O Caddy
só obtém o certificado quando o DNS já aponta para o servidor.

## 3. Configurar

```bash
git clone https://github.com/NzilaTecnologias/camps.git && cd camps/deploy
cp env.production.example .env
nano .env
```

Preencha pelo menos:

- `DOMAIN`, `ACME_EMAIL` e `APP_URL` (com `https://`);
- `POSTGRES_PASSWORD` (gerar com `openssl rand -base64 32`);
- `RESEND_API_KEY` e `EMAIL_FROM`;
- `PROXYPAY_TOKEN` e `PROXYPAY_POS_ID`, e/ou as credenciais do PayPal com `PAYPAL_EXCHANGE_RATE`;
- `PLATFORM_ADMIN_EMAILS`, com o e-mail de quem vai administrar a plataforma (o resto da equipa recebe o papel na própria administração);
- `NEXT_PUBLIC_MAP_TILE_URL` e `NEXT_PUBLIC_MAP_ATTRIBUTION`;
- `SENTRY_DSN`.

`APP_REPLICAS` deve ser igual ao número de vCPUs do servidor.

Antes de abrir ao público, preencha também os dados da empresa em `src/lib/legal.ts` e faça commit.

O `deploy/.env` nunca vai para o Git, porque o `.gitignore` o exclui. Guarde uma cópia num gestor de
palavras-passe.

## 4. Lançar

```bash
chmod +x deploy.sh backup.sh
./deploy.sh
```

O script vai buscar o código e constrói as imagens. Depois aplica as migrações e arranca o Caddy, as
réplicas, o Postgres, o Redis e as cópias de segurança. No fim confirma que
`https://DOMINIO/api/health` responde.

**Se a aplicação não arrancar:** corra `docker compose logs app`. Ao arrancar, o servidor confere a
configuração e termina com uma lista do que falta (linhas `"configuração: …"`). Por exemplo, recusa
`PAYMENTS_SIMULATOR=1`, `APP_URL` sem https ou a falta da Resend. Os avisos que não impedem o arranque
aparecem na mesma lista.

**Primeiro administrador:** crie conta em `https://DOMINIO/signup` com um e-mail que esteja em
`PLATFORM_ADMIN_EMAILS`. Depois confirme o e-mail pelo link recebido e entre na administração em
`https://DOMINIO/admin/login`, com a mesma palavra-passe. É separada do site: não há ligações para lá nos
menus públicos. Em **Equipa** dá o papel de Financeiro ou Suporte às outras pessoas, que primeiro criam
conta no site. **Não corra o seed em produção:** apaga todos os dados.

## 5. Atualizar

```bash
cd camps/deploy && ./deploy.sh
```

O script faz quatro coisas:

1. constrói a versão nova;
2. aplica as migrações (se falharem, a versão antiga continua no ar);
3. substitui as réplicas;
4. apaga as imagens antigas.

Durante a troca há alguns segundos em que os pedidos esperam. O Caddy volta a tentá-los durante 10 s
noutra réplica, por isso normalmente ninguém nota. Os navegadores abertos recarregam a página quando
detetam a versão nova (`NEXT_DEPLOYMENT_ID`).

**Voltar atrás:** volte ao commit anterior e reconstrua.

```bash
git checkout <commit-anterior>
DEPLOYMENT_ID=$(git rev-parse --short HEAD) docker compose up -d --build
```

As migrações só andam para a frente. Se a versão nova tiver mudado a base de dados, confirme que a
antiga ainda funciona com ela ou restaure uma cópia (secção 6).

## 6. Cópias de segurança

O serviço `backup` faz um `pg_dump` ao arrancar e depois todos os dias à hora `BACKUP_HOUR` de Luanda.
Na mesma hora guarda as imagens que os organizadores carregaram (volume `uploads`) num
`camps-uploads-….tar.gz`. As cópias ficam em `deploy/backups/` durante `BACKUP_KEEP_DAYS` dias.

**Leve as cópias para fora do servidor.** Se o servidor se perder, as cópias perdem-se com ele. Use por
exemplo o `rclone`, com um cron diário, para um bucket S3, Backblaze B2 ou Google Drive:

```bash
# crontab -e
30 4 * * * rclone copy /home/ubuntu/camps/deploy/backups remoto:camps-backups --max-age 48h
```

### Restaurar uma cópia

```bash
cd camps/deploy
docker compose stop app
docker compose exec -T db pg_restore -U camps -d camps --clean --if-exists < backups/camps-AAAAMMDD-HHMMSS.dump
# As imagens dos eventos (volume camps_uploads), da cópia do mesmo dia:
docker run --rm -v camps_uploads:/uploads -v "$PWD/backups:/backups:ro" alpine \
  tar -xzf /backups/camps-uploads-AAAAMMDD-HHMMSS.tar.gz -C /uploads
docker compose start app
```

Teste uma restauração uma vez antes do lançamento. Uma cópia que nunca foi restaurada não está provada.

## 7. Vigiar

| O quê | Como |
|---|---|
| Registos | `docker compose logs -f app`, em JSON numa linha. Os de cada contentor rodam a 5 × 20 MB |
| Erros | Sentry (`SENTRY_DSN`): erros dos pedidos e da tarefa de fundo |
| Disponibilidade | Um monitor externo (UptimeRobot, Better Stack…) a chamar `https://DOMINIO/api/health` a cada minuto. Responde 503 se a base de dados falhar |
| E-mails | Painel da Resend (entregas, devoluções). Os que falham ficam na tabela `EmailOutbox` com `lastError` e são reenviados até 6 vezes |
| Disco | `df -h`. O Postgres e as cópias são o que cresce |

## 8. Crescer

Por ordem, à medida que for preciso:

1. **Servidor maior e mais réplicas:** suba `APP_REPLICAS` até ao número de vCPUs e corra `./deploy.sh`.
2. **Postgres gerido** (backups, réplicas e atualizações automáticas):
   - migre os dados com `pg_dump` / `pg_restore`;
   - no `.env`, ponha `COMPOSE_PROFILES=` vazio e `DATABASE_URL=` com o endereço do fornecedor;
   - os serviços `db` e `backup` deixam de arrancar.
3. **CDN (Cloudflare):** o DNS em modo proxy, com SSL "Full (strict)".
   - **Limites por IP:** acrescente ao `reverse_proxy` do `Caddyfile`
     `trusted_proxies 173.245.48.0/20 103.21.244.0/22 …` (lista em cloudflare.com/ips) e
     `header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}`. Sem isto, todos os pedidos
     parecem vir dos IPs da Cloudflare e os limites por IP deixam de distinguir pessoas.
   - **Placar:** a Cloudflare passa a guardar 1 s em cache o JSON do placar (`s-maxage=1`), o que
     alivia os servidores em eventos grandes.
4. **Vários servidores:** cada servidor corre o `app` com o mesmo `.env`, apontado para o mesmo Postgres
   e para um Redis partilhado (Redis gerido). À frente fica um balanceador que verifica `/api/health`.
   As imagens dos eventos estão no volume `uploads` de um só servidor: antes de acrescentar o
   segundo, passe-as para um armazenamento partilhado (Cloudflare R2 ou S3), com outra
   implementação de `Storage` em `src/server/storage.ts`.
   Construa a imagem **uma vez** e use-a em todos os servidores, porque a chave das Server Actions é
   gerada na build. Se construir em cada servidor, defina `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` igual em
   todos (32 bytes em base64).

Os números medidos e o plano para 1 milhão de utilizadores estão em [ARQUITETURA.md](ARQUITETURA.md).

### Alternativa: plataformas geridas

O `Dockerfile` também serve em plataformas como Railway, Render ou Fly.io:

- use o alvo `runner` para a aplicação e o alvo `migrate` como comando antes de cada implantação;
- use um Postgres e um Redis geridos;
- defina as mesmas variáveis do `env.production.example`;
- o `HEALTHCHECK` da imagem usa `/api/health`;
- se a plataforma adormecer os contentores sem tráfego, ponha `JOBS_INTERVAL_SECONDS=0` e um
  agendador externo a chamar `GET /api/cron/jobs` com `Authorization: Bearer $CRON_SECRET` a cada minuto.

## 9. Lista final antes de abrir ao público

- [ ] O domínio abre em https e `/api/health` responde `{"ok":true}`
- [ ] `docker compose logs app` não mostra erros de configuração; os avisos foram lidos
- [ ] Criar conta → chega o e-mail de confirmação (e não vai para o spam)
- [ ] "Esqueceu-se da palavra-passe?" → chega o e-mail e o link funciona
- [ ] Inscrição paga com Multicaixa Express real, de valor baixo → confirmada e recibo por e-mail
- [ ] Reembolso dessa inscrição → dinheiro devolvido e e-mail de reembolso
- [ ] Mapa de eventos com os mosaicos do fornecedor contratado
- [ ] Um erro de teste chega ao Sentry
- [ ] Cópia de segurança criada em `deploy/backups/` e copiada para fora do servidor; uma restauração testada
- [ ] Dados da empresa preenchidos em `src/lib/legal.ts` (aparecem também nas faturas); Termos e Política revistos por um advogado
- [ ] Faturas: taxa de IVA e regime confirmados com o contabilista (`INVOICE_VAT_PERCENT`); programa de faturação certificado pela AGT ligado (`INVOICING_PROVIDER`) ou faturas internas lançadas nele à mão
- [ ] Monitor de disponibilidade a vigiar `/api/health`
