import type { PaymentAccount } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { rolesWith } from "@/lib/organizer-permissions";
import { requireFederation } from "./federations";
import { PROXYPAY_PRODUCTION, PROXYPAY_SANDBOX } from "./payments/multicaixa-express";
import { PAYPAL_PRODUCTION, PAYPAL_SANDBOX, paypalAccessToken } from "./payments/paypal";
import { encryptSecret } from "./secrets";

// Conta de pagamentos de uma organização (inscrições) ou de uma federação (quotas): as
// credenciais da conta ProxyPay e/ou PayPal dela, como a ligação ao Stripe no Smoothcomp. O
// dinheiro dos atletas cai direto nessa conta. Os segredos guardam-se cifrados e nunca voltam a
// ser mostrados; deixar o campo em branco mantém o que já estava.

export type Owner = { organizerId: string } | { federationId: string };

/** O que a página mostra da conta, sem os segredos. */
export function describeAccount(account: PaymentAccount | null) {
  return {
    proxypay: {
      configured: Boolean(account?.proxypayToken && account.proxypayPosId),
      posId: account?.proxypayPosId ?? null,
      sandbox: account?.proxypaySandbox ?? false,
    },
    paypal: {
      configured: Boolean(account?.paypalClientId && account.paypalSecret),
      clientId: account?.paypalClientId ?? null,
      sandbox: account?.paypalSandbox ?? false,
      currency: account?.paypalCurrency ?? "USD",
      exchangeRate: account?.paypalExchangeRate ?? null,
    },
  };
}

export type AccountView = ReturnType<typeof describeAccount>;

const where = (owner: Owner) => ("organizerId" in owner ? { organizerId: owner.organizerId } : { federationId: owner.federationId });

export function getPaymentAccount(owner: Owner) {
  return prisma.paymentAccount.findUnique({ where: where(owner) });
}

/** Só o dono da organização liga ou muda a conta onde caem as inscrições. */
export async function requireOrganizerAccountAccess(userId: string, organizerId: string) {
  const member = await prisma.organizerMember.findFirst({
    where: { organizerId, userId, role: { in: rolesWith("payout") } },
    select: { organizer: { select: { id: true, name: true } } },
  });
  if (!member) throw new UserError("Só o dono da organização pode ligar a conta de pagamentos");
  return member.organizer;
}

export async function requireFederationAccountAccess(userId: string, federationId: string) {
  return requireFederation(userId, federationId);
}

// As credenciais confirmam-se junto do provedor antes de se guardarem, em produção. Em
// desenvolvimento e nos testes não há contas reais para confirmar.
const verifying = () => process.env.NODE_ENV === "production";

async function verifyProxyPay(token: string, sandbox: boolean) {
  if (!verifying()) return;
  try {
    // Uma transação que não existe: 404 com um token válido, 401/403 com um errado.
    const response = await fetch(`${sandbox ? PROXYPAY_SANDBOX : PROXYPAY_PRODUCTION}/opg/v1/transactions/verificacao-camps`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 401 || response.status === 403) throw new UserError("A ProxyPay recusou o token: confirme-o na sua conta ProxyPay");
  } catch (error) {
    if (error instanceof UserError) throw error;
    throw new UserError("Não foi possível contactar a ProxyPay para confirmar o token. Tente de novo dentro de instantes.");
  }
}

async function verifyPayPal(clientId: string, clientSecret: string, sandbox: boolean) {
  if (!verifying()) return;
  try {
    await paypalAccessToken({ baseUrl: sandbox ? PAYPAL_SANDBOX : PAYPAL_PRODUCTION, clientId, clientSecret });
  } catch {
    throw new UserError("O PayPal recusou o client id ou o segredo: confirme-os na sua conta PayPal (My Apps & Credentials)");
  }
}

export type ProxyPayInput = { token: string; posId: string; sandbox: boolean };

/** Liga (ou muda) o Multicaixa Express via ProxyPay. Token em branco mantém o guardado. */
export async function saveProxyPay(owner: Owner, input: ProxyPayInput) {
  const current = await getPaymentAccount(owner);
  const token = input.token.trim();
  if (!token && !current?.proxypayToken) throw new UserError("Indique o token da API da ProxyPay");
  if (token && (token.length < 10 || token.length > 500)) throw new UserError("O token da ProxyPay não parece válido");
  const posId = Number(input.posId);
  if (!Number.isInteger(posId) || posId <= 0) throw new UserError("Indique o número do ponto de venda (POS) da ProxyPay");
  if (token) await verifyProxyPay(token, input.sandbox);
  const data = {
    ...(token ? { proxypayToken: encryptSecret(token) } : {}),
    proxypayPosId: posId,
    proxypaySandbox: input.sandbox,
  };
  await prisma.paymentAccount.upsert({ where: where(owner), update: data, create: { ...where(owner), ...data } });
}

export type PayPalInput = { clientId: string; secret: string; sandbox: boolean; currency: string; exchangeRate: string };

/** Liga (ou muda) o PayPal. Segredo em branco mantém o guardado. */
export async function savePayPal(owner: Owner, input: PayPalInput) {
  const current = await getPaymentAccount(owner);
  const clientId = input.clientId.trim();
  const secret = input.secret.trim();
  if (clientId.length < 10 || clientId.length > 200) throw new UserError("Indique o client id do PayPal");
  if (!secret && !current?.paypalSecret) throw new UserError("Indique o segredo (secret) do PayPal");
  const currency = input.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency) || currency === "AOA") throw new UserError("Indique a moeda da conta PayPal (ex.: USD ou EUR)");
  const exchangeRate = Number(input.exchangeRate.replace(",", "."));
  if (!(exchangeRate > 0 && exchangeRate < 1_000_000)) {
    throw new UserError(`Indique quantos kwanzas vale 1 ${currency}: o PayPal não cobra em kwanzas`);
  }
  // O segredo antigo só se pode reaproveitar com o mesmo client id.
  if (!secret && current?.paypalClientId !== clientId) throw new UserError("Mudou o client id: indique também o segredo novo");
  if (secret) await verifyPayPal(clientId, secret, input.sandbox);
  const data = {
    paypalClientId: clientId,
    ...(secret ? { paypalSecret: encryptSecret(secret) } : {}),
    paypalSandbox: input.sandbox,
    paypalCurrency: currency,
    paypalExchangeRate: exchangeRate,
  };
  await prisma.paymentAccount.upsert({ where: where(owner), update: data, create: { ...where(owner), ...data } });
}

/** Desliga um dos métodos. Os pagamentos já feitos continuam ligados à conta para as devoluções. */
export async function removeMethod(owner: Owner, method: "MULTICAIXA_EXPRESS" | "PAYPAL") {
  const data =
    method === "MULTICAIXA_EXPRESS"
      ? { proxypayToken: null, proxypayPosId: null, proxypaySandbox: false }
      : { paypalClientId: null, paypalSecret: null, paypalSandbox: false };
  await prisma.paymentAccount.updateMany({ where: where(owner), data });
}
