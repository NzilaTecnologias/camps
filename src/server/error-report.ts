// Envio de erros para o Sentry pela API HTTP (https://develop.sentry.dev/sdk/data-model/envelopes/),
// sem SDK: basta SENTRY_DSN. Sem a variável, os erros ficam só nos registos do servidor.

type Dsn = { endpoint: string; publicKey: string; dsn: string };

let parsed: Dsn | null | undefined;

function dsn(): Dsn | null {
  if (parsed !== undefined) return parsed;
  const raw = process.env.SENTRY_DSN;
  parsed = null;
  if (!raw) return parsed;
  try {
    // https://<chave>@o123.ingest.sentry.io/<projeto>
    const url = new URL(raw);
    const projectId = url.pathname.replace(/^\/+|\/+$/g, "");
    if (!url.username || !projectId) throw new Error("DSN incompleto");
    parsed = { endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/`, publicKey: url.username, dsn: raw };
  } catch (error) {
    console.error(JSON.stringify({ level: "error", msg: "SENTRY_DSN inválido", error: String(error) }));
  }
  return parsed;
}

export function errorReportingEnabled() {
  return dsn() !== null;
}

/** Linhas "at fn (ficheiro:linha:coluna)" do stack do V8, no formato de frames do Sentry. */
export function stackFrames(stack: string | undefined) {
  if (!stack) return [];
  return stack
    .split("\n")
    .slice(1)
    .map((line) => line.trim().match(/^at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map(([, fn, file, line, column]) => ({
      function: fn ?? "?",
      filename: file,
      lineno: Number(line),
      colno: Number(column),
      in_app: !file.includes("node_modules") && !file.startsWith("node:"),
    }))
    .reverse(); // O Sentry quer o frame mais recente no fim.
}

/** Envia um erro ao Sentry. Nunca lança e desiste ao fim de 3 s, para não atrasar o pedido. */
export async function reportError(error: unknown, context: { tags?: Record<string, string | undefined>; extra?: Record<string, unknown>; request?: { method?: string; url?: string } } = {}) {
  const target = dsn();
  if (!target) return;
  const err = error instanceof Error ? error : new Error(String(error));
  const eventId = crypto.randomUUID().replaceAll("-", "");
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;
  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "node",
    level: "error",
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    server_name: process.env.HOSTNAME,
    exception: { values: [{ type: err.name, value: err.message, stacktrace: { frames: stackFrames(err.stack) } }] },
    tags: { ...context.tags, ...(digest ? { digest } : {}) },
    extra: context.extra,
    request: context.request,
  };
  const body = [
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString(), dsn: target.dsn }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");
  try {
    await fetch(target.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${target.publicKey}, sentry_client=camps/1.0`,
      },
      body,
      signal: AbortSignal.timeout(3_000),
    });
  } catch {
    // O erro original já ficou nos registos; não há mais nada a fazer.
  }
}
