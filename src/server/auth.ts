import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { after, connection } from "next/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { AuthTokenKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { renderEmail } from "@/lib/email-template";
import { UserError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/password";
import { deliverEmail, enqueueEmail } from "./email";
import { clearFailures, lockedForMinutes, recordFailure } from "./login-throttle";
import { appUrl } from "./payments";

export const SESSION_COOKIE = "camps_session";
const SESSION_DAYS = 30;
const MAX_PASSWORD_LENGTH = 200;
const VERIFY_EMAIL_HOURS = 7 * 24;
const PASSWORD_RESET_MINUTES = 60;

// Hash de uma senha qualquer, para gastar o mesmo tempo quando o e-mail não existe.
let dummyHash: Promise<string> | undefined;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type CurrentUser = { id: string; name: string; email: string; emailVerified: boolean };

async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  // Aproveita para apagar as sessões já expiradas deste utilizador.
  await prisma.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
  await prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

function checkPassword(password: string) {
  if (password.length < 8) throw new UserError("A palavra-passe precisa de ter pelo menos 8 caracteres");
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new UserError(`A palavra-passe pode ter no máximo ${MAX_PASSWORD_LENGTH} caracteres`);
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signUp(input: { name: string; email: string; password: string; acceptedTerms: boolean }) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (name.length < 2) throw new UserError("Informe seu nome");
  if (!EMAIL_PATTERN.test(email)) throw new UserError("Informe um e-mail válido");
  checkPassword(input.password);
  if (name.length > 120 || email.length > 254) throw new UserError("Nome ou e-mail demasiado longo");
  if (!input.acceptedTerms) {
    throw new UserError("Para criar conta, aceite os Termos de utilização e a Política de privacidade");
  }

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new UserError("Já existe uma conta com este e-mail");
  }
  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(input.password), termsAcceptedAt: new Date() },
  });
  await createSession(user.id);
  await sendVerificationEmail(user);
}

export async function logIn(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const minutes = await lockedForMinutes(email);
  if (minutes > 0) {
    throw new UserError(`Demasiadas tentativas falhadas. Tente novamente dentro de ${minutes} min.`);
  }
  if (input.password.length > MAX_PASSWORD_LENGTH) throw new UserError("E-mail ou palavra-passe incorretos");

  const user = await prisma.user.findUnique({ where: { email } });
  dummyHash ??= hashPassword("senha-que-ninguem-usa");
  const valid = await verifyPassword(input.password, user?.passwordHash ?? (await dummyHash));
  if (!user || !valid) {
    await recordFailure(email);
    throw new UserError("E-mail ou palavra-passe incorretos");
  }
  await clearFailures(email);
  if (user.suspendedAt) throw new UserError("Esta conta está suspensa. Para saber porquê, contacte o apoio da Camps.");
  await createSession(user.id);
}

export async function logOut() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  cookieStore.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      user: { select: { id: true, name: true, email: true, emailVerifiedAt: true, suspendedAt: true } },
    },
  });
  await connection();
  if (!session || session.expiresAt < new Date() || session.user.suspendedAt) return null;
  const { id, name, email, emailVerifiedAt } = session.user;
  return { id, name, email, emailVerified: emailVerifiedAt !== null };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Para pagar ou organizar é preciso ter o e-mail confirmado: os recibos e os avisos de reembolso
 * vão para lá, e assim ninguém usa o e-mail de outra pessoa.
 */
export async function requireVerifiedUser(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.emailVerified) {
    throw new UserError(
      `Confirme primeiro o seu e-mail: enviámos um link para ${user.email}. Não chegou? Use "Reenviar" no aviso no topo da página.`,
    );
  }
  return user;
}

// ---------- Links enviados por e-mail ----------

/** Cria um link de uso único e anula os anteriores do mesmo tipo ainda por usar. */
async function issueToken(userId: string, kind: AuthTokenKind, minutes: number, newEmail?: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId, kind, usedAt: null } }),
    prisma.authToken.create({
      data: {
        userId,
        kind,
        newEmail,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + minutes * 60 * 1000),
      },
    }),
  ]);
  return token;
}

/** Envia depois de responder ao pedido: quem pede não espera pela Resend (e não fica a saber se a conta existe pelo tempo de resposta). */
function deliverLater(emailId: string) {
  after(() => deliverEmail(emailId));
}

