import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { DataTable, Notice, SectionHeader, StatTile } from "@/components/manage/parts";
import { Badge, Empty } from "@/components/ui";
import { formatDateTime, formatMoney } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { getEventWorkspace, listEventPayments } from "@/server/organizer";
import { refundAction } from "../../../event-actions";

const PROVIDER_LABEL = { MULTICAIXA_EXPRESS: "Multicaixa Express", PAYPAL: "PayPal", SIMULATOR: "Simulador" } as const;

type Payment = Awaited<ReturnType<typeof listEventPayments>>[number];

function PaymentStatus({ payment }: { payment: Payment }) {
  if (payment.status === "REFUNDED") return <Badge>Reembolsado</Badge>;
  if (payment.status === "PENDING") return <Badge tone="warning">Pendente</Badge>;
  if (payment.refund?.status === "PENDING") return <Badge tone="warning">Reembolso em curso</Badge>;
  return <Badge tone="success">Pago</Badge>;
}

function RefundForm({ payment, currency }: { payment: Payment; currency: string }) {
  return (
    <details className="group">
      <summary className="inline-flex h-8 cursor-pointer list-none items-center rounded-full border border-line px-3 text-xs font-semibold hover:border-foreground/40">
        Reembolsar
      </summary>
      <div className="mt-3 w-72 rounded-lg border border-line bg-surface-2 p-3 text-left">
        <ActionForm action={refundAction.bind(null, payment.id)} submitLabel={`Devolver ${formatMoney(payment.amountCents, currency)}`} className="flex flex-col gap-3">
          <Field label="Motivo" name="reason" placeholder="Lesão, desistência, erro…" maxLength={300} required />
          <fieldset className="space-y-2 text-sm">
            <legend className="mb-1 font-medium">Como devolver</legend>
            <label className="flex items-start gap-2">
              <input type="radio" name="manual" value="0" defaultChecked className="mt-1" />
              <span>Pelo {PROVIDER_LABEL[payment.provider]}, para a conta de onde veio</span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name="manual" value="1" className="mt-1" />
              <span>Já devolvi fora da plataforma (numerário, transferência)</span>
            </label>
          </fieldset>
        </ActionForm>
      </div>
    </details>
  );
}

async function Payments({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await requireUser();
  const [event, payments] = await Promise.all([getEventWorkspace(user.id, eventId), listEventPayments(user.id, eventId)]);
  if (!event) return null;

  const sum = (rows: Payment[]) => rows.reduce((total, payment) => total + payment.amountCents, 0);
  const collected = payments.filter((payment) => payment.status === "SUCCEEDED" || payment.status === "REFUNDED");
  const refunded = payments.filter((payment) => payment.status === "REFUNDED");
  const pending = payments.filter((payment) => payment.status === "PENDING");
  const discounts = collected.reduce((total, payment) => total + payment.registration.discountCents, 0);

  return (
    <>
      <SectionHeader
        title="Pagamentos e reembolsos"
        description="Tudo o que foi cobrado neste evento. Um reembolso devolve o valor total e cancela a inscrição."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <StatTile icon="wallet" tone="success" label="Cobrado" value={formatMoney(sum(collected), event.currency)} hint={`${collected.length} pagamentos`} />
        <StatTile icon="refund" label="Reembolsado" value={formatMoney(sum(refunded), event.currency)} hint={`${refunded.length} reembolsos`} />
        <StatTile icon="check" tone="primary" label="Líquido" value={formatMoney(sum(collected) - sum(refunded), event.currency)} />
        <StatTile icon="ticket" tone="warning" label="Descontos dados" value={formatMoney(discounts, event.currency)} hint={`${pending.length} pagamentos pendentes`} />
      </div>

      {payments.length === 0 ? (
        <Empty>Ainda não há pagamentos neste evento.</Empty>
      ) : (
        <DataTable head={["Atleta", "Método", "Valor", "Data", "Estado", ""]}>
          {payments.map((payment) => (
            <tr key={payment.id} id={`pagamento-${payment.id}`} className="scroll-mt-24 align-top transition-colors hover:bg-surface-2 target:bg-primary/10">
              <td className="px-4 py-3">
                <p className="font-semibold">
                  {payment.registration.athlete.firstName} {payment.registration.athlete.lastName}
                </p>
                <p className="text-xs text-muted">{payment.registration.division.name}</p>
              </td>
              <td className="px-4 py-3">
                <p>{PROVIDER_LABEL[payment.provider]}</p>
                {payment.providerRef && <p className="font-mono text-xs text-muted">{payment.providerRef}</p>}
              </td>
              <td className="px-4 py-3 tabular-nums">
                <p className="font-semibold">{formatMoney(payment.amountCents, event.currency)}</p>
                {payment.chargeCurrency !== event.currency && (
                  <p className="text-xs text-muted">cobrado {formatMoney(payment.chargeAmountCents, payment.chargeCurrency)}</p>
                )}
                {payment.registration.coupon && <p className="text-xs text-success">cupão {payment.registration.coupon.code}</p>}
              </td>
              <td className="px-4 py-3 text-muted">{formatDateTime(payment.settledAt ?? payment.createdAt)}</td>
              <td className="px-4 py-3">
                <PaymentStatus payment={payment} />
                {payment.refund && (
                  <div className="mt-1 max-w-48 text-xs text-muted">
                    {payment.refund.status === "FAILED" ? (
                      <p className="text-danger">Reembolso falhou: {payment.refund.failureReason}</p>
                    ) : (
                      <p>
                        {payment.refund.manual ? "Devolvido fora da plataforma" : "Devolvido pelo provedor"} · {payment.refund.reason}
                      </p>
                    )}
                    <p>por {payment.refund.requestedBy.name}</p>
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {payment.status === "SUCCEEDED" && (!payment.refund || payment.refund.status === "FAILED") && (
                  <RefundForm payment={payment} currency={event.currency} />
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <div className="mt-6">
        <Notice>
          Os reembolsos são sempre do valor total. Pelo Multicaixa Express o valor volta à conta do cliente quando a
          EMIS confirmar; pelo PayPal volta na moeda em que foi cobrado. As taxas do provedor podem não ser devolvidas
          à organização.
        </Notice>
      </div>
    </>
  );
}

export default function PaymentsPage({ params }: PageProps<"/manage/events/[eventId]/payments">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar pagamentos…</p>}>
      <Payments params={params} />
    </Suspense>
  );
}
