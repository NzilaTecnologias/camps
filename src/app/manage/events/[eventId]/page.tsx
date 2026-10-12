import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/field";
import { EventStatusBadge } from "@/components/status-badges";
import { BackLink, Badge, Card, Empty, Icon, LinkButton, PageTitle, RowList, SectionTitle } from "@/components/ui";
import { BRACKET_TYPE_LABEL, formatDate, formatMoney, formatWeight, count } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { getManagedEvent } from "@/server/manage";
import { createDivisionAction, setEventStatusAction } from "../../actions";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="px-5 py-4">
      <p className="font-display text-4xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
    </Card>
  );
}

async function EventPanel({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await requireUser();
  const event = await getManagedEvent(user.id, eventId);
  if (!event) notFound();
  const isPublished = event.status === "PUBLISHED";
  const registered = event.divisions.reduce((sum, division) => sum + division._count.registrations, 0);
  const brackets = event.divisions.filter((division) => division.bracket).length;

  return (
    <>
      <BackLink href="/manage">Painel</BackLink>
      <header className="mt-3 mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-line pb-6">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <EventStatusBadge status={event.status} />
            <span className="text-sm text-muted">{event.organizer.name}</span>
          </div>
          <PageTitle>{event.name}</PageTitle>
          <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <Icon name="calendar" />
              {formatDate(event.startsAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="pin" />
              {[event.venue, event.city].filter(Boolean).join(", ") || "local a definir"}
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="clock" />
              Inscrições até {formatDate(event.registrationClosesAt)}
            </span>
          </p>
        </div>

        {event.status !== "CANCELLED" && (
          <div className="flex items-center gap-3">
            {isPublished && (
              <LinkButton href={`/events/${event.slug}`} variant="secondary">
                Ver página pública
              </LinkButton>
            )}
            <ActionForm
              action={setEventStatusAction.bind(null, event.id, isPublished ? "DRAFT" : "PUBLISHED")}
              submitLabel={isPublished ? "Despublicar" : "Publicar evento"}
              submitVariant={isPublished ? "secondary" : "primary"}
            >
              {null}
            </ActionForm>
          </div>
        )}
      </header>

      <div className="mb-10 grid grid-cols-3 gap-4">
        <Stat label="Categorias" value={event.divisions.length} />
        <Stat label="Inscritos" value={registered} />
        <Stat label="Chaves geradas" value={brackets} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section>
          <SectionTitle>Categorias</SectionTitle>
          {event.divisions.length === 0 ? (
            <Empty>Nenhuma categoria ainda. Adicione a primeira ao lado.</Empty>
          ) : (
            <RowList>
              {event.divisions.map((division) => (
                <Link
                  key={division.id}
                  href={`/manage/events/${event.id}/divisions/${division.id}`}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold group-hover:text-primary">{division.name}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                      <span>{formatWeight(division.maxWeightKg)}</span>
                      <span>{count(division._count.registrations, "inscrito", "inscritos")}</span>
                      {division.bracket ? (
                        <Badge tone="primary">chave: {BRACKET_TYPE_LABEL[division.bracket.type]}</Badge>
                      ) : (
                        <Badge>sem chave</Badge>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 font-display text-lg font-bold">
                    {formatMoney(division.priceCents, event.currency)}
                  </span>
                  <Icon name="chevron-right" className="h-5 w-5 text-muted group-hover:text-primary" />
                </Link>
              ))}
            </RowList>
          )}
        </section>

        <aside>
          <Card className="p-5">
            <h2 className="mb-4 font-display text-xl font-bold uppercase leading-none">Nova categoria</h2>
            <ActionForm
              action={createDivisionAction.bind(null, event.id)}
              submitLabel="Adicionar categoria"
              className="flex flex-col gap-4"
            >
              <SelectField label="Sexo" name="gender" required>
                <option value="MALE">Masculino</option>
                <option value="FEMALE">Feminino</option>
              </SelectField>
              <Field label="Faixa etária" name="ageGroup" defaultValue="Adulto" required />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Faixa" name="belt" placeholder="Azul" required />
                <Field label="Categoria de peso" name="weightClass" placeholder="Leve" required />
              </div>
              <Field label="Peso máximo em kg (vazio = sem limite)" name="maxWeightKg" inputMode="decimal" />
              <Field
                label={`Preço da inscrição (${event.currency})`}
                name="price"
                inputMode="decimal"
                defaultValue="0"
              />
            </ActionForm>
          </Card>
        </aside>
      </div>
    </>
  );
}

export default function ManageEventPage({ params }: PageProps<"/manage/events/[eventId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar evento…</p>}>
      <EventPanel params={params} />
    </Suspense>
  );
}
