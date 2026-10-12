import type { ReactNode } from "react";
import type { BracketDetails } from "@/server/events";
import { Icon } from "./ui";

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

function CornerRow({ corner, match, stripe }: { corner: Corner; match: Match; stripe: string }) {
  const isWinner = corner !== null && match.winnerId === corner.id;
  const isLoser = corner !== null && match.winnerId !== null && !isWinner;
  const placeholder = match.status === "BYE" ? "Sem adversário" : "A definir";
  return (
    <div className={`flex items-stretch ${isWinner ? "bg-success/8" : ""}`}>
      <span className={`w-1.5 shrink-0 ${stripe}`} />
      <div className={`flex min-w-0 flex-1 items-center gap-2 px-3 py-2 ${isLoser ? "opacity-55" : ""}`}>
        <span className="min-w-0 flex-1">
          <span className={`block truncate ${isWinner ? "font-bold" : corner ? "font-medium" : "text-muted"}`}>
            {corner ? `${corner.athlete.firstName} ${corner.athlete.lastName}` : placeholder}
          </span>
          {corner?.athlete.academy && (
            <span className="block truncate text-xs text-muted">{corner.athlete.academy.name}</span>
          )}
        </span>
        {isWinner && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-white">
            <Icon name="check" className="h-3.5 w-3.5" />
            <span className="sr-only">venceu</span>
          </span>
        )}
      </div>
    </div>
  );
}

function MatchCard({ match, actions }: { match: Match; actions?: MatchActions }) {
  return (
    <div className="w-60 overflow-hidden rounded-lg border border-line bg-surface text-sm shadow-sm">
      <CornerRow corner={match.red} match={match} stripe="bg-corner-red" />
      <div className="border-t border-line" />
      <CornerRow corner={match.blue} match={match} stripe="bg-corner-blue" />
      {match.method && (
        <div className="flex justify-between border-t border-line bg-surface-2 px-3 py-1.5 text-xs text-muted">
          <span>{match.method}</span>
          <span className="font-mono font-semibold text-foreground">
            {match.redScore}–{match.blueScore}
          </span>
        </div>
      )}
      {actions?.(match)}
    </div>
  );
}

function RoundHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="border-b-2 border-foreground/70 pb-1.5 font-display text-base font-bold uppercase tracking-wide">
      {children}
    </h3>
  );
}

export function BracketView({ bracket, actions }: { bracket: BracketDetails; actions?: MatchActions }) {
  const main = bracket.matches.filter((m) => m.key !== BRONZE_KEY);
  const bronze = bracket.matches.find((m) => m.key === BRONZE_KEY);
  const rounds = [...new Set(main.map((m) => m.round))];
  const totalRounds = Math.max(...rounds);

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-3">
      <div className="flex min-w-max gap-8">
        {rounds.map((round) => (
          <section key={round} className="flex shrink-0 flex-col gap-4">
            <RoundHeading>{roundLabel(round, totalRounds, bracket.type)}</RoundHeading>
            <div className="flex flex-1 flex-col justify-around gap-4">
              {main
                .filter((m) => m.round === round)
                .map((match) => (
                  <MatchCard key={match.id} match={match} actions={actions} />
                ))}
            </div>
            {bronze && round === totalRounds && (
              <>
                <RoundHeading>Disputa de 3º lugar</RoundHeading>
                <MatchCard match={bronze} actions={actions} />
              </>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
