"use server";

import { refresh, updateTag } from "next/cache";
import { runAction, text, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/server/auth";
import { invoiceEventFeeNow, recordPayout } from "@/server/billing";
import { UserError } from "@/lib/errors";
import { activateFederationPlan, federationTag, recordFederationPayout } from "@/server/federations";

// Ações dos administradores da Camps. Cada função do servidor confirma o e-mail na lista
// PLATFORM_ADMIN_EMAILS; o eventId chega do navegador.

export async function recordPayoutAction(eventId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    await recordPayout(user.email, eventId, text(formData, "amount"), text(formData, "reference"));
    refresh();
  });
}

export async function activateFederationPlanAction(federationId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    const slug = await activateFederationPlan(
      user.email,
      federationId,
      text(formData, "plan"),
      text(formData, "until"),
      formData.get("invoice") === "on",
    );
    updateTag(federationTag(slug));
    refresh();
  });
}

export async function recordFederationPayoutAction(federationId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    await recordFederationPayout(user.email, federationId, text(formData, "amount"), text(formData, "reference"));
    refresh();
  });
}

export async function invoiceEventFeeAction(eventId: string): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser();
    if (!(await invoiceEventFeeNow(user.email, eventId))) {
      throw new UserError("Não há atletas confirmados por faturar neste evento");
    }
    refresh();
  });
}
