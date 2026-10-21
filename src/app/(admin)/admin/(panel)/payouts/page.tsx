import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { DataTable, SectionHeader, StatTile } from "@/components/manage/parts";
import { Badge, Empty, PageTitle, buttonClass } from "@/components/ui";
import { count, formatDate, formatMoney } from "@/lib/format";
import { formatIban } from "@/lib/statement";
import { pageStaff } from "@/server/admin/session";
import { listPayoutQueue } from "@/server/billing";
import { invoiceEventFeeAction, recordPayoutAction } from "../../actions";

const money = (cents: number) => formatMoney(cents, "AOA");

async function Queue() {
  const staff = await pageStaff("finance");
  const statements = await listPayoutQueue(staff);
  const toPay = statements.filter((s) => s.balanceCents > 0);
  const owed = statements.filter((s) => s.balanceCents < 0);
  const sum = (list: typeof statements, pick: (s: (typeof statements)[number]) => number) => list.reduce((total, s) => total + pick(s), 0);

  return (
    <>
      <header className="mb-8 border-b border-line pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Administração Camps</p>
        <div className="mt-2">
          <PageTitle>Repasses aos organizadores</PageTitle>
        </div>
      </header>
      <SectionHeader
        title="Eventos com movimento"
        description="Saldo de cada evento: inscrições cobradas online, menos reembolsos, menos a taxa da Camps, menos o que já foi transferido. Faça a transferência no banco e registe-a aqui com a referência."
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatTile icon="ticket" tone="success" label="Receita Camps (taxas)" value={money(sum(statements, (s) => s.feeCents))} hint={`${count(statements.length, "evento", "eventos")} com movimento`} />
        <StatTile icon="wallet" tone="warning" label="Por transferir" value={money(sum(toPay, (s) => s.balanceCents))} hint={count(toPay.length, "evento", "eventos")} />
        <StatTile icon="alert" tone="danger" label="Organizadores em dívida" value={money(Math.abs(sum(owed, (s) => s.balanceCents)))} hint={count(owed.length, "evento", "eventos")} />
      </div>

      {statements.length === 0 ? (
        <Empty>Ainda não há eventos com inscrições confirmadas.</Empty>
      ) : (
        <DataTable head={["Evento", "Organização e conta", "Cobrado", "Taxa", "Saldo", "Registar transferência"]}>
          {statements.map((s) => (
            <tr key={s.event.id} className="align-top">
              <td className="px-4 py-3">
                <Link href={`/events/${s.event.slug}`} className="font-semibold hover:text-primary">
                  {s.event.name}
                </Link>
                <p className="text-xs text-muted">termina {formatDate(s.event.endsAt)}</p>
              </td>
              <td className="px-4 py-3">
                <p>{s.organizer.name}</p>
                {s.organizer.payoutIban ? (
                  <p className="font-mono text-xs text-muted">
                    {s.organizer.payoutHolder} · {formatIban(s.organizer.payoutIban)}
                  </p>
                ) : (
                  <Badge tone="warning">Sem IBAN</Badge>
                )}
              </td>
              <td className="px-4 py-3 tabular-nums">
                {money(s.netCollectedCents)}
                {s.paidOutCents > 0 && <p className="text-xs text-muted">já transferido {money(s.paidOutCents)}</p>}
              </td>
              <td className="px-4 py-3 tabular-nums">
                {money(s.feeCents)}
                <p className="text-xs text-muted">{s.athletes} atletas</p>
              </td>
              <td className={`px-4 py-3 font-semibold tabular-nums ${s.balanceCents < 0 ? "text-danger" : ""}`}>
                {s.balanceCents < 0 ? `dívida ${money(-s.balanceCents)}` : money(s.balanceCents)}
              </td>
              <td className="px-4 py-3">
                {s.balanceCents > 0 && !s.organizer.payoutIban && (
                  <p className="text-xs text-muted">À espera de que o organizador indique o IBAN.</p>
                )}
                {s.balanceCents > 0 && s.organizer.payoutIban && (
                  <ActionForm action={recordPayoutAction.bind(null, s.event.id)} className="flex min-w-64 flex-col gap-2">
                    <input
                      name="amount"
                      inputMode="decimal"
                      defaultValue={(s.balanceCents / 100).toFixed(2)}
                      aria-label="Valor transferido em kwanzas"
                      className="h-8 rounded-lg border border-line bg-surface px-2 text-sm tabular-nums"
                      required
                    />
                    <input
                      name="reference"
                      placeholder="Referência da transferência"
                      aria-label="Referência da transferência"
                      className="h-8 rounded-lg border border-line bg-surface px-2 text-sm"
                      required
                    />
                    <button type="submit" className={buttonClass("primary", "sm")}>
                      Registar transferência
                    </button>
                    <p className="text-xs text-muted">A taxa dos atletas confirmados sai faturada com a transferência.</p>
                  </ActionForm>
                )}
                {s.athletes > 0 && (
                  <ActionForm action={invoiceEventFeeAction.bind(null, s.event.id)} className="mt-2 flex flex-col gap-1">
                    <button type="submit" className={buttonClass("secondary", "sm")}>
                      Faturar a taxa agora
                    </button>
                  </ActionForm>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}

export default function PayoutsPage() {
  // Título e dados só aparecem depois de confirmar que é administrador.
  return (
    <>
      <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
        <Queue />
      </Suspense>
    </>
  );
}
