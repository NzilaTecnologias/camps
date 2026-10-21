"use server";

import { redirect } from "next/navigation";
import { runAction, text, type ActionState } from "@/lib/action-state";
import { deleteAccount } from "@/server/account";
import { changePassword, endOtherSessions, logOut, requestEmailChange, requireUser, updateName } from "@/server/auth";
import { clientIp, enforceLimit } from "@/server/limits";

// Cada ação volta à página com ?ok=<o que mudou>, que mostra a confirmação.

export async function updateNameAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser();
    await updateName(user.id, text(formData, "name"));
    redirect("/account?ok=name");
  });
}

export async function changePasswordAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser();
    // Mesmo limite do login: impede adivinhar a palavra-passe atual por aqui.
    await enforceLimit("login", await clientIp());
    await changePassword(
      user.id,
      String(formData.get("current") ?? ""),
      String(formData.get("password") ?? ""),
      String(formData.get("confirmation") ?? ""),
    );
    redirect("/account?ok=password");
  });
}

export async function requestEmailChangeAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser();
    await enforceLimit("login", await clientIp());
    await enforceLimit("emailLink", user.email);
    await requestEmailChange(user.id, text(formData, "email"), String(formData.get("password") ?? ""));
    redirect("/account?ok=email");
  });
}

export async function endOtherSessionsAction(): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser();
    const count = await endOtherSessions(user.id);
    redirect(`/account?ok=sessions&n=${count}`);
  });
}

export async function deleteAccountAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser();
    await enforceLimit("login", await clientIp());
    await deleteAccount(user.id, String(formData.get("password") ?? ""), text(formData, "confirmation"));
    await logOut();
    redirect("/account/deleted");
  });
}
