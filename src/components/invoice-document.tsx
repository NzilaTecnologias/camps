import type { Invoice } from "@/generated/prisma/client";
import { formatDate, formatMoney } from "@/lib/format";
import { invoiceNumber, type InvoiceLine } from "@/lib/invoice";
import { LEGAL } from "@/lib/legal";
import { PrintButton } from "./print-button";

const KIND_LABEL = { PLATFORM_FEE: "Taxa de serviço por atleta", FEDERATION_PLAN: "Assinatura do Plano Federação" } as const;

/** Fatura-recibo da Camps, para imprimir ou guardar em PDF (no site do cliente e na administração). */
export function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  const lines = invoice.lines as InvoiceLine[];
  const money = (cents: number) => formatMoney(cents, invoice.currency);
  const number = invoice.externalNumber ?? invoiceNumber(invoice.series, invoice.number);

  return (
    <article className="mx-auto max-w-3xl rounded-xl border border-line bg-white p-8 text-[#111] shadow-sm print:border-0 print:p-0 print:shadow-none">
      {!invoice.certified && (
        <p className="mb-6 rounded-lg border border-[#d97706] bg-[#fef3c7] px-4 py-2 text-xs text-[#78350f]">
          Documento interno de faturação da Camps. A fatura com validade fiscal é emitida pelo programa de faturação
          certificado pela AGT, com o mesmo valor.
        </p>
      )}
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-[#e5e7eb] pb-6">
        <div>
          <p className="font-display text-3xl font-bold uppercase tracking-wide">Camps</p>
          <p className="mt-1 text-sm">{LEGAL.company}</p>
          <p className="text-sm">NIF {LEGAL.nif}</p>
          <p className="text-sm">{LEGAL.address}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">Fatura-recibo</p>
          <p className="font-display text-2xl font-bold">{number}</p>
          <p className="text-sm">Data: {formatDate(invoice.issuedAt)}</p>
          <p className="text-sm">{KIND_LABEL[invoice.kind]}</p>
        </div>
      </header>

      <section className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">Cliente</p>
        <p className="mt-1 font-semibold">{invoice.customerName}</p>
        <p className="text-sm">NIF {invoice.customerNif ?? "Consumidor final"}</p>
        {invoice.customerAddress && <p className="text-sm">{invoice.customerAddress}</p>}
      </section>

      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-[#e5e7eb] text-left text-xs uppercase tracking-wider text-[#6b7280]">
            <th className="py-2">Descrição</th>
            <th className="py-2 text-right">Qtd.</th>
            <th className="py-2 text-right">Preço unit.</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((item, index) => (
            <tr key={index} className="border-b border-[#f3f4f6]">
              <td className="py-2 pr-4">{item.description}</td>
              <td className="py-2 text-right tabular-nums">{item.quantity}</td>
              <td className="py-2 text-right tabular-nums">{money(item.unitCents)}</td>
              <td className="py-2 text-right tabular-nums">{money(item.totalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-6 ml-auto w-full max-w-xs text-sm">
        <div className="flex justify-between py-1">
          <dt>Total sem IVA</dt>
          <dd className="tabular-nums">{money(invoice.netCents)}</dd>
        </div>
        <div className="flex justify-between py-1">
          <dt>IVA ({(invoice.vatRateBp / 100).toLocaleString("pt-AO")} %)</dt>
          <dd className="tabular-nums">{money(invoice.vatCents)}</dd>
        </div>
        <div className="flex justify-between border-t border-[#111] py-2 text-base font-bold">
          <dt>Total</dt>
          <dd className="tabular-nums">{money(invoice.totalCents)}</dd>
        </div>
      </dl>

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[#e5e7eb] pt-4 text-xs text-[#6b7280]">
        <p>
          Série {invoice.series}, n.º {invoice.number}. Valores em kwanzas, IVA incluído.
          {invoice.pdfUrl && (
            <>
              {" "}
              <a href={invoice.pdfUrl} className="font-semibold text-[#d21f2b] underline">
                PDF certificado
              </a>
            </>
          )}
        </p>
        <PrintButton />
      </footer>
    </article>
  );
}
