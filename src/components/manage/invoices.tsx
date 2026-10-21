import Link from "next/link";
import type { FormAction } from "@/lib/action-state";
import { formatDate, formatMoney } from "@/lib/format";
import { invoiceNumber } from "@/lib/invoice";
import { ActionForm } from "../action-form";
import { Field } from "../field";
import { Card } from "../ui";

type InvoiceRow = { id: string; series: string; number: number; issuedAt: Date; totalCents: number; certified: boolean; externalNumber: string | null };

/** Faturas emitidas pela Camps a esta organização ou federação. */
export function InvoiceTable({ invoices }: { invoices: InvoiceRow[] }) {
  if (invoices.length === 0) return <p className="text-sm text-muted">Ainda não há faturas.</p>;
  // Três colunas curtas: cabe em colunas estreitas sem a largura mínima da DataTable.
  return (
    <Card className="divide-y divide-line overflow-hidden text-sm">
      {invoices.map((invoice) => (
        <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
          <Link href={`/invoices/${invoice.id}`} className="font-semibold hover:text-primary">
            {invoice.externalNumber ?? invoiceNumber(invoice.series, invoice.number)}
          </Link>
          <span className="text-muted">{formatDate(invoice.issuedAt)}</span>
          <span className="font-semibold tabular-nums">{formatMoney(invoice.totalCents, "AOA")}</span>
        </div>
      ))}
    </Card>
  );
}

type Billing = { billingName: string | null; billingNif: string | null; billingAddress: string | null };

/** Nome, NIF e morada que aparecem nas faturas. */
export function BillingDetailsCard({ action, billing, owner }: { action: FormAction; billing: Billing; owner: string }) {
  return (
    <Card className="p-5">
      <h3 className="mb-1 font-display text-xl font-bold uppercase leading-none">Dados para faturas</h3>
      <p className="mb-4 text-sm text-muted">Aparecem nas faturas da Camps a {owner}.</p>
      <ActionForm
        action={action}
        submitLabel={billing.billingNif ? "Atualizar dados" : "Guardar dados"}
        submitVariant="secondary"
        className="flex flex-col gap-4"
      >
        <Field label="Nome (denominação social)" name="billingName" defaultValue={billing.billingName ?? ""} maxLength={160} required />
        <Field label="NIF" name="billingNif" defaultValue={billing.billingNif ?? ""} maxLength={20} autoComplete="off" required />
        <Field label="Morada" name="billingAddress" defaultValue={billing.billingAddress ?? ""} maxLength={300} required />
      </ActionForm>
    </Card>
  );
}
