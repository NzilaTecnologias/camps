import { Prisma, type EventStatus, type StaffRole } from "@/generated/prisma/client";
import { can } from "@/lib/admin-permissions";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { isPlatformAdmin } from "../billing-config";
import { checkProductionEnv } from "../env-check";
import { refreshPlanPayment } from "../federation-plan";
import { publishedNow } from "../manage";
import { refreshMembershipPayment } from "../memberships";
import { refreshPayment } from "../registrations";
import { audit, staffRoleFor, type Staff } from "./session";

// Consultas e ações da área de administração. Cada função recebe quem a pede (Staff, já com a
// sessão validada em session.ts), confirma a permissão do papel e regista as escritas.

export const PAGE_SIZE = 50;

function require(staff: Staff, permission: Parameters<typeof can>[1]) {
  if (!can(staff.role, permission)) throw new UserError("O seu papel na equipa não permite fazer isto");
}

const contains = (q: string) => ({ contains: q, mode: "insensitive" as const });
const days = (n: number) => new Date(Date.now() - n * 86_400_000);

// ---------------------------------------------------------------- Painel

export async function dashboard(staff: Staff) {
  const [users, newUsers, suspended, events, upcoming, registrations30, collected30, pendingPayments, failedEmails] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, createdAt: { gte: days(30) } } }),
    prisma.user.count({ where: { suspendedAt: { not: null } } }),
    prisma.event.count({ where: { status: "PUBLISHED" } }),
    prisma.event.count({ where: { status: "PUBLISHED", startsAt: { gte: new Date() } } }),
    prisma.registration.count({ where: { confirmedAt: { gte: days(30) } } }),
    prisma.payment.aggregate({ where: { status: "SUCCEEDED", settledAt: { gte: days(30) } }, _sum: { amountCents: true } }),
    prisma.payment.count({ where: { status: "PENDING" } }),
    prisma.emailOutbox.count({ where: { sentAt: null, nextAttemptAt: null } }),
  ]);
  const recent = can(staff.role, "audit")
    ? await prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 })
    : [];
  return {
    users,
    newUsers,
    suspended,
    events,
    upcoming,
    registrations30,
    collected30: collected30._sum.amountCents ?? 0,
    pendingPayments,
    failedEmails,
    recent,
  };
}

// ---------------------------------------------------------------- Utilizadores

export async function listUsers(staff: Staff, q: string, page: number) {
  require(staff, "users");
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(q ? { OR: [{ name: contains(q) }, { email: contains(q) }] } : {}),
  };
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        emailVerifiedAt: true,
        suspendedAt: true,
        staffRole: true,
        _count: { select: { registrations: true, memberships: true } },
      },
    }),
  ]);
  return { total, users: users.map((user) => ({ ...user, role: staffRoleFor(user) })) };
}

