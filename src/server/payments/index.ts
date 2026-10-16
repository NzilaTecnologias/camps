import { multicaixaExpress } from "./multicaixa-express";
import { paypal } from "./paypal";
import type { PaymentProvider, ProviderId } from "./types";

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

const providers: Record<ProviderId, PaymentProvider> = {
  MULTICAIXA_EXPRESS: multicaixaExpress,
  PAYPAL: paypal,
  SIMULATOR: simulator,
};

export function availableProviders(): PaymentProvider[] {
  return Object.values(providers).filter((provider) => provider.isConfigured());
}

export function getProvider(id: string): PaymentProvider | null {
  const provider = providers[id as ProviderId];
  return provider?.isConfigured() ? provider : null;
}

/** Devolve o provedor mesmo sem credenciais, para acertar pagamentos antigos. */
export function providerFor(id: ProviderId): PaymentProvider {
  return providers[id];
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
