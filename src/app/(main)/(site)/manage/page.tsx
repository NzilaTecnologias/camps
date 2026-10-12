import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { EventStatusBadge } from "@/components/status-badges";
import { Card, Empty, Icon, LinkButton, PageTitle, RowList, SectionTitle } from "@/components/ui";
import { formatDate, count } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { listOrganizers } from "@/server/manage";
import { createOrganizerAction } from "./actions";

async function Dashboard() {
  const user = await requireUser();
  const organizers = await listOrganizers(user.id);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-10">
        {organizers.length === 0 && (
          <Empty>
            Para criar eventos você precisa de uma organização: a liga, federação ou academia que promove o torneio.
          </Empty>
        )}

        {organizers.map((organizer) => (
          <section key={organizer.id}>
            <SectionTitle aside={<span className="text-sm text-muted">{count(organizer.events.length, "evento", "eventos")}</span>}>
              {organizer.name}
            </SectionTitle>
            {organizer.events.length === 0 ? (
              <Empty>Nenhum evento ainda.</Empty>
            ) : (
              <RowList>
                {organizer.events.map((event) => (
                  <Link
                    key={event.id}
                    href={`/manage/events/${event.id}`}
                    className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold group-hover:text-primary">{event.name}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                        <span className="flex items-center gap-1.5">
                          <Icon name="calendar" />
                          {formatDate(event.startsAt)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Icon name="users" />
                          {count(event._count.registrations, "inscrito", "inscritos")}
                        </span>
                      </p>
                    </div>
                    <EventStatusBadge status={event.status} />
                    <Icon name="chevron-right" className="h-5 w-5 text-muted group-hover:text-primary" />
                  </Link>
                ))}
              </RowList>
            )}
          </section>
        ))}
      </div>

      <aside className="flex flex-col gap-4">
        {organizers.length > 0 && (
          <LinkButton href="/manage/events/new" className="w-full">
            <Icon name="plus" />
            Novo evento
          </LinkButton>
        )}
        <Card className="p-5">
          <h2 className="mb-4 font-display text-xl font-bold uppercase leading-none">Nova organização</h2>
          <ActionForm
            action={createOrganizerAction}
            submitLabel="Criar organização"
            submitVariant="secondary"
            className="flex flex-col gap-4"
          >
            <Field label="Nome" name="name" required />
          </ActionForm>
        </Card>
      </aside>
    </div>
  );
}

export default function ManagePage() {
  return (
    <>
      <header className="mb-8 border-b border-line pb-6">
        <PageTitle>Painel do organizador</PageTitle>
        <p className="mt-2 text-sm text-muted">Crie eventos, abra categorias, gere chaves e lance resultados.</p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
        <Dashboard />
      </Suspense>
    </>
  );
}
