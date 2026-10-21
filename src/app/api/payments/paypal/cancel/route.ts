import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { abandonPayPalPlanPayment } from "@/server/federation-plan";
import { abandonPayPalMembershipPayment } from "@/server/memberships";
import { abandonPayPalPayment } from "@/server/registrations";

export async function GET(request: NextRequest) {
  const paymentId = request.nextUrl.searchParams.get("payment");
  if (!paymentId) redirect("/registrations");
  const payment = await abandonPayPalPayment(paymentId);
  if (payment) redirect(`/registrations/${payment.registrationId}`);
  const membershipPayment = await abandonPayPalMembershipPayment(paymentId);
  if (membershipPayment) redirect(`/memberships/${membershipPayment.membershipId}`);
  const planPayment = await abandonPayPalPlanPayment(paymentId);
  redirect(planPayment ? `/manage/federations/${planPayment.federationId}/billing` : "/registrations");
}
