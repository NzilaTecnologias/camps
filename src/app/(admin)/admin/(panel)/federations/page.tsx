import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { SectionHeader } from "@/components/manage/parts";
import { Badge, Card, Empty, PageTitle, buttonClass } from "@/components/ui";
import { PLAN_LABEL, planActive } from "@/lib/federation-rules";
import { count, formatDate, formatMoney, toDateInput } from "@/lib/format";
import { formatIban } from "@/lib/statement";
import { pageStaff } from "@/server/admin/session";
import { federationPlanPriceCents } from "@/server/billing-config";
import { listFederationsAdmin } from "@/server/federations";
import { activateFederationPlanAction, recordFederationPayoutAction } from "../../actions";

const money = (cents: number) => formatMoney(cents, "AOA");
const inputClass = "h-9 rounded-lg border border-line bg-surface px-2 text-sm";

async function Federations() {
  const staff = await pageStaff("finance");
  const federations = await listFederationsAdmin(staff);
  await connection();
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);

  return (
    <>
      <header className="mb-8 border-b border-line pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Administração Camps</p>
        <div className="mt-2">
          <PageTitle>Federações</PageTitle>
        </div>
      </header>
      <SectionHeader
        title="Planos e quotas"
        description={`Ative o plano depois de a federação pagar a assinatura anual (Básico ${money(federationPlanPriceCents("BASIC"))}, Premium ${money(federationPlanPriceCents("PREMIUM"))}). As quotas de filiação pagas online são transferidas por inteiro para o IBAN da federação.`}
      />
      {federations.length === 0 ? (
        <Empty>Ainda não há federações.</Empty>
      ) : (
        <div className="space-y-4">
          {federations.map((federation) => {
            const active = planActive(federation);
            return (
              <Card key={federation.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{federation.name}</h3>
                      {active ? <Badge tone="success">{PLAN_LABEL[federation.plan!]} até {formatDate(federation.planExpiresAt!)}</Badge> : <Badge tone="warning">Inativa</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      <Link href={`/f/${federation.slug}`} className="font-mono hover:text-primary">
                        /f/{federation.slug}
                      </Link>{" "}
                      · {federation.sport} · {count(federation._count.events, "evento", "eventos")} ·{" "}
                      {count(federation._count.memberships, "filiado", "filiados")}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Responsáveis: {federation.members.map((member) => `${member.user.name} <${member.user.email}>`).join(", ")}
                    </p>
                  </div>
                  <ActionForm action={activateFederationPlanAction.bind(null, federation.id)} className="flex flex-wrap items-end gap-2">
                    <label className="text-xs text-muted">
                      Plano
                      <select name="plan" defaultValue={federation.plan ?? "PREMIUM"} className={`${inputClass} mt-1 block`}>
                        <option value="BASIC">Básico</option>
                        <option value="PREMIUM">Premium</option>
                        <option value="NONE">Desativar</option>
                      </select>
                    </label>
                    <label className="text-xs text-muted">
                      Válido até
                      <input
                        type="date"
                        name="until"
                        defaultValue={toDateInput(active ? federation.planExpiresAt : nextYear)}
                        className={`${inputClass} mt-1 block`}
                      />
                    </label>
                    <label className="flex items-center gap-1.5 pb-1.5 text-xs text-muted">
                      <input type="checkbox" name="invoice" className="h-4 w-4" />
                      Emitir fatura (pago por transferência)
                    </label>
                    <button type="submit" className={buttonClass("primary", "sm")}>
                      {active ? "Atualizar plano" : "Ativar plano"}
                    </button>
                  </ActionForm>
                </div>

                <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-4 text-sm">
                  <p>
                    Quotas recebidas <strong>{money(federation.statement.collectedCents)}</strong>
                    {federation.statement.refundedCents > 0 && <> · reembolsado <strong>{money(federation.statement.refundedCents)}</strong></>} · transferido{" "}
                    <strong>{money(federation.statement.paidOutCents)}</strong> · {federation.statement.balanceCents < 0 ? "em dívida" : "saldo"}{" "}
                    <strong className={federation.statement.balanceCents < 0 ? "text-danger" : ""}>
                      {money(Math.abs(federation.statement.balanceCents))}
                    </strong>
                    {federation.payoutIban ? (
                      <span className="block font-mono text-xs text-muted">
                        {federation.payoutHolder} · {formatIban(federation.payoutIban)}
                      </span>
                    ) : (
                      <span className="block text-xs text-muted">Sem IBAN indicado</span>
                    )}
                  </p>
                  {federation.statement.balanceCents > 0 && federation.payoutIban && (
                    <ActionForm action={recordFederationPayoutAction.bind(null, federation.id)} className="flex flex-wrap items-end gap-2">
                      <input
                        name="amount"
                        inputMode="decimal"
                        defaultValue={(federation.statement.balanceCents / 100).toFixed(2)}
                        aria-label="Valor transferido em kwanzas"
                        className={inputClass}
                        required
                      />
                      <input name="reference" placeholder="Referência" aria-label="Referência da transferência" className={inputClass} required />
                      <button type="submit" className={buttonClass("secondary", "sm")}>
                        Registar transferência
                      </button>
                    </ActionForm>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function AdminFederationsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Federations />
    </Suspense>
  );
}
