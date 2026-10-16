import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EventsMap } from "@/components/map/events-map";
import { ScoreboardCard } from "@/components/scoreboard-live";
import { BackLink, Badge, Empty, Icon, RowList, SectionTitle } from "@/components/ui";
import { eventLocation } from "@/lib/geo";
import { parseStreamUrl } from "@/lib/stream";
import { formatDate, formatMoney, formatWeight, count } from "@/lib/format";
import { earlyDiscountActive } from "@/lib/pricing";
import { getPublishedEvent } from "@/server/events";
import { registrationClosedReason } from "@/server/registrations";
import { Reveal } from "@/components/reveal";

async function EventDetails({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getPublishedEvent(slug);
  if (!event) notFound();
  const closedReason = registrationClosedReason(event);
  const totalRegistered = event.divisions.reduce((sum, division) => sum + division._count.registrations, 0);
  // Áreas no ar com um endereço que sabemos embutir, e áreas com uma luta no placar.
  const streams = event.mats.flatMap((mat) => {
    const embed = mat.isLive && mat.streamUrl ? parseStreamUrl(mat.streamUrl) : null;
    return embed ? [{ id: mat.id, name: mat.name, ...embed }] : [];
  });
  const activeMats = event.mats.filter((mat) => mat.currentMatchId !== null);
  const location = eventLocation(event);

  return (
    <>
      <BackLink href="/events">Eventos</BackLink>
      <Reveal>
        <header className="hero mt-3 mb-10 rounded-2xl px-6 py-10 sm:px-10">
          <div className="flex flex-wrap items-center gap-3">
            {closedReason ? <Badge tone="inverse">{closedReason}</Badge> : <Badge tone="accent">Inscrições abertas</Badge>}
            {!closedReason && earlyDiscountActive(event) && (
              <Badge tone="inverse">
                −{event.earlyDiscountPercent}% até {formatDate(event.earlyDiscountEndsAt!)}
              </Badge>
            )}
            <span className="text-sm text-white/60">Organização: {event.organizer.name}</span>
          </div>
          <h1 className="mt-4 font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl">
            {event.name}
          </h1>
          {event.description && <p className="mt-3 max-w-2xl whitespace-pre-line text-white/75">{event.description}</p>}
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
      </Reveal>

      {(streams.length > 0 || activeMats.length > 0) && (
        <section className="mb-10">
          <SectionTitle aside={streams.length > 0 && <Badge tone="danger">● Em direto</Badge>}>
            {streams.length > 0 ? "Transmissão em direto" : "A decorrer agora"}
          </SectionTitle>
          {streams.length > 0 && (
            <div className={`grid gap-4 ${streams.length > 1 ? "lg:grid-cols-2" : ""}`}>
              {streams.map((stream) => (
                <figure key={stream.id} className="overflow-hidden rounded-xl border border-line bg-black shadow-sm">
                  <iframe
                    src={stream.embedUrl}
                    title={`Transmissão em direto: ${stream.name}`}
                    className="aspect-video w-full"
                    allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                  <figcaption className="bg-surface px-4 py-2 text-sm font-semibold">
                    {stream.name} <span className="font-normal text-muted">· via {stream.provider}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
          {activeMats.length > 0 && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {activeMats.map((mat) => (
                <ScoreboardCard key={mat.id} matId={mat.id} />
              ))}
            </div>
          )}
        </section>
      )}

      {location && (
        <section className="mb-10">
          <SectionTitle>Localização</SectionTitle>
          <EventsMap
            className="h-72"
            singleZoom={location.exact ? 15 : 12}
            points={[
              {
                id: event.id,
                ...location,
                name: event.venue ?? event.name,
                href: `/events/${event.slug}`,
                detail: [event.venue, event.city].filter(Boolean).join(", "),
              },
            ]}
          />
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <Icon name="pin" />
              {[event.venue, event.city].filter(Boolean).join(", ")}
              {!location.exact && " (localização aproximada)"}
            </span>
            <a
              href={`https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=16/${location.lat}/${location.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              Abrir no mapa ↗
            </a>
          </p>
        </section>
      )}

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
