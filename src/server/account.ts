import { prisma } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { requirePassword } from "./auth";

// Direitos do titular dos dados (Lei 22/11, Política de privacidade): exportar e eliminar a conta.

/** Tudo o que a Camps guarda sobre a conta, num objeto que se descarrega em JSON. */
export async function exportUserData(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      createdAt: true,
      emailVerifiedAt: true,
      termsAcceptedAt: true,
      athletes: {
        select: {
          firstName: true,
          lastName: true,
          birthDate: true,
          gender: true,
          country: true,
          belt: true,
          academy: { select: { name: true } },
          memberships: {
            select: {
              status: true,
              priceCents: true,
              validFrom: true,
              validUntil: true,
              createdAt: true,
              federation: { select: { name: true } },
              plan: { select: { name: true } },
              payments: { select: { provider: true, amountCents: true, status: true, createdAt: true, settledAt: true } },
            },
          },
        },
      },
      registrations: {
        select: {
          status: true,
          priceCents: true,
          discountCents: true,
          createdAt: true,
          confirmedAt: true,
          event: { select: { name: true, startsAt: true } },
          division: { select: { name: true } },
          athlete: { select: { firstName: true, lastName: true } },
          placement: { select: { place: true } },
          payments: {
            select: {
              provider: true,
              amountCents: true,
              chargeCurrency: true,
              chargeAmountCents: true,
              status: true,
              createdAt: true,
              settledAt: true,
              refund: { select: { status: true, reason: true, settledAt: true } },
            },
          },
        },
      },
      memberships: { select: { role: true, organizer: { select: { name: true } } } },
      federations: { select: { createdAt: true, federation: { select: { name: true } } } },
      sessions: { select: { createdAt: true, expiresAt: true } },
    },
  });
  return {
    exportadoEm: new Date().toISOString(),
    nota: "Dados pessoais guardados pela Camps sobre esta conta (Lei n.º 22/11). Valores em cêntimos de kwanza.",
    conta: {
      nome: user.name,
      email: user.email,
      criadaEm: user.createdAt,
      emailConfirmadoEm: user.emailVerifiedAt,
      termosAceitesEm: user.termsAcceptedAt,
    },
    atletas: user.athletes,
    inscricoes: user.registrations,
    organizacoes: user.memberships.map((m) => ({ organizacao: m.organizer.name, papel: m.role })),
    federacoes: user.federations.map((f) => ({ federacao: f.federation.name, desde: f.createdAt })),
    sessoesAbertas: user.sessions,
  };
}

/** O que impede a conta de ser eliminada já: organizações e federações que ficariam sem ninguém. */
export async function deletionBlockers(userId: string): Promise<string[]> {
  const [organizers, federations] = await Promise.all([
    prisma.organizerMember.findMany({
      where: { userId, role: "OWNER" },
      select: {
        organizer: {
          select: {
            name: true,
            _count: { select: { events: true, members: { where: { role: "OWNER", userId: { not: userId } } } } },
          },
        },
      },
    }),
    prisma.federationMember.findMany({
      where: { userId },
      select: { federation: { select: { name: true, _count: { select: { members: true } } } } },
    }),
  ]);
  return [
    ...organizers
      .filter(({ organizer }) => organizer._count.events > 0 && organizer._count.members === 0)
      .map(({ organizer }) => `É o único dono da organização "${organizer.name}", que tem eventos. Dê o papel de dono a outra pessoa primeiro.`),
    ...federations
      .filter(({ federation }) => federation._count.members === 1)
      .map(({ federation }) => `É o único gestor da federação "${federation.name}". Acrescente outro gestor primeiro.`),
  ];
}

/**
 * Elimina a conta: apaga os dados pessoais e as sessões, e a conta deixa de poder entrar. Ficam,
 * sem ligação a ela, os registos que a lei ou a história dos eventos exigem: pagamentos (lei fiscal)
 * e os atletas que já competiram (resultados públicos, como diz a Política de privacidade).
 */
export async function deleteAccount(userId: string, password: string, confirmation: string) {
  if (confirmation.trim().toUpperCase() !== "ELIMINAR") throw new UserError('Escreva ELIMINAR para confirmar');
  await requirePassword(userId, password);
  const blockers = await deletionBlockers(userId);
  if (blockers.length) throw new UserError(blockers[0]);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId } }),
    prisma.authToken.deleteMany({ where: { userId } }),
    prisma.organizerMember.deleteMany({ where: { userId } }),
    prisma.federationMember.deleteMany({ where: { userId } }),
    // Atletas que nunca competiram nem se filiaram não fazem parte de nenhum histórico.
    prisma.athleteProfile.deleteMany({ where: { userId, registrations: { none: {} }, memberships: { none: {} } } }),
    prisma.emailOutbox.deleteMany({ where: { to: user.email } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        name: "Conta eliminada",
        email: `eliminada-${userId}@contas.camps.invalid`,
        // Não é um hash válido: nenhuma palavra-passe entra.
        passwordHash: "!",
        emailVerifiedAt: null,
        deletedAt: new Date(),
      },
    }),
  ]);
}
