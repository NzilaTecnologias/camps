import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { AdminHeader, textOf } from "@/components/admin/parts";
import { DataTable, FilterTabs } from "@/components/manage/parts";
import { Badge, Empty } from "@/components/ui";
import { formatDateTime, formatMoney } from "@/lib/format";
import { listPayments } from "@/server/admin/data";
import { pageStaff } from "@/server/admin/session";
import { refreshPaymentAction } from "../../actions";

const TABS = [
  { value: "", label: "Todos" },
  { value: "PENDING", label: "Pendentes" },
  { value: "SUCCEEDED", label: "Pagos" },
  { value: "FAILED", label: "Não concluídos" },
  { value: "REFUNDED", label: "Reembolsados" },
];

const KIND_LABEL = { registration: "Inscrição", membership: "Quota", plan: "Plano Federação", credits: "Créditos" } as const;
const STATUS = {
  PENDING: { label: "Pendente", tone: "warning" },
  SUCCEEDED: { label: "Pago", tone: "success" },
  FAILED: { label: "Não concluído", tone: "danger" },
  REFUNDED: { label: "Reembolsado", tone: "neutral" },
} as const;
const PROVIDER_LABEL: Record<string, string> = { MULTICAIXA_EXPRESS: "Multicaixa Express", PAYPAL: "PayPal", SIMULATOR: "Simulador" };

async function Payments({ searchParams }: { searchParams: PageProps<"/admin/payments">["searchParams"] }) {
  const staff = await pageStaff("payments");
  const status = textOf((await searchParams).status);
  const payments = await listPayments(staff, status);
  return (
    <>
      <AdminHeader
        title="Pagamentos"
        description="Inscrições, quotas de filiação, compras de créditos e Planos Federação (os 200 mais recentes). Um pagamento pendente pode ser consultado já no provedor, sem esperar pela tarefa de fundo."
      />
      <FilterTabs tabs={TABS.map((tab) => ({ href: tab.value ? `/admin/payments?status=${tab.value}` : "/admin/payments", label: tab.label, active: status === tab.value }))} />
      {payments.length === 0 ? (
        <Empty>Nenhum pagamento.</Empty>
      ) : (
        <DataTable head={["Data", "Tipo", "De", "Valor", "Método", "Estado", ""]}>
          {payments.map((payment) => {
            const status = STATUS[payment.status as keyof typeof STATUS];
            return (
              <tr key={`${payment.kind}:${payment.id}`} className="align-top">
                <td className="px-4 py-3 text-muted">{formatDateTime(payment.createdAt)}</td>
                <td className="px-4 py-3">{KIND_LABEL[payment.kind]}</td>
                <td className="px-4 py-3">
                  {payment.kind === "registration" ? (
                    <Link href={`/registrations/${payment.ref}`} className="hover:text-primary">
                      {payment.label}
                    </Link>
                  ) : (
                    payment.label
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums">{formatMoney(Number(payment.amountCents), "AOA")}</td>
                <td className="px-4 py-3">{PROVIDER_LABEL[payment.provider] ?? payment.provider}</td>
                <td className="px-4 py-3">
                  {status ? <Badge tone={status.tone}>{status.label}</Badge> : payment.status}
                  {payment.failureReason && <p className="mt-1 max-w-56 text-xs text-muted">{payment.failureReason}</p>}
                </td>
                <td className="px-4 py-3 text-right">
                  {payment.status === "PENDING" && payment.provider !== "SIMULATOR" && (
                    <ActionForm action={refreshPaymentAction.bind(null, payment.kind, payment.id)} submitLabel="Consultar provedor" submitVariant="secondary">
                      {null}
                    </ActionForm>
                  )}
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </>
  );
}

export default function AdminPaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Payments searchParams={searchParams} />
    </Suspense>
  );
}
