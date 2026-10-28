import Link from "next/link";
import { Suspense } from "react";
import { AdminHeader, SearchBox, textOf } from "@/components/admin/parts";
import { DataTable } from "@/components/manage/parts";
import { Badge, Empty } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { invoiceNumber } from "@/lib/invoice";
import { listInvoices } from "@/server/admin/data";
import { pageStaff } from "@/server/admin/session";

async function Invoices({ searchParams }: { searchParams: PageProps<"/admin/invoices">["searchParams"] }) {
  const staff = await pageStaff("finance");
  const q = textOf((await searchParams).q);
  const invoices = await listInvoices(staff, q);
  const total = invoices.reduce((sum, invoice) => sum + invoice.totalCents, 0);
  return (
    <>
      <AdminHeader
        title="Faturas"
        description={`Faturas das compras de créditos e do Plano Federação (as 200 mais recentes${q ? ` de "${q}"` : ""}): ${formatMoney(total, "AOA")} no total.`}
      />
      <SearchBox action="/admin/invoices" q={q} placeholder="Cliente, NIF ou e-mail" />
      {invoices.length === 0 ? (
        <Empty>Ainda não há faturas.</Empty>
      ) : (
        <DataTable head={["Fatura", "Data", "Cliente", "Tipo", "Total", ""]}>
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td className="px-4 py-3">
                <Link href={`/admin/invoices/${invoice.id}`} className="font-semibold hover:text-primary">
                  {invoice.externalNumber ?? invoiceNumber(invoice.series, invoice.number)}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted">{formatDate(invoice.issuedAt)}</td>
              <td className="px-4 py-3">
                {invoice.customerName}
                <p className="text-xs text-muted">{invoice.customerNif ? `NIF ${invoice.customerNif}` : "Sem NIF"}</p>
              </td>
              <td className="px-4 py-3 text-xs">{{ CREDITS: "Créditos", PLATFORM_FEE: "Taxa por atleta", FEDERATION_PLAN: "Plano Federação" }[invoice.kind]}</td>
              <td className="px-4 py-3 font-semibold tabular-nums">{formatMoney(invoice.totalCents, "AOA")}</td>
              <td className="px-4 py-3">{invoice.certified ? <Badge tone="success">Certificada</Badge> : <Badge>Interna</Badge>}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}

export default function AdminInvoicesPage({ searchParams }: PageProps<"/admin/invoices">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Invoices searchParams={searchParams} />
    </Suspense>
  );
}
