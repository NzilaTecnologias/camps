import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { DataTable, SectionHeader } from "@/components/manage/parts";
import { PlanGate } from "@/components/manage/premium-gate";
import { Badge, Card, Empty, buttonClass } from "@/components/ui";
import { premiumActive } from "@/lib/federation-rules";
import { formatMoney } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { getFederationOverview } from "@/server/federations";
import { createMembershipPlanAction, setMembershipPlanActiveAction } from "../../../federation-actions";

async function Plans({ params }: { params: Promise<{ federationId: string }> }) {
  const { federationId } = await params;
  const user = await requireUser();
  const { federation, plans } = await getFederationOverview(user.id, federationId);
  return (
    <>
      <SectionHeader
        title="Planos de filiação"
        description="Os atletas filiam-se online, na página da federação, e pagam por Multicaixa Express ou PayPal. As quotas vão inteiras para a federação: a Camps não cobra taxa sobre elas."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {plans.length === 0 ? (
          <Empty>Ainda não há planos de filiação.</Empty>
        ) : (
          <DataTable head={["Plano", "Quota", "Duração", "Idade", "Filiados", ""]}>
            {plans.map((plan) => (
              <tr key={plan.id}>
                <td className="px-4 py-3 font-semibold">
                  {plan.name} {!plan.active && <Badge>Desativado</Badge>}
                </td>
                <td className="px-4 py-3 tabular-nums">{plan.priceCents === 0 ? "Grátis" : formatMoney(plan.priceCents, "AOA")}</td>
                <td className="px-4 py-3 text-muted">{plan.months} meses</td>
                <td className="px-4 py-3 text-muted">{plan.maxAge ? `até ${plan.maxAge} anos` : "Qualquer"}</td>
                <td className="px-4 py-3 tabular-nums">{plan._count.memberships}</td>
                <td className="px-4 py-3 text-right">
                  <ActionForm action={setMembershipPlanActiveAction.bind(null, federation.id, plan.id, !plan.active)}>
                    <button type="submit" className={buttonClass("secondary", "sm")}>
                      {plan.active ? "Desativar" : "Ativar"}
                    </button>
                  </ActionForm>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
        <Card className="p-5">
          <h3 className="mb-4 font-display text-xl font-bold uppercase leading-none">Novo plano</h3>
          <PlanGate allowed={premiumActive(federation)} plan="Premium">
            <ActionForm action={createMembershipPlanAction.bind(null, federation.id)} submitLabel="Criar plano" className="flex flex-col gap-4">
              <Field label="Nome" name="name" placeholder="Atleta sénior 2027" required />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Quota (Kz)" name="price" inputMode="decimal" placeholder="5000" required />
                <Field label="Meses" name="months" type="number" min={1} max={36} defaultValue={12} required />
              </div>
              <Field label="Idade máxima (vazio = qualquer)" name="maxAge" type="number" min={4} max={99} />
            </ActionForm>
          </PlanGate>
        </Card>
      </div>
    </>
  );
}

export default function FederationPlansPage({ params }: PageProps<"/manage/federations/[federationId]/plans">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Plans params={params} />
    </Suspense>
  );
}
