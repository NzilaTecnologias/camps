import Link from "next/link";
import { count, dateParts } from "@/lib/format";
import type { PublishedEvent } from "@/server/events";
import { registrationClosedReason } from "@/server/registrations";
import { Badge, Icon } from "./ui";

export function EventCard({ event }: { event: PublishedEvent }) {
  const { day, month, year } = dateParts(event.startsAt);
  const isOpen = registrationClosedReason(event) === null;
  const closes = dateParts(event.registrationClosesAt);

  return (
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
          {event._count.mats > 0 && (
            <p className="mb-1.5">
              <Badge tone="danger">● Em direto</Badge>
            </p>
          )}
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
  );
}
