import Link from "next/link";
import { Suspense } from "react";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { EventCard } from "@/components/event-card";
import { EventsMap, type MapPoint } from "@/components/map/events-map";
import { Pager, readPage } from "@/components/pager";
import { Empty, Icon, LinkButton, buttonClass } from "@/components/ui";
import { UTC_OFFSET, count, formatDateRange } from "@/lib/format";
import { eventLocation } from "@/lib/geo";
import { SPORTS, SPORT_NAMES } from "@/lib/sports";
import { EVENTS_PER_PAGE, listEventCities, listEventMapPoints, listEvents, type EventFilters } from "@/server/events";
import { Reveal } from "@/components/reveal";

type SearchParams = PageProps<"/events">["searchParams"];

const controlClass =
  "h-10 w-full rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-primary focus:ring-2 focus:ring-primary/30 [color-scheme:dark]";

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value.trim() : "");

function parseDay(value: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${time}${UTC_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Lê os filtros do endereço, ignorando valores que não reconhece. */
function readFilters(params: Awaited<SearchParams>) {
  const raw = {
    when: one(params.when) === "past" ? ("past" as const) : ("upcoming" as const),
    q: one(params.q),
    sport: SPORT_NAMES.includes(one(params.sport)) ? one(params.sport) : "",
    city: one(params.city),
    from: one(params.from),
    to: one(params.to),
    sort: one(params.sort) === "popular" ? ("popular" as const) : ("date" as const),
    view: one(params.view) === "map" ? ("map" as const) : ("grid" as const),
  };
  const filters: EventFilters = {
    when: raw.when,
    search: raw.q,
    sport: raw.sport || undefined,
    city: raw.city || undefined,
    from: parseDay(raw.from, "00:00:00"),
    to: parseDay(raw.to, "23:59:59"),
    sort: raw.sort,
  };
  const active = Boolean(raw.q || raw.sport || raw.city || raw.from || raw.to);
  return { raw, filters, active };
}

function Tabs({ when }: { when: "upcoming" | "past" }) {
  const tab = (value: "upcoming" | "past", label: string) => (
    <Link
      href={value === "upcoming" ? "/events" : "/events?when=past"}
      aria-current={when === value ? "page" : undefined}
      className={`flex-1 rounded-full px-5 py-2.5 text-center text-sm font-semibold whitespace-nowrap transition-colors ${
        when === value ? "bg-white text-ink shadow" : "text-white/70 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Período" className="flex w-full max-w-md rounded-full bg-white/10 p-1">
      {tab("upcoming", "Próximos eventos")}
      {tab("past", "Eventos passados")}
    </nav>
  );
}

async function EventsBrowser({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { raw, filters, active } = readFilters(params);
  const page = readPage(params.page);
  const [{ events, total }, cities, mapEvents] = await Promise.all([
    listEvents(filters, { page }),
    listEventCities(),
    raw.view === "map" ? listEventMapPoints(filters) : Promise.resolve([]),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / EVENTS_PER_PAGE));
  // Parâmetros atuais para os links de página (os valores por omissão não aparecem no endereço).
  const pagerParams = Object.fromEntries(
    Object.entries(raw).filter(
      ([key, value]) => value && !(key === "when" && value === "upcoming") && !(key === "sort" && value === "date") && !(key === "view" && value === "grid"),
    ),
  );
  const clearHref = raw.when === "past" ? "/events?when=past" : "/events";
  // Ligar e desligar o mapa mantém os filtros escolhidos.
  const mapToggleHref = (() => {
    const query = new URLSearchParams(
      Object.entries({ ...raw, view: raw.view === "map" ? "" : "map" }).filter(
        ([key, value]) => value && !(key === "when" && value === "upcoming") && !(key === "sort" && value === "date"),
      ),
    ).toString();
    return query ? `/events?${query}` : "/events";
  })();
  const points: MapPoint[] = mapEvents.flatMap((event) => {
    const location = eventLocation(event);
    return location
      ? [
          {
            id: event.id,
            ...location,
            name: event.name,
            href: `/events/${event.slug}`,
            detail: `${formatDateRange(event.startsAt, event.endsAt)} · ${event.city ?? ""} · ${event.sport}`,
          },
        ]
      : [];
  });

  return (
    <>
      {/* Faixa escura com separadores, ações e filtros */}
      <Reveal delay={120}>
        <section className="hero mb-10 rounded-2xl px-5 py-8 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Tabs when={raw.when} />
            <div className="flex flex-wrap gap-2">
              <LinkButton href="/manage/events/new">
                <Icon name="plus" />
                Criar evento
              </LinkButton>
              <LinkButton href={mapToggleHref} variant="inverse">
                <Icon name="pin" />
                {raw.view === "map" ? "Esconder mapa" : "Mostrar mapa"}
              </LinkButton>
              <LinkButton href="/academies" variant="inverse">
                <Icon name="users" />
                Academias
              </LinkButton>
            </div>
          </div>

          <AutoSubmitForm
            action="/events"
            role="search"
            className="mt-6 grid gap-3 border-t border-white/10 pt-6 sm:grid-cols-2 lg:grid-cols-6"
          >
            {raw.when === "past" && <input type="hidden" name="when" value="past" />}
            {raw.view === "map" && <input type="hidden" name="view" value="map" />}
            <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
              <label className="sr-only" htmlFor="q">
                Procurar evento
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={raw.q}
                placeholder="Procurar evento, cidade ou organizador…"
                className={controlClass}
              />
              <button type="submit" className={buttonClass("primary")}>
                Procurar
              </button>
            </div>
            <label className="lg:col-span-2">
              <span className="sr-only">Modalidade</span>
              <select name="sport" defaultValue={raw.sport} className={controlClass}>
                <option value="">Todas as modalidades</option>
                {SPORTS.map((sport) => (
                  <option key={sport.name} value={sport.name}>
                    {sport.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="lg:col-span-2">
              <span className="sr-only">Cidade</span>
              <select name="city" defaultValue={raw.city} className={controlClass}>
                <option value="">Todas as cidades</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-white/60">
              <span className="shrink-0">De</span>
              <input name="from" type="date" defaultValue={raw.from} className={controlClass} />
            </label>
            <label className="flex items-center gap-2 text-xs text-white/60">
              <span className="shrink-0">Até</span>
              <input name="to" type="date" defaultValue={raw.to} className={controlClass} />
            </label>
            <label className="sm:col-span-2 lg:col-span-2">
              <span className="sr-only">Ordenar</span>
              <select name="sort" defaultValue={raw.sort} className={controlClass}>
                <option value="date">{raw.when === "past" ? "Mais recentes primeiro" : "Mais próximos primeiro"}</option>
                <option value="popular">Mais inscritos primeiro</option>
              </select>
            </label>
          </AutoSubmitForm>
        </section>
      </Reveal>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-3xl font-bold uppercase leading-none">
          {raw.when === "past" ? "Eventos passados" : "Próximos eventos"}
        </h2>
        <p className="flex items-center gap-3 text-sm text-muted">
          {count(total, "evento", "eventos")}
          {active && (
            <Link href={clearHref} className="font-semibold text-primary hover:underline">
              Limpar filtros
            </Link>
          )}
        </p>
      </div>

      {raw.view === "map" && (
        <section className="mb-8" aria-label="Mapa dos eventos">
          <EventsMap points={points} />
          {points.length < mapEvents.length && (
            <p className="mt-2 text-xs text-muted">
              {count(mapEvents.length - points.length, "evento não aparece", "eventos não aparecem")} no mapa por não ter
              localização.
            </p>
          )}
          {mapEvents.length >= 500 && (
            <p className="mt-2 text-xs text-muted">O mapa mostra os primeiros 500 eventos; use os filtros para ver outros.</p>
          )}
        </section>
      )}

      {events.length === 0 ? (
        <Empty>
          {active
            ? "Nenhum evento corresponde aos filtros escolhidos."
            : raw.when === "past"
              ? "Ainda não há eventos terminados."
              : "Não há eventos marcados de momento."}
        </Empty>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {events.map((event) => (
            <li key={event.id} className="min-w-0">
              <EventCard event={event} />
            </li>
          ))}
        </ul>
      )}
      <Pager basePath="/events" params={pagerParams} page={page} totalPages={totalPages} />
    </>
  );
}

export default function EventsPage({ searchParams }: PageProps<"/events">) {
  return (
    <>
      <Reveal>
        <header className="mb-6">
          <h1 className="font-display text-5xl font-bold uppercase leading-none tracking-tight">Eventos</h1>
          <p className="mt-2 text-muted">Torneios de desportos de combate: inscrições, chaves, resultados e transmissões.</p>
        </header>
      </Reveal>
      <Suspense fallback={<p className="text-sm text-muted">A carregar eventos…</p>}>
        <EventsBrowser searchParams={searchParams} />
      </Suspense>
    </>
  );
}
