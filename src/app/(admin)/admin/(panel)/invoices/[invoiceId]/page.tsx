import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InvoiceDocument } from "@/components/invoice-document";
import { BackLink } from "@/components/ui";
import { getInvoice } from "@/server/admin/data";
import { pageStaff } from "@/server/admin/session";

async function Invoice({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const invoice = await getInvoice(await pageStaff("finance"), invoiceId);
  if (!invoice) notFound();
  return (
    <>
      <div className="mb-4 print:hidden">
        <BackLink href="/admin/invoices">Faturas</BackLink>
      </div>
      <InvoiceDocument invoice={invoice} />
    </>
  );
}

export default function AdminInvoicePage({ params }: PageProps<"/admin/invoices/[invoiceId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Invoice params={params} />
    </Suspense>
  );
}
