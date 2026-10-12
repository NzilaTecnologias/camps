import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { AutoRefresh } from "@/components/auto-refresh";
import { PaymentFields } from "@/components/payment-fields";
import { formatMoney } from "@/lib/format";
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
  const price = formatMoney(registration.priceCents, event.currency);
  // Nestes dois casos o desfecho vem de fora e não faz sentido oferecer outro pagamento.
  const isAwaiting = pending?.provider === "MULTICAIXA_EXPRESS" || pending?.provider === "SIMULATOR";

  return (
    <div className="max-w-md">
      <header className="mb-6">
        <Link href="/registrations" className="text-sm opacity-60 hover:opacity-100">
          ← As minhas inscrições
        </Link>
        <h1 className="text-2xl font-bold">
          {registration.athlete.firstName} {registration.athlete.lastName}
        </h1>
        <p className="opacity-70">
          <Link href={`/events/${event.slug}/divisions/${registration.division.id}`} className="hover:underline">
            {event.name} · {registration.division.name}
          </Link>
        </p>
      </header>

      {registration.status === "PAID" && (
        <p className="rounded-lg border border-emerald-600/40 bg-emerald-600/10 p-4">
          Inscrição confirmada{registration.priceCents > 0 && ` · ${price} pagos`}.
        </p>
      )}

      {registration.status === "INCOMPLETE" && pending?.provider === "MULTICAIXA_EXPRESS" && (
        <div className="rounded-lg border border-foreground/15 p-4">
          <AutoRefresh seconds={5} />
          <p className="font-medium">Confirme o pagamento de {price} na app Multicaixa Express.</p>
          <p className="mt-1 text-sm opacity-70">
            Enviámos o pedido para o seu telemóvel. Esta página atualiza sozinha assim que o pagamento for
            confirmado; o pedido expira ao fim de cerca de um minuto e meio.
          </p>
        </div>
      )}

      {registration.status === "INCOMPLETE" && pending?.provider === "SIMULATOR" && (
        <div className="space-y-3 rounded-lg border border-dashed border-foreground/30 p-4">
          <p className="text-sm opacity-70">Simulador de pagamentos: escolha o desfecho. Ninguém é cobrado.</p>
          <div className="flex gap-3">
            <ActionForm action={simulatePaymentAction.bind(null, pending.id, true)} submitLabel="Simular aprovado">
              {null}
            </ActionForm>
            <ActionForm action={simulatePaymentAction.bind(null, pending.id, false)} submitLabel="Simular recusado">
              {null}
            </ActionForm>
          </div>
        </div>
      )}

      {registration.status === "INCOMPLETE" && !isAwaiting && (
        <section className="space-y-4">
          {pending?.provider === "PAYPAL" ? (
            <p className="text-sm opacity-70">
              O pagamento no PayPal ainda não foi concluído. Pode tentar de novo abaixo.
            </p>
          ) : (
            lastFailure && (
              <p role="alert" className="text-sm text-red-600">
                O último pagamento não foi concluído: {lastFailure.failureReason ?? "sem detalhe"}.
              </p>
            )
          )}
          {closedReason ? (
            <p className="opacity-70">{closedReason}.</p>
          ) : (
            <ActionForm
              action={payAction.bind(null, registration.id)}
              submitLabel={`Pagar ${price}`}
              className="space-y-4"
            >
              <PaymentFields providers={providers} />
            </ActionForm>
          )}
        </section>
      )}
    </div>
  );
}

export default function RegistrationPage({ params }: PageProps<"/registrations/[registrationId]">) {
  return (
    <Suspense fallback={<p className="opacity-60">A carregar…</p>}>
      <RegistrationDetails params={params} />
    </Suspense>
  );
}
