import Link from "next/link";
import type { BracketDetails, DivisionDetails } from "@/server/events";
import { Avatar, Card, Empty } from "./ui";
import { Reveal } from "./reveal";

// Peças partilhadas pela página pública da categoria e pela do painel. O nome de cada atleta
// leva ao perfil dele (só os de eventos publicados o têm; nos outros o perfil responde 404).

const MEDAL: Record<number, string> = {
  1: "bg-accent text-ink",
  2: "bg-slate-300 text-slate-900",
  3: "bg-amber-700 text-white",
};

export function Podium({ placements }: { placements: BracketDetails["placements"] }) {
  if (placements.length === 0) return null;
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {placements.map((placement) => (
        <li key={placement.id}>
          <Reveal stagger className="h-full">
            <Card className="flex items-center gap-3 p-4">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-xl font-bold ${MEDAL[placement.place] ?? "bg-foreground/10 text-foreground"}`}
              >
                {placement.place}º
              </span>
              <span className="min-w-0">
                <span className="sr-only"> — </span>
                <Link href={`/athletes/${placement.registration.athlete.id}`} className="block truncate font-semibold hover:text-primary">
                  {placement.registration.athlete.firstName} {placement.registration.athlete.lastName}
                </Link>
                <span className="block truncate text-xs text-muted">
                  {placement.registration.athlete.academy?.name ?? "Sem academia"}
                </span>
              </span>
            </Card>
          </Reveal>
        </li>
      ))}
    </ol>
  );
}

export function RegistrantList({ registrations }: { registrations: DivisionDetails["registrations"] }) {
  if (registrations.length === 0) return <Empty>Ainda não há atletas inscritos nesta categoria.</Empty>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {registrations.map((registration) => {
        const name = `${registration.athlete.firstName} ${registration.athlete.lastName}`;
        return (
          <li key={registration.id}>
            <Reveal stagger className="h-full">
              <Card className="flex items-center gap-3 px-4 py-3">
                <Avatar name={name} />
                <span className="min-w-0">
                  <Link href={`/athletes/${registration.athlete.id}`} className="block truncate font-medium hover:text-primary">
                    {name}
                  </Link>
                  <span className="block truncate text-xs text-muted">
                    {registration.athlete.academy?.name ?? "Sem academia"}
                  </span>
                </span>
              </Card>
            </Reveal>
          </li>
        );
      })}
    </ul>
  );
}
