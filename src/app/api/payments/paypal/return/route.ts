import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { refreshByProviderRef } from "@/server/registrations";

// O PayPal devolve o utilizador aqui depois de aprovar, com o id da ordem em `token`.
// A captura acontece na consulta de estado; a página da inscrição mostra o resultado.
export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("token");
  const payment = orderId ? await refreshByProviderRef("PAYPAL", orderId) : null;
  redirect(payment ? `/registrations/${payment.registrationId}` : "/registrations");
}
