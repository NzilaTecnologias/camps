import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeAngolanMobile } from "@/lib/phone";
import { safeNext } from "@/lib/safe-next";
import { multicaixaExpress } from "./multicaixa-express";
import { convertForPayPal, paypal } from "./paypal";
import type { StartInput } from "./types";

type Call = { url: string; init: RequestInit };

/** Troca o fetch global por respostas enfileiradas e guarda os pedidos feitos. */
function mockFetch(...responses: { status?: number; body: unknown }[]): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error(`pedido inesperado a ${url}`);
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200 });
  });
  return calls;
}

const input: StartInput = {
  paymentId: "pay_1",
  amountCents: 1_500_000,
  currency: "AOA",
  description: "Copa Camps — Edson Kiala",
  mobile: "923456789",
  appUrl: "https://camps.example",
};

const header = (call: Call, name: string) => (call.init.headers as Record<string, string>)[name];
const jsonBody = (call: Call) => JSON.parse(call.init.body as string);

beforeEach(() => {
  vi.stubEnv("PROXYPAY_API_URL", "https://api.sandbox.proxypay.co.ao");
  vi.stubEnv("PROXYPAY_TOKEN", "token-proxypay");
  vi.stubEnv("PROXYPAY_POS_ID", "1234");
  vi.stubEnv("PAYPAL_API_URL", "https://api-m.sandbox.paypal.com");
  vi.stubEnv("PAYPAL_CLIENT_ID", "client");
  vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
  vi.stubEnv("PAYPAL_CURRENCY", "USD");
  vi.stubEnv("PAYPAL_EXCHANGE_RATE", "920");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Multicaixa Express (ProxyPay)", () => {
  it("só fica disponível com token e POS configurados", () => {
    expect(multicaixaExpress.isConfigured()).toBe(true);
    vi.stubEnv("PROXYPAY_POS_ID", "");
    expect(multicaixaExpress.isConfigured()).toBe(false);
  });

  it("cria a transação com valor em kwanzas, telemóvel, idempotência e callback", async () => {
    const calls = mockFetch({ status: 201, body: { id: 987, type: "payment" } });
    const started = await multicaixaExpress.start(input);

    expect(started).toEqual({ providerRef: "987", chargeCurrency: "AOA", chargeAmountCents: 1_500_000 });
    expect(calls[0].url).toBe("https://api.sandbox.proxypay.co.ao/opg/v1/transactions");
    expect(header(calls[0], "Authorization")).toBe("Bearer token-proxypay");
    expect(header(calls[0], "Idempotency-Key")).toBe("pay_1");
    expect(jsonBody(calls[0])).toEqual({
      type: "payment",
      pos_id: 1234,
      mobile: "923456789",
      amount: "15000.00",
      callback_url: "https://camps.example/api/payments/multicaixa-express/callback",
    });
  });

  it("não pede callback para um endereço local", async () => {
    const calls = mockFetch({ status: 201, body: { id: 1 } });
    await multicaixaExpress.start({ ...input, appUrl: "http://localhost:3000" });
    expect(jsonBody(calls[0])).not.toHaveProperty("callback_url");
  });

  it("recusa moeda que não seja kwanza e pedido sem telemóvel, sem chamar a API", async () => {
    const calls = mockFetch();
    await expect(multicaixaExpress.start({ ...input, currency: "USD" })).rejects.toThrow(/kwanzas/);
    await expect(multicaixaExpress.start({ ...input, mobile: null })).rejects.toThrow(/telemóvel/);
    expect(calls).toHaveLength(0);
  });

  it("traduz o estado da transação", async () => {
    mockFetch(
      { body: { id: 987 } },
      { body: { id: 987, status: "accepted" } },
      { body: { id: 987, status: "rejected", status_reason: "2001" } },
      { body: { id: 987, status: "rejected", status_reason: 9999 } },
    );
    expect(await multicaixaExpress.check("987")).toEqual({ status: "PENDING" });
    expect(await multicaixaExpress.check("987")).toEqual({ status: "SUCCEEDED" });
    expect(await multicaixaExpress.check("987")).toEqual({ status: "FAILED", reason: "Saldo insuficiente" });
    expect(await multicaixaExpress.check("987")).toEqual({ status: "FAILED", reason: "Pagamento recusado" });
  });

  it("falha quando a API responde com erro", async () => {
    mockFetch({ status: 401, body: { message: "Your API key is wrong." } });
    await expect(multicaixaExpress.start(input)).rejects.toThrow(/401/);
  });
});

