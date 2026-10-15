import Image from "next/image";
import Link from "next/link";
import { calendarDaysBetween, count, dateParts, formatDateRange } from "@/lib/format";
import { sportImage } from "@/lib/sports";
import type { PublishedEvent } from "@/server/events";
import { registrationClosedReason } from "@/server/registrations";
import { Badge, Icon } from "./ui";
import { Reveal } from "./reveal";

/** Quanto falta para o evento, ou se já está a decorrer ou terminou. */
function timing(event: PublishedEvent, now: Date): { label: string; tone: "primary" | "neutral" | "danger" } {
  if (event.endsAt < now) return { label: "Terminado", tone: "neutral" };
  if (event.startsAt <= now) return { label: "A decorrer", tone: "danger" };
  const days = calendarDaysBetween(now, event.startsAt);
  if (days <= 0) return { label: "Hoje", tone: "danger" };
  if (days === 1) return { label: "Amanhã", tone: "primary" };
  return { label: `Faltam ${days} dias`, tone: "primary" };
}

export function EventCard({ event }: { event: PublishedEvent }) {
  const now = new Date();
  const { day, month } = dateParts(event.startsAt);
  const isOpen = registrationClosedReason(event, now) === null;
  const when = timing(event, now);
  const closes = dateParts(event.registrationClosesAt);

  return (
    <Reveal stagger className="h-full">
      <Link
        href={`/events/${event.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-lg"
      >
        <div className="relative aspect-[16/9] overflow-hidden bg-ink">
          <Image
            src={sportImage(event.sport)}
            alt=""
            fill
            sizes="(min-width: 1280px) 300px, (min-width: 768px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
          <div className="absolute top-3 left-3 flex flex-col items-center rounded-lg bg-white px-2.5 py-1.5 text-ink shadow">
            <span className="font-display text-2xl font-bold leading-none">{day}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{month}</span>
          </div>
          {event._count.mats > 0 && (
            <span className="absolute top-3 right-3">
              <Badge tone="danger">● Em direto</Badge>
            </span>
          )}
          <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur">
            {event.sport}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="line-clamp-2 font-display text-xl font-bold uppercase leading-tight tracking-tight group-hover:text-primary">
            {event.name}
          </h3>
          <p className="flex items-center gap-1.5 truncate text-sm text-muted">
            <Icon name="pin" />
            <span className="truncate">{[event.city, event.country === "AO" ? "Angola" : event.country].filter(Boolean).join(", ")}</span>
          </p>
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Icon name="users" />
            {count(event._count.registrations, "inscrito", "inscritos")} · {count(event._count.divisions, "categoria", "categorias")}
          </p>
          {isOpen && (
            <p className="text-xs font-semibold text-success">
              Inscrições abertas até {closes.day} {closes.month}
            </p>
          )}

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3 text-sm">
            <span className="font-semibold">{formatDateRange(event.startsAt, event.endsAt, now)}</span>
            <Badge tone={when.tone}>{when.label}</Badge>
          </div>
        </div>
      </Link>
    </Reveal>
  );
}
