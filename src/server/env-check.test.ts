import { describe, expect, it } from "vitest";
import { checkProductionEnv } from "./env-check";

const good = {
  DATABASE_URL: "postgres://camps@db/camps",
  APP_URL: "https://camps.ao",
  RESEND_API_KEY: "re_123",
  EMAIL_FROM: "Camps <nao-responder@camps.ao>",
  JOBS_INTERVAL_SECONDS: "30",
  PAYMENT_SECRETS_KEY: Buffer.alloc(32, 7).toString("base64"),
  PROXYPAY_TOKEN: "t",
  PROXYPAY_POS_ID: "1",
  PROXYPAY_API_URL: "https://api.proxypay.co.ao",
  REDIS_URL: "redis://redis:6379",
  NEXT_PUBLIC_MAP_TILE_URL: "https://api.maptiler.com/x/{z}/{x}/{y}.png",
  PLATFORM_ADMIN_EMAILS: "admin@camps.ao",
  SENTRY_DSN: "https://k@o1.ingest.sentry.io/1",
};

describe("checkProductionEnv", () => {
  it("aceita uma configuração completa", () => {
    expect(checkProductionEnv(good).errors).toEqual([]);
  });

  it("recusa o simulador, http e a falta da Resend", () => {
    const { errors } = checkProductionEnv({ ...good, PAYMENTS_SIMULATOR: "1", APP_URL: "http://camps.ao", RESEND_API_KEY: "" });
    expect(errors).toHaveLength(3);
    expect(errors.join(" ")).toMatch(/PAYMENTS_SIMULATOR/);
    expect(errors.join(" ")).toMatch(/https/);
    expect(errors.join(" ")).toMatch(/RESEND_API_KEY/);
  });

  it("exige quem trate da tarefa de fundo e um CRON_SECRET longo", () => {
    expect(checkProductionEnv({ ...good, JOBS_INTERVAL_SECONDS: "0" }).errors).toHaveLength(1);
    expect(checkProductionEnv({ ...good, JOBS_INTERVAL_SECONDS: "0", CRON_SECRET: "curto" }).errors).toHaveLength(1);
    expect(checkProductionEnv({ ...good, JOBS_INTERVAL_SECONDS: "0", CRON_SECRET: "x".repeat(40) }).errors).toEqual([]);
  });

  it("avisa sem bloquear quando falta o Redis, o mapa ou os pagamentos", () => {
    const { errors, warnings } = checkProductionEnv({ ...good, REDIS_URL: "", NEXT_PUBLIC_MAP_TILE_URL: "", PROXYPAY_TOKEN: "" });
    expect(errors).toEqual([]);
    expect(warnings.join(" ")).toMatch(/REDIS_URL/);
    expect(warnings.join(" ")).toMatch(/MAP_TILE/);
    expect(warnings.join(" ")).toMatch(/pagamento/);
  });
});
