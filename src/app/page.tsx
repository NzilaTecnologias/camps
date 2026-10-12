import Link from "next/link";
import { Suspense } from "react";
import { formatDate } from "@/lib/format";
import { listPublishedEvents } from "@/server/events";

async function EventList() {
  const events = await listPublishedEvents();
  if (events.length === 0) {
    return <p className="opacity-60">Nenhum evento publicado ainda.</p>;
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {events.map((event) => (
        <li key={event.id}>
          <Link
            href={`/events/${event.slug}`}
            className="block rounded-lg border border-foreground/15 p-4 hover:border-foreground/40"
          >
            <h2 className="font-semibold">{event.name}</h2>
            <p className="text-sm opacity-70">
              {formatDate(event.startsAt)} · {[event.city, event.country].filter(Boolean).join(", ")}
            </p>
            <p className="mt-2 text-sm opacity-60">
              {event.organizer.name} · {event._count.registrations} inscritos
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Próximos eventos</h1>
      <Suspense fallback={<p className="opacity-60">A carregar eventos…</p>}>
        <EventList />
      </Suspense>
    </>
  );
}
