import { UserError } from "@/lib/errors";
import type { MulticaixaCredentials, Outcome, PaymentProvider } from "./types";

// Multicaixa Express através da API OPG da ProxyPay, que fala com o GPO da EMIS:
// o cliente recebe o pedido na app Multicaixa Express e confirma lá.
// Documentação: https://developer.proxypay.co.ao/opg/v1/
// Cada conta (a da Camps ou a de uma organização) tem o seu token e o seu ponto de venda; o
// dinheiro cai na conta dona das credenciais. Para trocar de agregador basta reescrever este ficheiro.

export const PROXYPAY_PRODUCTION = "https://api.proxypay.co.ao";
export const PROXYPAY_SANDBOX = "https://api.sandbox.proxypay.co.ao";

const REJECTION_REASONS: Record<string, string> = {
  "2001": "Saldo insuficiente",
  "2002": "Recusado pelo banco emissor",
  "2004": "O pedido expirou sem confirmação na app Multicaixa Express",
  "3000": "Pagamento recusado na app Multicaixa Express",
};

type Transaction = { id?: string | number; status?: string; status_reason?: string | number };

export function multicaixaExpress(credentials: MulticaixaCredentials | null): PaymentProvider {
  async function request(path: string, init: RequestInit = {}): Promise<Transaction> {
    if (!credentials) throw new Error("Multicaixa Express sem credenciais");
    const response = await fetch(`${credentials.baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${credentials.token}`, "Content-Type": "application/json", ...init.headers },
    });
    if (!response.ok) {
      throw new Error(`ProxyPay respondeu ${response.status} em ${path}: ${await response.text()}`);
    }
    return (await response.json()) as Transaction;
  }

  async function transactionOutcome(id: string, rejected: string): Promise<Outcome> {
    const transaction = await request(`/opg/v1/transactions/${encodeURIComponent(id)}`);
    if (transaction.status === "accepted") return { status: "SUCCEEDED" };
    if (transaction.status === "rejected") {
      return { status: "FAILED", reason: REJECTION_REASONS[String(transaction.status_reason)] ?? rejected };
    }
    return { status: "PENDING" };
  }

  return {
    id: "MULTICAIXA_EXPRESS",
    label: "Multicaixa Express",

    isConfigured() {
      return Boolean(credentials?.token) && Number.isInteger(credentials?.posId) && (credentials?.posId ?? 0) > 0;
    },

    async start({ paymentId, amountCents, currency, mobile, appUrl }) {
      if (currency !== "AOA") throw new UserError("O Multicaixa Express só aceita pagamentos em kwanzas");
      if (!mobile) throw new UserError("Informe o número de telemóvel associado ao Multicaixa Express");

      // A EMIS não consegue chamar um endereço local; nesse caso ficamos só pela consulta de estado.
      const isPublic = appUrl.startsWith("https://");
      const transaction = await request("/opg/v1/transactions", {
        method: "POST",
        headers: { "Idempotency-Key": paymentId },
        body: JSON.stringify({
          type: "payment",
          pos_id: credentials!.posId,
          mobile,
          amount: (amountCents / 100).toFixed(2),
          ...(isPublic ? { callback_url: `${appUrl}/api/payments/multicaixa-express/callback` } : {}),
        }),
      });
      if (transaction.id == null) throw new Error("ProxyPay não devolveu o id da transação");

      return { providerRef: String(transaction.id), chargeCurrency: "AOA", chargeAmountCents: amountCents };
    },

    async check(providerRef): Promise<Outcome> {
      return transactionOutcome(providerRef, "Pagamento recusado");
    },

    // A OPG só faz devoluções totais: uma transação "refund" ligada ao pagamento original.
    async refund({ refundId, providerRef, appUrl }) {
      const transaction = await request("/opg/v1/transactions", {
        method: "POST",
        headers: { "Idempotency-Key": refundId },
        body: JSON.stringify({
          type: "refund",
          parent_transaction_id: providerRef,
          ...(appUrl.startsWith("https://") ? { callback_url: `${appUrl}/api/payments/multicaixa-express/callback` } : {}),
        }),
      });
      if (transaction.id == null) throw new Error("ProxyPay não devolveu o id da devolução");
      return { refundRef: String(transaction.id), outcome: { status: "PENDING" } };
    },

    async checkRefund(refundRef) {
      return transactionOutcome(refundRef, "Devolução recusada");
    },
  };
}
