import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { AutoRefresh } from "@/components/auto-refresh";
import { SelectField } from "@/components/field";
import { BillingDetailsCard, InvoiceTable } from "@/components/manage/invoices";
import { DataTable, SectionHeader } from "@/components/manage/parts";
import { PaymentFields } from "@/components/payment-fields";
import { Badge, Card, Icon } from "@/components/ui";
import { PLAN_FEATURES, PLAN_LABEL, planActive } from "@/lib/federation-rules";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { getPlanContext } from "@/server/federation-plan";
import { listFederationInvoices } from "@/server/invoicing";
import { payFederationPlanAction, simulatePlanPaymentAction, updateFederationBillingAction } from "../../../federation-actions";

const STATUS = {
  PENDING: { label: "À espera", tone: "warning" },
  SUCCEEDED: { label: "Pago", tone: "success" },
  FAILED: { label: "Não concluído", tone: "danger" },
  REFUNDED: { label: "Reembolsado", tone: "neutral" },
} as const;

const PROVIDER_LABEL = { MULTICAIXA_EXPRESS: "Multicaixa Express", PAYPAL: "PayPal", SIMULATOR: "Simulador" } as const;

async function PlanBilling({ params }: { params: Promise<{ federationId: string }> }) {
  const { federationId } = await params;
  const user = await requireUser();
  const [{ federation, payments, prices, months, providers }, invoices] = await Promise.all([
    getPlanContext(user.id, federationId),
    listFederationInvoices(federationId),
  ]);
  const active = planActive(federation);
  const pending = payments.find((payment) => payment.status === "PENDING");
  const money = (cents: number) => formatMoney(cents, "AOA");

  return (
    <>
      <SectionHeader
        title="Plano e faturas"
        description={`A assinatura do Plano Federação é anual. Paga online, fica ativa logo e a fatura chega por e-mail. Renovar antes do fim soma ${months} meses ao que falta.`}
      />

      <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="grid min-w-0 gap-6">
          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Plano atual</p>
            {active ? (
              <p className="mt-1 font-display text-3xl font-bold uppercase leading-none">
                {PLAN_LABEL[federation.plan!]} <span className="text-base font-normal normal-case text-muted">até {formatDate(federation.planExpiresAt!)}</span>
              </p>
            ) : (
              <p className="mt-1 font-display text-3xl font-bold uppercase leading-none text-warning">Sem plano ativo</p>
            )}
          </Card>

          {pending?.provider === "MULTICAIXA_EXPRESS" && (
            <Card className="p-5">
              <AutoRefresh seconds={5} />
              <p className="font-semibold">Confirme o pagamento de {money(pending.amountCents)} na app Multicaixa Express.</p>
              <p className="mt-1 text-sm text-muted">Esta página atualiza sozinha assim que o pagamento for confirmado.</p>
            </Card>
          )}

          {pending?.provider === "SIMULATOR" && (
            <div className="space-y-4 rounded-xl border-2 border-dashed border-warning/50 bg-warning/5 p-5">
              <p className="text-sm font-medium">
                Simulador de pagamentos ({money(pending.amountCents)}, plano {PLAN_LABEL[pending.plan]}): escolha o desfecho. Ninguém é cobrado.
              </p>
              <div className="flex flex-wrap gap-3">
                <ActionForm action={simulatePlanPaymentAction.bind(null, pending.id, true)} submitLabel="Simular aprovado">
                  {null}
                </ActionForm>
                <ActionForm action={simulatePlanPaymentAction.bind(null, pending.id, false)} submitLabel="Simular recusado" submitVariant="secondary">
                  {null}
                </ActionForm>
              </div>
            </div>
          )}

          {!pending && (
            <Card className="p-6">
              <h3 className="mb-4 font-display text-xl font-bold uppercase leading-none">{active ? "Renovar ou mudar de plano" : "Ativar o plano"}</h3>
              <div className="mb-5 grid gap-4 sm:grid-cols-2">
                {(["BASIC", "PREMIUM"] as const).map((plan) => (
                  <div key={plan} className="rounded-lg border border-line p-4">
                    <p className="font-semibold">
                      {PLAN_LABEL[plan]} · {money(prices[plan])} / ano
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-muted">
                      {PLAN_FEATURES[plan].map((feature) => (
                        <li key={feature} className="flex items-start gap-1.5">
                          <Icon name="check" className="mt-0.5 h-3.5 w-3.5 text-success" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <ActionForm action={payFederationPlanAction.bind(null, federation.id)} submitLabel="Pagar" className="flex max-w-md flex-col gap-4">
                <SelectField label="Plano" name="plan" defaultValue={federation.plan ?? "PREMIUM"} required>
                  <option value="BASIC">
                    Básico — {money(prices.BASIC)}
                  </option>
                  <option value="PREMIUM">
                    Premium — {money(prices.PREMIUM)}
                  </option>
                </SelectField>
                <PaymentFields providers={providers} />
              </ActionForm>
            </Card>
          )}

          <section>
            <h3 className="mb-3 font-display text-xl font-bold uppercase leading-none">Faturas</h3>
            <InvoiceTable invoices={invoices} />
          </section>

          {payments.length > 0 && (
            <section>
              <h3 className="mb-3 font-display text-xl font-bold uppercase leading-none">Pagamentos</h3>
              <DataTable head={["Data", "Plano", "Valor", "Método", "Estado"]}>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3 text-muted">{formatDateTime(payment.createdAt)}</td>
                    <td className="px-4 py-3">{PLAN_LABEL[payment.plan]}</td>
                    <td className="px-4 py-3 tabular-nums">{money(payment.amountCents)}</td>
                    <td className="px-4 py-3">{PROVIDER_LABEL[payment.provider]}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS[payment.status].tone}>{STATUS[payment.status].label}</Badge>
                      {payment.failureReason && <p className="mt-1 text-xs text-muted">{payment.failureReason}</p>}
                    </td>
                  </tr>
                ))}
              </DataTable>
            </section>
          )}
        </section>

        <BillingDetailsCard action={updateFederationBillingAction.bind(null, federation.id)} billing={federation} owner={federation.name} />
      </div>
    </>
  );
}

export default function FederationBillingPage({ params }: PageProps<"/manage/federations/[federationId]/billing">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <PlanBilling params={params} />
    </Suspense>
  );
}
