import { formatTime } from "@/lib/format";
import type { ScheduledMatch } from "@/server/schedule";
import { Badge, Card, Empty } from "./ui";

type Fighter = ScheduledMatch["red"];

const name = (fighter: Fighter) => (fighter ? `${fighter.athlete.firstName} ${fighter.athlete.lastName}` : "A definir");

function MatchStatus({ match }: { match: ScheduledMatch }) {
  if (match.status === "FINISHED") return <Badge>Terminada</Badge>;
  if (match.currentOnMat) return <Badge tone="danger">● A decorrer</Badge>;
  if (match.status === "READY") return <Badge tone="success">Pronta</Badge>;
  return <Badge>A definir</Badge>;
}

function Corner({ fighter, won, tone }: { fighter: Fighter; won: boolean; tone: string }) {
  return <span className={`${tone} ${won ? "font-bold" : ""}`}>{name(fighter)}</span>;
}

/** As lutas de uma área pela ordem da programação, com a hora prevista. */
export function MatSchedule({ name: matName, matches, live }: { name: string; matches: ScheduledMatch[]; live?: boolean }) {
  const next = matches.find((match) => match.status !== "FINISHED");
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <h3 className="font-display text-2xl font-bold uppercase leading-none">{matName}</h3>
        <span className="flex items-center gap-2 text-xs text-muted">
          {live && <Badge tone="danger">● Em direto</Badge>}
          {matches.length} {matches.length === 1 ? "luta" : "lutas"}
        </span>
      </div>
      {matches.length === 0 ? (
        <Empty>Sem lutas programadas nesta área.</Empty>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {matches.map((match) => (
            <div
              key={match.id}
              className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm ${match.status === "FINISHED" ? "opacity-60" : ""} ${match.id === next?.id ? "bg-primary/5" : ""}`}
            >
              <span className="w-12 font-mono text-xs tabular-nums text-muted">#{match.sequence}</span>
              <span className="w-14 font-mono font-semibold tabular-nums">{match.scheduledAt ? formatTime(match.scheduledAt) : "—"}</span>
              <span className="min-w-48 flex-1">
                <Corner fighter={match.red} won={match.winnerId !== null && match.winnerId === match.redId} tone="text-corner-red" />
                <span className="mx-2 text-muted">×</span>
                <Corner fighter={match.blue} won={match.winnerId !== null && match.winnerId === match.blueId} tone="text-corner-blue" />
                <span className="block text-xs text-muted">{match.bracket.division.name}</span>
              </span>
              <MatchStatus match={match} />
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}
