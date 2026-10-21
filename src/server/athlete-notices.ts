import { prisma } from "@/lib/db";
import { renderEmail, type EmailContent } from "@/lib/email-template";
import { formatDateTime } from "@/lib/format";
import { enqueueEmail } from "./email";
import { appUrl } from "./payments";

// Avisos por e-mail a quem inscreveu atletas: lembrete dois dias antes do evento, chave publicada
// e resultado. Corre na tarefa de fundo (jobs.ts), que depois envia a fila de e-mails.
// Cada aviso fica gravado em NotificationLog na mesma transação em que o e-mail entra na fila:
// com vários servidores ou tarefas repetidas, nunca sai duas vezes. As consultas já excluem os
// avisos dados, por isso cada volta pega nos seguintes, por muitos que tenham sido enviados antes.

const BATCH = 300;
const REMINDER_HOURS = 48;
/** Chaves e resultados mais antigos do que isto já não são novidade. */
const RECENT_DAYS = 14;

type Notice = { kind: string; key: string; to: string; content: EmailContent };

/** Grava o aviso e põe o e-mail na fila, se ainda não tinha sido dado. Devolve se foi novo. */
async function send(notice: Notice): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.notificationLog.createMany({ data: [{ kind: notice.kind, key: notice.key }], skipDuplicates: true });
    if (count === 0) return false;
    await enqueueEmail(tx, notice.to, renderEmail(notice.content));
    return true;
  });
}

const place = (event: { venue: string | null; city: string | null }) => [event.venue, event.city].filter(Boolean).join(", ");

/** Lembrete a quem tem atletas inscritos num evento que começa nas próximas 48 horas. */
async function reminders(now: Date): Promise<number> {
  const until = new Date(now.getTime() + REMINDER_HOURS * 3_600_000);
  // Um e-mail por pessoa e evento, com todos os atletas que ela inscreveu.
  const pairs = await prisma.$queryRaw<{ eventId: string; userId: string }[]>`
    SELECT DISTINCT r."eventId", r."registeredById" AS "userId"
      FROM "Registration" r
      JOIN "Event" e ON e.id = r."eventId"
      JOIN "User" u ON u.id = r."registeredById"
     WHERE r.status = 'PAID' AND e.status = 'PUBLISHED' AND u."deletedAt" IS NULL
       AND e."startsAt" > ${now} AND e."startsAt" <= ${until}
       AND NOT EXISTS (SELECT 1 FROM "NotificationLog" n
                        WHERE n.kind = 'event-reminder' AND n.key = r."eventId" || ':' || r."registeredById")
     LIMIT ${BATCH}`;
  let sent = 0;
  for (const { eventId, userId } of pairs) {
    const items = await prisma.registration.findMany({
      where: { eventId, registeredById: userId, status: "PAID" },
      select: {
        registeredBy: { select: { name: true, email: true } },
        event: { select: { name: true, slug: true, startsAt: true, venue: true, city: true } },
        division: { select: { name: true } },
        athlete: { select: { firstName: true, lastName: true } },
      },
    });
    if (items.length === 0) continue;
    const [{ event, registeredBy }] = items;
    const where = place(event);
    const ok = await send({
      kind: "event-reminder",
      key: `${eventId}:${userId}`,
      to: registeredBy.email,
      content: {
        subject: `Lembrete: ${event.name} começa ${formatDateTime(event.startsAt)}`,
        heading: `${event.name} está a chegar`,
        paragraphs: [
          `Olá ${registeredBy.name},`,
          `O evento começa ${formatDateTime(event.startsAt)}${where ? `, em ${where}` : ""}. Estas são as inscrições confirmadas:`,
        ],
        rows: items.map((item): [string, string] => [`${item.athlete.firstName} ${item.athlete.lastName}`, item.division.name]),
        action: { label: "Ver o evento", url: `${appUrl()}/events/${event.slug}` },
        footnote: "Chegue a tempo da pesagem e leve um documento de identificação. As chaves e os horários aparecem na página do evento.",
      },
    });
    if (ok) sent++;
  }
  return sent;
}