export async function getUserDetail(staff: Staff, userId: string) {
  require(staff, "users");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      emailVerifiedAt: true,
      termsAcceptedAt: true,
      deletedAt: true,
      suspendedAt: true,
      suspendedReason: true,
      staffRole: true,
      memberships: { select: { role: true, organizer: { select: { id: true, name: true, slug: true } } } },
      federations: { select: { federation: { select: { id: true, name: true, slug: true } } } },
      registrations: {
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          id: true,
          status: true,
          priceCents: true,
          createdAt: true,
          event: { select: { name: true, slug: true } },
          division: { select: { name: true } },
          athlete: { select: { firstName: true, lastName: true } },
        },
      },
      _count: { select: { registrations: true, athletes: true } },
    },
  });
  if (!user) return null;
  const [sessions, history] = await Promise.all([
    prisma.session.count({ where: { userId, expiresAt: { gt: new Date() } } }),
    prisma.adminAuditLog.findMany({ where: { targetType: "user", targetId: userId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return { ...user, role: staffRoleFor(user), sessions, history };
}

async function targetUser(staff: Staff, userId: string) {
  require(staff, "users");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw new UserError("Utilizador não encontrado");
  return user;
}

/** Suspende a conta: termina as sessões do site e da administração e impede novas entradas. */
export async function suspendUser(staff: Staff, userId: string, rawReason: string) {
  const user = await targetUser(staff, userId);
  const reason = rawReason.trim();
  if (reason.length < 5 || reason.length > 300) throw new UserError("Indique o motivo da suspensão");
  if (user.id === staff.id) throw new UserError("Não pode suspender a sua própria conta");
  // Só um administrador suspende alguém da equipa.
  if (staffRoleFor(user) && staff.role !== "ADMIN") throw new UserError("Só um administrador pode suspender alguém da equipa");
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { suspendedAt: new Date(), suspendedReason: reason } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.adminSession.deleteMany({ where: { userId: user.id } }),
  ]);
  await audit(staff, "user.suspend", { type: "user", id: user.id }, { reason });
}

export async function reactivateUser(staff: Staff, userId: string) {
  const user = await targetUser(staff, userId);
  await prisma.user.update({ where: { id: user.id }, data: { suspendedAt: null, suspendedReason: null } });
  await audit(staff, "user.reactivate", { type: "user", id: user.id });
}

export async function endUserSessions(staff: Staff, userId: string) {
  const user = await targetUser(staff, userId);
  const { count } = await prisma.session.deleteMany({ where: { userId: user.id } });
  await audit(staff, "user.sessions.end", { type: "user", id: user.id }, { count });
  return count;
}

/** Confirma o e-mail à mão (ex.: o utilizador provou ao apoio que o e-mail é seu). */
export async function verifyUserEmail(staff: Staff, userId: string) {
  const user = await targetUser(staff, userId);
  await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date() } });
  await audit(staff, "user.email.verify", { type: "user", id: user.id });
}

// ---------------------------------------------------------------- Organizações e eventos

export async function listOrganizers(staff: Staff, q: string) {
  require(staff, "organizers");
  return prisma.organizer.findMany({
    where: q ? { OR: [{ name: contains(q) }, { slug: contains(q) }] } : {},
    orderBy: { name: "asc" },
    take: 200,
    select: {
      id: true,
      name: true,
      slug: true,
      payoutIban: true,
      billingNif: true,
      members: { where: { role: "OWNER" }, take: 2, select: { user: { select: { id: true, name: true, email: true } } } },
      _count: { select: { events: true, members: true } },
    },
  });
}

const EVENT_STATUSES: EventStatus[] = ["DRAFT", "PUBLISHED", "CANCELLED"];

export async function listEvents(staff: Staff, q: string, status: string, page: number) {
  require(staff, "events");
  const where: Prisma.EventWhereInput = {
    ...(EVENT_STATUSES.includes(status as EventStatus) ? { status: status as EventStatus } : {}),
    ...(q ? { OR: [{ name: contains(q) }, { city: contains(q) }, { organizer: { name: contains(q) } }] } : {}),
  };
  const [total, events] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where,
      orderBy: { startsAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        slug: true,
        sport: true,
        city: true,
        status: true,
        startsAt: true,
        organizer: { select: { id: true, name: true } },
        _count: { select: { registrations: { where: { status: "PAID" } } } },
      },
    }),
  ]);
  return { total, events };
}

/** Despublica (volta a rascunho) ou cancela um evento, com o motivo no registo de atividade. */
export async function moderateEvent(staff: Staff, eventId: string, status: string, rawReason: string) {
  require(staff, "events.moderate");
  if (status !== "DRAFT" && status !== "CANCELLED" && status !== "PUBLISHED") throw new UserError("Estado inválido");
  const reason = rawReason.trim();
  if (status !== "PUBLISHED" && (reason.length < 5 || reason.length > 300)) throw new UserError("Indique o motivo");
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, slug: true, status: true, publishedAt: true } });
  if (!event) throw new UserError("Evento não encontrado");
  await prisma.event.update({ where: { id: event.id }, data: { status, ...publishedNow(event, status) } });
  await audit(staff, `event.status.${status.toLowerCase()}`, { type: "event", id: event.id }, { from: event.status, reason });
  return event;
}

// ---------------------------------------------------------------- Pagamentos

