import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ActionForm } from "@/components/action-form";
import { EventNav } from "@/components/manage/event-nav";
import { EventStatusBadge } from "@/components/status-badges";
import { BackLink, Icon, LinkButton } from "@/components/ui";
import { formatDateRange } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { getEventWorkspace } from "@/server/organizer";
import { setEventStatusAction } from "../../actions";

async function Workspace({ params, children }: { params: Promise<{ eventId: string }>; children: ReactNode }) {
  const { eventId } = await params;
  const user = await requireUser();
  const event = await getEventWorkspace(user.id, eventId);
  if (!event) notFound();
  const isPublished = event.status === "PUBLISHED";

  return (
    <>
      <BackLink href="/manage">Os meus eventos</BackLink>
      <header className="hero relative mt-3 mb-8 overflow-hidden rounded-2xl px-6 py-6 text-white sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <EventStatusBadge status={event.status} />
              <span className="text-sm text-white/70">
                {event.organizer.name} · {event.sport}
              </span>
            </div>
            <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight sm:text-5xl">
              {event.name}
            </h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-white/75">
              <span className="flex items-center gap-1.5">
                <Icon name="calendar" />
                {formatDateRange(event.startsAt, event.endsAt)}
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="pin" />
                {[event.venue, event.city].filter(Boolean).join(", ") || "Local a definir"}
              </span>
            </p>
          </div>
          {event.status !== "CANCELLED" && (
            <div className="flex flex-wrap items-center gap-2">
              {isPublished && (
                <LinkButton href={`/events/${event.slug}`} variant="inverse" target="_blank">
                  Ver página pública
                  <Icon name="external" />
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
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="min-w-0">
          <EventNav eventId={event.id} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}

/** Todas as secções do painel de um evento partilham este cabeçalho e o menu lateral. */
export default function EventWorkspaceLayout({ params, children }: LayoutProps<"/manage/events/[eventId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar evento…</p>}>
      <Workspace params={params}>{children}</Workspace>
    </Suspense>
  );
}
