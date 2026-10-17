"use server";

import { redirect } from "next/navigation";
import { runAction, text, type ActionState } from "@/lib/action-state";
import { safeNext } from "@/lib/safe-next";
import { logIn, logOut, signUp } from "@/server/auth";
import { clientIp, enforceLimit } from "@/server/limits";

export async function signUpAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await enforceLimit("signup", await clientIp());
    await signUp({
      name: text(formData, "name"),
      email: text(formData, "email"),
      // A palavra-passe não passa por trim: espaços fazem parte dela.
      password: String(formData.get("password") ?? ""),
    });
    redirect(safeNext(text(formData, "next")));
  });
}

export async function logInAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await enforceLimit("login", await clientIp());
    await logIn({ email: text(formData, "email"), password: String(formData.get("password") ?? "") });
    redirect(safeNext(text(formData, "next")));
  });
}

export async function logOutAction() {
  await logOut();
  redirect("/");
}
