import { refreshCreditPurchaseByProviderRef } from "@/server/credits";
import { refreshPlanByProviderRef } from "@/server/federation-plan";
import { refreshMembershipByProviderRef, refreshMembershipRefundByProviderRef } from "@/server/memberships";
import { refreshRefundByProviderRef } from "@/server/refunds";
import { refreshByProviderRef } from "@/server/registrations";

// A ProxyPay faz POST da transação quando ela termina. O pedido não vem assinado, por isso
// o conteúdo serve só para saber qual transação consultar; o estado vem da consulta à API.
// A transação pode ser uma inscrição, uma quota de filiação, uma compra de créditos, um Plano
// Federação ou uma devolução. As contas ProxyPay das organizações apontam para este mesmo endereço.
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const id = body && typeof body === "object" && "id" in body ? body.id : null;
  if (typeof id === "string" || typeof id === "number") {
    const ref = String(id);
    const lookups = [
      refreshByProviderRef,
      refreshMembershipByProviderRef,
      refreshCreditPurchaseByProviderRef,
      refreshPlanByProviderRef,
      refreshMembershipRefundByProviderRef,
      refreshRefundByProviderRef,
    ];
    for (const lookup of lookups) if (await lookup("MULTICAIXA_EXPRESS", ref)) break;
  }
  return new Response(null, { status: 204 });
}
