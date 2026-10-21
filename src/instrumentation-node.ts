// Arranque no runtime Node.js (importado por instrumentation.ts só nesse runtime, para não entrar
// no bundle Edge).

/** Em produção, variáveis em falta ou perigosas impedem o arranque (src/server/env-check.ts). */
async function enforceProductionEnv() {
  // SKIP_ENV_CHECK=1 deixa arrancar à mesma, para testar a imagem fora da produção.
  if (process.env.NODE_ENV !== "production" || process.env.SKIP_ENV_CHECK === "1") return;
  const { checkProductionEnv } = await import("./server/env-check");
  const { errors, warnings } = checkProductionEnv();
  for (const warning of warnings) console.warn(JSON.stringify({ level: "warn", msg: `configuração: ${warning}` }));
  if (errors.length) {
    for (const error of errors) console.error(JSON.stringify({ level: "error", msg: `configuração: ${error}` }));
    // Lançar um erro aqui só faz cada pedido responder 500; sair deixa claro que a implantação
    // falhou (o Docker mostra o contentor a reiniciar e os registos dizem porquê).
    process.exit(1);
  }
}

/**
 * Com JOBS_INTERVAL_SECONDS, este servidor corre o trabalho de fundo (pagamentos, reembolsos,
 * e-mails, estatísticas) de x em x segundos. Com vários servidores podem todos tê-lo ligado:
 * um bloqueio no Redis (kv.ts) deixa só um trabalhar de cada vez.
 */
function startJobs() {
  const seconds = Number(process.env.JOBS_INTERVAL_SECONDS);
  if (!(seconds > 0)) return;

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const { runJobs } = await import("./server/jobs");
      const report = await runJobs();
      if (report.ran && (report.payments || report.refunds || report.expired || report.emails)) {
        console.log(JSON.stringify({ level: "info", msg: "jobs", ...report }));
      }
    } catch (error) {
      console.error(JSON.stringify({ level: "error", msg: "jobs falharam", error: String(error) }));
      const { reportError } = await import("./server/error-report");
      await reportError(error, { tags: { source: "jobs" } });
    } finally {
      running = false;
    }
  };
  // O primeiro arranque espera um pouco para não competir com o aquecimento do servidor.
  setTimeout(tick, 10_000).unref();
  setInterval(tick, seconds * 1000).unref();
}

export async function registerNode() {
  await enforceProductionEnv();
  startJobs();
}
