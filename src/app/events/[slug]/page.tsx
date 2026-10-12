import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink, Badge, Empty, Icon, RowList, SectionTitle } from "@/components/ui";
import { formatDate, formatMoney, formatWeight, count } from "@/lib/format";
import { getPublishedEvent } from "@/server/events";
import { registrationClosedReason } from "@/server/registrations";

async function EventDetails({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getPublishedEvent(slug);
  if (!event) notFound();
  const closedReason = registrationClosedReason(event);
  const totalRegistered = event.divisions.reduce((sum, division) => sum + division._count.registrations, 0);

  return (
    <>
      <BackLink href="/">Eventos</BackLink>
      <header className="hero mt-3 mb-10 rounded-2xl px-6 py-10 sm:px-10">
        <div className="flex flex-wrap items-center gap-3">
          {closedReason ? <Badge tone="inverse">{closedReason}</Badge> : <Badge tone="accent">Inscrições abertas</Badge>}
          <span className="text-sm text-white/60">Organização: {event.organizer.name}</span>
        </div>
        <h1 className="mt-4 font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl">
          {event.name}
        </h1>
        {event.description && <p className="mt-3 max-w-2xl text-white/75">{event.description}</p>}
        <dl className="mt-7 grid gap-4 text-sm sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <Icon name="calendar" className="mt-0.5 h-5 w-5 text-accent" />
            <div>
              <dt className="text-xs uppercase tracking-wider text-white/50">Data</dt>
              <dd className="font-semibold">{formatDate(event.startsAt)}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Icon name="pin" className="mt-0.5 h-5 w-5 text-accent" />
            <div>
              <dt className="text-xs uppercase tracking-wider text-white/50">Local</dt>
              <dd className="font-semibold">
                {[event.venue, event.city, event.country].filter(Boolean).join(", ")}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Icon name="clock" className="mt-0.5 h-5 w-5 text-accent" />
            <div>
              <dt className="text-xs uppercase tracking-wider text-white/50">Inscrições até</dt>
              <dd className="font-semibold">{formatDate(event.registrationClosesAt)}</dd>
            </div>
          </div>
        </dl>
      </header>

      <SectionTitle aside={<span className="text-sm text-muted">{count(totalRegistered, "inscrito", "inscritos")} no total</span>}>
        Categorias
      </SectionTitle>
      {event.divisions.length === 0 ? (
        <Empty>As categorias deste evento ainda não foram publicadas.</Empty>
      ) : (
        <RowList>
          {event.divisions.map((division) => (
            <Link
              key={division.id}
              href={`/events/${event.slug}/divisions/${division.id}`}
              className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold group-hover:text-primary">{division.name}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                  <span className="flex items-center gap-1.5">
                    <Icon name="scale" />
                    {formatWeight(division.maxWeightKg)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Icon name="users" />
                    {count(division._count.registrations, "inscrito", "inscritos")}
                  </span>
                  {division.bracket && <Badge tone="primary">Chave publicada</Badge>}
                </p>
              </div>
              <span className="shrink-0 font-display text-xl font-bold">
                {division.priceCents === 0 ? "Gratuito" : formatMoney(division.priceCents, event.currency)}
              </span>
              <Icon name="chevron-right" className="h-5 w-5 text-muted group-hover:text-primary" />
            </Link>
          ))}
        </RowList>
      )}
    </>
  );
}

export default function EventPage({ params }: PageProps<"/events/[slug]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar evento…</p>}>
      <EventDetails params={params} />
    </Suspense>
  );
}
