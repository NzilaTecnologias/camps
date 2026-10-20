import { notFound } from "next/navigation";
import { Suspense } from "react";
import { joinFederationAction } from "@/app/(main)/(site)/memberships/actions";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/field";
import { PaymentFields } from "@/components/payment-fields";
import { Card, Empty, LinkButton } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { getCurrentUser } from "@/server/auth";
import { getJoinContext } from "@/server/memberships";

async function Join({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const context = await getJoinContext(user?.id ?? null, slug);
  if (!context) notFound();
  const { federation, athletes, providers } = context;
  const plans = federation.plans;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section>
        <h2 className="mb-4 font-display text-3xl font-bold uppercase leading-none">Planos de filiação</h2>
        {plans.length === 0 ? (
          <Empty>A federação ainda não publicou planos de filiação.</Empty>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {plans.map((plan) => (
              <li key={plan.id}>
                <Card className="h-full p-5">
                  <p className="font-semibold">{plan.name}</p>
                  <p className="mt-2 font-display text-4xl font-bold leading-none">
                    {plan.priceCents === 0 ? "Grátis" : formatMoney(plan.priceCents, "AOA")}
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Válida {plan.months} meses{plan.maxAge ? ` · até aos ${plan.maxAge} anos` : ""}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {plans.length > 0 && (
        <Card className="p-6">
          <h2 className="mb-4 font-display text-xl font-bold uppercase leading-none">Filiar um atleta</h2>
          {!user ? (
            <>
              <p className="mb-4 text-sm text-muted">Inicie sessão para filiar os seus atletas.</p>
              <LinkButton href={`/login?next=${encodeURIComponent(`/f/${slug}/filiacao`)}`} className="w-full">
                Iniciar sessão
              </LinkButton>
            </>
          ) : (
            <ActionForm action={joinFederationAction.bind(null, slug)} submitLabel="Filiar e pagar" className="flex flex-col gap-4">
              <SelectField label="Plano" name="planId" defaultValue={plans[0].id}>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} — {plan.priceCents === 0 ? "grátis" : formatMoney(plan.priceCents, "AOA")}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Atleta" name="athleteId" defaultValue={athletes.find((a) => a.memberships.length === 0)?.id ?? ""}>
                {athletes.map((athlete) => (
                  <option key={athlete.id} value={athlete.id} disabled={athlete.memberships.length > 0}>
                    {athlete.firstName} {athlete.lastName}
                    {athlete.memberships[0]?.validUntil && ` (filiado até ${formatDate(athlete.memberships[0].validUntil)})`}
                  </option>
                ))}
                <option value="">Novo atleta…</option>
              </SelectField>
              <fieldset className="grid gap-3 rounded-lg border border-line bg-surface-2 p-4">
                <legend className="px-1 text-sm font-medium text-muted">Só para um novo atleta</legend>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nome" name="firstName" />
                  <Field label="Apelido" name="lastName" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nascimento" name="birthDate" type="date" />
                  <SelectField label="Sexo" name="gender" defaultValue="MALE">
                    <option value="MALE">Masculino</option>
                    <option value="FEMALE">Feminino</option>
                  </SelectField>
                </div>
                <Field label="Academia" name="academyName" />
              </fieldset>
              <PaymentFields providers={providers} />
            </ActionForm>
          )}
        </Card>
      )}
    </div>
  );
}

export default function FederationJoinPage({ params }: PageProps<"/f/[slug]/filiacao">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Join params={params} />
    </Suspense>
  );
}
