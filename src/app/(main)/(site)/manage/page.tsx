import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/field";
import { EventStatusBadge } from "@/components/status-badges";
import { Badge, Card, Empty, Icon, LinkButton, PageTitle } from "@/components/ui";
import { PLAN_LABEL, planActive } from "@/lib/federation-rules";
import { count, formatDateRange } from "@/lib/format";
import { SPORTS, sportImage } from "@/lib/sports";
import { listMyFederations } from "@/server/federations";
import { createFederationAction } from "./federation-actions";
import { requireUser } from "@/server/auth";
import { listOrganizers } from "@/server/manage";
import { createOrganizerAction } from "./actions";

type Organizer = Awaited<ReturnType<typeof listOrganizers>>[number];

function EventTile({ event }: { event: Organizer["events"][number] }) {
  return (
    <Link
      href={`/manage/events/${event.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-lg"
    >
      <div className="relative h-32 overflow-hidden">
        <Image
          src={sportImage(event.sport)}
          alt=""
          fill
          sizes="(min-width: 1024px) 22rem, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute top-3 left-3 rounded-full bg-black/70 backdrop-blur-sm">
          <EventStatusBadge status={event.status} />
        </div>
        <p className="absolute bottom-3 left-3 text-xs font-semibold uppercase tracking-wider text-white/80">{event.sport}</p>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 font-semibold leading-snug group-hover:text-primary">{event.name}</h3>
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <Icon name="calendar" />
          {formatDateRange(event.startsAt, event.endsAt)}
        </p>
        <div className="mt-auto flex items-center justify-between border-t border-line pt-3 text-sm">
          <span className="flex items-center gap-1.5 text-muted">
            <Icon name="users" />
            {count(event._count.registrations, "inscrito", "inscritos")}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-primary">
            Gerir <Icon name="chevron-right" />
          </span>
        </div>
      </div>
    </Link>
  );
}

async function Dashboard() {
  const user = await requireUser();
  const [organizers, federations] = await Promise.all([listOrganizers(user.id), listMyFederations(user.id)]);
  const events = organizers.flatMap((organizer) => organizer.events);
  const registrations = events.reduce((sum, event) => sum + event._count.registrations, 0);
  const published = events.filter((event) => event.status === "PUBLISHED").length;

  return (
    <>
      {organizers.length > 0 && (
        <div className="mb-10 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Eventos", value: events.length, icon: "calendar" as const },
            { label: "Publicados", value: published, icon: "flag" as const },
            { label: "Inscrições confirmadas", value: registrations, icon: "users" as const },
          ].map((stat) => (
            <Card key={stat.label} className="flex items-center gap-4 p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Icon name={stat.icon} className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-3xl font-bold leading-none">{stat.value}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">{stat.label}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-10">
          {organizers.length === 0 && (
            <Empty>
              Para criar eventos precisa de uma organização: a liga, federação ou academia que promove o torneio.
              Crie-a no formulário ao lado.
            </Empty>
          )}

          {organizers.map((organizer) => (
            <section key={organizer.id}>
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Organização</p>
                  <h2 className="font-display text-2xl font-bold uppercase leading-none">{organizer.name}</h2>
                  <p className="mt-1 text-xs text-muted">
                    Identificador <code className="rounded bg-foreground/8 px-1.5 py-0.5 font-mono">{organizer.slug}</code> · dê-o a uma
                    federação para poder pôr eventos sob ela
                  </p>
                </div>
                <span className="text-sm text-muted">{count(organizer.events.length, "evento", "eventos")}</span>
              </div>
              {organizer.events.length === 0 ? (
                <Empty>Nenhum evento ainda.</Empty>
              ) : (
                <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {organizer.events.map((event) => (
                    <li key={event.id}>
                      <EventTile event={event} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {federations.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Federações</p>
              <h2 className="mb-4 font-display text-2xl font-bold uppercase leading-none">As minhas federações</h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {federations.map((federation) => (
                  <li key={federation.id}>
                    <Link
                      href={`/manage/federations/${federation.id}`}
                      className="group flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-foreground/30"
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-8 w-1.5 rounded-full" style={{ background: federation.color }} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold group-hover:text-primary">{federation.name}</p>
                          <p className="text-xs text-muted">{federation.sport}</p>
                        </div>
                        {planActive(federation) ? <Badge tone="success">{PLAN_LABEL[federation.plan!]}</Badge> : <Badge>Inativo</Badge>}
                      </div>
                      <p className="text-sm text-muted">
                        {count(federation._count.events, "evento", "eventos")} · {count(federation._count.academies, "academia", "academias")} ·{" "}
                        {count(federation._count.memberships, "atleta filiado", "atletas filiados")}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          {organizers.length > 0 && (
            <LinkButton href="/manage/events/new" className="w-full">
              <Icon name="plus" />
              Novo evento
            </LinkButton>
          )}
          <Card className="p-5">
            <h2 className="mb-1 font-display text-xl font-bold uppercase leading-none">Nova organização</h2>
            <p className="mb-4 text-sm text-muted">Liga, federação ou academia em nome da qual organiza torneios.</p>
            <ActionForm
              action={createOrganizerAction}
              submitLabel="Criar organização"
              submitVariant="secondary"
              className="flex flex-col gap-4"
            >
              <Field label="Nome" name="name" required />
            </ActionForm>
          </Card>
          <Card className="p-5">
            <h2 className="mb-1 font-display text-xl font-bold uppercase leading-none">Nova federação</h2>
            <p className="mb-4 text-sm text-muted">
              Página própria, filiação de academias e atletas e ranking nacional. Fica ativa depois de a Camps ativar o
              plano.
            </p>
            <ActionForm action={createFederationAction} submitLabel="Criar federação" submitVariant="secondary" className="flex flex-col gap-4">
              <Field label="Nome" name="name" placeholder="Federação Angolana de Jiu-Jitsu" required />
              <SelectField label="Modalidade" name="sport" defaultValue="Jiu-Jitsu">
                {SPORTS.map((sport) => (
                  <option key={sport.name} value={sport.name}>
                    {sport.name}
                  </option>
                ))}
              </SelectField>
            </ActionForm>
          </Card>
        </aside>
      </div>
    </>
  );
}

export default function ManagePage() {
  return (
    <>
      <header className="mb-8 border-b border-line pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Área do organizador</p>
        <div className="mt-2">
          <PageTitle>Os meus eventos</PageTitle>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Abra um evento para gerir a página, as inscrições, a pesagem, as chaves, o placar, a transmissão, os
          descontos e os reembolsos.
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
        <Dashboard />
      </Suspense>
    </>
  );
}
