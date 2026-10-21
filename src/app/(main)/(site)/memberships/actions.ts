"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { runAction, text, type ActionState } from "@/lib/action-state";
import { requireUser, requireVerifiedUser } from "@/server/auth";
import { enforceLimit } from "@/server/limits";
import { simulateMembershipPayment, startMembership, startMembershipPayment } from "@/server/memberships";

export async function joinFederationAction(slug: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireVerifiedUser();
    await enforceLimit("payment", user.id);
    const started = await startMembership(user.id, slug, {
      planId: text(formData, "planId"),
      athleteId: text(formData, "athleteId"),
      firstName: text(formData, "firstName"),
      lastName: text(formData, "lastName"),
      birthDate: text(formData, "birthDate"),
      gender: text(formData, "gender"),
      academyName: text(formData, "academyName"),
      provider: text(formData, "provider"),
      mobile: text(formData, "mobile"),
    });
    redirect(started.redirectUrl ?? `/memberships/${started.membershipId}`);
  });
}

export async function payMembershipAction(membershipId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireVerifiedUser();
    await enforceLimit("payment", user.id);
    const started = await startMembershipPayment(user.id, membershipId, text(formData, "provider"), text(formData, "mobile"));
    if (started.redirectUrl) redirect(started.redirectUrl);
    refresh();
  });
}

export async function simulateMembershipPaymentAction(paymentId: string, approve: boolean) {
  return runAction(async () => {
    const user = await requireUser();
    await simulateMembershipPayment(user.id, paymentId, approve);
    refresh();
  });
}
