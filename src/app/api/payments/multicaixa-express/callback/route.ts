import { refreshRefundByProviderRef } from "@/server/refunds";
import { refreshByProviderRef } from "@/server/registrations";

// A ProxyPay faz POST da transação quando ela termina. O pedido não vem assinado, por isso
// o conteúdo serve só para saber qual transação consultar; o estado vem da consulta à API.
// A transação tanto pode ser um pagamento como uma devolução.
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const id = body && typeof body === "object" && "id" in body ? body.id : null;
  if (typeof id === "string" || typeof id === "number") {
    const payment = await refreshByProviderRef("MULTICAIXA_EXPRESS", String(id));
    if (!payment) await refreshRefundByProviderRef("MULTICAIXA_EXPRESS", String(id));
  }
  return new Response(null, { status: 204 });
}
