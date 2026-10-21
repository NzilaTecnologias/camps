import { LEGAL } from "@/lib/legal";

// Conferência das variáveis de ambiente ao arrancar em produção (instrumentation.ts). Uma falha
// grave impede o servidor de arrancar: é melhor a implantação falhar do que abrir ao público
// sem e-mails, a cobrar pelo simulador ou com sessões que não funcionam em https.

export type EnvReport = { errors: string[]; warnings: string[] };

export function checkProductionEnv(env: Record<string, string | undefined> = process.env): EnvReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const has = (name: string) => Boolean(env[name]?.trim());

  if (!has("DATABASE_URL")) errors.push("DATABASE_URL em falta");

  const appUrl = env.APP_URL?.trim();
  if (!appUrl) errors.push("APP_URL em falta (endereço público, ex.: https://camps.ao)");
  else if (!appUrl.startsWith("https://")) {
    errors.push("APP_URL tem de começar por https:// (cookies seguros, callback do Multicaixa, links nos e-mails)");
  }

  if (env.PAYMENTS_SIMULATOR === "1") errors.push("PAYMENTS_SIMULATOR=1 em produção: apagar a variável");

  if (!has("RESEND_API_KEY")) errors.push("RESEND_API_KEY em falta: sem ela ninguém recebe o link para confirmar a conta");
  if (!has("EMAIL_FROM")) errors.push('EMAIL_FROM em falta (ex.: "Camps <nao-responder@camps.ao>")');

  const jobs = Number(env.JOBS_INTERVAL_SECONDS);
  if (!(jobs > 0) && !has("CRON_SECRET")) {
    errors.push("Sem JOBS_INTERVAL_SECONDS nem CRON_SECRET, os pagamentos pendentes e os e-mails em atraso nunca são tratados");
  }
  if (has("CRON_SECRET") && (env.CRON_SECRET ?? "").length < 32) errors.push("CRON_SECRET tem de ter pelo menos 32 caracteres");

  const payments = (has("PROXYPAY_TOKEN") && has("PROXYPAY_POS_ID")) || (has("PAYPAL_CLIENT_ID") && has("PAYPAL_CLIENT_SECRET"));
  if (!payments) warnings.push("Nenhum método de pagamento configurado (ProxyPay ou PayPal): só funcionam eventos gratuitos");
  if (has("PROXYPAY_API_URL") && env.PROXYPAY_API_URL?.includes("sandbox")) warnings.push("PROXYPAY_API_URL aponta para o sandbox");
  if (has("PAYPAL_API_URL") && env.PAYPAL_API_URL?.includes("sandbox")) warnings.push("PAYPAL_API_URL aponta para o sandbox");
  if (has("PAYPAL_CLIENT_ID") && !(Number(env.PAYPAL_EXCHANGE_RATE) > 0)) errors.push("PAYPAL_EXCHANGE_RATE em falta ou inválida");

  if (!has("REDIS_URL")) warnings.push("REDIS_URL em falta: limites e caches valem só por servidor (aceitável com um só servidor)");
  if (env.DATABASE_POOL_MAX === "1") warnings.push("DATABASE_POOL_MAX=1 é o valor do Postgres de desenvolvimento; em produção usar 5–10 ou apagar");
  if (!has("NEXT_PUBLIC_MAP_TILE_URL")) warnings.push("NEXT_PUBLIC_MAP_TILE_URL em falta: o mapa usa o OpenStreetMap, que não permite tráfego intenso");
  if (!has("PLATFORM_ADMIN_EMAILS") || env.PLATFORM_ADMIN_EMAILS?.includes("@camps.local")) {
    warnings.push("PLATFORM_ADMIN_EMAILS não tem os e-mails reais dos administradores");
  }
  if (!has("SENTRY_DSN")) warnings.push("SENTRY_DSN em falta: os erros ficam só nos registos do servidor");
  if (!has("INVOICING_PROVIDER")) {
    warnings.push("Sem programa de faturação certificado (INVOICING_PROVIDER): as faturas saem como documentos internos");
  }
  if (Object.values(LEGAL).some((value) => value.includes("["))) {
    warnings.push("Dados da empresa por preencher em src/lib/legal.ts (Termos e Política de privacidade)");
  }

  return { errors, warnings };
}
