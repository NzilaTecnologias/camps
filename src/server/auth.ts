import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/password";

export const SESSION_COOKIE = "camps_session";
const SESSION_DAYS = 30;

// Hash de uma senha qualquer, para gastar o mesmo tempo quando o e-mail não existe.
let dummyHash: Promise<string> | undefined;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type CurrentUser = { id: string; name: string; email: string };

async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function signUp(input: { name: string; email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (name.length < 2) throw new UserError("Informe seu nome");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new UserError("Informe um e-mail válido");
  if (input.password.length < 8) throw new UserError("A palavra-passe precisa de ter pelo menos 8 caracteres");

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new UserError("Já existe uma conta com este e-mail");
  }
  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(input.password) },
  });
  await createSession(user.id);
}

export async function logIn(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email.trim().toLowerCase() } });
  dummyHash ??= hashPassword("senha-que-ninguem-usa");
  const valid = await verifyPassword(input.password, user?.passwordHash ?? (await dummyHash));
  if (!user || !valid) throw new UserError("E-mail ou palavra-passe incorretos");
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
    select: { expiresAt: true, user: { select: { id: true, name: true, email: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
