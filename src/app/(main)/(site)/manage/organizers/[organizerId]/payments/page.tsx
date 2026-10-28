import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BillingDetailsCard } from "@/components/manage/invoices";
import { PaymentAccountForms } from "@/components/manage/payment-account";
import { Notice } from "@/components/manage/parts";
import { BackLink, PageTitle } from "@/components/ui";
import { UserError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { describeAccount, getPaymentAccount, requireOrganizerAccountAccess } from "@/server/payment-accounts";
import { updateOrganizerBillingAction } from "../../../event-actions";

async function Payments({ params }: { params: Promise<{ organizerId: string }> }) {
  const { organizerId } = await params;
  const user = await requireUser();
  const organizer = await requireOrganizerAccountAccess(user.id, organizerId).catch((error) => {
    if (error instanceof UserError) return null;
    throw error;
  });
  if (!organizer) notFound();
  const [account, billing] = await Promise.all([
    getPaymentAccount({ organizerId }),
    prisma.organizer.findUniqueOrThrow({ where: { id: organizerId }, select: { billingName: true, billingNif: true, billingAddress: true } }),
  ]);
  const view = describeAccount(account);

  return (
    <>
      <BackLink href="/manage">Os meus eventos</BackLink>
      <header className="mt-3 mb-8 border-b border-line pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{organizer.name}</p>
        <div className="mt-2">
          <PageTitle>Conta de pagamentos</PageTitle>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          As inscrições pagas pelos atletas caem direto na conta da organização: a Camps não guarda o dinheiro nem fica com
          parte dele. A Camps cobra à organização em créditos (1 por atleta confirmado).
        </p>
      </header>
      {!view.proxypay.configured && !view.paypal.configured && (
        <div className="mb-6">
          <Notice>Enquanto não ligar uma conta, as categorias pagas não aceitam inscrições online. As gratuitas e as inscrições feitas à mão funcionam.</Notice>
        </div>
      )}
      <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <PaymentAccountForms kind="organizer" id={organizerId} account={view} />
        <BillingDetailsCard action={updateOrganizerBillingAction.bind(null, organizerId)} billing={billing} owner={organizer.name} />
      </div>
    </>
  );
}

export default function OrganizerPaymentsPage({ params }: PageProps<"/manage/organizers/[organizerId]/payments">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Payments params={params} />
    </Suspense>
  );
}
