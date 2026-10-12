import "dotenv/config";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { createBracket, reportResult } from "@/server/brackets";
import { adjustScore, openScoreboard } from "@/server/scoreboard";

const DAY = 24 * 60 * 60 * 1000;

const ACADEMIES = ["Kimura Luanda", "Gracie Barra Angola", "Checkmat Talatona", "Palanca BJJ", "Benguela Fight Team"];
const FIRST_NAMES = ["Edson", "Mateus", "Nelson", "Gelson", "Adilson", "Kiluanji", "Hélder", "André", "Zola", "Wilson"];
const LAST_NAMES = ["Domingos", "Kiala", "Neto", "dos Santos", "Manuel", "Cassule", "Tchipilica", "Van-Dúnem", "Gomes", "Paulo"];

async function main() {
  // Dados de demonstração: recomeça do zero a cada execução.
  await prisma.bracket.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.event.deleteMany();
  await prisma.athleteProfile.deleteMany();
  await prisma.academy.deleteMany();
  await prisma.organizerMember.deleteMany();
  await prisma.organizer.deleteMany();
  await prisma.user.deleteMany();

  const owner = await prisma.user.create({
    // Conta de demonstração, só para desenvolvimento local.
    data: {
      email: "organizador@camps.local",
      name: "Organizador Demo",
      passwordHash: await hashPassword("camps-demo"),
    },
  });

  const organizer = await prisma.organizer.create({
    data: {
      name: "Liga Camps",
      slug: "liga-camps",
      members: { create: { userId: owner.id, role: "OWNER" } },
    },
  });

  const now = Date.now();
  const event = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      slug: "copa-camps-2026",
      name: "Copa Camps de Jiu-Jitsu 2026",
      description: "Evento de demonstração com categorias adulto faixa azul.",
      venue: "Pavilhão Multiusos do Kilamba",
      city: "Luanda",
      country: "AO",
      startsAt: new Date(now + 30 * DAY),
      endsAt: new Date(now + 30 * DAY + 10 * 60 * 60 * 1000),
      registrationOpensAt: new Date(now - 30 * DAY),
      registrationClosesAt: new Date(now + 23 * DAY),
      status: "PUBLISHED",
      mats: { create: [{ name: "Área 1", sortOrder: 1 }, { name: "Área 2", sortOrder: 2 }] },
    },
  });

  const academies = await Promise.all(
    ACADEMIES.map((name) => prisma.academy.create({ data: { name, country: "AO" } })),
  );

  const divisions = [
    { weightClass: "Leve", maxWeightKg: 76, athletes: 8, type: "SINGLE_ELIMINATION" as const },
    { weightClass: "Médio", maxWeightKg: 82.3, athletes: 5, type: "SINGLE_ELIMINATION" as const },
    { weightClass: "Meio-pesado", maxWeightKg: 88.3, athletes: 3, type: "ROUND_ROBIN" as const },
  ];

  let athleteIndex = 0;
  for (const spec of divisions) {
    const division = await prisma.division.create({
      data: {
        eventId: event.id,
        name: `Adulto Masculino Azul ${spec.weightClass}`,
        gender: "MALE",
        ageGroup: "Adulto",
        minAge: 18,
        belt: "Azul",
        weightClass: spec.weightClass,
        maxWeightKg: spec.maxWeightKg,
        priceCents: 1_500_000, // 15 000 Kz
      },
    });

    for (let i = 0; i < spec.athletes; i++, athleteIndex++) {
      const athlete = await prisma.athleteProfile.create({
        data: {
          userId: owner.id,
          firstName: FIRST_NAMES[athleteIndex % FIRST_NAMES.length],
          lastName: LAST_NAMES[(athleteIndex * 3) % LAST_NAMES.length],
          birthDate: new Date(1995 + (athleteIndex % 8), athleteIndex % 12, 10),
          gender: "MALE",
          country: "AO",
          belt: "Azul",
          academyId: academies[athleteIndex % academies.length].id,
        },
      });
      await prisma.registration.create({
        data: {
          eventId: event.id,
          divisionId: division.id,
          athleteId: athlete.id,
          registeredById: owner.id,
          status: "PAID",
          priceCents: division.priceCents,
        },
      });
    }

    await createBracket(division.id, spec.type);
  }

  // Deixa a primeira categoria com a primeira rodada já disputada.
  const firstRound = await prisma.match.findMany({
    where: { bracket: { division: { eventId: event.id, weightClass: "Leve" } }, round: 1, status: "READY" },
    orderBy: { position: "asc" },
  });
  for (const match of firstRound) {
    await reportResult(match.id, match.redId as string, { method: "Pontos", redScore: 4, blueScore: 2 });
  }

  // E uma semifinal a meio no placar da Área 1, para os ecrãs de placar terem o que mostrar.
  const semifinal = await prisma.match.findFirstOrThrow({
    where: { bracket: { division: { eventId: event.id, weightClass: "Leve" } }, round: 2, status: "READY" },
    orderBy: { position: "asc" },
  });
  const mat = await prisma.mat.findFirstOrThrow({ where: { eventId: event.id, name: "Área 1" } });
  await openScoreboard(owner.id, semifinal.id, mat.id, 300);
  await adjustScore(owner.id, semifinal.id, "red", "points", 2);
  await adjustScore(owner.id, semifinal.id, "blue", "advantages", 1);

  console.log(`Seed concluído: ${event.name} (/events/${event.slug})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
