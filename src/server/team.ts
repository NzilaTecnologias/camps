import { prisma } from "@/lib/db";
import { renderEmail } from "@/lib/email-template";
import { UserError } from "@/lib/errors";
import {
  ORGANIZER_ROLE_DESCRIPTION,
  ORGANIZER_ROLE_LABEL,
  ORGANIZER_ROLES,
  rolesWith,
  type OrganizerRole,
} from "@/lib/organizer-permissions";
import { enqueueEmail } from "./email";
import { appUrl } from "./payments";

// Equipa de cada organização: quem pode gerir os eventos dela e com que papel. Como na equipa da
// administração, a pessoa cria primeiro conta no site e o dono acrescenta-a pelo e-mail.
// Uma organização nunca fica sem dono.

/** A organização e a equipa, para qualquer membro ver; só o dono a muda. */
export async function getOrganizerTeam(userId: string, organizerId: string) {
  const organizer = await prisma.organizer.findFirst({
    where: { id: organizerId, members: { some: { userId } } },
    select: {
      id: true,
      name: true,
      slug: true,
      members: {
        orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
        select: { userId: true, role: true, user: { select: { name: true, email: true, suspendedAt: true } } },
      },
    },
  });
  if (!organizer) return null;
  const me = organizer.members.find((member) => member.userId === userId);
  return { ...organizer, myRole: me!.role };
}

async function requireTeamAccess(userId: string, organizerId: string) {
  const organizer = await prisma.organizer.findFirst({
    where: { id: organizerId, members: { some: { userId, role: { in: rolesWith("team") } } } },
  });
  if (!organizer) throw new UserError("Só o dono da organização pode gerir a equipa");
  return organizer;
}

/** Recusa a mudança se a organização ficasse sem nenhum dono. */
async function keepAnOwner(organizerId: string, leavingUserId: string) {
  const others = await prisma.organizerMember.count({
    where: { organizerId, role: "OWNER", userId: { not: leavingUserId } },
  });
  if (others === 0) throw new UserError("A organização precisa de pelo menos um dono. Dê esse papel a outra pessoa primeiro.");
}

/** Acrescenta alguém à equipa pelo e-mail da conta, ou muda o papel de quem já lá está. */
export async function setMemberRole(userId: string, organizerId: string, rawEmail: string, rawRole: string) {
  const organizer = await requireTeamAccess(userId, organizerId);
  const role = ORGANIZER_ROLES.find((value) => value === rawRole);
  if (!role) throw new UserError("Escolha o papel");
  const email = rawEmail.trim().toLowerCase();
  if (!email) throw new UserError("Indique o e-mail da conta");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) {
    throw new UserError("Não há nenhuma conta com esse e-mail. A pessoa tem de criar conta no site primeiro.");
  }
  if (!user.emailVerifiedAt) throw new UserError("Essa conta ainda não confirmou o e-mail");
  if (user.suspendedAt) throw new UserError("Essa conta está suspensa");

  const current = await prisma.organizerMember.findUnique({
    where: { organizerId_userId: { organizerId, userId: user.id } },
  });
  if (current?.role === role) return;
  if (current?.role === "OWNER") await keepAnOwner(organizerId, user.id);

  await prisma.$transaction(async (tx) => {
    await tx.organizerMember.upsert({
      where: { organizerId_userId: { organizerId, userId: user.id } },
      update: { role },
      create: { organizerId, userId: user.id, role },
    });
    if (!current) await enqueueEmail(tx, user.email, welcomeEmail(user.name, organizer.name, role));
  });
}

function welcomeEmail(name: string, organizerName: string, role: OrganizerRole) {
  return renderEmail({
    subject: `Entrou na equipa de ${organizerName} na Camps`,
    heading: `Bem-vindo à equipa de ${organizerName}`,
    paragraphs: [
      `Olá ${name},`,
      `Foi acrescentado à equipa da organização ${organizerName} como ${ORGANIZER_ROLE_LABEL[role].toLowerCase()}.`,
      `${ORGANIZER_ROLE_DESCRIPTION[role]}.`,
    ],
    action: { label: "Abrir os eventos", url: `${appUrl()}/manage` },
    footnote: "Se não esperava este convite, fale com o dono da organização ou responda a este e-mail.",
  });
}

/**
 * Tira alguém da equipa. O dono tira qualquer pessoa; os outros só se podem tirar a si próprios
 * (sair da organização).
 */
export async function removeMember(userId: string, organizerId: string, memberId: string) {
  if (memberId !== userId) await requireTeamAccess(userId, organizerId);
  const member = await prisma.organizerMember.findUnique({
    where: { organizerId_userId: { organizerId, userId: memberId } },
  });
  if (!member) throw new UserError("Essa pessoa não está na equipa");
  if (member.role === "OWNER") await keepAnOwner(organizerId, memberId);
  await prisma.organizerMember.delete({ where: { organizerId_userId: { organizerId, userId: memberId } } });
}
