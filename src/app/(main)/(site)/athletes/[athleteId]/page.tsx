import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MedalCounts } from "@/components/medals";
import { BackLink, Badge, Card, PageTitle, RowList, SectionTitle } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { getAthlete } from "@/server/community";
import { Reveal } from "@/components/reveal";

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Reveal stagger className="h-full">
      <Card className="px-5 py-4">
        <p className="font-display text-4xl font-bold leading-none">{value}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      </Card>
    </Reveal>
  );
}

const PLACE_TONE = { 1: "accent", 2: "neutral", 3: "warning" } as const;

async function AthleteDetails({ params }: { params: Promise<{ athleteId: string }> }) {
  const { athleteId } = await params;
  const athlete = await getAthlete(athleteId);
  if (!athlete) notFound();
  const winRate = athlete.fights > 0 ? `${Math.round((athlete.wins / athlete.fights) * 100)}%` : "—";

  return (
    <>
      <BackLink href="/athletes">Atletas</BackLink>
      <header className="mt-3 mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <PageTitle>{athlete.name}</PageTitle>
          <p className="mt-2 text-sm text-muted">
            {athlete.academy ? (
              <Link href={`/academies/${athlete.academy.id}`} className="hover:text-primary hover:underline">
                {athlete.academy.name}
              </Link>
            ) : (
              "Sem academia"
            )}
            {athlete.belt && ` · Faixa ${athlete.belt.toLowerCase()}`}
          </p>
        </div>
        <MedalCounts medals={athlete.medals} />
      </header>

      <div className="mb-10 grid grid-cols-3 gap-4">
        <Stat label="Lutas" value={athlete.fights} />
        <Stat label="Vitórias" value={athlete.wins} />
        <Stat label="Aproveitamento" value={winRate} />
      </div>

      <SectionTitle>Torneios</SectionTitle>
      <RowList>
        {athlete.history.map((entry) => (
          <Link
            key={entry.id}
            href={`/events/${entry.event.slug}/divisions/${entry.division.id}`}
            className="group flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 transition-colors hover:bg-surface-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold group-hover:text-primary">{entry.event.name}</p>
              <p className="truncate text-sm text-muted">
                {entry.division.name} · {formatDate(entry.event.startsAt)}
              </p>
            </div>
            <span className="text-sm text-muted">
              {entry.wins} V · {entry.fights - entry.wins} D
            </span>
            {entry.place && entry.place <= 3 ? (
              <Badge tone={PLACE_TONE[entry.place as 1 | 2 | 3]}>{entry.place}º lugar</Badge>
            ) : entry.place ? (
              <Badge>{entry.place}º lugar</Badge>
            ) : null}
          </Link>
        ))}
      </RowList>
    </>
  );
}

export default function AthletePage({ params }: PageProps<"/athletes/[athleteId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar atleta…</p>}>
      <AthleteDetails params={params} />
    </Suspense>
  );
}
