import type { ReactNode } from "react";
import type { BracketDetails } from "@/server/events";

export type BracketMatchDetails = BracketDetails["matches"][number];
type Match = BracketMatchDetails;
type MatchActions = (match: Match) => ReactNode;
type Corner = Match["red"];

const BRONZE_KEY = "BRONZE";

function roundLabel(round: number, totalRounds: number, type: BracketDetails["type"]) {
  if (type === "ROUND_ROBIN") return `Rodada ${round}`;
  const fromEnd = totalRounds - round;
  return ["Final", "Semifinal", "Quartas de final", "Oitavas de final"][fromEnd] ?? `Rodada ${round}`;
}

function CornerRow({ corner, match, color }: { corner: Corner; match: Match; color: string }) {
  const isWinner = corner !== null && match.winnerId === corner.id;
  const placeholder = match.status === "BYE" ? "—" : "A definir";
  return (
    <div className={`flex items-center gap-2 px-3 py-2 ${isWinner ? "font-semibold" : ""}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate">
          {corner ? `${corner.athlete.firstName} ${corner.athlete.lastName}` : placeholder}
        </span>
        {corner?.athlete.academy && (
          <span className="block truncate text-xs font-normal opacity-60">{corner.athlete.academy.name}</span>
        )}
      </span>
      {isWinner && <span className="text-xs text-emerald-600">venceu</span>}
    </div>
  );
}

function MatchCard({ match, actions }: { match: Match; actions?: MatchActions }) {
  return (
    <div className="w-56 rounded-lg border border-foreground/15 text-sm">
      <CornerRow corner={match.red} match={match} color="bg-red-500" />
      <div className="border-t border-foreground/10" />
      <CornerRow corner={match.blue} match={match} color="bg-blue-500" />
      {match.method && (
        <div className="border-t border-foreground/10 px-3 py-1 text-xs opacity-60">
          {match.method} · {match.redScore}–{match.blueScore}
        </div>
      )}
      {actions?.(match)}
    </div>
  );
}

export function BracketView({ bracket, actions }: { bracket: BracketDetails; actions?: MatchActions }) {
  const main = bracket.matches.filter((m) => m.key !== BRONZE_KEY);
  const bronze = bracket.matches.find((m) => m.key === BRONZE_KEY);
  const rounds = [...new Set(main.map((m) => m.round))];
  const totalRounds = Math.max(...rounds);

  return (
    <div className="flex gap-6 overflow-x-auto pb-2">
      {rounds.map((round) => (
        <section key={round} className="flex shrink-0 flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide opacity-60">
            {roundLabel(round, totalRounds, bracket.type)}
          </h3>
          <div className="flex flex-1 flex-col justify-around gap-3">
            {main
              .filter((m) => m.round === round)
              .map((match) => (
                <MatchCard key={match.id} match={match} actions={actions} />
              ))}
          </div>
          {bronze && round === totalRounds && (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-wide opacity-60">Disputa de 3º lugar</h3>
              <MatchCard match={bronze} actions={actions} />
            </>
          )}
        </section>
      ))}
    </div>
  );
}
