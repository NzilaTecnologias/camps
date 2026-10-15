import { prisma } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { DEFAULT_COUNTRY, UTC_OFFSET } from "@/lib/format";
import { slugify } from "@/lib/slug";
import { SPORT_NAMES } from "@/lib/sports";
import { parseLatLng } from "@/lib/geo";
import { createBracket, reportResult, type BracketKind } from "./brackets";
import { divisionDetails } from "./events";

// Toda função daqui recebe o usuário logado e só enxerga o que pertence a um organizador dele.
// Por enquanto qualquer membro pode tudo; os papéis (OWNER/ADMIN/STAFF) ainda não restringem nada.

export const memberOf = (userId: string) => ({ organizer: { members: { some: { userId } } } });


function parseDay(value: string, time: string, label: string): Date {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T${time}${UTC_OFFSET}`) : new Date(NaN);
  if (Number.isNaN(date.getTime())) throw new UserError(`Informe ${label}`);
  return date;
}

function required(value: string, label: string): string {
  if (!value) throw new UserError(`Informe ${label}`);
  return value;
}

async function uniqueSlug(text: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
  const root = slugify(text) || "sem-nome";
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    if (!(await exists(candidate))) return candidate;
  }
}

export function listOrganizers(userId: string) {
  return prisma.organizer.findMany({
    where: { members: { some: { userId } } },
    orderBy: { name: "asc" },
    include: {
      events: {
        orderBy: { startsAt: "desc" },
        include: { _count: { select: { registrations: { where: { status: "PAID" } } } } },
      },
    },
  });
}

export async function createOrganizer(userId: string, name: string) {
  required(name, "o nome da organização");
  const slug = await uniqueSlug(name, async (s) => (await prisma.organizer.count({ where: { slug: s } })) > 0);
  return prisma.organizer.create({
    data: { name, slug, members: { create: { userId, role: "OWNER" } } },
  });
}

export type EventInput = {
  organizerId: string;
  name: string;
  sport: string;
  date: string;
  registrationClosesOn: string;
  venue: string;
  city: string;
  description: string;
  latitude: string;
  longitude: string;
};

export async function createEvent(userId: string, input: EventInput) {
  const membership = await prisma.organizerMember.findUnique({
    where: { organizerId_userId: { organizerId: input.organizerId, userId } },
  });
  if (!membership) throw new UserError("Escolha uma organização sua");

  required(input.name, "o nome do evento");
  if (!SPORT_NAMES.includes(input.sport)) throw new UserError("Escolha a modalidade do evento");
  const location = parseLatLng(input.latitude, input.longitude);
  if (location === "invalid") throw new UserError("Localização no mapa inválida");
  const startsAt = parseDay(input.date, "08:00:00", "a data do evento");
  const endsAt = parseDay(input.date, "20:00:00", "a data do evento");
  const registrationClosesAt = parseDay(input.registrationClosesOn, "23:59:59", "o fim das inscrições");
  if (registrationClosesAt > endsAt) throw new UserError("As inscrições precisam fechar até o dia do evento");

  const slug = await uniqueSlug(input.name, async (s) => (await prisma.event.count({ where: { slug: s } })) > 0);
  return prisma.event.create({
    data: {
      organizerId: input.organizerId,
      slug,
      name: input.name,
      description: input.description || null,
      sport: input.sport,
      latitude: location?.lat ?? null,
      longitude: location?.lng ?? null,
      venue: input.venue || null,
      city: input.city || null,
      country: DEFAULT_COUNTRY,
      startsAt,
      endsAt,
      registrationOpensAt: new Date(),
      registrationClosesAt,
    },
  });
}

export function getManagedEvent(userId: string, eventId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, ...memberOf(userId) },
    include: {
      organizer: { select: { name: true } },
      mats: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          currentMatch: {
            select: {
              id: true,
              red: { select: { athlete: { select: { firstName: true, lastName: true } } } },
              blue: { select: { athlete: { select: { firstName: true, lastName: true } } } },
            },
          },
        },
      },
      divisions: {
        orderBy: [{ gender: "asc" }, { belt: "asc" }, { maxWeightKg: "asc" }],
        include: {
          bracket: { select: { type: true } },
          _count: { select: { registrations: { where: { status: "PAID" } } } },
        },
      },
    },
  });
}

async function requireEvent(userId: string, eventId: string) {
  const event = await prisma.event.findFirst({ where: { id: eventId, ...memberOf(userId) } });
  if (!event) throw new UserError("Evento não encontrado");
  return event;
}

async function requireDivision(userId: string, divisionId: string) {
  const division = await prisma.division.findFirst({
    where: { id: divisionId, event: memberOf(userId) },
    include: { event: true },
  });
  if (!division) throw new UserError("Categoria não encontrada");
  return division;
}

/** Marca (ou apaga, com campos vazios) o ponto do evento no mapa. */
export async function setEventLocation(userId: string, eventId: string, latitude: string, longitude: string) {
  const event = await requireEvent(userId, eventId);
  const location = parseLatLng(latitude, longitude);
  if (location === "invalid") throw new UserError("Localização no mapa inválida");
  await prisma.event.update({
    where: { id: event.id },
    data: { latitude: location?.lat ?? null, longitude: location?.lng ?? null },
  });
}

export async function setEventStatus(userId: string, eventId: string, status: "DRAFT" | "PUBLISHED") {
  const event = await requireEvent(userId, eventId);
  if (event.status === "CANCELLED") throw new UserError("Evento cancelado não pode ser publicado");
  await prisma.event.update({ where: { id: event.id }, data: { status } });
}

export type DivisionInput = {
  gender: string;
  ageGroup: string;
  belt: string;
  weightClass: string;
  maxWeightKg: string;
  price: string;
};

const GENDER_LABEL = { MALE: "Masculino", FEMALE: "Feminino" } as const;

const parseDecimal = (value: string) => Number(value.replace(",", "."));

export async function createDivision(userId: string, eventId: string, input: DivisionInput) {
  const event = await requireEvent(userId, eventId);
  if (input.gender !== "MALE" && input.gender !== "FEMALE") throw new UserError("Informe o sexo da categoria");
  required(input.ageGroup, "a faixa etária");
  required(input.belt, "a faixa");
  required(input.weightClass, "a categoria de peso");

  const maxWeightKg = input.maxWeightKg ? parseDecimal(input.maxWeightKg) : null;
  if (maxWeightKg !== null && !(maxWeightKg > 0 && maxWeightKg < 1000)) {
    throw new UserError("Peso máximo inválido");
  }
  const price = parseDecimal(input.price || "0");
  if (!(price >= 0 && price < 100_000)) throw new UserError("Preço inválido");

  return prisma.division.create({
    data: {
      eventId: event.id,
      name: `${input.ageGroup} ${GENDER_LABEL[input.gender]} ${input.belt} ${input.weightClass}`,
      gender: input.gender,
      ageGroup: input.ageGroup,
      belt: input.belt,
      weightClass: input.weightClass,
      maxWeightKg,
      priceCents: Math.round(price * 100),
    },
  });
}

export function getManagedDivision(userId: string, eventId: string, divisionId: string) {
  return prisma.division.findFirst({
    where: { id: divisionId, eventId, event: memberOf(userId) },
    include: divisionDetails,
  });
}

export type AthleteInput = { firstName: string; lastName: string; birthDate: string; academyName: string };

/** Inscrição manual feita pelo organizador: entra como paga e sem cobrança. */
export async function addAthlete(userId: string, divisionId: string, input: AthleteInput) {
  const division = await requireDivision(userId, divisionId);
  required(input.firstName, "o nome");
  required(input.lastName, "o sobrenome");
  const birthDate = parseDay(input.birthDate, "12:00:00", "a data de nascimento");
  if (birthDate > new Date()) throw new UserError("Data de nascimento inválida");

  await prisma.$transaction(async (tx) => {
    const academy = input.academyName
      ? ((await tx.academy.findFirst({ where: { name: { equals: input.academyName, mode: "insensitive" } } })) ??
        (await tx.academy.create({ data: { name: input.academyName, country: division.event.country } })))
      : null;

    const athlete = await tx.athleteProfile.create({
      data: {
        userId,
        firstName: input.firstName,
        lastName: input.lastName,
        birthDate,
        gender: division.gender,
        country: division.event.country,
        belt: division.belt,
        academyId: academy?.id,
      },
    });
    await tx.registration.create({
      data: {
        eventId: division.eventId,
        divisionId: division.id,
        athleteId: athlete.id,
        registeredById: userId,
        status: "PAID",
        priceCents: 0,
      },
    });
  });
}

export async function generateBracket(userId: string, divisionId: string, type: string) {
  const division = await requireDivision(userId, divisionId);
  if (type !== "SINGLE_ELIMINATION" && type !== "ROUND_ROBIN") throw new UserError("Tipo de chave inválido");
  await createBracket(division.id, type satisfies BracketKind);
}

export async function reportMatchResult(userId: string, matchId: string, winnerId: string) {
  const match = await prisma.match.findFirst({
    where: { id: matchId, bracket: { division: { event: memberOf(userId) } } },
    select: { id: true },
  });
  if (!match) throw new UserError("Luta não encontrada");
  await reportResult(match.id, winnerId);
}
