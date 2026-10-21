import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InvoiceDocument } from "@/components/invoice-document";
import { requireUser } from "@/server/auth";
import { getInvoiceFor } from "@/server/invoicing";

export const metadata: Metadata = { title: "Fatura — Camps", robots: { index: false } };

async function Invoice({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const user = await requireUser();
  const invoice = await getInvoiceFor(user, invoiceId);
  if (!invoice) notFound();
  return <InvoiceDocument invoice={invoice} />;
}

export default function InvoicePage({ params }: PageProps<"/invoices/[invoiceId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Invoice params={params} />
    </Suspense>
  );
}
