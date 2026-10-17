// Mede as consultas mais pesadas numa base com volume (ver seed-scale.ts) e mostra se usam índices.
// Uso: DATABASE_URL=... npx tsx scripts/explain.ts
import "dotenv/config";
import { prisma } from "@/lib/db";
import { refreshCommunityStats } from "@/server/stats";

async function timed<T>(label: string, run: () => Promise<T>) {
  const started = performance.now();
  const result = await run();
  console.log(`${label}: ${(performance.now() - started).toFixed(0)} ms`);
  return result;
}

async function plan(label: string, sql: string) {
  await prisma.$executeRawUnsafe("ANALYZE");
  const rows = await prisma.$queryRawUnsafe<{ "QUERY PLAN": string }[]>(`EXPLAIN (ANALYZE, BUFFERS OFF) ${sql}`);
  const lines = rows.map((row) => row["QUERY PLAN"]);
  const scans = lines.filter((line) => /Scan|Execution Time/.test(line)).map((line) => line.trim().replace(/\s+\(cost.*?\)/, ""));
  console.log(`\n${label}\n  ${scans.slice(0, 6).join("\n  ")}`);
}

async function main() {
  await timed("recalcular rankings e popularidade (tarefa de fundo)", refreshCommunityStats);
  await timed("lista de eventos (próximos, página 1)", () =>
    prisma.event.findMany({ where: { status: "PUBLISHED", endsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 24 }),
  );
  await timed("pesquisa de eventos 'Luanda'", () =>
    prisma.event.findMany({ where: { status: "PUBLISHED", name: { contains: "Luanda", mode: "insensitive" } }, take: 24 }),
  );
  await timed("ranking de academias (página 1)", () => prisma.academy.findMany({ where: { rank: { not: null } }, orderBy: { rank: "asc" }, take: 48 }));
  await timed("pesquisa de atletas 'Kiala 12'", () =>
    prisma.athleteProfile.findMany({
      where: { AND: [{ lastName: { contains: "Kiala", mode: "insensitive" } }, { lastName: { contains: "12", mode: "insensitive" } }] },
      take: 60,
    }),
  );
  await plan("Plano: pesquisa por nome de evento", `SELECT id FROM "Event" WHERE name ILIKE '%Luanda 1%' LIMIT 24`);
  await plan("Plano: pesquisa por apelido de atleta", `SELECT id FROM "AthleteProfile" WHERE "lastName" ILIKE '%Kiala 123%' LIMIT 60`);
  await plan("Plano: inscrições pagas de um evento", `SELECT count(*) FROM "Registration" WHERE "eventId" = 'levt00000064' AND status = 'PAID'`);
  await plan("Plano: inscrições de um atleta", `SELECT id FROM "Registration" WHERE "athleteId" = 'lath000003e8'`);
  await prisma.$disconnect();
}

main();
