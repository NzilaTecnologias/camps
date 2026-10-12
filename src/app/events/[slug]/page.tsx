import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatDate, formatMoney } from "@/lib/format";
import { getPublishedEvent } from "@/server/events";

async function EventDetails({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getPublishedEvent(slug);
  if (!event) notFound();

  return (
    <>
      <header className="mb-8">
        <h1 className="text-2xl font-bold">{event.name}</h1>
        <p className="opacity-70">
          {formatDate(event.startsAt)} · {[event.venue, event.city, event.country].filter(Boolean).join(", ")}
        </p>
        <p className="text-sm opacity-60">
          Organização: {event.organizer.name} · Inscrições até {formatDate(event.registrationClosesAt)}
        </p>
        {event.description && <p className="mt-4">{event.description}</p>}
      </header>

      <h2 className="mb-3 text-lg font-semibold">Categorias</h2>
      <ul className="divide-y divide-foreground/10 rounded-lg border border-foreground/15">
        {event.divisions.map((division) => (
          <li key={division.id}>
            <Link
              href={`/events/${event.slug}/divisions/${division.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-foreground/5"
            >
              <span>
                <span className="block font-medium">{division.name}</span>
                <span className="text-sm opacity-60">
                  {division.maxWeightKg ? `até ${division.maxWeightKg.toString()} kg` : "sem limite de peso"} ·{" "}
                  {division._count.registrations} inscritos
                  {division.bracket && " · chave publicada"}
                </span>
              </span>
              <span className="shrink-0 text-sm">{formatMoney(division.priceCents, event.currency)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function EventPage({ params }: PageProps<"/events/[slug]">) {
  return (
    <Suspense fallback={<p className="opacity-60">A carregar evento…</p>}>
      <EventDetails params={params} />
    </Suspense>
  );
}
