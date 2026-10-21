import type { Instrumentation } from "next";

/**
 * Arranque do servidor: confere a configuração de produção e liga o trabalho de fundo
 * (instrumentation-node.ts). O `if` com NEXT_RUNTIME deixa esse código fora do bundle Edge.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation-node");
    await registerNode();
  }
}

/**
 * Erros do servidor: uma linha JSON nos registos e, com SENTRY_DSN, um evento no Sentry.
 * O caminho vai sem a query string, onde podem viajar links de acesso (?token=…).
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const path = request.path.split("?")[0];
  console.error(
    JSON.stringify({
      level: "error",
      msg: error instanceof Error ? error.message : String(error),
      digest: typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined,
      method: request.method,
      path,
      route: context.routePath,
      kind: context.routerKind,
    }),
  );
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { reportError } = await import("./server/error-report");
    await reportError(error, {
      tags: { route: context.routePath, kind: context.routerKind, type: context.routeType },
      request: { method: request.method, url: path },
    });
  }
};
