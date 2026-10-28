import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { AutoRefresh } from "@/components/auto-refresh";
import { Field } from "@/components/field";
import { InvoiceTable } from "@/components/manage/invoices";
import { DataTable, Notice, StatTile } from "@/components/manage/parts";
import { PaymentFields } from "@/components/payment-fields";
import { BackLink, Badge, Card, PageTitle } from "@/components/ui";
import { CREDIT_PACKS, MAX_PURCHASE, MIN_PURCHASE } from "@/lib/credits";
import { UserError } from "@/lib/errors";
import { count, formatDateTime, formatMoney } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { getCreditsPage } from "@/server/credits";
import { buyCreditsAction, simulateCreditPurchaseAction } from "../../../payment-actions";

const KIND = {
  WELCOME: "Oferta de boas-vindas",
  PURCHASE: "Compra",
  ATHLETE: "Atleta confirmado",
  ADJUSTMENT: "Acerto da Camps",
} as const;

const STATUS = {
  PENDING: { label: "À espera", tone: "warning" },
  SUCCEEDED: { label: "Pago", tone: "success" },
  FAILED: { label: "Não concluído", tone: "danger" },
  REFUNDED: { label: "Reembolsado", tone: "neutral" },
} as const;

const PROVIDER_LABEL = { MULTICAIXA_EXPRESS: "Multicaixa Express", PAYPAL: "PayPal", SIMULATOR: "Simulador" } as const;

