// Teste de carga simples, sem dependências: N clientes a pedir o mesmo URL durante T segundos.
// Uso: node scripts/load-test.mjs <url> [clientes=200] [segundos=20] [--pg=postgres://…]
// Mostra quantas consultas a base de dados recebeu: em desenvolvimento pelo /api/health; com --pg,
// pelas transações contadas pelo próprio Postgres (serve também para a build de produção).
import pg from "pg";

const pgUrl = process.argv.find((arg) => arg.startsWith("--pg="))?.slice(5);
const [url, clients = "200", seconds = "20"] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
if (!url) {
  console.log("Uso: node scripts/load-test.mjs <url> [clientes] [segundos]");
  process.exit(1);
}
const origin = new URL(url).origin;
async function queries() {
  if (pgUrl) {
    const client = new pg.Client({ connectionString: pgUrl });
    await client.connect();
    const { rows } = await client.query("SELECT xact_commit + xact_rollback AS n FROM pg_stat_database WHERE datname = current_database()");
    await client.end();
    return Number(rows[0].n);
  }
  return (await (await fetch(`${origin}/api/health`)).json()).queries;
}

const latencies = [];
let errors = 0;
const statuses = {};
const before = await queries();
const end = Date.now() + Number(seconds) * 1000;

async function client() {
  while (Date.now() < end) {
    const started = performance.now();
    try {
      const response = await fetch(url, { headers: { "x-forwarded-for": `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}` } });
      await response.arrayBuffer();
      statuses[response.status] = (statuses[response.status] ?? 0) + 1;
      if (response.status >= 500) errors++;
    } catch {
      errors++;
    }
    latencies.push(performance.now() - started);
  }
}

await Promise.all(Array.from({ length: Number(clients) }, client));
const after = await queries();
latencies.sort((a, b) => a - b);
const pct = (p) => latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))]?.toFixed(0);
const total = latencies.length;
console.log(`${url}`);
console.log(`  ${clients} clientes, ${seconds} s: ${total} pedidos (${(total / Number(seconds)).toFixed(0)}/s), erros: ${errors}, estados: ${JSON.stringify(statuses)}`);
console.log(`  latência p50 ${pct(50)} ms · p95 ${pct(95)} ms · p99 ${pct(99)} ms`);
if (typeof before === "number" && typeof after === "number") {
  const label = pgUrl ? "transações no Postgres" : "consultas à base de dados";
  console.log(`  ${label}: ${after - before} (${((after - before) / Math.max(1, total)).toFixed(3)} por pedido)`);
}
