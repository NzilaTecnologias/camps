import { UserError } from "@/lib/errors";
import type { Outcome, PaymentProvider } from "./types";

// PayPal Orders API v2: criamos a ordem, o utilizador aprova no site do PayPal e nós capturamos.
// O PayPal não trabalha com kwanzas, por isso a inscrição é convertida para PAYPAL_CURRENCY
// usando a taxa fixa PAYPAL_EXCHANGE_RATE (quantos kwanzas vale 1 unidade dessa moeda).

type Link = { rel: string; href: string };
type Order = {
  id?: string;
  status?: string;
  links?: Link[];
  purchase_units?: { payments?: { captures?: { status?: string }[] } }[];
};

function config() {
  return {
    baseUrl: (process.env.PAYPAL_API_URL ?? "https://api-m.paypal.com").replace(/\/$/, ""),
    clientId: process.env.PAYPAL_CLIENT_ID ?? "",
    clientSecret: process.env.PAYPAL_CLIENT_SECRET ?? "",
    currency: process.env.PAYPAL_CURRENCY ?? "USD",
    exchangeRate: Number(process.env.PAYPAL_EXCHANGE_RATE),
  };
}

/** Converte o valor da inscrição para a moeda cobrada no PayPal, arredondando a favor da organização. */
export function convertForPayPal(amountCents: number, currency: string) {
  const { currency: target, exchangeRate } = config();
  if (currency === target) return { chargeCurrency: target, chargeAmountCents: amountCents };
  if (currency !== "AOA" || !(exchangeRate > 0)) {
    throw new UserError("O PayPal não está disponível para a moeda deste evento");
  }
  return { chargeCurrency: target, chargeAmountCents: Math.ceil(amountCents / exchangeRate) };
}

async function accessToken(): Promise<string> {
  const { baseUrl, clientId, clientSecret } = config();
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error(`PayPal recusou as credenciais (${response.status})`);
  return ((await response.json()) as { access_token: string }).access_token;
}

async function request(path: string, init: RequestInit = {}): Promise<Order> {
  const response = await fetch(`${config().baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`PayPal respondeu ${response.status} em ${path}: ${await response.text()}`);
  }
  return (await response.json()) as Order;
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

export const paypal: PaymentProvider = {
  id: "PAYPAL",
  label: "PayPal",

  isConfigured() {
    const { clientId, clientSecret } = config();
    return clientId !== "" && clientSecret !== "";
  },

  async start({ paymentId, amountCents, currency, description, appUrl }) {
    const charge = convertForPayPal(amountCents, currency);
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
};