describe("PayPal", () => {
  const token = { body: { access_token: "abc" } };

  it("converte kwanzas para a moeda do PayPal arredondando para cima", () => {
    // 15 000,00 Kz a 920 Kz por dólar = 16,304... → 16,31 USD
    expect(convertForPayPal(1_500_000, "AOA")).toEqual({ chargeCurrency: "USD", chargeAmountCents: 1631 });
    expect(convertForPayPal(2500, "USD")).toEqual({ chargeCurrency: "USD", chargeAmountCents: 2500 });
  });

  it("recusa converter sem taxa de câmbio configurada", () => {
    vi.stubEnv("PAYPAL_EXCHANGE_RATE", "");
    expect(() => convertForPayPal(1_500_000, "AOA")).toThrow(/não está disponível/);
  });

  it("cria a ordem em dólares e devolve o endereço de aprovação", async () => {
    const calls = mockFetch(token, {
      status: 201,
      body: {
        id: "ORDER-1",
        status: "PAYER_ACTION_REQUIRED",
        links: [{ rel: "payer-action", href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-1" }],
      },
    });
    const started = await paypal.start(input);

    expect(started).toEqual({
      providerRef: "ORDER-1",
      redirectUrl: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-1",
      chargeCurrency: "USD",
      chargeAmountCents: 1631,
    });
    expect(calls[0].url).toBe("https://api-m.sandbox.paypal.com/v1/oauth2/token");
    expect(header(calls[0], "Authorization")).toBe(`Basic ${Buffer.from("client:secret").toString("base64")}`);
    expect(calls[1].url).toBe("https://api-m.sandbox.paypal.com/v2/checkout/orders");
    expect(header(calls[1], "PayPal-Request-Id")).toBe("pay_1");
    const order = jsonBody(calls[1]);
    expect(order.intent).toBe("CAPTURE");
    expect(order.purchase_units[0].amount).toEqual({ currency_code: "USD", value: "16.31" });
    expect(order.payment_source.paypal.experience_context.return_url).toBe(
      "https://camps.example/api/payments/paypal/return?payment=pay_1",
    );
  });

  it("não captura uma ordem que o utilizador ainda não aprovou", async () => {
    const calls = mockFetch(token, { body: { id: "ORDER-1", status: "PAYER_ACTION_REQUIRED" } });
    expect(await paypal.check("ORDER-1")).toEqual({ status: "PENDING" });
    expect(calls).toHaveLength(2);
  });

  it("captura uma ordem aprovada e confirma o pagamento", async () => {
    const calls = mockFetch(token, { body: { id: "ORDER-1", status: "APPROVED" } }, token, {
      status: 201,
      body: {
        id: "ORDER-1",
        status: "COMPLETED",
        purchase_units: [{ payments: { captures: [{ status: "COMPLETED" }] } }],
      },
    });
    expect(await paypal.check("ORDER-1")).toEqual({ status: "SUCCEEDED" });
    expect(calls[3].url).toBe("https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER-1/capture");
    expect(calls[3].init.method).toBe("POST");
  });

  it("trata captura recusada como falha e captura em análise como pendente", async () => {
    const captured = (status: string) => ({
      body: { id: "ORDER-1", status: "COMPLETED", purchase_units: [{ payments: { captures: [{ status }] } }] },
    });
    mockFetch(token, captured("DECLINED"), token, captured("PENDING"));
    expect(await paypal.check("ORDER-1")).toEqual({ status: "FAILED", reason: "O PayPal recusou o pagamento" });
    expect(await paypal.check("ORDER-1")).toEqual({ status: "PENDING" });
  });
});

describe("normalizeAngolanMobile", () => {
  it("aceita formatos comuns e devolve 9 dígitos", () => {
    expect(normalizeAngolanMobile("923 456 789")).toBe("923456789");
    expect(normalizeAngolanMobile("+244 923-456-789")).toBe("923456789");
    expect(normalizeAngolanMobile("00244923456789")).toBe("923456789");
  });

  it("recusa números que não são telemóveis angolanos", () => {
    expect(normalizeAngolanMobile("222 123 456")).toBeNull();
    expect(normalizeAngolanMobile("92345678")).toBeNull();
    expect(normalizeAngolanMobile("")).toBeNull();
  });
});

describe("safeNext", () => {
  it("aceita só caminhos internos", () => {
    expect(safeNext("/registrations/abc?x=1")).toBe("/registrations/abc?x=1");
    expect(safeNext("https://malicioso.example")).toBe("/");
    expect(safeNext("//malicioso.example")).toBe("/");
    expect(safeNext("/\\malicioso.example")).toBe("/");
    expect(safeNext("")).toBe("/");
  });
});

describe("reembolsos", () => {
  const refundInput = { refundId: "ref_1", providerRef: "987", appUrl: "https://camps.example" };

  it("Multicaixa Express pede uma transação refund ligada ao pagamento", async () => {
    const calls = mockFetch({ status: 201, body: { id: 555, type: "refund", parent_transaction_id: "987" } });
    expect(await multicaixaExpress.refund(refundInput)).toEqual({ refundRef: "555", outcome: { status: "PENDING" } });
    expect(calls[0].url).toBe("https://api.sandbox.proxypay.co.ao/opg/v1/transactions");
    expect(header(calls[0], "Idempotency-Key")).toBe("ref_1");
    expect(jsonBody(calls[0])).toEqual({
      type: "refund",
      parent_transaction_id: "987",
      callback_url: "https://camps.example/api/payments/multicaixa-express/callback",
    });

    mockFetch({ body: { id: 555, status: "accepted" } });
    expect(await multicaixaExpress.checkRefund("555")).toEqual({ status: "SUCCEEDED" });
  });

  it("PayPal devolve a captura da ordem", async () => {
    const token = { body: { access_token: "tok" } };
    const calls = mockFetch(
      token,
      { body: { id: "ORDER-1", status: "COMPLETED", purchase_units: [{ payments: { captures: [{ id: "CAP-9", status: "COMPLETED" }] } }] } },
      token,
      { status: 201, body: { id: "REF-3", status: "COMPLETED" } },
    );
    expect(await paypal.refund({ ...refundInput, providerRef: "ORDER-1" })).toEqual({
      refundRef: "REF-3",
      outcome: { status: "SUCCEEDED" },
    });
    expect(calls[3].url).toBe("https://api-m.sandbox.paypal.com/v2/payments/captures/CAP-9/refund");
    expect(header(calls[3], "PayPal-Request-Id")).toBe("ref_1");
  });
});
