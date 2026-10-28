import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { refreshCreditPurchaseByProviderRef } from "@/server/credits";
import { refreshPlanByProviderRef } from "@/server/federation-plan";
import { refreshMembershipByProviderRef } from "@/server/memberships";
import { refreshByProviderRef } from "@/server/registrations";

// O PayPal devolve o utilizador aqui depois de aprovar, com o id da ordem em `token`.
// A captura acontece na consulta de estado; a página da inscrição (ou da filiação) mostra o resultado.
export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("token");
  if (!orderId) redirect("/registrations");
  const payment = await refreshByProviderRef("PAYPAL", orderId);
  if (payment) redirect(`/registrations/${payment.registrationId}`);
  const membershipPayment = await refreshMembershipByProviderRef("PAYPAL", orderId);
  if (membershipPayment) redirect(`/memberships/${membershipPayment.membershipId}`);
  const purchase = await refreshCreditPurchaseByProviderRef("PAYPAL", orderId);
  if (purchase) redirect(`/manage/organizers/${purchase.organizerId}/credits`);
  const planPayment = await refreshPlanByProviderRef("PAYPAL", orderId);
  redirect(planPayment ? `/manage/federations/${planPayment.federationId}/billing` : "/registrations");
}
