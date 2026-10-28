"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { runAction, text, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/server/auth";
import { simulateCreditPurchase, startCreditPurchase } from "@/server/credits";
import { enforceLimit } from "@/server/limits";
import {
  removeMethod,
  requireFederationAccountAccess,
  requireOrganizerAccountAccess,
  savePayPal,
  saveProxyPay,
  type Owner,
} from "@/server/payment-accounts";

// Conta de pagamentos (organização ou federação) e compra de créditos.

export type OwnerKind = "organizer" | "federation";

/** Confirma que o utilizador pode mexer na conta e devolve o dono dela. */
async function owner(kind: OwnerKind, id: string): Promise<Owner> {
  const user = await requireUser();
  if (kind === "organizer") {
    await requireOrganizerAccountAccess(user.id, id);
    return { organizerId: id };
  }
  await requireFederationAccountAccess(user.id, id);
  return { federationId: id };
}

export async function saveProxyPayAction(kind: OwnerKind, id: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    await saveProxyPay(await owner(kind, id), {
      token: text(formData, "token"),
      posId: text(formData, "posId"),
      sandbox: formData.get("sandbox") === "on",
    });
    refresh();
  });
}

export async function savePayPalAction(kind: OwnerKind, id: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    await savePayPal(await owner(kind, id), {
      clientId: text(formData, "clientId"),
      secret: text(formData, "secret"),
      sandbox: formData.get("sandbox") === "on",
      currency: text(formData, "currency"),
      exchangeRate: text(formData, "exchangeRate"),
    });
    refresh();
  });
}

export async function removePaymentMethodAction(kind: OwnerKind, id: string, method: "MULTICAIXA_EXPRESS" | "PAYPAL") {
  return runAction(async () => {
    await removeMethod(await owner(kind, id), method);
    refresh();
  });
}

export async function buyCreditsAction(organizerId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    await enforceLimit("payment", user.id);
    const started = await startCreditPurchase(user.id, organizerId, {
      credits: text(formData, "credits"),
      provider: text(formData, "provider"),
      mobile: text(formData, "mobile"),
    });
    if (started.redirectUrl) redirect(started.redirectUrl);
    refresh();
  });
}

export async function simulateCreditPurchaseAction(purchaseId: string, approve: boolean) {
  return runAction(async () => {
    const user = await requireUser();
    await simulateCreditPurchase(user.id, purchaseId, approve);
    refresh();
  });
}
