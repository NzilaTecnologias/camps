import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { DataTable, NoAccess, Notice, SectionHeader, StatTile } from "@/components/manage/parts";
import { Card } from "@/components/ui";
import { count, formatDateTime, formatMoney } from "@/lib/format";
import { canOrganizer } from "@/lib/organizer-permissions";
import { formatIban } from "@/lib/statement";
import { requireUser } from "@/server/auth";
import { getEventStatement } from "@/server/billing";
import { getEventWorkspace } from "@/server/organizer";
import { BillingDetailsCard, InvoiceTable } from "@/components/manage/invoices";
import { updateOrganizerBillingAction, updatePayoutDetailsAction } from "../../../event-actions";

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2 ${strong ? "border-t border-line pt-3 font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-muted"}>{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-display text-2xl" : ""}`}>{value}</dd>
    </div>
  );
}

async function Billing({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await requireUser();
  const [event, result] = await Promise.all([getEventWorkspace(user.id, eventId), getEventStatement(user.id, eventId)]);
  if (!event) return null;
  if (!result) return <NoAccess />;
  const { statement, payouts, invoices, billing } = result;
  const ownsPayouts = canOrganizer(event.role, "payout");
  const money = (cents: number) => formatMoney(cents, "AOA");
  const owesCamps = statement.balanceCents < 0;

  return (
    <>
      <SectionHeader
        title="Faturação e repasses"
        description={`A Camps cobra ${money(statement.feePerAthleteCents)} por atleta confirmado neste evento, uma só vez por atleta, seja em quantas categorias for. Os atletas não pagam taxas à Camps. As inscrições pagas online entram na conta da Camps; o saldo, já sem a taxa, é transferido para o IBAN da organização.`}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile icon="users" tone="primary" label="Atletas confirmados" value={statement.athletes} hint="Contam para a taxa" />
        <StatTile icon="ticket" label="Taxa Camps" value={money(statement.feeCents)} hint={`${count(statement.athletes, "atleta", "atletas")} × ${money(statement.feePerAthleteCents)}`} />
        <StatTile
          icon="wallet"
          tone={owesCamps ? "danger" : "success"}
          label={owesCamps ? "Em dívida à Camps" : "Saldo a receber"}
          value={money(Math.abs(statement.balanceCents))}
          hint={owesCamps ? "Inscrições manuais ou gratuitas sem cobrança online" : "Transferido depois do evento"}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section>
          <Card className="p-6">
            <h3 className="mb-2 font-display text-xl font-bold uppercase leading-none">Extrato</h3>
            <dl className="text-sm">
              <Line label="Inscrições pagas online" value={money(statement.collectedCents)} />
              <Line label="Reembolsos aos atletas" value={`− ${money(statement.refundedCents)}`} />
              <Line label={`Taxa Camps (${count(statement.athletes, "atleta", "atletas")})`} value={`− ${money(statement.feeCents)}`} />
              <Line label="Já transferido" value={`− ${money(statement.paidOutCents)}`} />
              <Line label={owesCamps ? "Em dívida à Camps" : "Saldo a transferir"} value={money(Math.abs(statement.balanceCents))} strong />
            </dl>
          </Card>

          <h3 className="mt-8 mb-3 font-display text-xl font-bold uppercase leading-none">Transferências recebidas</h3>
          {payouts.length === 0 ? (
            <p className="text-sm text-muted">Ainda não houve transferências para este evento.</p>
          ) : (
            <DataTable head={["Data", "Valor", "Referência"]}>
              {payouts.map((payout) => (
                <tr key={payout.id}>
                  <td className="px-4 py-3 text-muted">{formatDateTime(payout.paidAt)}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums">{money(payout.amountCents)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{payout.reference}</td>
                </tr>
              ))}
            </DataTable>
          )}

          <h3 className="mt-8 mb-3 font-display text-xl font-bold uppercase leading-none">Faturas da Camps</h3>
          <InvoiceTable invoices={invoices} />
          <p className="mt-2 text-xs text-muted">A taxa dos atletas confirmados é faturada a cada transferência.</p>

          <div className="mt-6">
            <Notice>
              Um atleta conta quando a inscrição fica confirmada (paga, gratuita ou inscrita à mão) e continua a contar
              se desistir ou for reembolsado. Reembolsos pelo Multicaixa Express ou PayPal saem do valor cobrado.
            </Notice>
          </div>
        </section>

        <div className="grid gap-6">
          <Card className="p-5">
            <h3 className="mb-1 font-display text-xl font-bold uppercase leading-none">Conta para repasses</h3>
            <p className="mb-4 text-sm text-muted">
              Da organização {statement.organizer.name}; vale para todos os eventos dela.
            </p>
            {statement.organizer.payoutIban && (
              <p className="mb-4 rounded-lg bg-surface-2 px-3 py-2 font-mono text-sm">{formatIban(statement.organizer.payoutIban)}</p>
            )}
            {ownsPayouts ? (
              <ActionForm
                action={updatePayoutDetailsAction.bind(null, statement.organizer.id)}
                submitLabel={statement.organizer.payoutIban ? "Atualizar conta" : "Guardar conta"}
                submitVariant="secondary"
                className="flex flex-col gap-4"
              >
                <Field label="Titular" name="holder" defaultValue={statement.organizer.payoutHolder ?? ""} maxLength={120} required />
                <Field
                  label="IBAN"
                  name="iban"
                  defaultValue={statement.organizer.payoutIban ? formatIban(statement.organizer.payoutIban) : ""}
                  placeholder="AO06 0000 0000 0000 0000 0000 0"
                  autoComplete="off"
                  required
                />
              </ActionForm>
            ) : (
              <p className="text-sm text-muted">Só o dono da organização muda a conta e os dados de faturação.</p>
            )}
          </Card>
          {ownsPayouts && (
            <BillingDetailsCard
              action={updateOrganizerBillingAction.bind(null, statement.organizer.id)}
              billing={billing}
              owner={statement.organizer.name}
            />
          )}
        </div>
      </div>
    </>
  );
}

export default function BillingPage({ params }: PageProps<"/manage/events/[eventId]/billing">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Billing params={params} />
    </Suspense>
  );
}