export type PaymentRow = {
  kind: "registration" | "membership" | "plan";
  id: string;
  provider: string;
  amountCents: number;
  status: string;
  failureReason: string | null;
  createdAt: Date;
  /** Inscrição, filiação ou federação a que o pagamento pertence. */
  ref: string;
  label: string;
};

const PAYMENT_STATUSES = ["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"];

/** Pagamentos de inscrições, quotas e planos, mais recentes primeiro. */
export async function listPayments(staff: Staff, status: string) {
  require(staff, "payments");
  const filter = PAYMENT_STATUSES.includes(status) ? Prisma.sql`WHERE status::text = ${status}` : Prisma.empty;
  return prisma.$queryRaw<PaymentRow[]>`
    SELECT * FROM (
      SELECT 'registration' AS kind, p.id, p.provider::text AS provider, p."amountCents", p.status::text AS status,
             p."failureReason", p."createdAt", p."registrationId" AS ref, e.name AS label
        FROM "Payment" p JOIN "Registration" r ON r.id = p."registrationId" JOIN "Event" e ON e.id = r."eventId"
      UNION ALL
      SELECT 'membership', mp.id, mp.provider::text, mp."amountCents", mp.status::text,
             mp."failureReason", mp."createdAt", mp."membershipId", f.name
        FROM "MembershipPayment" mp JOIN "Membership" m ON m.id = mp."membershipId" JOIN "Federation" f ON f.id = m."federationId"
      UNION ALL
      SELECT 'plan', fp.id, fp.provider::text, fp."amountCents", fp.status::text,
             fp."failureReason", fp."createdAt", fp."federationId", f.name
        FROM "FederationPlanPayment" fp JOIN "Federation" f ON f.id = fp."federationId"
    ) payments ${filter}
    ORDER BY "createdAt" DESC
    LIMIT 200`;
}

/** Pergunta já ao provedor por um pagamento pendente (o mesmo que a tarefa de fundo faz). */
export async function refreshAnyPayment(staff: Staff, kind: string, paymentId: string) {
  require(staff, "payments");
  if (kind === "registration") await refreshPayment(paymentId, { force: true });
  else if (kind === "membership") await refreshMembershipPayment(paymentId, { force: true });
  else if (kind === "plan") await refreshPlanPayment(paymentId, { force: true });
  else throw new UserError("Tipo de pagamento inválido");
  await audit(staff, "payment.refresh", { type: `payment.${kind}`, id: paymentId });
}

// ---------------------------------------------------------------- Faturas

export async function listInvoices(staff: Staff, q: string) {
  require(staff, "finance");
  return prisma.invoice.findMany({
    where: q ? { OR: [{ customerName: contains(q) }, { customerNif: contains(q) }, { customerEmail: contains(q) }] } : {},
    orderBy: { issuedAt: "desc" },
    take: 200,
  });
}

export async function getInvoice(staff: Staff, invoiceId: string) {
  require(staff, "finance");
  return prisma.invoice.findUnique({ where: { id: invoiceId } });
}

// ---------------------------------------------------------------- E-mails

export async function listEmails(staff: Staff, status: string) {
  require(staff, "emails");
  const where: Prisma.EmailOutboxWhereInput =
    status === "failed"
      ? { sentAt: null, nextAttemptAt: null }
      : status === "pending"
        ? { sentAt: null, nextAttemptAt: { not: null } }
        : status === "sent"
          ? { sentAt: { not: null } }
          : {};
  return prisma.emailOutbox.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, to: true, subject: true, attempts: true, lastError: true, sentAt: true, nextAttemptAt: true, createdAt: true, sensitive: true },
  });
}

/** Volta a pôr na fila um e-mail que falhou (a tarefa de fundo envia-o na volta seguinte). */
export async function retryEmail(staff: Staff, emailId: string) {
  require(staff, "emails");
  const email = await prisma.emailOutbox.findUnique({ where: { id: emailId } });
  if (!email || email.sentAt) throw new UserError("E-mail não encontrado ou já enviado");
  if (email.sensitive && !email.html) throw new UserError("Este e-mail tinha um link de acesso e já foi apagado: o utilizador tem de pedir outro");
  await prisma.emailOutbox.update({ where: { id: email.id }, data: { attempts: 0, nextAttemptAt: new Date(), lastError: null } });
  await audit(staff, "email.retry", { type: "email", id: email.id }, { to: email.to });
}

