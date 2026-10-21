import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { can, type Permission, type StaffRole } from "@/lib/admin-permissions";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/password";
import { isPlatformAdmin } from "../billing-config";
import { clientIp } from "../limits";
import { clearFailures, lockedForMinutes, recordFailure } from "../login-throttle";

// Sessão da área de administração, separada da do site: outro cookie, só enviado para /admin,
// SameSite=Strict e válido 8 horas. Ter sessão no site não abre a administração, e vice-versa.
// O papel é lido da base de dados em cada pedido: tirar alguém da equipa vale logo.

export const ADMIN_COOKIE = "camps_admin";
const SESSION_HOURS = 8;
const MAX_PASSWORD_LENGTH = 200;

export type Staff = { id: string; name: string; email: string; role: StaffRole };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Os e-mails de PLATFORM_ADMIN_EMAILS são sempre administradores, para nunca ficar ninguém sem acesso. */
export function staffRoleFor(user: { email: string; staffRole: StaffRole | null }): StaffRole | null {
  return isPlatformAdmin(user.email) ? "ADMIN" : user.staffRole;
}

/** Regista uma ação da equipa. As ações de escrita chamam-no depois de gravar. */
export async function audit(
  actor: { id: string | null; email: string },
  action: string,
  target?: { type: string; id: string } | null,
  details?: Prisma.InputJsonValue,
) {
  await prisma.adminAuditLog.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      action,
      targetType: target?.type,
      targetId: target?.id,
      details,
      ip: await clientIp(),
    },
  });
}

let dummyHash: Promise<string> | undefined;

/** Entrada na administração: conta com palavra-passe certa, papel na equipa e não suspensa. */
export async function adminLogIn(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const throttleKey = `admin:${email}`;
  const minutes = await lockedForMinutes(throttleKey);
  if (minutes > 0) throw new UserError(`Demasiadas tentativas falhadas. Tente novamente dentro de ${minutes} min.`);

  const user = await prisma.user.findUnique({ where: { email } });
  dummyHash ??= hashPassword("senha-que-ninguem-usa");
  const valid =
    input.password.length <= MAX_PASSWORD_LENGTH && (await verifyPassword(input.password, user?.passwordHash ?? (await dummyHash)));
  const role = user ? staffRoleFor(user) : null;
  if (!user || !valid || !role || user.suspendedAt || user.deletedAt) {
    await recordFailure(throttleKey);
    await audit({ id: user?.id ?? null, email }, "login.failed");
    // A mesma mensagem em todos os casos: não diz quem é da equipa.
    throw new UserError("E-mail ou palavra-passe incorretos, ou conta sem acesso à administração");
  }
  await clearFailures(throttleKey);

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3_600_000);
  const requestHeaders = await headers();
  await prisma.adminSession.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } });
  await prisma.adminSession.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt,
      ip: await clientIp(),
      userAgent: requestHeaders.get("user-agent")?.slice(0, 300),
    },
  });
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    expires: expiresAt,
  });
  await audit({ id: user.id, email: user.email }, "login");
}

export async function adminLogOut() {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (token) await prisma.adminSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  store.delete({ name: ADMIN_COOKIE, path: "/admin" });
}

/** Membro da equipa com sessão de administração válida, ou null. */
export const getStaff = cache(async (): Promise<Staff | null> => {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      user: { select: { id: true, name: true, email: true, staffRole: true, suspendedAt: true, deletedAt: true } },
    },
  });
  await connection();
  if (!session || session.expiresAt < new Date()) return null;
  const { user } = session;
  const role = staffRoleFor(user);
  if (!role || user.suspendedAt || user.deletedAt) return null;
  return { id: user.id, name: user.name, email: user.email, role };
});

/** Para as páginas: sem sessão vai para a entrada; sem permissão a página não existe. */
export async function pageStaff(permission: Permission = "dashboard"): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/admin/login");
  if (!can(staff.role, permission)) notFound();
  return staff;
}

/** Para as ações e funções do servidor: confirma a sessão e a permissão. */
export async function requireStaff(permission: Permission): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/admin/login");
  if (!can(staff.role, permission)) throw new UserError("O seu papel na equipa não permite fazer isto");
  return staff;
}
