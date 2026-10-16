export type ProviderId = "MULTICAIXA_EXPRESS" | "PAYPAL" | "SIMULATOR";

export type StartInput = {
  /** Id do nosso Payment: serve de chave de idempotência e de referência no provedor. */
  paymentId: string;
  amountCents: number;
  currency: string;
  description: string;
  /** Telemóvel já normalizado (9 dígitos); só o Multicaixa Express usa. */
  mobile: string | null;
  /** Endereço público da aplicação, sem barra final. */
  appUrl: string;
};

export type StartResult = {
  providerRef: string;
  /** O que o provedor vai cobrar, que pode estar noutra moeda. */
  chargeCurrency: string;
  chargeAmountCents: number;
  /** Para onde mandar o utilizador, quando o pagamento é concluído fora da plataforma. */
  redirectUrl?: string;
};

export type Outcome =
  | { status: "PENDING" }
  | { status: "SUCCEEDED" }
  | { status: "FAILED"; reason: string };

export interface PaymentProvider {
  id: ProviderId;
  label: string;
  /** Verdadeiro quando as credenciais estão no ambiente. */
  isConfigured(): boolean;
  start(input: StartInput): Promise<StartResult>;
  /**
   * Pergunta ao provedor o estado da transação. É a única fonte de verdade:
   * callbacks e retornos do navegador só servem de aviso para vir perguntar.
   */
  check(providerRef: string): Promise<Outcome>;
  /** Pede a devolução total de um pagamento concluído. */
  refund(input: RefundInput): Promise<RefundStarted>;
  /** Estado de uma devolução pedida antes. */
  checkRefund(refundRef: string): Promise<Outcome>;
}

export type RefundInput = {
  /** Id do nosso Refund: chave de idempotência no provedor. */
  refundId: string;
  /** Referência do pagamento original no provedor. */
  providerRef: string;
  appUrl: string;
};

export type RefundStarted = { refundRef: string; outcome: Outcome };