async function sendVerificationEmail(user: { id: string; name: string; email: string }) {
  const token = await issueToken(user.id, "VERIFY_EMAIL", VERIFY_EMAIL_HOURS * 60);
  const emailId = await enqueueEmail(
    prisma,
    user.email,
    renderEmail({
      subject: "Confirme o seu e-mail na Camps",
      heading: "Confirme o seu e-mail",
      paragraphs: [
        `Olá ${user.name},`,
        "Falta só um passo: confirme que este e-mail é seu. Depois disso pode pagar inscrições, filiar-se e organizar eventos.",
      ],
      action: { label: "Confirmar e-mail", url: `${appUrl()}/verify-email?token=${token}` },
      footnote: `O link é válido durante ${VERIFY_EMAIL_HOURS / 24} dias. Se não criou uma conta na Camps, ignore este e-mail.`,
    }),
    { sensitive: true },
  );
  deliverLater(emailId);
}

export async function resendVerificationEmail(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, name: true, email: true, emailVerifiedAt: true },
  });
  if (user.emailVerifiedAt) return;
  await sendVerificationEmail(user);
}

/** Gasta um link: devolve o utilizador se o link existe, é deste tipo, não expirou e não foi usado. */
async function consumeToken(token: string, kind: AuthTokenKind): Promise<{ userId: string; newEmail: string | null } | null> {
  if (!token || token.length > 100) return null;
  const tokenHash = hashToken(token);
  const { count } = await prisma.authToken.updateMany({
    where: { tokenHash, kind, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (count === 0) return null;
  return prisma.authToken.findUniqueOrThrow({ where: { tokenHash }, select: { userId: true, newEmail: true } });
}

/** Só para mostrar a página certa: não gasta o link. */
export async function tokenIsValid(token: string, kind: AuthTokenKind): Promise<boolean> {
  if (!token || token.length > 100) return false;
  const row = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { kind: true, usedAt: true, expiresAt: true },
  });
  await connection();
  return row !== null && row.kind === kind && row.usedAt === null && row.expiresAt > new Date();
}

export async function verifyEmail(token: string) {
  const used = await consumeToken(token, "VERIFY_EMAIL");
  if (!used) throw new UserError("Este link já foi usado ou expirou. Entre na sua conta e peça um novo.");
  await prisma.user.updateMany({ where: { id: used.userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
}

/** Responde sempre da mesma maneira, exista ou não uma conta com o e-mail. */
export async function requestPasswordReset(rawEmail: string) {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new UserError("Informe um e-mail válido");
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } });
  if (!user) return;
  const token = await issueToken(user.id, "PASSWORD_RESET", PASSWORD_RESET_MINUTES);
  const emailId = await enqueueEmail(
    prisma,
    user.email,
    renderEmail({
      subject: "Definir uma nova palavra-passe na Camps",
      heading: "Nova palavra-passe",
      paragraphs: [`Olá ${user.name},`, "Recebemos um pedido para definir uma nova palavra-passe na sua conta da Camps."],
      action: { label: "Definir nova palavra-passe", url: `${appUrl()}/reset-password?token=${token}` },
      footnote: `O link é válido durante ${PASSWORD_RESET_MINUTES} minutos e só pode ser usado uma vez. Se não foi você que pediu, ignore este e-mail: a palavra-passe atual continua a funcionar.`,
    }),
    { sensitive: true },
  );
  deliverLater(emailId);
}

/** Troca a palavra-passe, termina todas as sessões abertas e entra com uma nova. */
export async function resetPassword(token: string, password: string, confirmation: string) {
  checkPassword(password);
  if (password !== confirmation) throw new UserError("As duas palavras-passe não são iguais");
  const passwordHash = await hashPassword(password);
  const used = await consumeToken(token, "PASSWORD_RESET");
  if (!used) throw new UserError("Este link já foi usado ou expirou. Peça um novo.");
  const { userId } = used;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, emailVerifiedAt: true } });
  await prisma.$transaction([
    // Quem abriu o link recebido por e-mail provou que o e-mail é seu.
    prisma.user.update({ where: { id: userId }, data: { passwordHash, emailVerifiedAt: user.emailVerifiedAt ?? new Date() } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.authToken.deleteMany({ where: { userId, kind: "PASSWORD_RESET", usedAt: null } }),
  ]);
  await clearFailures(user.email);
  await createSession(userId);
}

// ---------- A minha conta ----------

const EMAIL_CHANGE_HOURS = 24;

/** Hash do token da sessão deste pedido, para terminar as outras sessões e deixar esta. */
async function currentSessionHash(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? hashToken(token) : null;
}

export async function requirePassword(userId: string, password: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
  if (password.length > MAX_PASSWORD_LENGTH || !(await verifyPassword(password, user.passwordHash))) {
    throw new UserError("A palavra-passe atual não está certa");
  }
}

export async function updateName(userId: string, rawName: string) {
  const name = rawName.trim();
  if (name.length < 2) throw new UserError("Informe seu nome");
  if (name.length > 120) throw new UserError("Nome demasiado longo");
  await prisma.user.update({ where: { id: userId }, data: { name } });
}

/** Troca a palavra-passe e termina as sessões dos outros aparelhos (esta continua aberta). */
export async function changePassword(userId: string, current: string, next: string, confirmation: string) {
  await requirePassword(userId, current);
  checkPassword(next);
  if (next !== confirmation) throw new UserError("As duas palavras-passe novas não são iguais");
  if (next === current) throw new UserError("A palavra-passe nova tem de ser diferente da atual");
  const keep = await currentSessionHash();
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } }),
    prisma.session.deleteMany({ where: { userId, ...(keep ? { tokenHash: { not: keep } } : {}) } }),
    prisma.authToken.deleteMany({ where: { userId, kind: "PASSWORD_RESET", usedAt: null } }),
  ]);
}

