import "dotenv/config";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { slugify } from "@/lib/slug";
import { createBracket, reportResult } from "@/server/brackets";
import { grantWelcomeCredits, settleDueCredits } from "@/server/credits";
import { adjustScore, openScoreboard } from "@/server/scoreboard";
import { refreshCommunityStats } from "@/server/stats";

const DAY = 24 * 60 * 60 * 1000;

const ACADEMIES = ["Kimura Luanda", "Gracie Barra Angola", "Checkmat Talatona", "Palanca BJJ", "Benguela Fight Team"];
const FIRST_NAMES = ["Edson", "Mateus", "Nelson", "Gelson", "Adilson", "Kiluanji", "Hélder", "André", "Zola", "Wilson"];
const LAST_NAMES = ["Domingos", "Kiala", "Neto", "dos Santos", "Manuel", "Cassule", "Tchipilica", "Van-Dúnem", "Gomes", "Paulo"];

async function main() {
  // Dados de demonstração: recomeça do zero a cada execução.
  await prisma.bracket.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.registration.deleteMany();
  // Apaga também membros, organizações, academias, planos, filiações e notícias (em cascata).
  await prisma.federation.deleteMany();
  await prisma.event.deleteMany();
  await prisma.athleteProfile.deleteMany();
  await prisma.academy.deleteMany();
  await prisma.creditTransaction.deleteMany();
  await prisma.creditPurchase.deleteMany();
  await prisma.paymentAccount.deleteMany();
  await prisma.organizerMember.deleteMany();
  await prisma.organizer.deleteMany();
  await prisma.emailOutbox.deleteMany();
  await prisma.notificationLog.deleteMany();
  await prisma.adminAuditLog.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.invoiceSeries.deleteMany();
  await prisma.user.deleteMany();

  const owner = await prisma.user.create({
    // Conta de demonstração, só para desenvolvimento local.
    data: {
      email: "organizador@camps.local",
      name: "Organizador Demo",
      passwordHash: await hashPassword("camps-demo"),
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date(),
    },
  });

  // Equipa da Camps de demonstração, para a área /admin. O administrador vem de PLATFORM_ADMIN_EMAILS
  // no .env; o financeiro e o suporte têm o papel gravado na conta.
  const staff = [
    { email: "admin@camps.local", name: "Admin Camps", password: "camps-admin", staffRole: null },
    { email: "financeiro@camps.local", name: "Financeiro Camps", password: "camps-financeiro", staffRole: "FINANCE" as const },
    { email: "suporte@camps.local", name: "Suporte Camps", password: "camps-suporte", staffRole: "SUPPORT" as const },
  ];
  for (const member of staff) {
    await prisma.user.create({
      data: {
        email: member.email,
        name: member.name,
        passwordHash: await hashPassword(member.password),
        staffRole: member.staffRole,
        emailVerifiedAt: new Date(),
        termsAcceptedAt: new Date(),
      },
    });
  }

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
      publishedAt: new Date(now - 30 * DAY),
      sport: "Jiu-Jitsu",
      earlyDiscountPercent: 20,
      earlyDiscountEndsAt: new Date(now + 7 * DAY),
      mats: { create: [{ name: "Área 1", sortOrder: 1 }, { name: "Área 2", sortOrder: 2 }] },
      coupons: {
        create: [
          { code: "ACADEMIA10", percentOff: 10 },
          { code: "PALANCA5000", amountOffCents: 500_000, maxUses: 20, expiresAt: new Date(now + 14 * DAY) },
        ],
      },
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
          // O desvio a cada volta dos nomes próprios evita dois atletas com o mesmo nome completo.
          lastName: LAST_NAMES[(athleteIndex * 3 + Math.floor(athleteIndex / FIRST_NAMES.length)) % LAST_NAMES.length],
          birthDate: new Date(1995 + (athleteIndex % 8), athleteIndex % 12, 10),
          gender: "MALE",
          country: "AO",
          belt: "Azul",
          academyId: academies[athleteIndex % academies.length].id,
        },
      });
      // Pagas pelo simulador, para a secção de pagamentos e reembolsos ter conteúdo.
      // As duas primeiras categorias já passaram pela pesagem, todos dentro do peso.
      await prisma.registration.create({
        data: {
          eventId: event.id,
          divisionId: division.id,
          athleteId: athlete.id,
          registeredById: owner.id,
          status: "PAID",
          confirmedAt: new Date(now - (athleteIndex + 1) * DAY),
          priceCents: division.priceCents,
          payments: {
            create: {
              provider: "SIMULATOR",
              providerRef: `sim_seed_${athleteIndex}`,
              amountCents: division.priceCents,
              chargeCurrency: "AOA",
              chargeAmountCents: division.priceCents,
              status: "SUCCEEDED",
              settledAt: new Date(now - (athleteIndex + 1) * DAY),
            },
          },
          ...(spec.type === "SINGLE_ELIMINATION"
            ? { weighIn: { create: { weightKg: spec.maxWeightKg - 1.5 - (i % 3) * 0.4, passed: true } } }
            : {}),
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

  // A categoria em "todos contra todos" fica disputada até ao fim: dá pódio e pontos ao ranking da federação.
  for (let pass = 0; pass < 5; pass++) {
    const ready = await prisma.match.findMany({
      where: { bracket: { division: { eventId: event.id, weightClass: "Meio-pesado" } }, status: "READY" },
      orderBy: [{ round: "asc" }, { position: "asc" }],
    });
    if (ready.length === 0) break;
    for (const match of ready) await reportResult(match.id, match.redId as string, { method: "Finalização", redScore: 6, blueScore: 0 });
  }

  // Federação de demonstração (plano Premium ativo): a Copa Camps decorre sob ela, com academias
  // filiadas, planos de filiação, alguns atletas já filiados e uma notícia. Nome fictício.
  const federation = await prisma.federation.create({
    data: {
      name: "Federação Demo de Jiu-Jitsu de Angola",
      slug: "federacao-demo",
      sport: "Jiu-Jitsu",
      description: "Federação de demonstração da Camps: organiza o circuito nacional, filia academias e atletas e publica o ranking.",
      color: "#0f766e",
      plan: "PREMIUM",
      planExpiresAt: new Date(now + 365 * DAY),
      members: { create: { userId: owner.id } },
      organizers: { create: { organizerId: organizer.id } },
      academies: { create: academies.slice(0, 3).map((academy) => ({ academyId: academy.id, validUntil: new Date(now + 300 * DAY) })) },
      plans: {
        create: [
          { name: "Atleta sénior", priceCents: 500_000, months: 12 },
          { name: "Atleta juvenil", priceCents: 250_000, months: 12, maxAge: 17 },
        ],
      },
      posts: {
        create: {
          title: "Calendário do circuito nacional",
          body: "A primeira etapa do circuito é a Copa Camps de Jiu-Jitsu, no Kilamba. As inscrições estão abertas na página do evento.",
        },
      },
    },
    include: { plans: true },
  });
  await prisma.event.update({ where: { id: event.id }, data: { federationId: federation.id } });
  const seniorPlan = federation.plans.find((plan) => plan.name === "Atleta sénior")!;
  const filiados = await prisma.athleteProfile.findMany({ where: { userId: owner.id }, take: 4, orderBy: { createdAt: "asc" } });
  for (const [index, athlete] of filiados.entries()) {
    const validFrom = new Date(now - (index + 10) * DAY);
    await prisma.membership.create({
      data: {
        federationId: federation.id,
        planId: seniorPlan.id,
        athleteId: athlete.id,
        boughtById: owner.id,
        status: "ACTIVE",
        priceCents: seniorPlan.priceCents,
        validFrom,
        validUntil: new Date(validFrom.getTime() + 365 * DAY),
        payments: {
          create: {
            provider: "SIMULATOR",
            providerRef: `sim_seed_membership_${index}`,
            amountCents: seniorPlan.priceCents,
            chargeCurrency: "AOA",
            chargeAmountCents: seniorPlan.priceCents,
            status: "SUCCEEDED",
            settledAt: validFrom,
          },
        },
      },
    });
  }

  // Outros eventos de demonstração, para a lista de eventos e os filtros terem conteúdo.
  // Nomes e organizações são fictícios.
  const otherOrganizer = await prisma.organizer.create({
    data: {
      name: "Liga Sul de Desportos de Combate",
      slug: "liga-sul",
      members: { create: { userId: owner.id, role: "OWNER" } },
    },
  });
  const demoEvents = [
    { name: "Open de Judo de Benguela", sport: "Judo", city: "Benguela", venue: "Pavilhão Acácias Rubras", inDays: 9, days: 1 },
    { name: "Taça de Karaté do Huambo", sport: "Karaté", city: "Huambo", venue: "Pavilhão Municipal do Huambo", inDays: 16, days: 2 },
    { name: "Grappling Night Talatona", sport: "Grappling", city: "Luanda", venue: "Arena Talatona", inDays: 21, days: 1 },
    { name: "Campeonato de Taekwondo do Lubango", sport: "Taekwondo", city: "Lubango", venue: "Pavilhão da Senhora do Monte", inDays: 38, days: 2 },
    { name: "Kickboxing Cabinda Fight Series", sport: "Kickboxing", city: "Cabinda", venue: "Pavilhão do Tchizo", inDays: 52, days: 1 },
    { name: "Taça de Jiu-Jitsu do Lobito", sport: "Jiu-Jitsu", city: "Lobito", venue: "Pavilhão do Lobito", inDays: -12, days: 1 },
    { name: "Open de Luta Livre de Luanda", sport: "Luta", city: "Luanda", venue: "Pavilhão da Cidadela", inDays: -40, days: 2 },
  ];
  for (const [index, demo] of demoEvents.entries()) {
    const startsAt = new Date(now + demo.inDays * DAY);
    await prisma.event.create({
      data: {
        organizerId: index % 2 === 0 ? otherOrganizer.id : organizer.id,
        slug: slugify(demo.name),
        name: demo.name,
        sport: demo.sport,
        venue: demo.venue,
        city: demo.city,
        country: "AO",
        startsAt,
        endsAt: new Date(startsAt.getTime() + ((demo.days - 1) * 24 + 10) * 60 * 60 * 1000),
        registrationOpensAt: new Date(startsAt.getTime() - 60 * DAY),
        registrationClosesAt: new Date(startsAt.getTime() - 5 * DAY),
        status: "PUBLISHED",
        // Publicados quando abriram as inscrições.
        publishedAt: new Date(startsAt.getTime() - 60 * DAY),
        divisions: {
          create: [
            { name: "Adulto Masculino Absoluto", gender: "MALE", ageGroup: "Adulto", belt: "Todas", weightClass: "Absoluto", priceCents: 1_000_000 },
            { name: "Adulto Feminino Absoluto", gender: "FEMALE", ageGroup: "Adulto", belt: "Todas", weightClass: "Absoluto", priceCents: 1_000_000 },
          ],
        },
      },
    });
  }

  // Créditos: as boas-vindas de cada organização (bloqueadas até à primeira compra) e um acerto
  // de demonstração, já gasto nos atletas confirmados (sem ele, a gestão dos eventos ficava bloqueada).
  for (const { id } of await prisma.organizer.findMany({ select: { id: true } })) {
    await prisma.$transaction(async (tx) => {
      await grantWelcomeCredits(tx, id);
      const { credits } = await tx.organizer.update({ where: { id }, data: { credits: { increment: 500 } }, select: { credits: true } });
      await tx.creditTransaction.create({
        data: { organizerId: id, kind: "ADJUSTMENT", delta: 500, balance: credits, note: "Saldo de demonstração", createdBy: "seed" },
      });
    });
    await settleDueCredits(id);
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

  // Ranking das academias e popularidade dos eventos, que em produção a tarefa de fundo mantém.
  await refreshCommunityStats();
  console.log(`Seed concluído: ${event.name} (/events/${event.slug})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
