import { Suspense } from "react";
import { EventCard } from "@/components/event-card";
import { Empty, PageTitle } from "@/components/ui";
import { listPublishedEvents } from "@/server/events";

async function EventList() {
  const events = await listPublishedEvents();
  if (events.length === 0) return <Empty>Nenhum evento publicado ainda.</Empty>;
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {events.map((event) => (
        <li key={event.id} className="min-w-0">
          <EventCard event={event} />
        </li>
      ))}
    </ul>
  );
}

export default function EventsPage() {
  return (
    <>
      <header className="mb-8 border-b border-line pb-6">
        <PageTitle>Eventos</PageTitle>
        <p className="mt-2 text-sm text-muted">Torneios com inscrições abertas e chaves publicadas.</p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted">A carregar eventos…</p>}>
        <EventList />
      </Suspense>
    </>
  );
}
