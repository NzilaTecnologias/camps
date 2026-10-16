import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { AutoRefresh } from "@/components/auto-refresh";
import { PaymentFields } from "@/components/payment-fields";
import { RegistrationStatusBadge } from "@/components/status-badges";
import { BackLink, Card, Icon, PageTitle } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { getMyRegistration } from "@/server/registrations";
import { payAction, simulatePaymentAction } from "../actions";

async function RegistrationDetails({ params }: { params: Promise<{ registrationId: string }> }) {
  const { registrationId } = await params;
  const user = await requireUser();
  const details = await getMyRegistration(user.id, registrationId);
  if (!details) notFound();
  const { registration, providers, closedReason } = details;
  const { event } = registration.division;
  const pending = registration.payments.find((payment) => payment.status === "PENDING");
  const lastFailure = registration.payments.find((payment) => payment.status === "FAILED");
  const refunded = registration.payments.find((payment) => payment.status === "REFUNDED");
  const price = formatMoney(registration.priceCents, event.currency);
  // Nestes dois casos o desfecho vem de fora e não faz sentido oferecer outro pagamento.
  const isAwaiting = pending?.provider === "MULTICAIXA_EXPRESS" || pending?.provider === "SIMULATOR";

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink href="/registrations">As minhas inscrições</BackLink>
      <header className="mt-3 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <PageTitle>
            {registration.athlete.firstName} {registration.athlete.lastName}
          </PageTitle>
          <p className="mt-2 text-sm text-muted">
            <Link
              href={`/events/${event.slug}/divisions/${registration.division.id}`}
              className="hover:text-primary hover:underline"
            >
              {event.name} · {registration.division.name}
            </Link>
          </p>
        </div>
        <RegistrationStatusBadge status={registration.status} />
      </header>

      <Card className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4 text-sm">
        <span className="flex items-center gap-2 text-muted">
          <Icon name="calendar" />
          {formatDate(event.startsAt)}
        </span>
        <span className="flex items-center gap-2 text-muted">
          <Icon name="pin" />
          {[event.venue, event.city].filter(Boolean).join(", ") || "Local a definir"}
        </span>
        <span className="ml-auto font-display text-2xl font-bold leading-none">
          {registration.priceCents === 0 ? "Gratuita" : price}
        </span>
      </Card>

      {registration.discountCents > 0 && (
        <p className="-mt-3 mb-6 text-sm text-success">
          Desconto de {formatMoney(registration.discountCents, event.currency)} aplicado
          {registration.coupon && ` (cupão ${registration.coupon.code})`}.
        </p>
      )}

      {registration.status === "CANCELLED" && refunded && (
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="font-semibold">Inscrição cancelada e reembolsada.</p>
          <p className="mt-1 text-sm text-muted">
            {formatMoney(refunded.amountCents, event.currency)} devolvidos pelo organizador
            {refunded.refund?.reason && ` · ${refunded.refund.reason}`}.
          </p>
        </div>
      )}

      {registration.status === "CANCELLED" && !refunded && (
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="font-semibold">Esta inscrição foi cancelada.</p>
        </div>
      )}

      {registration.status === "PAID" && (
        <div className="flex items-center gap-3 rounded-xl border border-success/40 bg-success/10 p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success text-white">
            <Icon name="check" className="h-5 w-5" />
          </span>
          <p className="font-semibold">
            Inscrição confirmada{registration.priceCents > 0 && ` · ${price} pagos`}.
          </p>
        </div>
      )}

      {registration.status === "INCOMPLETE" && pending?.provider === "MULTICAIXA_EXPRESS" && (
        <Card className="p-5">
          <AutoRefresh seconds={5} />
          <p className="font-semibold">Confirme o pagamento de {price} na app Multicaixa Express.</p>
          <p className="mt-1 text-sm text-muted">
            Enviámos o pedido para o seu telemóvel. Esta página atualiza sozinha assim que o pagamento for
            confirmado; o pedido expira ao fim de cerca de um minuto e meio.
          </p>
        </Card>
      )}

      {registration.status === "INCOMPLETE" && pending?.provider === "SIMULATOR" && (
        <div className="space-y-4 rounded-xl border-2 border-dashed border-warning/50 bg-warning/5 p-5">
          <p className="text-sm font-medium">Simulador de pagamentos: escolha o desfecho. Ninguém é cobrado.</p>
          <div className="flex flex-wrap gap-3">
            <ActionForm action={simulatePaymentAction.bind(null, pending.id, true)} submitLabel="Simular aprovado">
              {null}
            </ActionForm>
            <ActionForm
              action={simulatePaymentAction.bind(null, pending.id, false)}
              submitLabel="Simular recusado"
              submitVariant="secondary"
            >
              {null}
            </ActionForm>
          </div>
        </div>
      )}

      {registration.status === "INCOMPLETE" && !isAwaiting && (
        <Card className="p-6">
          <h2 className="mb-4 font-display text-xl font-bold uppercase leading-none">Pagamento</h2>
          {pending?.provider === "PAYPAL" ? (
            <p className="mb-4 text-sm text-muted">
              O pagamento no PayPal ainda não foi concluído. Pode tentar de novo abaixo.
            </p>
          ) : (
            lastFailure && (
              <p role="alert" className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
                O último pagamento não foi concluído: {lastFailure.failureReason ?? "sem detalhe"}.
              </p>
            )
          )}
          {closedReason ? (
            <p className="text-sm text-muted">{closedReason}.</p>
          ) : (
            <ActionForm
              action={payAction.bind(null, registration.id)}
              submitLabel={`Pagar ${price}`}
              className="flex flex-col gap-4"
            >
              <PaymentFields providers={providers} />
            </ActionForm>
          )}
        </Card>
      )}
    </div>
  );
}

export default function RegistrationPage({ params }: PageProps<"/registrations/[registrationId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <RegistrationDetails params={params} />
    </Suspense>
  );
}
