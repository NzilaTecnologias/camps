import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { AutoRefresh } from "@/components/auto-refresh";
import { PaymentFields } from "@/components/payment-fields";
import { BackLink, Badge, Card, Icon, PageTitle } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { getMyMembership } from "@/server/memberships";
import { payMembershipAction, simulateMembershipPaymentAction } from "../actions";

async function MembershipDetails({ params }: { params: Promise<{ membershipId: string }> }) {
  const { membershipId } = await params;
  const user = await requireUser();
  const details = await getMyMembership(user.id, membershipId);
  if (!details) notFound();
  const { membership, providers } = details;
  const pending = membership.payments.find((payment) => payment.status === "PENDING");
  const lastFailure = membership.payments.find((payment) => payment.status === "FAILED");
  const price = formatMoney(membership.priceCents, "AOA");
  const awaiting = pending?.provider === "MULTICAIXA_EXPRESS" || pending?.provider === "SIMULATOR";
  const refunded = membership.payments.find((payment) => payment.status === "REFUNDED");

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink href="/registrations">As minhas inscrições e filiações</BackLink>
      <header className="mt-3 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <PageTitle>
            {membership.athlete.firstName} {membership.athlete.lastName}
          </PageTitle>
          <p className="mt-2 text-sm text-muted">
            Filiação na{" "}
            <Link href={`/f/${membership.federation.slug}`} className="hover:text-primary hover:underline">
              {membership.federation.name}
            </Link>{" "}
            · {membership.plan.name}
          </p>
        </div>
        {membership.status === "ACTIVE" ? (
          <Badge tone="success">Em dia</Badge>
        ) : membership.status === "CANCELLED" ? (
          <Badge>{refunded ? "Reembolsada" : "Cancelada"}</Badge>
        ) : (
          <Badge tone="warning">Por pagar</Badge>
        )}
      </header>

      {membership.status === "ACTIVE" && membership.validUntil && (
        <div className="flex items-center gap-3 rounded-xl border border-success/40 bg-success/10 p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success text-white">
            <Icon name="check" className="h-5 w-5" />
          </span>
          <p className="font-semibold">Filiação em dia até {formatDate(membership.validUntil)}.</p>
        </div>
      )}

      {membership.status === "CANCELLED" && (
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="font-semibold">{refunded ? "Filiação cancelada e reembolsada." : "Esta filiação foi cancelada."}</p>
          {refunded && (
            <p className="mt-1 text-sm text-muted">
              {price} devolvidos pela federação{refunded.refund?.reason && ` · ${refunded.refund.reason}`}.
            </p>
          )}
        </div>
      )}

      {membership.status === "PENDING" && pending?.provider === "MULTICAIXA_EXPRESS" && (
        <Card className="p-5">
          <AutoRefresh seconds={5} />
          <p className="font-semibold">Confirme o pagamento de {price} na app Multicaixa Express.</p>
          <p className="mt-1 text-sm text-muted">Esta página atualiza sozinha assim que o pagamento for confirmado.</p>
        </Card>
      )}

      {membership.status === "PENDING" && pending?.provider === "SIMULATOR" && (
        <div className="space-y-4 rounded-xl border-2 border-dashed border-warning/50 bg-warning/5 p-5">
          <p className="text-sm font-medium">Simulador de pagamentos: escolha o desfecho. Ninguém é cobrado.</p>
          <div className="flex flex-wrap gap-3">
            <ActionForm action={simulateMembershipPaymentAction.bind(null, pending.id, true)} submitLabel="Simular aprovado">
              {null}
            </ActionForm>
            <ActionForm action={simulateMembershipPaymentAction.bind(null, pending.id, false)} submitLabel="Simular recusado" submitVariant="secondary">
              {null}
            </ActionForm>
          </div>
        </div>
      )}

      {membership.status === "PENDING" && !awaiting && (
        <Card className="p-6">
          <h2 className="mb-4 font-display text-xl font-bold uppercase leading-none">Pagamento</h2>
          {lastFailure && (
            <p role="alert" className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
              O último pagamento não foi concluído: {lastFailure.failureReason ?? "sem detalhe"}.
            </p>
          )}
          <ActionForm action={payMembershipAction.bind(null, membership.id)} submitLabel={`Pagar ${price}`} className="flex flex-col gap-4">
            <PaymentFields providers={providers} />
          </ActionForm>
        </Card>
      )}
    </div>
  );
}

export default function MembershipPage({ params }: PageProps<"/memberships/[membershipId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <MembershipDetails params={params} />
    </Suspense>
  );
}
