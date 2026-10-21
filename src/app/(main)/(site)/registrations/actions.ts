"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { runAction, text, type ActionState } from "@/lib/action-state";
import { requireUser, requireVerifiedUser } from "@/server/auth";
import { publicDataChanged } from "@/server/cache-tags";
import { enforceLimit } from "@/server/limits";
import { simulatePayment, startPayment, startRegistration, type Started } from "@/server/registrations";

/** Segue para o PayPal quando o provedor pede, senão para a página da inscrição. */
function follow({ registrationId, redirectUrl }: Started): never {
  redirect(redirectUrl ?? `/registrations/${registrationId}`);
}

export async function registerAction(
  eventSlug: string,
  divisionId: string,
  _state: ActionState,
  formData: FormData,
) {
  return runAction(async () => {
    const user = await requireVerifiedUser();
    await enforceLimit("registration", user.id);
    if (text(formData, "couponCode")) await enforceLimit("coupon", user.id);
    const started = await startRegistration(user.id, {
      eventSlug,
      divisionId,
      athleteId: text(formData, "athleteId"),
      firstName: text(formData, "firstName"),
      lastName: text(formData, "lastName"),
      birthDate: text(formData, "birthDate"),
      academyName: text(formData, "academyName"),
      provider: text(formData, "provider"),
      mobile: text(formData, "mobile"),
      couponCode: text(formData, "couponCode"),
    });
    // Uma inscrição gratuita fica logo confirmada e aparece na página pública.
    publicDataChanged({ eventSlug });
    follow(started);
  });
}

export async function payAction(registrationId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireVerifiedUser();
    await enforceLimit("payment", user.id);
    const started = await startPayment(user.id, registrationId, text(formData, "provider"), text(formData, "mobile"));
    if (started.redirectUrl) redirect(started.redirectUrl);
    refresh();
  });
}

export async function simulatePaymentAction(paymentId: string, approve: boolean) {
  return runAction(async () => {
    const user = await requireUser();
    publicDataChanged({ eventId: await simulatePayment(user.id, paymentId, approve) });
    refresh();
  });
}
