// Dia de prova com vários eventos em simultâneo: espectadores a seguir os placares de um evento
// (um pedido por segundo com todas as áreas dele, como a página do evento) enquanto as mesas
// alteram pontuações. Mede o débito, a carga no Postgres e quanto tempo uma pontuação nova
// demora a chegar aos espectadores.
// Uso: node scripts/load-test-live.mjs <origem> <DATABASE_URL> [clientes=500] [segundos=30]
// Precisa de áreas em direto (scripts/seed-live.ts). NUNCA correr numa base com dados reais:
// altera pontuações.
import pg from "pg";

const [origin, databaseUrl, clients = "500", seconds = "30"] = process.argv.slice(2);
if (!origin || !databaseUrl) {
  console.log("Uso: node scripts/load-test-live.mjs <origem> <DATABASE_URL> [clientes] [segundos]");
  process.exit(1);
}

const db = new pg.Client({ connectionString: databaseUrl });
await db.connect();
const { rows: mats } = await db.query(
  `SELECT m.id, m."eventId", m."currentMatchId" FROM "Mat" m JOIN "Event" e ON e.id = m."eventId"
    WHERE m."isLive" AND m."currentMatchId" IS NOT NULL AND e.status = 'PUBLISHED' ORDER BY m."eventId", m."sortOrder"`,
);
const events = Object.values(
  mats.reduce((acc, mat) => ((acc[mat.eventId] ??= []).push(mat), acc), {}),
);
console.log(`${events.length} eventos em direto, ${mats.length} áreas`);

const transactions = async () =>
  Number((await db.query("SELECT xact_commit + xact_rollback AS n FROM pg_stat_database WHERE datname = current_database()")).rows[0].n);

// Pontuação escrita por área (matchId → { score, writtenAt }), para medir quando os espectadores a veem.
const written = new Map();
const delays = [];
const end = Date.now() + Number(seconds) * 1000;

async function writer() {
  // De 2 em 2 s, cada área marca um ponto (como as mesas de placar a trabalhar).
  while (Date.now() < end) {
    for (const mat of mats) {
      const { rows } = await db.query(`UPDATE "Match" SET "redScore" = "redScore" + 1 WHERE id = $1 RETURNING "redScore"`, [mat.currentMatchId]);
      written.set(mat.currentMatchId, { score: rows[0].redScore, writtenAt: Date.now(), seen: false });
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

const latencies = [];
let errors = 0;
const statuses = {};
async function viewer() {
  while (Date.now() < end) {
    const event = events[Math.floor(Math.random() * events.length)];
    const ids = event.map((mat) => mat.id).sort();
    const started = performance.now();
    try {
      const response = await fetch(`${origin}/api/scoreboards?mats=${ids.join(",")}`, {
        headers: { "x-forwarded-for": `10.1.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}` },
      });
      statuses[response.status] = (statuses[response.status] ?? 0) + 1;
      if (response.ok) {
        const { mats: states } = await response.json();
        for (const state of Object.values(states)) {
          const board = state?.scoreboard;
          const write = board && written.get(board.matchId);
          if (write && !write.seen && board.red.points >= write.score) {
            write.seen = true;
            delays.push(Date.now() - write.writtenAt);
          }
        }
      } else errors++;
    } catch {
      errors++;
    }
    latencies.push(performance.now() - started);
  }
}

const before = await transactions();
await Promise.all([writer(), ...Array.from({ length: Number(clients) }, viewer)]);
const after = await transactions();
await db.end();

const pct = (list, p) => {
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]?.toFixed(0);
};
const total = latencies.length;
console.log(`${clients} espectadores em simultâneo, ${seconds} s: ${total} pedidos (${(total / Number(seconds)).toFixed(0)}/s, cada um com as ${events[0].length} áreas de um evento)`);
console.log(`  erros: ${errors}, estados: ${JSON.stringify(statuses)}`);
console.log(`  latência p50 ${pct(latencies, 50)} ms · p95 ${pct(latencies, 95)} ms · p99 ${pct(latencies, 99)} ms`);
console.log(`  transações no Postgres: ${after - before} (${((after - before) / Number(seconds)).toFixed(0)}/s, incluindo as escritas das mesas)`);
console.log(`  pontuação nova até chegar aos espectadores: p50 ${pct(delays, 50)} ms · p95 ${pct(delays, 95)} ms · máx ${pct(delays, 100)} ms (${delays.length} medições)`);
