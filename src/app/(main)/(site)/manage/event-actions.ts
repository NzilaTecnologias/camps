"use server";

import { refresh } from "next/cache";
import { runAction, text, type ActionState } from "@/lib/action-state";
import { UserError } from "@/lib/errors";
import { requireUser } from "@/server/auth";
import { publicDataChanged } from "@/server/cache-tags";
import { createCoupon, deleteCoupon, setCouponActive, setEarlyDiscount } from "@/server/coupons";
import {
  cancelEvent,
  clearWeighIn,
  generateMissingBrackets,
  recordWeighIn,
  setEventFederation,
  updateEventSettings,
} from "@/server/organizer";
import { updateOrganizerBilling, updatePayoutDetails } from "@/server/billing";
import { cancelRegistration, requestRefund } from "@/server/refunds";

// Ações das secções do painel de um evento. Cada função do servidor confirma que o
// utilizador pertence à organização; os ids que chegam aqui vêm do navegador.

export async function updateEventSettingsAction(eventId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    await updateEventSettings(user.id, eventId, {
      name: text(formData, "name"),
      sport: text(formData, "sport"),
      description: text(formData, "description"),
      date: text(formData, "date"),
      endDate: text(formData, "endDate"),
      registrationOpensOn: text(formData, "registrationOpensOn"),
      registrationClosesOn: text(formData, "registrationClosesOn"),
      venue: text(formData, "venue"),
      city: text(formData, "city"),
      latitude: text(formData, "latitude"),
      longitude: text(formData, "longitude"),
    });
    publicDataChanged({ eventId, events: true, live: true });
    refresh();
  });
}

export async function cancelEventAction(eventId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    if (text(formData, "confirm") !== "CANCELAR") throw new UserError("Escreva CANCELAR para confirmar");
    await cancelEvent(user.id, eventId);
    publicDataChanged({ eventId, events: true, community: true, live: true });
    refresh();
  });
}

export async function cancelRegistrationAction(registrationId: string) {
  return runAction(async () => {
    const user = await requireUser();
    publicDataChanged({ eventId: await cancelRegistration(user.id, registrationId), community: true });
    refresh();
  });
}

export async function refundAction(paymentId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    const eventId = await requestRefund(user.id, paymentId, {
      reason: text(formData, "reason"),
      manual: text(formData, "manual") === "1",
    });
    publicDataChanged({ eventId, community: true });
    refresh();
  });
}

export async function recordWeighInAction(registrationId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    await recordWeighIn(user.id, registrationId, text(formData, "weight"));
    refresh();
  });
}

export async function clearWeighInAction(registrationId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await clearWeighIn(user.id, registrationId);
    refresh();
  });
}

export async function createCouponAction(eventId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    await createCoupon(user.id, eventId, {
      code: text(formData, "code"),
      kind: text(formData, "kind"),
      value: text(formData, "value"),
      maxUses: text(formData, "maxUses"),
      expiresOn: text(formData, "expiresOn"),
    });
    refresh();
  });
}

export async function setCouponActiveAction(couponId: string, active: boolean) {
  return runAction(async () => {
    const user = await requireUser();
    await setCouponActive(user.id, couponId, active);
    refresh();
  });
}

export async function deleteCouponAction(couponId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await deleteCoupon(user.id, couponId);
    refresh();
  });
}

export async function setEarlyDiscountAction(eventId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    await setEarlyDiscount(user.id, eventId, text(formData, "percent"), text(formData, "endsOn"));
    publicDataChanged({ eventId });
    refresh();
  });
}

export async function generateMissingBracketsAction(eventId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    const { generated } = await generateMissingBrackets(user.id, eventId, text(formData, "type"));
    publicDataChanged({ eventId });
    if (generated === 0) throw new UserError("Nenhuma categoria sem chave tem pelo menos dois atletas aptos");
    refresh();
  });
}

export async function updatePayoutDetailsAction(organizerId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    await updatePayoutDetails(user.id, organizerId, text(formData, "holder"), text(formData, "iban"));
    refresh();
  });
}

export async function setEventFederationAction(eventId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    await setEventFederation(user.id, eventId, text(formData, "federationId"), text(formData, "requiresMembership") === "1");
    publicDataChanged({ eventId, events: true, community: true });
    refresh();
  });
}

export async function updateOrganizerBillingAction(organizerId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    await updateOrganizerBilling(user.id, organizerId, {
      name: text(formData, "billingName"),
      nif: text(formData, "billingNif"),
      address: text(formData, "billingAddress"),
    });
    refresh();
  });
}
