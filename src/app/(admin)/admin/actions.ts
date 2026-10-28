"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { runAction, text, type ActionState } from "@/lib/action-state";
import { UserError } from "@/lib/errors";
import {
  endUserSessions,
  moderateEvent,
  reactivateUser,
  refreshAnyPayment,
  removeStaff,
  retryEmail,
  setStaffRole,
  suspendUser,
  verifyUserEmail,
} from "@/server/admin/data";
import { adminLogIn, adminLogOut, audit, getStaff, requireStaff } from "@/server/admin/session";
import { resendVerificationEmail } from "@/server/auth";
import { publicDataChanged } from "@/server/cache-tags";
import { adjustCredits } from "@/server/credits";
import { activateFederationPlan, federationTag } from "@/server/federations";
import { runJobs } from "@/server/jobs";
import { clientIp, enforceLimit } from "@/server/limits";

// Ações da área de administração. Cada uma confirma a sessão de administração e a permissão do
// papel (requireStaff); as funções do servidor voltam a confirmar e registam o que fazem.

export async function adminLogInAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await enforceLimit("login", await clientIp());
    await adminLogIn({ email: text(formData, "email"), password: String(formData.get("password") ?? "") });
    redirect("/admin");
  });
}

export async function adminLogOutAction() {
  const staff = await getStaff();
  if (staff) await audit(staff, "logout");
  await adminLogOut();
  redirect("/admin/login");
}

// ---------- Utilizadores

export async function suspendUserAction(userId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    await suspendUser(await requireStaff("users"), userId, text(formData, "reason"));
    refresh();
  });
}

export async function reactivateUserAction(userId: string) {
  return runAction(async () => {
    await reactivateUser(await requireStaff("users"), userId);
    refresh();
  });
}

export async function endUserSessionsAction(userId: string) {
  return runAction(async () => {
    await endUserSessions(await requireStaff("users"), userId);
    refresh();
  });
}

export async function verifyUserEmailAction(userId: string) {
  return runAction(async () => {
    await verifyUserEmail(await requireStaff("users"), userId);
    refresh();
  });
}

export async function resendVerificationAdminAction(userId: string) {
  return runAction(async () => {
    const staff = await requireStaff("users");
    await resendVerificationEmail(userId);
    await audit(staff, "user.email.resend", { type: "user", id: userId });
    refresh();
  });
}

// ---------- Eventos e pagamentos

export async function moderateEventAction(eventId: string, status: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const event = await moderateEvent(await requireStaff("events.moderate"), eventId, status, text(formData, "reason"));
    publicDataChanged({ eventId: event.id, eventSlug: event.slug, events: true, community: true, live: true });
    refresh();
  });
}

export async function refreshPaymentAction(kind: string, paymentId: string) {
  return runAction(async () => {
    await refreshAnyPayment(await requireStaff("payments"), kind, paymentId);
    refresh();
  });
}

// ---------- Finanças

export async function adjustCreditsAction(organizerId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    await adjustCredits(await requireStaff("finance"), organizerId, text(formData, "delta"), text(formData, "note"));
    refresh();
  });
}

export async function activateFederationPlanAction(federationId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const slug = await activateFederationPlan(
      await requireStaff("finance"),
      federationId,
      text(formData, "plan"),
      text(formData, "until"),
      formData.get("invoice") === "on",
    );
    updateTag(federationTag(slug));
    refresh();
  });
}

// ---------- E-mails, equipa e sistema

export async function retryEmailAction(emailId: string) {
  return runAction(async () => {
    await retryEmail(await requireStaff("emails"), emailId);
    refresh();
  });
}

export async function setStaffRoleAction(_state: ActionState, formData: FormData) {
  return runAction(async () => {
    await setStaffRole(await requireStaff("staff"), text(formData, "email"), text(formData, "role"));
    refresh();
  });
}

export async function removeStaffAction(userId: string) {
  return runAction(async () => {
    await removeStaff(await requireStaff("staff"), userId);
    refresh();
  });
}

export async function runJobsAction(): Promise<ActionState> {
  return runAction(async () => {
    const staff = await requireStaff("system");
    const report = await runJobs({ forceStats: true });
    if (!report.ran) throw new UserError("A tarefa de fundo já está a correr noutro servidor. Tente daqui a pouco.");
    await audit(staff, "system.jobs", null, report);
    refresh();
  });
}
