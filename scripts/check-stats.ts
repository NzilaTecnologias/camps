// Confere as estatísticas pré-calculadas (server/stats.ts) contra a contagem feita linha a linha.
// Uso: npx tsx scripts/check-stats.ts
import "dotenv/config";
import { prisma } from "@/lib/db";

const pub = { status: "PAID", event: { status: "PUBLISHED" } } as const;

async function main() {
  const academies = await prisma.academy.findMany({
    include: {
      athletes: {
        where: { registrations: { some: pub } },
        select: { registrations: { where: pub, select: { placement: { select: { place: true } } } } },
      },
    },
  });
  const expected = academies
    .filter((academy) => academy.athletes.length > 0)
    .map((academy) => {
      const places = academy.athletes.flatMap((athlete) =>
        athlete.registrations.flatMap((registration) => (registration.placement ? [registration.placement.place] : [])),
      );
      const medal = (place: number) => places.filter((value) => value === place).length;
      return [academy.name, academy.athletes.length, medal(1), medal(2), medal(3)] as const;
    })
    .sort((a, b) => b[2] - a[2] || b[3] - a[3] || b[4] - a[4] || b[1] - a[1] || a[0].localeCompare(b[0]));
  const stored = await prisma.academy.findMany({
    where: { rank: { not: null } },
    orderBy: { rank: "asc" },
    select: { name: true, athleteCount: true, gold: true, silver: true, bronze: true },
  });
  const actual = stored.map((a) => [a.name, a.athleteCount, a.gold, a.silver, a.bronze] as const);
  const academiesOk = JSON.stringify(expected) === JSON.stringify(actual);
  console.log(`academias: ${academiesOk ? "certas" : "DIFERENTES"} (${actual.length})`);
  if (!academiesOk) console.log({ expected, actual });

  const events = await prisma.event.findMany({
    select: { paidRegistrations: true, _count: { select: { registrations: { where: { status: "PAID" } } } } },
  });
  const eventsOk = events.every((event) => event.paidRegistrations === event._count.registrations);
  console.log(`inscrições pagas por evento: ${eventsOk ? "certas" : "DIFERENTES"} (${events.length})`);
  await prisma.$disconnect();
  process.exit(academiesOk && eventsOk ? 0 : 1);
}

main();
