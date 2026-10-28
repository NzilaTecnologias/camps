import { Suspense } from "react";
import { PaymentAccountForms } from "@/components/manage/payment-account";
import { Notice, SectionHeader, StatTile } from "@/components/manage/parts";
import { formatMoney } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { getFederationQuotas, getFederationWorkspace } from "@/server/federations";
import { describeAccount, getPaymentAccount } from "@/server/payment-accounts";

async function Payments({ params }: { params: Promise<{ federationId: string }> }) {
  const { federationId } = await params;
  const user = await requireUser();
  const federation = await getFederationWorkspace(user.id, federationId);
  if (!federation) return null;
  const [quotas, account] = await Promise.all([getFederationQuotas(federation.id), getPaymentAccount({ federationId: federation.id })]);
  const view = describeAccount(account);
  const money = (cents: number) => formatMoney(cents, "AOA");
  return (
    <>
      <SectionHeader
        title="Receber quotas"
        description="As quotas de filiação pagas online caem direto na conta da federação, sem passar pela Camps e sem taxa. A Camps é paga pela assinatura do plano."
      />
      {!view.proxypay.configured && !view.paypal.configured && (
        <div className="mb-6">
          <Notice>Enquanto não ligar uma conta, os atletas não conseguem pagar a filiação online.</Notice>
        </div>
      )}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatTile icon="ticket" tone="primary" label="Quotas recebidas" value={money(quotas.collectedCents)} />
        <StatTile icon="refund" label="Reembolsado" value={money(quotas.refundedCents)} hint="Devolvido aos atletas" />
        <StatTile icon="wallet" tone="success" label="Líquido" value={money(quotas.netCents)} />
      </div>
      <PaymentAccountForms kind="federation" id={federation.id} account={view} />
    </>
  );
}

export default function FederationPaymentsPage({ params }: PageProps<"/manage/federations/[federationId]/payments">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Payments params={params} />
    </Suspense>
  );
}
