import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { normalizeColor, planActive, premiumActive, RANKING_POINTS, type FederationPlanName } from "@/lib/federation-rules";
import { UTC_OFFSET } from "@/lib/format";
import { slugify } from "@/lib/slug";
import { SPORT_NAMES } from "@/lib/sports";
import { computeStatement, normalizeAngolanIban } from "@/lib/statement";
import { isPlatformAdmin } from "./billing-config";

// Plano Federação: página própria, organizadores e academias filiadas, filiação individual paga,
// ranking e notícias. As funções de gestão recebem o utilizador e só mexem em federações de que
// ele é membro; as leituras públicas só mostram federações com o plano em dia.

export const federationTag = (slug: string) => `federation:${slug}`;

const RESERVED_SLUGS = new Set(["admin", "api", "new", "nova"]);

async function uniqueSlug(name: string) {
  const root = slugify(name) || "federacao";
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    if (RESERVED_SLUGS.has(candidate)) continue;
    if (!(await prisma.federation.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
  }
}

function parseDay(value: string, label: string): Date {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T23:59:59${UTC_OFFSET}`) : new Date(NaN);
  if (Number.isNaN(date.getTime())) throw new UserError(`Indique ${label}`);
  return date;
}

// ---------- Gestão (membros da federação) ----------

export function listMyFederations(userId: string) {
  return prisma.federation.findMany({
    where: { members: { some: { userId } } },
    orderBy: { name: "asc" },
    include: { _count: { select: { events: true, academies: true, memberships: { where: { status: "ACTIVE" } } } } },
  });
}

export async function createFederation(userId: string, input: { name: string; sport: string }) {
  const name = input.name.trim();
  if (name.length < 3 || name.length > 120) throw new UserError("Indique o nome da federação");
  if (!SPORT_NAMES.includes(input.sport)) throw new UserError("Escolha a modalidade");
  return prisma.federation.create({
    data: { name, sport: input.sport, slug: await uniqueSlug(name), members: { create: { userId } } },
  });
}

/** Federação de que o utilizador é membro, para o painel; partilhada pelo layout e pelas páginas. */
export const getFederationWorkspace = cache(async (userId: string, federationId: string) => {
  return prisma.federation.findFirst({ where: { id: federationId, members: { some: { userId } } } });
});

async function requireFederation(userId: string, federationId: string, needs?: "active" | "premium") {
  const federation = await getFederationWorkspace(userId, federationId);
  if (!federation) throw new UserError("Federação não encontrada");
  if (needs === "active" && !planActive(federation)) {
    throw new UserError("Esta funcionalidade precisa de um plano ativo. Fale com a Camps para o ativar.");
  }
  if (needs === "premium" && !premiumActive(federation)) {
    throw new UserError("Esta funcionalidade faz parte do plano Premium");
  }
  return federation;
}

export async function updateFederationSettings(
  userId: string,
  federationId: string,
  input: { name: string; sport: string; description: string; color: string },
) {
  const federation = await requireFederation(userId, federationId);
  const name = input.name.trim();
  if (name.length < 3 || name.length > 120) throw new UserError("Indique o nome da federação");
  if (!SPORT_NAMES.includes(input.sport)) throw new UserError("Escolha a modalidade");
  if (input.description.length > 3000) throw new UserError("A apresentação pode ter no máximo 3000 caracteres");
  const color = normalizeColor(input.color);
  if (!color) throw new UserError("Cor inválida");
  await prisma.federation.update({
    where: { id: federation.id },
    data: { name, sport: input.sport, description: input.description.trim() || null, color },
  });
  return federation.slug;
}

export async function getFederationOverview(userId: string, federationId: string) {
  const federation = await requireFederation(userId, federationId);
  const where = { federationId: federation.id };
  const [organizers, academies, activeMembers, pendingMembers, events, posts, plans] = await Promise.all([
    prisma.federationOrganizer.findMany({ where, include: { organizer: { select: { id: true, name: true, slug: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.federationAcademy.findMany({ where, include: { academy: { select: { id: true, name: true } } }, orderBy: { academy: { name: "asc" } } }),
    prisma.membership.count({ where: { ...where, status: "ACTIVE", validUntil: { gte: new Date() } } }),
    prisma.membership.count({ where: { ...where, status: "PENDING" } }),
    prisma.event.findMany({ where, orderBy: { startsAt: "desc" }, take: 50, select: { id: true, name: true, slug: true, startsAt: true, status: true, requiresMembership: true, organizer: { select: { name: true } } } }),
    prisma.federationPost.findMany({ where, orderBy: { publishedAt: "desc" }, take: 50 }),
    prisma.membershipPlan.findMany({ where, orderBy: [{ active: "desc" }, { createdAt: "asc" }], include: { _count: { select: { memberships: { where: { status: "ACTIVE" } } } } } }),
  ]);
  return { federation, organizers, academies, activeMembers, pendingMembers, events, posts, plans };
}

/** Autoriza uma organização (pelo identificador dela) a pôr eventos sob a federação. */
export async function addFederationOrganizer(userId: string, federationId: string, organizerSlug: string) {
  const federation = await requireFederation(userId, federationId, "active");
  const organizer = await prisma.organizer.findUnique({ where: { slug: organizerSlug.trim().toLowerCase() } });
  if (!organizer) throw new UserError("Não há nenhuma organização com esse identificador");
  await prisma.federationOrganizer.upsert({
    where: { federationId_organizerId: { federationId: federation.id, organizerId: organizer.id } },
    update: {},
    create: { federationId: federation.id, organizerId: organizer.id },
  });
}

export async function removeFederationOrganizer(userId: string, federationId: string, organizerId: string) {
  const federation = await requireFederation(userId, federationId);
  await prisma.federationOrganizer.deleteMany({ where: { federationId: federation.id, organizerId } });
}

/** Filia (ou renova) uma academia até uma data. Cria a academia se ainda não existir. */
export async function affiliateAcademy(userId: string, federationId: string, academyName: string, validUntilDay: string) {
  const federation = await requireFederation(userId, federationId, "active");
  const name = academyName.trim();
  if (name.length < 2 || name.length > 120) throw new UserError("Indique o nome da academia");
  const validUntil = parseDay(validUntilDay, "a validade da filiação");
  if (validUntil < new Date()) throw new UserError("A validade tem de ser uma data futura");
  const academy =
    (await prisma.academy.findFirst({ where: { name: { equals: name, mode: "insensitive" } } })) ??
    (await prisma.academy.create({ data: { name, country: "AO" } }));
  await prisma.federationAcademy.upsert({
    where: { federationId_academyId: { federationId: federation.id, academyId: academy.id } },
    update: { validUntil },
    create: { federationId: federation.id, academyId: academy.id, validUntil },
  });
  return federation.slug;
}

export async function removeAcademy(userId: string, federationId: string, academyId: string) {
  const federation = await requireFederation(userId, federationId);
  await prisma.federationAcademy.deleteMany({ where: { federationId: federation.id, academyId } });
  return federation.slug;
}

export async function createMembershipPlan(
  userId: string,
  federationId: string,
  input: { name: string; price: string; months: string; maxAge: string },
) {
  const federation = await requireFederation(userId, federationId, "premium");
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) throw new UserError("Indique o nome do plano");
  const price = Number(input.price.replace(/\s/g, "").replace(",", "."));
  if (!(price >= 0 && price < 10_000_000)) throw new UserError("Preço inválido");
  const months = Number(input.months);
  if (!Number.isInteger(months) || months < 1 || months > 36) throw new UserError("A duração vai de 1 a 36 meses");
  const maxAge = input.maxAge ? Number(input.maxAge) : null;
  if (maxAge !== null && !(Number.isInteger(maxAge) && maxAge > 3 && maxAge < 100)) throw new UserError("Idade máxima inválida");
  await prisma.membershipPlan.create({
    data: { federationId: federation.id, name, priceCents: Math.round(price * 100), months, maxAge },
  });
  return federation.slug;
}

export async function setMembershipPlanActive(userId: string, federationId: string, planId: string, active: boolean) {
  const federation = await requireFederation(userId, federationId);
  await prisma.membershipPlan.updateMany({ where: { id: planId, federationId: federation.id }, data: { active } });
  return federation.slug;
}

export function listFederationMembers(userId: string, federationId: string, q = "") {
  const term = q.trim();
  return prisma.membership.findMany({
    where: {
      federationId,
      federation: { members: { some: { userId } } },
      status: { in: ["ACTIVE", "PENDING", "CANCELLED"] },
      ...(term
        ? {
            OR: [
              { athlete: { firstName: { contains: term, mode: "insensitive" } } },
              { athlete: { lastName: { contains: term, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      plan: { select: { name: true } },
      athlete: { select: { firstName: true, lastName: true, birthDate: true, academy: { select: { name: true } } } },
      payments: {
        where: { status: { in: ["SUCCEEDED", "REFUNDED"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { refund: { include: { requestedBy: { select: { name: true } } } } },
      },
    },
  });
}

export async function createPost(userId: string, federationId: string, title: string, body: string) {
  const federation = await requireFederation(userId, federationId, "premium");
  if (title.trim().length < 3 || title.length > 140) throw new UserError("Indique o título");
  if (body.trim().length < 10 || body.length > 10_000) throw new UserError("Escreva o texto da notícia");
  await prisma.federationPost.create({ data: { federationId: federation.id, title: title.trim(), body: body.trim() } });
  return federation.slug;
}

export async function deletePost(userId: string, federationId: string, postId: string) {
  const federation = await requireFederation(userId, federationId);
  await prisma.federationPost.deleteMany({ where: { id: postId, federationId: federation.id } });
  return federation.slug;
}

export async function updateFederationPayoutDetails(userId: string, federationId: string, holder: string, iban: string) {
  const federation = await requireFederation(userId, federationId);
  const name = holder.trim();
  if (name.length < 3 || name.length > 120) throw new UserError("Indique o titular da conta");
  const normalized = normalizeAngolanIban(iban);
  if (!normalized) throw new UserError("IBAN inválido. Um IBAN angolano tem AO seguido de 23 dígitos.");
  await prisma.federation.update({ where: { id: federation.id }, data: { payoutHolder: name, payoutIban: normalized } });
}

/**
 * Extrato das quotas de filiação: a Camps não cobra taxa sobre elas (recebe a assinatura do plano).
 * Quotas reembolsadas saem do saldo; se já tinham sido transferidas, a federação fica a dever.
 */
export async function getFederationStatement(federationId: string) {
  const [collected, refunded, paidOut, payouts] = await Promise.all([
    prisma.membershipPayment.aggregate({ where: { status: { in: ["SUCCEEDED", "REFUNDED"] }, membership: { federationId } }, _sum: { amountCents: true } }),
    prisma.membershipPayment.aggregate({ where: { status: "REFUNDED", membership: { federationId } }, _sum: { amountCents: true } }),
    prisma.payout.aggregate({ where: { federationId }, _sum: { amountCents: true } }),
    prisma.payout.findMany({ where: { federationId }, orderBy: { paidAt: "desc" } }),
  ]);
  return {
    statement: computeStatement({
      collectedCents: collected._sum.amountCents ?? 0,
      refundedCents: refunded._sum.amountCents ?? 0,
      athletes: 0,
      feePerAthleteCents: 0,
      paidOutCents: paidOut._sum.amountCents ?? 0,
    }),
    payouts,
  };
}

/** Federações (com plano ativo) onde a organização pode pôr os seus eventos. */
export function federationsForOrganizer(organizerId: string) {
  return prisma.federation.findMany({
    where: { organizers: { some: { organizerId } }, plan: { not: null }, planExpiresAt: { gte: new Date() } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, plan: true, planExpiresAt: true },
  });
}

// ---------- Administração Camps ----------

function requireAdmin(email: string) {
  if (!isPlatformAdmin(email)) throw new UserError("Só os administradores da Camps podem fazer isto");
}

export async function listFederationsAdmin(adminEmail: string) {
  requireAdmin(adminEmail);
  const federations = await prisma.federation.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      members: { include: { user: { select: { name: true, email: true } } }, take: 3 },
      _count: { select: { events: true, memberships: { where: { status: "ACTIVE" } } } },
    },
  });
  return Promise.all(
    federations.map(async (federation) => ({ ...federation, ...(await getFederationStatement(federation.id)) })),
  );
}

/** Ativa ou renova o plano depois de a federação pagar a assinatura (fatura e transferência). */
export async function activateFederationPlan(adminEmail: string, federationId: string, plan: string, untilDay: string) {
  requireAdmin(adminEmail);
  if (plan !== "BASIC" && plan !== "PREMIUM" && plan !== "NONE") throw new UserError("Escolha o plano");
  const federation = await prisma.federation.findUnique({ where: { id: federationId } });
  if (!federation) throw new UserError("Federação não encontrada");
  if (plan === "NONE") {
    await prisma.federation.update({ where: { id: federationId }, data: { plan: null, planExpiresAt: null } });
    return federation.slug;
  }
  const until = parseDay(untilDay, "a validade do plano");
  await prisma.federation.update({
    where: { id: federationId },
    data: { plan: plan as FederationPlanName, planExpiresAt: until },
  });
  return federation.slug;
}

export async function recordFederationPayout(adminEmail: string, federationId: string, amount: string, reference: string) {
  requireAdmin(adminEmail);
  const federation = await prisma.federation.findUnique({ where: { id: federationId } });
  if (!federation) throw new UserError("Federação não encontrada");
  const { statement } = await getFederationStatement(federationId);
  const amountCents = Math.round(Number(amount.replace(/\s/g, "").replace(",", ".")) * 100);
  if (!(amountCents > 0)) throw new UserError("Indique o valor transferido");
  if (amountCents > statement.balanceCents) throw new UserError("O valor passa do saldo a transferir a esta federação");
  const ref = reference.trim();
  if (ref.length < 3 || ref.length > 80) throw new UserError("Indique a referência da transferência");
  if (!federation.payoutIban) throw new UserError("A federação ainda não indicou o IBAN");
  await prisma.payout.create({ data: { federationId, amountCents, reference: ref, recordedBy: adminEmail } });
}

// ---------- Leituras públicas ----------

/** Federação pública: só aparece com o plano em dia. */
export async function getPublicFederation(slug: string) {
  "use cache";
  cacheLife("public");
  cacheTag(federationTag(slug));
  const federation = await prisma.federation.findUnique({
    where: { slug },
    select: {
      id: true, name: true, slug: true, sport: true, description: true, color: true, plan: true, planExpiresAt: true,
      _count: { select: { academies: true, events: { where: { status: "PUBLISHED" } } } },
    },
  });
  if (!federation || !planActive(federation)) return null;
  return { ...federation, premium: premiumActive(federation) };
}

export async function listFederationEvents(federationId: string, slug: string) {
  "use cache";
  cacheLife("public");
  cacheTag(federationTag(slug));
  return prisma.event.findMany({
    where: { federationId, status: "PUBLISHED" },
    orderBy: { startsAt: "desc" },
    take: 60,
    select: { id: true, name: true, slug: true, city: true, sport: true, startsAt: true, endsAt: true, requiresMembership: true, organizer: { select: { name: true } } },
  });
}

export async function listFederationAcademies(federationId: string, slug: string) {
  "use cache";
  cacheLife("public");
  cacheTag(federationTag(slug));
  return prisma.federationAcademy.findMany({
    where: { federationId },
    orderBy: { academy: { name: "asc" } },
    include: { academy: { select: { id: true, name: true } } },
  });
}

export async function listFederationPosts(federationId: string, slug: string) {
  "use cache";
  cacheLife("public");
  cacheTag(federationTag(slug));
  return prisma.federationPost.findMany({ where: { federationId }, orderBy: { publishedAt: "desc" }, take: 30 });
}

export async function listMembershipPlans(federationId: string, slug: string) {
  "use cache";
  cacheLife("public");
  cacheTag(federationTag(slug));
  return prisma.membershipPlan.findMany({ where: { federationId, active: true }, orderBy: { priceCents: "asc" } });
}

type RankRow = { id: string; name: string; academy: string | null; points: number; gold: number; silver: number; bronze: number };

/**
 * Ranking da federação num ano: pontos dos pódios (9 / 3 / 1) em eventos publicados sob ela.
 * `kind` = atletas ou academias. Calculado no Postgres, com cache curta.
 */
export async function federationRanking(federationId: string, slug: string, year: number, kind: "athletes" | "academies") {
  "use cache";
  cacheLife("public");
  cacheTag(federationTag(slug));
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));
  const points = Prisma.sql`CASE pl.place WHEN 1 THEN ${RANKING_POINTS[1]} WHEN 2 THEN ${RANKING_POINTS[2]} WHEN 3 THEN ${RANKING_POINTS[3]} ELSE 0 END`;
  const base = Prisma.sql`
      FROM "Placement" pl
      JOIN "Registration" r ON r.id = pl."registrationId"
      JOIN "Event" e ON e.id = r."eventId"
      JOIN "AthleteProfile" ap ON ap.id = r."athleteId"
      LEFT JOIN "Academy" ac ON ac.id = ap."academyId"
     WHERE e."federationId" = ${federationId} AND e.status = 'PUBLISHED'
       AND e."startsAt" >= ${from} AND e."startsAt" < ${to} AND pl.place <= 3`;
  const rows =
    kind === "athletes"
      ? await prisma.$queryRaw<RankRow[]>`
          SELECT ap.id, ap."firstName" || ' ' || ap."lastName" AS name, MAX(ac.name) AS academy,
                 SUM(${points})::int AS points,
                 COUNT(*) FILTER (WHERE pl.place = 1)::int AS gold,
                 COUNT(*) FILTER (WHERE pl.place = 2)::int AS silver,
                 COUNT(*) FILTER (WHERE pl.place = 3)::int AS bronze
          ${base}
          GROUP BY ap.id ORDER BY points DESC, gold DESC, silver DESC, name ASC LIMIT 100`
      : await prisma.$queryRaw<RankRow[]>`
          SELECT ac.id, ac.name, NULL AS academy,
                 SUM(${points})::int AS points,
                 COUNT(*) FILTER (WHERE pl.place = 1)::int AS gold,
                 COUNT(*) FILTER (WHERE pl.place = 2)::int AS silver,
                 COUNT(*) FILTER (WHERE pl.place = 3)::int AS bronze
          ${base} AND ac.id IS NOT NULL
          GROUP BY ac.id ORDER BY points DESC, gold DESC, silver DESC, ac.name ASC LIMIT 100`;
  return rows.map((row, index) => ({ ...row, position: index + 1 }));
}

