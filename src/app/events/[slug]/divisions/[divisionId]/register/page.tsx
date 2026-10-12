import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { registerAction } from "@/app/registrations/actions";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/field";
import { PaymentFields } from "@/components/payment-fields";
import { formatMoney } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { getRegistrationContext } from "@/server/registrations";

async function RegisterForm({ params }: { params: Promise<{ slug: string; divisionId: string }> }) {
  const { slug, divisionId } = await params;
  const user = await requireUser();
  const context = await getRegistrationContext(user.id, slug, divisionId);
  if (!context) notFound();
  const { division, athletes, providers, closedReason } = context;
  const isFree = division.priceCents === 0;

  return (
    <div className="max-w-md">
      <header className="mb-6">
        <Link href={`/events/${slug}/divisions/${division.id}`} className="text-sm opacity-60 hover:opacity-100">
          ← {division.name}
        </Link>
        <h1 className="text-2xl font-bold">Inscrição</h1>
        <p className="opacity-70">
          {division.event.name} · {isFree ? "gratuita" : formatMoney(division.priceCents, division.event.currency)}
        </p>
      </header>

      {closedReason ? (
        <p className="opacity-70">{closedReason}.</p>
      ) : (
        <ActionForm
          action={registerAction.bind(null, slug, division.id)}
          submitLabel={isFree ? "Confirmar inscrição" : "Inscrever e pagar"}
          className="space-y-4"
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

          <fieldset className="space-y-4 rounded-lg border border-foreground/15 p-4">
            <legend className="px-1 text-sm opacity-70">Preencha só para um novo atleta</legend>
            <Field label="Nome" name="firstName" autoComplete="given-name" />
            <Field label="Apelido" name="lastName" autoComplete="family-name" />
            <Field label="Data de nascimento" name="birthDate" type="date" />
            <Field label="Academia" name="academyName" />
          </fieldset>

          {!isFree && <PaymentFields providers={providers} />}
        </ActionForm>
      )}
    </div>
  );
}

export default function RegisterPage({
  params,
}: PageProps<"/events/[slug]/divisions/[divisionId]/register">) {
  return (
    <Suspense fallback={<p className="opacity-60">A carregar…</p>}>
      <RegisterForm params={params} />
    </Suspense>
  );
}
