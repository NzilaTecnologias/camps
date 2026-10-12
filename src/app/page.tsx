import Link from "next/link";
import { Suspense } from "react";
import { Badge, Empty, Icon, LinkButton, SectionTitle } from "@/components/ui";
import { count, dateParts } from "@/lib/format";
import { listPublishedEvents } from "@/server/events";
import { registrationClosedReason } from "@/server/registrations";

async function EventList() {
  const events = await listPublishedEvents();
  if (events.length === 0) {
    return <Empty>Nenhum evento publicado ainda.</Empty>;
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {events.map((event) => {
        const { day, month, year } = dateParts(event.startsAt);
        const isOpen = registrationClosedReason(event) === null;
        const closes = dateParts(event.registrationClosesAt);
        return (
          <li key={event.id} className="min-w-0">
            <Link
              href={`/events/${event.slug}`}
              className="group flex h-full overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-md"
            >
              <div className="flex w-24 shrink-0 flex-col items-center justify-center bg-ink px-2 py-5 text-white">
                <span className="font-display text-5xl font-bold leading-none">{day}</span>
                <span className="mt-1 text-xs font-semibold uppercase tracking-widest text-accent">{month}</span>
                <span className="text-xs text-white/50">{year}</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
                <div>
                  <h3 className="font-display text-2xl font-bold uppercase leading-tight tracking-tight group-hover:text-primary">
                    {event.name}
                  </h3>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                    <Icon name="pin" />
                    {[event.venue, event.city].filter(Boolean).join(", ") || "Local a definir"}
                  </p>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
                  <span className="flex items-center gap-1.5">
                    <Icon name="users" />
                    {count(event._count.registrations, "inscrito", "inscritos")}
                  </span>
                  <span>{count(event._count.divisions, "categoria", "categorias")}</span>
                  <span className="ml-auto">
                    {isOpen ? (
                      <Badge tone="success">
                        Inscrições até {closes.day} {closes.month}
                      </Badge>
                    ) : (
                      <Badge>Inscrições encerradas</Badge>
                    )}
                  </span>
                </div>
                <p className="text-xs text-muted">Organização: {event.organizer.name}</p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function Home() {
  return (
    <>
      <section className="hero mb-10 overflow-hidden rounded-2xl px-6 py-12 sm:px-10 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Jiu-jitsu · Judo · Grappling · MMA</p>
        <h1 className="mt-3 max-w-2xl font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-7xl">
          Os torneios de Angola num só tatami
        </h1>
        <p className="mt-4 max-w-xl text-base text-white/75">
          Inscreva-se em competições, pague online e acompanhe as chaves e os resultados de cada categoria.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <LinkButton href="#eventos">Ver eventos</LinkButton>
          <LinkButton href="/manage" variant="inverse">
            Organizar um evento
          </LinkButton>
        </div>
      </section>

      <section id="eventos" className="scroll-mt-20">
        <SectionTitle>Próximos eventos</SectionTitle>
        <Suspense fallback={<p className="text-sm text-muted">A carregar eventos…</p>}>
          <EventList />
        </Suspense>
      </section>
    </>
  );
}
