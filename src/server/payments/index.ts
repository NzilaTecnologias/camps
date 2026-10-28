import type { PaymentAccount } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { decryptSecret } from "../secrets";
import { multicaixaExpress, PROXYPAY_PRODUCTION, PROXYPAY_SANDBOX } from "./multicaixa-express";
import { paypal, PAYPAL_PRODUCTION, PAYPAL_SANDBOX } from "./paypal";
import type { MulticaixaCredentials, PayPalCredentials, PaymentProvider, ProviderId } from "./types";

// Quem recebe cada pagamento, como no Smoothcomp:
//   - a Camps (as contas do .env): compras de créditos e o Plano Federação;
//   - a organização ou a federação (a conta de pagamentos dela, PaymentAccount): inscrições e
//     quotas de filiação. O dinheiro cai direto lá; a Camps não o guarda nem faz repasses.

export type Payee = { kind: "platform" } | { kind: "account"; account: PaymentAccount | null };

export const PLATFORM: Payee = { kind: "platform" };

export const accountPayee = (account: PaymentAccount | null): Payee => ({ kind: "account", account });

/**
 * Provedor de faz-de-conta para desenvolvimento: não cobra ninguém e o resultado é escolhido
 * à mão na página da inscrição. Só existe com PAYMENTS_SIMULATOR=1 e nunca num build de produção,
 * mesmo que a variável lá fique esquecida: deixaria qualquer pessoa inscrever-se sem pagar.
 */
const simulator: PaymentProvider = {
  id: "SIMULATOR",
  label: "Simulador (só para testes)",
  isConfigured: () => process.env.PAYMENTS_SIMULATOR === "1" && process.env.NODE_ENV !== "production",
  async start({ paymentId, amountCents, currency }) {
    return { providerRef: `sim_${paymentId}`, chargeCurrency: currency, chargeAmountCents: amountCents };
  },
  async check() {
    return { status: "PENDING" };
  },
  async refund({ refundId }) {
    return { refundRef: `sim_${refundId}`, outcome: { status: "SUCCEEDED" } };
  },
  async checkRefund() {
    return { status: "SUCCEEDED" };
  },
};

function platformCredentials(): { mcx: MulticaixaCredentials | null; paypal: PayPalCredentials | null } {
  const posId = Number(process.env.PROXYPAY_POS_ID);
  return {
    mcx: process.env.PROXYPAY_TOKEN
      ? { baseUrl: process.env.PROXYPAY_API_URL || PROXYPAY_PRODUCTION, token: process.env.PROXYPAY_TOKEN, posId }
      : null,
    paypal:
      process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET
        ? {
            baseUrl: process.env.PAYPAL_API_URL || PAYPAL_PRODUCTION,
            clientId: process.env.PAYPAL_CLIENT_ID,
            clientSecret: process.env.PAYPAL_CLIENT_SECRET,
            currency: process.env.PAYPAL_CURRENCY || "USD",
            exchangeRate: Number(process.env.PAYPAL_EXCHANGE_RATE),
          }
        : null,
  };
}

/** Credenciais de uma conta de pagamentos, com os segredos já decifrados. */
export function accountCredentials(account: PaymentAccount): { mcx: MulticaixaCredentials | null; paypal: PayPalCredentials | null } {
  return {
    mcx:
      account.proxypayToken && account.proxypayPosId
        ? {
            baseUrl: account.proxypaySandbox ? PROXYPAY_SANDBOX : PROXYPAY_PRODUCTION,
            token: decryptSecret(account.proxypayToken),
            posId: account.proxypayPosId,
          }
        : null,
    paypal:
      account.paypalClientId && account.paypalSecret
        ? {
            baseUrl: account.paypalSandbox ? PAYPAL_SANDBOX : PAYPAL_PRODUCTION,
            clientId: account.paypalClientId,
            clientSecret: decryptSecret(account.paypalSecret),
            currency: account.paypalCurrency,
            exchangeRate: account.paypalExchangeRate ?? 0,
          }
        : null,
  };
}

function providers(payee: Payee): Record<ProviderId, PaymentProvider> {
  const credentials =
    payee.kind === "platform" ? platformCredentials() : payee.account ? accountCredentials(payee.account) : { mcx: null, paypal: null };
  return {
    MULTICAIXA_EXPRESS: multicaixaExpress(credentials.mcx),
    PAYPAL: paypal(credentials.paypal),
    SIMULATOR: simulator,
  };
}

/** Os métodos com que se pode pagar a este destinatário agora. */
export function paymentMethods(payee: Payee): PaymentProvider[] {
  return Object.values(providers(payee)).filter((provider) => provider.isConfigured());
}

/** Os métodos reais (sem o simulador) que o destinatário tem configurados. */
export function realPaymentMethods(payee: Payee): PaymentProvider[] {
  return paymentMethods(payee).filter((provider) => provider.id !== "SIMULATOR");
}

export function getProvider(payee: Payee, id: string): PaymentProvider | null {
  const provider = providers(payee)[id as ProviderId];
  return provider?.isConfigured() ? provider : null;
}

/** O provedor de um pagamento já feito, mesmo que a conta tenha mudado: para consultar e devolver. */
export function providerFor(id: ProviderId, payee: Payee): PaymentProvider {
  return providers(payee)[id];
}

/** O destinatário de um pagamento guardado: a conta com que foi cobrado (nula = simulador). */
export async function payeeOf(accountId: string | null): Promise<Payee> {
  return accountPayee(accountId ? await prisma.paymentAccount.findUnique({ where: { id: accountId } }) : null);
}

/** O simulador, para as ações "Simular aprovado / recusado" (só em desenvolvimento). */
export function simulatorEnabled(): boolean {
  return simulator.isConfigured();
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
