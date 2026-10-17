// Dados em massa para testes de carga: muitos utilizadores, atletas, eventos e inscrições.
// NUNCA correr numa base com dados reais: acrescenta milhares de registos fictícios.
// Uso: DATABASE_URL=... npx tsx scripts/seed-scale.ts [utilizadores=100000]
import "dotenv/config";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { refreshCommunityStats } from "@/server/stats";

const USERS = Number(process.argv[2] ?? 100_000);
const ATHLETES_PER_USER = 2;
const ACADEMIES = 400;
const EVENTS = Math.max(50, Math.round(USERS / 33));
const DIVISIONS_PER_EVENT = 8;
const REGISTRATIONS_PER_ATHLETE = 2.5;
const BATCH = 5_000;
const DAY = 24 * 60 * 60 * 1000;
const CITIES = ["Luanda", "Benguela", "Huambo", "Lubango", "Cabinda", "Lobito", "Malanje", "Namibe", "Uíge", "Saurimo"];
const SPORTS = ["Jiu-Jitsu", "Judo", "Karaté", "Taekwondo", "Kickboxing", "Grappling", "Luta", "Boxe", "MMA"];
const FIRST = ["Edson", "Mateus", "Nelson", "Gelson", "Adilson", "Kiluanji", "Hélder", "André", "Zola", "Wilson", "Ana", "Bia", "Nzinga", "Lueji", "Marta", "Rosa"];
const LAST = ["Domingos", "Kiala", "Neto", "dos Santos", "Manuel", "Cassule", "Tchipilica", "Van-Dúnem", "Gomes", "Paulo", "Mbandi", "Lopes"];

const id = (prefix: string, n: number) => `${prefix}${n.toString(36).padStart(8, "0")}`;

async function inBatches<T>(label: string, rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += BATCH) await insert(rows.slice(i, i + BATCH));
  console.log(`${label}: ${rows.length}`);
}

async function main() {
  const started = Date.now();
  const passwordHash = await hashPassword("senha-de-teste-de-carga");
  const now = Date.now();
  const organizer = await prisma.organizer.create({ data: { name: "Liga de Carga", slug: `liga-carga-${now}` } });

  await inBatches(
    "academias",
    Array.from({ length: ACADEMIES }, (_, n) => ({ id: id("lacad", n), name: `Academia Carga ${n + 1}`, country: "AO" })),
    (data) => prisma.academy.createMany({ data, skipDuplicates: true }),
  );

  await inBatches(
    "utilizadores",
    Array.from({ length: USERS }, (_, n) => ({ id: id("luser", n), email: `carga${n}@teste.local`, name: `Utilizador ${n}`, passwordHash })),
    (data) => prisma.user.createMany({ data, skipDuplicates: true }),
  );

  const athleteCount = USERS * ATHLETES_PER_USER;
  await inBatches(
    "atletas",
    Array.from({ length: athleteCount }, (_, n) => ({
      id: id("lath", n),
      userId: id("luser", Math.floor(n / ATHLETES_PER_USER)),
      firstName: FIRST[n % FIRST.length],
      lastName: `${LAST[(n * 7) % LAST.length]} ${n}`,
      birthDate: new Date(Date.UTC(1990 + (n % 15), n % 12, 1 + (n % 27))),
      gender: n % 3 === 0 ? ("FEMALE" as const) : ("MALE" as const),
      country: "AO",
      belt: "Azul",
      academyId: id("lacad", n % ACADEMIES),
    })),
    (data) => prisma.athleteProfile.createMany({ data, skipDuplicates: true }),
  );

  await inBatches(
    "eventos",
    Array.from({ length: EVENTS }, (_, n) => {
      // Metade no passado, metade nos próximos meses.
      const startsAt = new Date(now + (n - EVENTS / 2) * (DAY / 4));
      return {
        id: id("levt", n),
        organizerId: organizer.id,
        slug: `evento-carga-${now}-${n}`,
        name: `${SPORTS[n % SPORTS.length]} Open ${CITIES[n % CITIES.length]} ${n}`,
        city: CITIES[n % CITIES.length],
        country: "AO",
        sport: SPORTS[n % SPORTS.length],
        startsAt,
        endsAt: new Date(startsAt.getTime() + 10 * 60 * 60 * 1000),
        registrationOpensAt: new Date(startsAt.getTime() - 60 * DAY),
        registrationClosesAt: new Date(startsAt.getTime() - DAY),
        status: "PUBLISHED" as const,
      };
    }),
    (data) => prisma.event.createMany({ data, skipDuplicates: true }),
  );

  await inBatches(
    "categorias",
    Array.from({ length: EVENTS * DIVISIONS_PER_EVENT }, (_, n) => ({
      id: id("ldiv", n),
      eventId: id("levt", Math.floor(n / DIVISIONS_PER_EVENT)),
      name: `Adulto ${n % 2 ? "Feminino" : "Masculino"} Azul Peso ${n % DIVISIONS_PER_EVENT}`,
      gender: n % 2 ? ("FEMALE" as const) : ("MALE" as const),
      ageGroup: "Adulto",
      belt: "Azul",
      weightClass: `Peso ${n % DIVISIONS_PER_EVENT}`,
      maxWeightKg: 60 + (n % DIVISIONS_PER_EVENT) * 6,
      priceCents: 1_000_000,
    })),
    (data) => prisma.division.createMany({ data, skipDuplicates: true }),
  );

  // Cada atleta inscrito em 2 ou 3 categorias diferentes; ~10% ficam por pagar.
  const registrations: { id: string; eventId: string; divisionId: string; athleteId: string; registeredById: string; status: "PAID" | "INCOMPLETE"; priceCents: number }[] = [];
  const totalDivisions = EVENTS * DIVISIONS_PER_EVENT;
  for (let a = 0; a < athleteCount; a++) {
    const count = a % 2 ? 3 : 2;
    for (let k = 0; k < count && registrations.length < athleteCount * REGISTRATIONS_PER_ATHLETE; k++) {
      const division = (a * 13 + k * 7919) % totalDivisions;
      registrations.push({
        id: id("lreg", registrations.length),
        eventId: id("levt", Math.floor(division / DIVISIONS_PER_EVENT)),
        divisionId: id("ldiv", division),
        athleteId: id("lath", a),
        registeredById: id("luser", Math.floor(a / ATHLETES_PER_USER)),
        status: registrations.length % 10 === 0 ? "INCOMPLETE" : "PAID",
        priceCents: 1_000_000,
      });
    }
  }
  await inBatches("inscrições", registrations, (data) => prisma.registration.createMany({ data, skipDuplicates: true }));

  console.log("a calcular rankings…");
  await refreshCommunityStats();
  console.log(`concluído em ${((Date.now() - started) / 1000).toFixed(0)} s`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
