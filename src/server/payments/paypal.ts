import { UserError } from "@/lib/errors";
import type { Outcome, PayPalCredentials, PaymentProvider } from "./types";

// PayPal Orders API v2: criamos a ordem, o utilizador aprova no site do PayPal e nós capturamos.
// O PayPal não trabalha com kwanzas, por isso a inscrição é convertida para a moeda da conta usando
// a taxa fixa dela (quantos kwanzas vale 1 unidade dessa moeda). Cada conta (a da Camps ou a de
// uma organização) tem as suas credenciais; o dinheiro cai na conta dona delas.

export const PAYPAL_PRODUCTION = "https://api-m.paypal.com";
export const PAYPAL_SANDBOX = "https://api-m.sandbox.paypal.com";

type Link = { rel: string; href: string };
type Order = {
  id?: string;
  status?: string;
  links?: Link[];
  purchase_units?: { payments?: { captures?: { id?: string; status?: string }[] } }[];
};

type PayPalRefund = { id?: string; status?: string };

/** Converte o valor da inscrição para a moeda cobrada no PayPal, arredondando a favor de quem recebe. */
export function convertForPayPal(amountCents: number, currency: string, credentials: Pick<PayPalCredentials, "currency" | "exchangeRate">) {
  const { currency: target, exchangeRate } = credentials;
  if (currency === target) return { chargeCurrency: target, chargeAmountCents: amountCents };
  if (currency !== "AOA" || !(exchangeRate > 0)) {
    throw new UserError("O PayPal não está disponível para a moeda deste evento");
  }
  return { chargeCurrency: target, chargeAmountCents: Math.ceil(amountCents / exchangeRate) };
}

/** Pede um token ao PayPal: serve também para confirmar que as credenciais estão certas. */
export async function paypalAccessToken(credentials: Pick<PayPalCredentials, "baseUrl" | "clientId" | "clientSecret">): Promise<string> {
  const response = await fetch(`${credentials.baseUrl.replace(/\/$/, "")}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error(`PayPal recusou as credenciais (${response.status})`);
  return ((await response.json()) as { access_token: string }).access_token;
}

function refundOutcome(refund: PayPalRefund): Outcome {
  if (refund.status === "COMPLETED") return { status: "SUCCEEDED" };
  if (refund.status === "CANCELLED" || refund.status === "FAILED") {
    return { status: "FAILED", reason: "O PayPal recusou a devolução" };
  }
  return { status: "PENDING" };
}

function captureOutcome(order: Order): Outcome {
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  if (order.status === "COMPLETED" && capture?.status === "COMPLETED") return { status: "SUCCEEDED" };
  if (capture?.status === "DECLINED" || capture?.status === "FAILED") {
    return { status: "FAILED", reason: "O PayPal recusou o pagamento" };
  }
  // Captura em análise no PayPal: fica pendente até uma nova consulta.
  return { status: "PENDING" };
}

export function paypal(credentials: PayPalCredentials | null): PaymentProvider {
  async function request<T = Order>(path: string, init: RequestInit = {}): Promise<T> {
    if (!credentials) throw new Error("PayPal sem credenciais");
    const response = await fetch(`${credentials.baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${await paypalAccessToken(credentials)}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    if (!response.ok) {
      throw new Error(`PayPal respondeu ${response.status} em ${path}: ${await response.text()}`);
    }
    return (await response.json()) as T;
  }

  return {
    id: "PAYPAL",
    label: "PayPal",

    isConfigured() {
      return Boolean(credentials?.clientId && credentials.clientSecret);
    },

    async start({ paymentId, amountCents, currency, description, appUrl }) {
      const charge = convertForPayPal(amountCents, currency, credentials!);
      const order = await request("/v2/checkout/orders", {
        method: "POST",
        headers: { "PayPal-Request-Id": paymentId },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              reference_id: paymentId,
              custom_id: paymentId,
              description: description.slice(0, 127),
              amount: { currency_code: charge.chargeCurrency, value: (charge.chargeAmountCents / 100).toFixed(2) },
            },
          ],
          payment_source: {
            paypal: {
              experience_context: {
                return_url: `${appUrl}/api/payments/paypal/return?payment=${paymentId}`,
                cancel_url: `${appUrl}/api/payments/paypal/cancel?payment=${paymentId}`,
                user_action: "PAY_NOW",
                shipping_preference: "NO_SHIPPING",
              },
            },
          },
        }),
      });

      const approval = order.links?.find((link) => link.rel === "payer-action" || link.rel === "approve");
      if (!order.id || !approval) throw new Error("PayPal não devolveu o endereço de aprovação");
      return { providerRef: order.id, redirectUrl: approval.href, ...charge };
    },

    async check(providerRef): Promise<Outcome> {
      const path = `/v2/checkout/orders/${encodeURIComponent(providerRef)}`;
      const order = await request(path);
      if (order.status === "COMPLETED") return captureOutcome(order);
      if (order.status === "VOIDED") return { status: "FAILED", reason: "A ordem PayPal foi anulada" };
      if (order.status !== "APPROVED") return { status: "PENDING" };

      // O utilizador aprovou: é a captura que move o dinheiro.
      return captureOutcome(await request(`${path}/capture`, { method: "POST", headers: { "PayPal-Request-Id": providerRef } }));
    },

    // Devolve-se a captura, não a ordem: o id dela está na própria ordem.
    async refund({ refundId, providerRef }) {
      const order = await request(`/v2/checkout/orders/${encodeURIComponent(providerRef)}`);
      const captureId = order.purchase_units?.[0]?.payments?.captures?.[0]?.id;
      if (!captureId) throw new Error(`A ordem PayPal ${providerRef} não tem captura para devolver`);
      const refund = await request<PayPalRefund>(`/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
        method: "POST",
        headers: { "PayPal-Request-Id": refundId },
        body: "{}",
      });
      if (!refund.id) throw new Error("PayPal não devolveu o id da devolução");
      return { refundRef: refund.id, outcome: refundOutcome(refund) };
    },

    async checkRefund(refundRef) {
      return refundOutcome(await request<PayPalRefund>(`/v2/payments/refunds/${encodeURIComponent(refundRef)}`));
    },
  };
}
