import { notFound } from "next/navigation";
import { Suspense } from "react";
import { registerAction } from "@/app/(main)/(site)/registrations/actions";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/field";
import { PaymentFields } from "@/components/payment-fields";
import { BackLink, Card, Empty, Icon, PageTitle } from "@/components/ui";
import { formatDate, formatMoney, formatWeight } from "@/lib/format";
import { premiumActive } from "@/lib/federation-rules";
import { computePrice } from "@/lib/pricing";
import { requireUser } from "@/server/auth";
import { getRegistrationContext } from "@/server/registrations";

async function RegisterForm({ params }: { params: Promise<{ slug: string; divisionId: string }> }) {
  const { slug, divisionId } = await params;
  const user = await requireUser();
  const context = await getRegistrationContext(user.id, slug, divisionId);
  if (!context) notFound();
  const { division, athletes, providers, closedReason } = context;
  const { currency } = division.event;
  // Preço antes do cupão; o cupão só se conhece ao submeter e é validado no servidor.
  const quote = computePrice(division.priceCents, division.event, null);
  const isFree = division.priceCents === 0;
  const price = quote.priceCents === 0 ? "gratuita" : formatMoney(quote.priceCents, currency);

  return (
    <>
      <BackLink href={`/events/${slug}/divisions/${division.id}`}>{division.name}</BackLink>
      <header className="mt-3 mb-8">
        <PageTitle>Inscrição</PageTitle>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_20rem]">
        {closedReason ? (
          <Empty>{closedReason}.</Empty>
        ) : (
          <Card className="p-6">
            {division.event.requiresMembership && division.event.federation && premiumActive(division.event.federation) && (
              <p className="mb-5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
                Este evento exige filiação ativa na {division.event.federation.name} no dia da prova.{" "}
                <a href={`/f/${division.event.federation.slug}/filiacao`} className="font-semibold text-primary hover:underline">
                  Filiar um atleta
                </a>
              </p>
            )}
            <ActionForm
              action={registerAction.bind(null, slug, division.id)}
              submitLabel={isFree ? "Confirmar inscrição" : "Inscrever e pagar"}
              className="flex flex-col gap-5"
            >
              <SelectField label="Atleta" name="athleteId" defaultValue={athletes[0]?.id ?? ""}>
                {athletes.map((athlete) => (
                  <option key={athlete.id} value={athlete.id} disabled={athlete.registrations.length > 0}>
                    {athlete.firstName} {athlete.lastName}
                    {athlete.registrations.length > 0 && " (já inscrito)"}
                  </option>
                ))}
                <option value="">Novo atleta…</option>
              </SelectField>

              <fieldset className="grid gap-4 rounded-lg border border-line bg-surface-2 p-4 sm:grid-cols-2">
                <legend className="px-1 text-sm font-medium text-muted">Preencha só para um novo atleta</legend>
                <Field label="Nome" name="firstName" autoComplete="given-name" />
                <Field label="Apelido" name="lastName" autoComplete="family-name" />
                <Field label="Data de nascimento" name="birthDate" type="date" />
                <Field label="Academia" name="academyName" />
              </fieldset>

              {!isFree && (
                <>
                  <Field
                    label="Código de desconto (opcional)"
                    name="couponCode"
                    autoComplete="off"
                    placeholder="Ex.: ACADEMIA10"
                    maxLength={30}
                  />
                  <PaymentFields providers={providers} />
                  <p className="-mt-2 text-xs text-muted">Se o cupão deixar a inscrição a zero, não é pedido pagamento.</p>
                </>
              )}
            </ActionForm>
          </Card>
        )}

        <aside>
          <Card className="overflow-hidden">
            <div className="hero px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">Resumo</p>
              <p className="mt-1 font-display text-2xl font-bold uppercase leading-tight">{division.event.name}</p>
            </div>
            <dl className="space-y-3 p-5 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted">Categoria</dt>
                <dd className="font-semibold">{division.name}</dd>
              </div>
              <div className="flex items-center gap-2 text-muted">
                <Icon name="scale" />
                {formatWeight(division.maxWeightKg)}
              </div>
              <div className="flex items-center gap-2 text-muted">
                <Icon name="calendar" />
                {formatDate(division.event.startsAt)}
              </div>
              {quote.applied.length > 0 && (
                <div className="space-y-1 border-t border-line pt-3">
                  <div className="flex justify-between text-muted">
                    <dt>Preço da categoria</dt>
                    <dd className="tabular-nums">{formatMoney(quote.baseCents, currency)}</dd>
                  </div>
                  {quote.applied.map((discount) => (
                    <div key={discount.label} className="flex justify-between text-success">
                      <dt>{discount.label}</dt>
                      <dd className="tabular-nums">−{formatMoney(discount.cents, currency)}</dd>
                    </div>
                  ))}
                  {division.event.earlyDiscountEndsAt && (
                    <p className="text-xs text-muted">Válido até {formatDate(division.event.earlyDiscountEndsAt)}</p>
                  )}
                </div>
              )}
              <div className="flex items-end justify-between border-t border-line pt-3">
                <dt className="text-xs uppercase tracking-wider text-muted">Total{!isFree && " sem cupão"}</dt>
                <dd className="font-display text-2xl font-bold leading-none">{price}</dd>
              </div>
            </dl>
          </Card>
        </aside>
      </div>
    </>
  );
}

export default function RegisterPage({
  params,
}: PageProps<"/events/[slug]/divisions/[divisionId]/register">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <RegisterForm params={params} />
    </Suspense>
  );
}
