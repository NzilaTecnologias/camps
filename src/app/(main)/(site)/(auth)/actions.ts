"use server";

import { redirect } from "next/navigation";
import { runAction, text, type ActionState } from "@/lib/action-state";
import { safeNext } from "@/lib/safe-next";
import {
  confirmEmailChange,
  logIn,
  logOut,
  requestPasswordReset,
  requireUser,
  resendVerificationEmail,
  resetPassword,
  signUp,
  verifyEmail,
} from "@/server/auth";
import { clientIp, enforceLimit } from "@/server/limits";

export async function signUpAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await enforceLimit("signup", await clientIp());
    await signUp({
      name: text(formData, "name"),
      email: text(formData, "email"),
      // A palavra-passe não passa por trim: espaços fazem parte dela.
      password: String(formData.get("password") ?? ""),
      acceptedTerms: formData.get("terms") === "on",
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

export async function forgotPasswordAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const email = text(formData, "email").toLowerCase();
    await enforceLimit("emailLinkIp", await clientIp());
    await enforceLimit("emailLink", email);
    await requestPasswordReset(email);
    redirect("/forgot-password?sent=1");
  });
}

export async function resetPasswordAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await enforceLimit("login", await clientIp());
    await resetPassword(
      text(formData, "token"),
      String(formData.get("password") ?? ""),
      String(formData.get("confirmation") ?? ""),
    );
    redirect("/registrations");
  });
}

export async function confirmEmailChangeAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await confirmEmailChange(text(formData, "token"));
    redirect("/confirm-email-change?done=1");
  });
}

export async function verifyEmailAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await verifyEmail(text(formData, "token"));
    redirect("/verify-email?done=1");
  });
}

export async function resendVerificationAction(): Promise<ActionState & { sent?: boolean }> {
  const state = await runAction(async () => {
    const user = await requireUser();
    await enforceLimit("emailLinkIp", await clientIp());
    await enforceLimit("emailLink", user.email);
    await resendVerificationEmail(user.id);
  });
  return state.error ? state : { sent: true };
}