// ---------------------------------------------------------------- Equipa

export async function listStaff(staff: Staff) {
  require(staff, "staff");
  const bootstrap = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const members = await prisma.user.findMany({
    where: { OR: [{ staffRole: { not: null } }, { email: { in: bootstrap } }], deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      staffRole: true,
      suspendedAt: true,
      adminSessions: { where: { expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, ip: true } },
    },
  });
  return members.map((member) => ({ ...member, role: staffRoleFor(member), fromEnv: isPlatformAdmin(member.email) }));
}

const ROLES: StaffRole[] = ["ADMIN", "FINANCE", "SUPPORT"];

/** Dá (ou muda) o papel na equipa a uma conta existente, pelo e-mail. */
export async function setStaffRole(staff: Staff, rawEmail: string, role: string) {
  require(staff, "staff");
  if (!ROLES.includes(role as StaffRole)) throw new UserError("Escolha o papel");
  const email = rawEmail.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) throw new UserError("Não há nenhuma conta com esse e-mail. A pessoa tem de criar conta no site primeiro.");
  if (!user.emailVerifiedAt) throw new UserError("Essa conta ainda não confirmou o e-mail");
  if (user.suspendedAt) throw new UserError("Essa conta está suspensa");
  if (isPlatformAdmin(user.email)) throw new UserError("Essa conta é administradora pela configuração do servidor (PLATFORM_ADMIN_EMAILS)");
  if (user.id === staff.id) throw new UserError("Não pode mudar o seu próprio papel");
  await prisma.user.update({ where: { id: user.id }, data: { staffRole: role as StaffRole } });
  await audit(staff, "staff.role", { type: "user", id: user.id }, { from: user.staffRole, to: role });
}

/** Tira alguém da equipa: perde logo o acesso e as sessões de administração. */
export async function removeStaff(staff: Staff, userId: string) {
  require(staff, "staff");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.staffRole) throw new UserError("Esta conta não é da equipa");
  if (user.id === staff.id) throw new UserError("Não pode tirar-se a si próprio da equipa");
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { staffRole: null } }),
    prisma.adminSession.deleteMany({ where: { userId: user.id } }),
  ]);
  await audit(staff, "staff.remove", { type: "user", id: user.id }, { from: user.staffRole });
}

// ---------------------------------------------------------------- Registo de atividade e sistema

export async function listAudit(staff: Staff, filters: { actor: string; action: string }, page: number) {
  require(staff, "audit");
  const where: Prisma.AdminAuditLogWhereInput = {
    ...(filters.actor ? { actorEmail: contains(filters.actor) } : {}),
    ...(filters.action ? { action: { startsWith: filters.action } } : {}),
  };
  const [total, entries] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ]);
  return { total, entries };
}

export async function systemStatus(staff: Staff) {
  require(staff, "system");
  const [pending, failedEmails, queuedEmails, sessions, adminSessions] = await Promise.all([
    Promise.all([
      prisma.payment.count({ where: { status: "PENDING" } }),
      prisma.membershipPayment.count({ where: { status: "PENDING" } }),
      prisma.federationPlanPayment.count({ where: { status: "PENDING" } }),
    ]).then((counts) => counts.reduce((a, b) => a + b, 0)),
    prisma.emailOutbox.count({ where: { sentAt: null, nextAttemptAt: null } }),
    prisma.emailOutbox.count({ where: { sentAt: null, nextAttemptAt: { not: null } } }),
    prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
    prisma.adminSession.count({ where: { expiresAt: { gt: new Date() } } }),
  ]);
  return {
    env: checkProductionEnv(),
    production: process.env.NODE_ENV === "production",
    counts: { pending, failedEmails, queuedEmails, sessions, adminSessions },
  };
}
