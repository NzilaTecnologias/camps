"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { runAction, text, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/server/auth";
import {
  addFederationOrganizer,
  affiliateAcademy,
  createFederation,
  createMembershipPlan,
  createPost,
  deletePost,
  federationTag,
  removeAcademy,
  removeFederationOrganizer,
  setMembershipPlanActive,
  updateFederationPayoutDetails,
  updateFederationSettings,
} from "@/server/federations";
import { requestMembershipRefund } from "@/server/memberships";

// Ações do painel de uma federação. Cada função do servidor confirma que o utilizador é membro;
// os ids chegam do navegador. Depois de mudar algo público, renova a página da federação.

const changed = (slug: string) => updateTag(federationTag(slug));

export async function createFederationAction(_state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    const federation = await createFederation(user.id, { name: text(formData, "name"), sport: text(formData, "sport") });
    redirect(`/manage/federations/${federation.id}`);
  });
}

export async function updateFederationSettingsAction(federationId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    changed(
      await updateFederationSettings(user.id, federationId, {
        name: text(formData, "name"),
        sport: text(formData, "sport"),
        description: text(formData, "description"),
        color: text(formData, "color"),
      }),
    );
    refresh();
  });
}

export async function addFederationOrganizerAction(federationId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    await addFederationOrganizer(user.id, federationId, text(formData, "organizerSlug"));
    refresh();
  });
}

export async function removeFederationOrganizerAction(federationId: string, organizerId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await removeFederationOrganizer(user.id, federationId, organizerId);
    refresh();
  });
}

export async function affiliateAcademyAction(federationId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    changed(await affiliateAcademy(user.id, federationId, text(formData, "academyName"), text(formData, "validUntil")));
    refresh();
  });
}

export async function removeAcademyAction(federationId: string, academyId: string) {
  return runAction(async () => {
    const user = await requireUser();
    changed(await removeAcademy(user.id, federationId, academyId));
    refresh();
  });
}

export async function createMembershipPlanAction(federationId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    changed(
      await createMembershipPlan(user.id, federationId, {
        name: text(formData, "name"),
        price: text(formData, "price"),
        months: text(formData, "months"),
        maxAge: text(formData, "maxAge"),
      }),
    );
    refresh();
  });
}

export async function setMembershipPlanActiveAction(federationId: string, planId: string, active: boolean) {
  return runAction(async () => {
    const user = await requireUser();
    changed(await setMembershipPlanActive(user.id, federationId, planId, active));
    refresh();
  });
}

export async function createPostAction(federationId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    changed(await createPost(user.id, federationId, text(formData, "title"), text(formData, "body")));
    refresh();
  });
}

export async function deletePostAction(federationId: string, postId: string) {
  return runAction(async () => {
    const user = await requireUser();
    changed(await deletePost(user.id, federationId, postId));
    refresh();
  });
}

export async function updateFederationPayoutAction(federationId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    await updateFederationPayoutDetails(user.id, federationId, text(formData, "holder"), text(formData, "iban"));
    refresh();
  });
}

export async function refundMembershipAction(paymentId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    changed(
      await requestMembershipRefund(user.id, paymentId, {
        reason: text(formData, "reason"),
        manual: text(formData, "manual") === "1",
      }),
    );
    refresh();
  });
}
