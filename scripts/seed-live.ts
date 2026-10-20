// Põe N eventos "a decorrer" para testes de carga: áreas em direto, cada uma com uma luta no placar.
// Precisa de dados de seed-scale.ts (eventos publicados com categorias e inscrições).
// NUNCA correr numa base com dados reais.
// Uso: DATABASE_URL=... npx tsx scripts/seed-live.ts [eventos=10] [áreas por evento=4]
import "dotenv/config";
import { prisma } from "@/lib/db";
import { createBracket } from "@/server/brackets";

const EVENTS = Number(process.argv[2] ?? 10);
const MATS = Number(process.argv[3] ?? 4);

async function main() {
  const events = await prisma.event.findMany({
    where: { status: "PUBLISHED", endsAt: { gte: new Date() }, slug: { startsWith: "evento-carga-" } },
    orderBy: { startsAt: "asc" },
    take: EVENTS,
    include: { divisions: { take: MATS, include: { _count: { select: { registrations: { where: { status: "PAID" } } } } } } },
  });
  if (events.length < EVENTS) throw new Error(`Só há ${events.length} eventos de carga; corra primeiro seed-scale.ts`);

  for (const event of events) {
    await prisma.mat.deleteMany({ where: { eventId: event.id } });
    for (let m = 0; m < MATS; m++) {
      const division = event.divisions[m % event.divisions.length];
      if (!(await prisma.bracket.findUnique({ where: { divisionId: division.id } }))) {
        await createBracket(division.id, "SINGLE_ELIMINATION");
      }
      const match = await prisma.match.findFirst({
        where: { bracket: { divisionId: division.id }, status: "READY", currentOnMat: null },
        orderBy: [{ round: "asc" }, { position: "asc" }],
      });
      if (!match) throw new Error(`Sem luta pronta na categoria ${division.name}`);
      const mat = await prisma.mat.create({
        data: {
          eventId: event.id,
          name: `Área ${m + 1}`,
          sortOrder: m + 1,
          streamUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          isLive: true,
          currentMatchId: match.id,
        },
      });
      await prisma.match.update({
        where: { id: match.id },
        data: { matId: mat.id, durationSeconds: 300, clockRemainingMs: 300_000, clockStartedAt: new Date() },
      });
    }
    console.log(`${event.name}: ${MATS} áreas em direto`);
  }
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