async function Credits({ params }: { params: Promise<{ organizerId: string }> }) {
  const { organizerId } = await params;
  const user = await requireUser();
  const page = await getCreditsPage(user.id, organizerId).catch((error) => {
    if (error instanceof UserError) return null;
    throw error;
  });
  if (!page) notFound();
  const { organizer, transactions, purchases, invoices, due, baseUnitCents, packs, providers } = page;
  const money = (cents: number) => formatMoney(cents, "AOA");
  const pending = purchases.find((purchase) => purchase.status === "PENDING");
  const totalDue = due.reduce((sum, row) => sum + row.due, 0);
  const suggested = Math.max(MIN_PURCHASE, totalDue, CREDIT_PACKS[0].credits);

  return (
    <>
      <BackLink href="/manage">Os meus eventos</BackLink>
      <header className="mt-3 mb-8 border-b border-line pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{organizer.name}</p>
        <div className="mt-2">
          <PageTitle>Créditos</PageTitle>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          1 crédito = 1 atleta confirmado num evento, uma só vez, seja em quantas categorias for. Os créditos servem para todos
          os eventos da organização e não expiram. Os atletas não pagam taxas à Camps.
        </p>
      </header>

      {organizer.welcomeCredits > 0 && (
        <div className="mb-6">
          <Notice tone="success">
            Tem <strong>{count(organizer.welcomeCredits, "crédito", "créditos")} de boas-vindas</strong> à espera: passam para o
            saldo com a primeira compra de créditos (mínimo {MIN_PURCHASE}).
          </Notice>
        </div>
      )}

      {totalDue > 0 && (
        <div className="mb-6">
          <Notice tone="danger">
            Faltam {count(totalDue, "crédito", "créditos")} ({due.map((row) => `${row.name}: ${row.due}`).join(" · ")}). A gestão
            desses eventos (chaves, programação, placar) está parada até os comprar; são gastos logo que a compra se confirmar.
          </Notice>
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatTile icon="wallet" tone={organizer.credits > 0 ? "success" : "danger"} label="Saldo" value={organizer.credits} hint={organizer.welcomeCredits > 0 ? `créditos disponíveis · +${organizer.welcomeCredits} bloqueados` : "créditos disponíveis"} />
        <StatTile icon="ticket" label="Preço avulso" value={money(baseUnitCents)} hint="por crédito" />
        <StatTile icon="alert" tone={totalDue > 0 ? "danger" : "neutral"} label="Por cobrar" value={totalDue} hint="atletas sem crédito" />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="grid min-w-0 gap-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {packs.map((pack) => (
              <Card key={pack.credits} className="p-5">
                <p className="font-display text-3xl font-bold leading-none">{pack.credits}</p>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">créditos</p>
                <p className="mt-3 font-semibold">{money(pack.amountCents)}</p>
                <p className="text-xs text-muted">
                  {money(pack.unitCents)} cada · <span className="font-semibold text-success">−{pack.discountPercent}%</span>
                </p>
              </Card>
            ))}
          </div>

          <section>
            <h3 className="mb-3 font-display text-xl font-bold uppercase leading-none">Movimentos</h3>
            <DataTable head={["Data", "Movimento", "Créditos", "Saldo"]}>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 text-muted">{formatDateTime(t.createdAt)}</td>
                  <td className="px-4 py-3">
                    {KIND[t.kind]}
                    {t.eventName && <span className="text-muted"> · {t.eventName}</span>}
                    {t.note && <p className="text-xs text-muted">{t.note}</p>}
                  </td>
                  <td className={`px-4 py-3 font-semibold tabular-nums ${t.delta > 0 ? "text-success" : ""}`}>
                    {t.delta > 0 ? `+${t.delta}` : t.delta}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{t.balance}</td>
                </tr>
              ))}
            </DataTable>
          </section>

          {purchases.length > 0 && (
            <section>
              <h3 className="mb-3 font-display text-xl font-bold uppercase leading-none">Compras</h3>
              <DataTable head={["Data", "Créditos", "Valor", "Método", "Estado"]}>
                {purchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td className="px-4 py-3 text-muted">{formatDateTime(purchase.createdAt)}</td>
                    <td className="px-4 py-3 tabular-nums">{purchase.credits}</td>
                    <td className="px-4 py-3 tabular-nums">{money(purchase.amountCents)}</td>
                    <td className="px-4 py-3">{PROVIDER_LABEL[purchase.provider]}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS[purchase.status].tone}>{STATUS[purchase.status].label}</Badge>
                      {purchase.failureReason && <p className="mt-1 text-xs text-muted">{purchase.failureReason}</p>}
                    </td>
                  </tr>
                ))}
              </DataTable>
            </section>
          )}

          <section>
            <h3 className="mb-3 font-display text-xl font-bold uppercase leading-none">Faturas</h3>
            <InvoiceTable invoices={invoices} />
          </section>
        </section>

        <aside className="grid gap-6">
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
                Simulador de pagamentos ({pending.credits} créditos, {money(pending.amountCents)}): escolha o desfecho. Ninguém é cobrado.
              </p>
              <div className="flex flex-wrap gap-3">
                <ActionForm action={simulateCreditPurchaseAction.bind(null, pending.id, true)} submitLabel="Simular aprovado">
                  {null}
                </ActionForm>
                <ActionForm action={simulateCreditPurchaseAction.bind(null, pending.id, false)} submitLabel="Simular recusado" submitVariant="secondary">
                  {null}
                </ActionForm>
              </div>
            </div>
          )}

          {pending?.provider !== "MULTICAIXA_EXPRESS" && (
            <Card className="p-5">
              <h3 className="mb-1 font-display text-xl font-bold uppercase leading-none">Comprar créditos</h3>
              <p className="mb-4 text-sm text-muted">
                Mínimo de {MIN_PURCHASE} créditos por compra; a partir de {CREDIT_PACKS[0].credits} o preço baixa. A fatura chega por e-mail; os dados dela mudam-se em{" "}
                <Link href={`/manage/organizers/${organizer.id}/payments`} className="font-semibold text-primary hover:underline">
                  Conta de pagamentos
                </Link>
                .
              </p>
              <ActionForm action={buyCreditsAction.bind(null, organizer.id)} submitLabel="Comprar" className="flex flex-col gap-4">
                <Field
                  label="Quantos créditos"
                  name="credits"
                  type="number"
                  min={MIN_PURCHASE}
                  max={MAX_PURCHASE}
                  step={1}
                  defaultValue={suggested}
                  required
                />
                <PaymentFields providers={providers} />
              </ActionForm>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}

export default function OrganizerCreditsPage({ params }: PageProps<"/manage/organizers/[organizerId]/credits">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Credits params={params} />
    </Suspense>
  );
}
