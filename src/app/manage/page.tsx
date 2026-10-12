import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { EVENT_STATUS_LABEL, formatDate } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { listOrganizers } from "@/server/manage";
import { createOrganizerAction } from "./actions";

async function Dashboard() {
  const user = await requireUser();
  const organizers = await listOrganizers(user.id);

  return (
    <>
      {organizers.length === 0 && (
        <p className="mb-8 opacity-70">
          Para criar eventos você precisa de uma organização: a liga, federação ou academia que promove o torneio.
        </p>
      )}

      {organizers.map((organizer) => (
        <section key={organizer.id} className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">{organizer.name}</h2>
          {organizer.events.length === 0 ? (
            <p className="opacity-60">Nenhum evento ainda.</p>
          ) : (
            <ul className="divide-y divide-foreground/10 rounded-lg border border-foreground/15">
              {organizer.events.map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/manage/events/${event.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-foreground/5"
                  >
                    <span>
                      <span className="block font-medium">{event.name}</span>
                      <span className="text-sm opacity-60">
                        {formatDate(event.startsAt)} · {event._count.registrations} inscritos
                      </span>
                    </span>
                    <span className="shrink-0 text-sm opacity-70">{EVENT_STATUS_LABEL[event.status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {organizers.length > 0 && (
        <Link
          href="/manage/events/new"
          className="mb-10 inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Novo evento
        </Link>
      )}

      <section className="max-w-sm">
        <h2 className="mb-3 text-lg font-semibold">Nova organização</h2>
        <ActionForm action={createOrganizerAction} submitLabel="Criar organização" className="space-y-4">
          <Field label="Nome" name="name" required />
        </ActionForm>
      </section>
    </>
  );
}

export default function ManagePage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Painel do organizador</h1>
      <Suspense fallback={<p className="opacity-60">A carregar…</p>}>
        <Dashboard />
      </Suspense>
    </>
  );
}
