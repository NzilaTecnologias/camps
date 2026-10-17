import type { Instrumentation } from "next";

/**
 * Arranque do servidor. Com JOBS_INTERVAL_SECONDS, este servidor corre o trabalho de fundo
 * (pagamentos, reembolsos, estatísticas) de x em x segundos. Com vários servidores podem todos
 * tê-lo ligado: um bloqueio no Redis (kv.ts) deixa só um trabalhar de cada vez.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const seconds = Number(process.env.JOBS_INTERVAL_SECONDS);
  if (!(seconds > 0)) return;

  const { runJobs } = await import("./server/jobs");
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const report = await runJobs();
      if (report.ran && (report.payments || report.refunds || report.expired)) {
        console.log(JSON.stringify({ level: "info", msg: "jobs", ...report }));
      }
    } catch (error) {
      console.error(JSON.stringify({ level: "error", msg: "jobs falharam", error: String(error) }));
    } finally {
      running = false;
    }
  };
  // O primeiro arranque espera um pouco para não competir com o aquecimento do servidor.
  setTimeout(tick, 10_000).unref();
  setInterval(tick, seconds * 1000).unref();
}

/** Erros do servidor numa linha JSON, fácil de recolher por um serviço de registos (Sentry, Datadog…). */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  console.error(
    JSON.stringify({
      level: "error",
      msg: error instanceof Error ? error.message : String(error),
      digest: typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined,
      method: request.method,
      path: request.path,
      route: context.routePath,
      kind: context.routerKind,
    }),
  );
};
