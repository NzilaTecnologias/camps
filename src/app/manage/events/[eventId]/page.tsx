import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/field";
import { BRACKET_TYPE_LABEL, EVENT_STATUS_LABEL, formatDate, formatMoney } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { getManagedEvent } from "@/server/manage";
import { createDivisionAction, setEventStatusAction } from "../../actions";

async function EventPanel({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await requireUser();
  const event = await getManagedEvent(user.id, eventId);
  if (!event) notFound();
  const isPublished = event.status === "PUBLISHED";

  return (
    <>
      <header className="mb-8">
        <Link href="/manage" className="text-sm opacity-60 hover:opacity-100">
          ← Painel
        </Link>
        <h1 className="text-2xl font-bold">{event.name}</h1>
        <p className="opacity-70">
          {formatDate(event.startsAt)} · {[event.venue, event.city].filter(Boolean).join(", ") || "local a definir"}
        </p>
        <p className="text-sm opacity-60">
          {event.organizer.name} · Inscrições até {formatDate(event.registrationClosesAt)} ·{" "}
          {EVENT_STATUS_LABEL[event.status]}
        </p>

        {event.status !== "CANCELLED" && (
          <div className="mt-4 flex items-center gap-4">
            <ActionForm
              action={setEventStatusAction.bind(null, event.id, isPublished ? "DRAFT" : "PUBLISHED")}
              submitLabel={isPublished ? "Despublicar" : "Publicar evento"}
            >
              {null}
            </ActionForm>
            {isPublished && (
              <Link href={`/events/${event.slug}`} className="text-sm underline">
                Ver página pública
              </Link>
            )}
          </div>
        )}
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Categorias</h2>
        {event.divisions.length === 0 ? (
          <p className="opacity-60">Nenhuma categoria ainda.</p>
        ) : (
          <ul className="divide-y divide-foreground/10 rounded-lg border border-foreground/15">
            {event.divisions.map((division) => (
              <li key={division.id}>
                <Link
                  href={`/manage/events/${event.id}/divisions/${division.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-foreground/5"
                >
                  <span>
                    <span className="block font-medium">{division.name}</span>
                    <span className="text-sm opacity-60">
                      {division.maxWeightKg ? `até ${division.maxWeightKg.toString()} kg` : "sem limite de peso"} ·{" "}
                      {division._count.registrations} inscritos ·{" "}
                      {division.bracket ? `chave: ${BRACKET_TYPE_LABEL[division.bracket.type]}` : "sem chave"}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm">{formatMoney(division.priceCents, event.currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="max-w-md">
        <h2 className="mb-3 text-lg font-semibold">Nova categoria</h2>
        <ActionForm
          action={createDivisionAction.bind(null, event.id)}
          submitLabel="Adicionar categoria"
          className="space-y-4"
        >
          <SelectField label="Sexo" name="gender" required>
            <option value="MALE">Masculino</option>
            <option value="FEMALE">Feminino</option>
          </SelectField>
          <Field label="Faixa etária" name="ageGroup" defaultValue="Adulto" required />
          <Field label="Faixa" name="belt" placeholder="Azul" required />
          <Field label="Categoria de peso" name="weightClass" placeholder="Leve" required />
          <Field label="Peso máximo em kg (vazio = sem limite)" name="maxWeightKg" inputMode="decimal" />
          <Field label={`Preço da inscrição (${event.currency})`} name="price" inputMode="decimal" defaultValue="0" />
        </ActionForm>
      </section>
    </>
  );
}

export default function ManageEventPage({ params }: PageProps<"/manage/events/[eventId]">) {
  return (
    <Suspense fallback={<p className="opacity-60">A carregar evento…</p>}>
      <EventPanel params={params} />
    </Suspense>
  );
}