/** Aviso de chave publicada, a quem inscreveu atletas nessa categoria (um e-mail por pessoa e chave). */
async function brackets(now: Date): Promise<number> {
  const since = new Date(now.getTime() - RECENT_DAYS * 86_400_000);
  const pairs = await prisma.$queryRaw<{ bracketId: string; divisionId: string; userId: string }[]>`
    SELECT DISTINCT b.id AS "bracketId", b."divisionId", r."registeredById" AS "userId"
      FROM "Bracket" b
      JOIN "Division" d ON d.id = b."divisionId"
      JOIN "Event" e ON e.id = d."eventId"
      JOIN "Registration" r ON r."divisionId" = d.id AND r.status = 'PAID'
      JOIN "User" u ON u.id = r."registeredById"
     WHERE b."createdAt" > ${since} AND e.status = 'PUBLISHED' AND e."endsAt" > ${now} AND u."deletedAt" IS NULL
       AND NOT EXISTS (SELECT 1 FROM "NotificationLog" n
                        WHERE n.kind = 'bracket-published' AND n.key = b.id || ':' || r."registeredById")
     LIMIT ${BATCH}`;
  let sent = 0;
  for (const { bracketId, divisionId, userId } of pairs) {
    const items = await prisma.registration.findMany({
      where: { divisionId, registeredById: userId, status: "PAID" },
      select: {
        registeredBy: { select: { name: true, email: true } },
        athlete: { select: { firstName: true, lastName: true } },
        division: { select: { name: true, event: { select: { name: true, slug: true } } } },
      },
    });
    if (items.length === 0) continue;
    const [{ registeredBy, division }] = items;
    const athletes = items.map((item) => `${item.athlete.firstName} ${item.athlete.lastName}`).join(", ");
    const ok = await send({
      kind: "bracket-published",
      key: `${bracketId}:${userId}`,
      to: registeredBy.email,
      content: {
        subject: `Chave publicada: ${division.name} — ${division.event.name}`,
        heading: "A chave já está publicada",
        paragraphs: [
          `Olá ${registeredBy.name},`,
          `A chave da categoria ${division.name} em ${division.event.name} já pode ser vista, com os adversários de ${athletes}.`,
        ],
        action: { label: "Ver a chave", url: `${appUrl()}/events/${division.event.slug}/divisions/${divisionId}` },
        footnote: "A ordem e as áreas das lutas podem mudar no dia do evento; acompanhe pela página da categoria.",
      },
    });
    if (ok) sent++;
  }
  return sent;
}

const PLACE_LABEL: Record<number, string> = { 1: "1.º lugar — ouro", 2: "2.º lugar — prata", 3: "3.º lugar — bronze" };

/** Resultado final de cada atleta, quando a chave da categoria fecha. */
async function results(now: Date): Promise<number> {
  const since = new Date(now.getTime() - RECENT_DAYS * 86_400_000);
  const rows = await prisma.$queryRaw<{ registrationId: string }[]>`
    SELECT p."registrationId"
      FROM "Placement" p
      JOIN "Registration" r ON r.id = p."registrationId"
      JOIN "Event" e ON e.id = r."eventId"
      JOIN "User" u ON u.id = r."registeredById"
     WHERE e.status = 'PUBLISHED' AND e."startsAt" > ${since} AND u."deletedAt" IS NULL
       AND NOT EXISTS (SELECT 1 FROM "NotificationLog" n WHERE n.kind = 'result' AND n.key = p."registrationId")
     LIMIT ${BATCH}`;
  const placements = await prisma.placement.findMany({
    where: { registrationId: { in: rows.map((row) => row.registrationId) } },
    select: {
      registrationId: true,
      place: true,
      registration: {
        select: {
          registeredBy: { select: { name: true, email: true } },
          athlete: { select: { firstName: true, lastName: true } },
          division: { select: { id: true, name: true } },
          event: { select: { name: true, slug: true } },
        },
      },
    },
  });
  let sent = 0;
  for (const { registrationId, place: position, registration } of placements) {
    const name = `${registration.athlete.firstName} ${registration.athlete.lastName}`;
    const label = PLACE_LABEL[position] ?? `${position}.º lugar`;
    const ok = await send({
      kind: "result",
      key: registrationId,
      to: registration.registeredBy.email,
      content: {
        subject: `Resultado: ${name} — ${label}`,
        heading: position <= 3 ? `Pódio para ${name}!` : `Resultado de ${name}`,
        paragraphs: [`Olá ${registration.registeredBy.name},`, `A categoria ${registration.division.name} em ${registration.event.name} terminou.`],
        rows: [
          ["Atleta", name],
          ["Categoria", registration.division.name],
          ["Classificação", label],
        ],
        action: { label: "Ver a chave e o pódio", url: `${appUrl()}/events/${registration.event.slug}/divisions/${registration.division.id}` },
        footnote: "Os resultados contam para o perfil do atleta e para os rankings.",
      },
    });
    if (ok) sent++;
  }
  return sent;
}

/** Para a tarefa de fundo: põe na fila os avisos que faltam. Devolve quantos. */
export async function queueAthleteNotices(now = new Date()): Promise<number> {
  return (await reminders(now)) + (await brackets(now)) + (await results(now));
}