/** Termina todas as sessões menos a deste aparelho. Devolve quantas terminou. */
export async function endOtherSessions(userId: string): Promise<number> {
  const keep = await currentSessionHash();
  const { count } = await prisma.session.deleteMany({ where: { userId, ...(keep ? { tokenHash: { not: keep } } : {}) } });
  return count;
}

/**
 * Pede a troca de e-mail: o novo só passa a valer quando o link enviado para lá for aberto. O
 * e-mail antigo recebe um aviso, para o titular saber se não foi ele.
 */
export async function requestEmailChange(userId: string, rawEmail: string, password: string) {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 254) throw new UserError("Informe um e-mail válido");
  await requirePassword(userId, password);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, email: true } });
  if (email === user.email) throw new UserError("Esse já é o e-mail da sua conta");
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new UserError("Já existe uma conta com esse e-mail");
  }
  const token = await issueToken(user.id, "EMAIL_CHANGE", EMAIL_CHANGE_HOURS * 60, email);
  const confirmId = await enqueueEmail(
    prisma,
    email,
    renderEmail({
      subject: "Confirme o novo e-mail da sua conta Camps",
      heading: "Confirme o novo e-mail",
      paragraphs: [`Olá ${user.name},`, `Pediu para a sua conta da Camps passar a usar este e-mail (${email}).`],
      action: { label: "Confirmar o novo e-mail", url: `${appUrl()}/confirm-email-change?token=${token}` },
      footnote: `O link é válido durante ${EMAIL_CHANGE_HOURS} horas. Até lá, a conta continua com o e-mail antigo.`,
    }),
    { sensitive: true },
  );
  const noticeId = await enqueueEmail(
    prisma,
    user.email,
    renderEmail({
      subject: "Pedido para mudar o e-mail da sua conta Camps",
      heading: "Pedido de mudança de e-mail",
      paragraphs: [
        `Olá ${user.name},`,
        `Foi pedido que a sua conta da Camps passe a usar o e-mail ${email}. A mudança só acontece quando o link enviado para esse endereço for aberto.`,
      ],
      footnote: "Se não foi você, entre na conta e mude a palavra-passe: alguém a conhece.",
    }),
  );
  deliverLater(confirmId);
  deliverLater(noticeId);
}

/** Abre o link enviado para o e-mail novo: a conta passa a usá-lo, já confirmado. */
export async function confirmEmailChange(token: string) {
  const used = await consumeToken(token, "EMAIL_CHANGE");
  if (!used?.newEmail) throw new UserError("Este link já foi usado ou expirou. Peça a mudança outra vez em A minha conta.");
  if (await prisma.user.findUnique({ where: { email: used.newEmail }, select: { id: true } })) {
    throw new UserError("Entretanto foi criada outra conta com esse e-mail");
  }
  await prisma.user.update({ where: { id: used.userId }, data: { email: used.newEmail, emailVerifiedAt: new Date() } });
}

/** E-mail novo à espera de confirmação, se houver. */
export async function pendingEmailChange(userId: string): Promise<string | null> {
  const row = await prisma.authToken.findFirst({
    where: { userId, kind: "EMAIL_CHANGE", usedAt: null, expiresAt: { gt: new Date() } },
    select: { newEmail: true },
  });
  return row?.newEmail ?? null;
}
