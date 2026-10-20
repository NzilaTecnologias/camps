import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { DataTable, SectionHeader, StatTile } from "@/components/manage/parts";
import { Card } from "@/components/ui";
import { formatDateTime, formatMoney } from "@/lib/format";
import { formatIban } from "@/lib/statement";
import { requireUser } from "@/server/auth";
import { getFederationStatement, getFederationWorkspace } from "@/server/federations";
import { updateFederationPayoutAction } from "../../../federation-actions";

async function Payouts({ params }: { params: Promise<{ federationId: string }> }) {
  const { federationId } = await params;
  const user = await requireUser();
  const federation = await getFederationWorkspace(user.id, federationId);
  if (!federation) return null;
  const { statement, payouts } = await getFederationStatement(federation.id);
  const money = (cents: number) => formatMoney(cents, "AOA");
  return (
    <>
      <SectionHeader
        title="Quotas e repasses"
        description="As quotas pagas online entram na conta da Camps e são transferidas por inteiro para o IBAN da federação. A Camps é paga pela assinatura do plano, não pelas quotas."
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon="ticket" tone="primary" label="Quotas recebidas" value={money(statement.collectedCents)} />
        <StatTile icon="refund" label="Reembolsado" value={money(statement.refundedCents)} hint="Devolvido aos atletas" />
        <StatTile icon="check" label="Já transferido" value={money(statement.paidOutCents)} />
        {statement.balanceCents < 0 ? (
          <StatTile icon="alert" tone="danger" label="Em dívida à Camps" value={money(-statement.balanceCents)} hint="Reembolsos de quotas já transferidas" />
        ) : (
          <StatTile icon="wallet" tone="success" label="Saldo a receber" value={money(statement.balanceCents)} />
        )}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section>
          <h3 className="mb-3 font-display text-xl font-bold uppercase leading-none">Transferências recebidas</h3>
          {payouts.length === 0 ? (
            <p className="text-sm text-muted">Ainda não houve transferências.</p>
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
        </section>
        <Card className="p-5">
          <h3 className="mb-4 font-display text-xl font-bold uppercase leading-none">Conta para repasses</h3>
          {federation.payoutIban && <p className="mb-4 rounded-lg bg-surface-2 px-3 py-2 font-mono text-sm">{formatIban(federation.payoutIban)}</p>}
          <ActionForm
            action={updateFederationPayoutAction.bind(null, federation.id)}
            submitLabel={federation.payoutIban ? "Atualizar conta" : "Guardar conta"}
            submitVariant="secondary"
            className="flex flex-col gap-4"
          >
            <Field label="Titular" name="holder" defaultValue={federation.payoutHolder ?? ""} maxLength={120} required />
            <Field
              label="IBAN"
              name="iban"
              defaultValue={federation.payoutIban ? formatIban(federation.payoutIban) : ""}
              placeholder="AO06 0000 0000 0000 0000 0000 0"
              autoComplete="off"
              required
            />
          </ActionForm>
        </Card>
      </div>
    </>
  );
}

export default function FederationPayoutsPage({ params }: PageProps<"/manage/federations/[federationId]/payouts">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Payouts params={params} />
    </Suspense>
  );
}
