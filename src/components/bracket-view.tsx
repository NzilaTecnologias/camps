import type { ReactNode } from "react";
import { doubleEliminationSection } from "@/lib/brackets/double-elimination";
import { formatTime } from "@/lib/format";
import type { BracketDetails } from "@/server/events";
import { Icon } from "./ui";
import { Reveal } from "./reveal";

export type BracketMatchDetails = BracketDetails["matches"][number];
type Match = BracketMatchDetails;
type MatchActions = (match: Match) => ReactNode;
type Corner = Match["red"];

const BRONZE_KEY = "BRONZE";

/** Nome de cada ronda a contar do fim: a última é `finalLabel`. */
function eliminationLabel(round: number, totalRounds: number, finalLabel = "Final") {
  const fromEnd = totalRounds - round;
  return [finalLabel, "Semifinal", "Quartas de final", "Oitavas de final"][fromEnd] ?? `Rodada ${round}`;
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
  const live = match.currentOnMat && match.status === "READY";
  const planned = !live && match.status !== "FINISHED" && match.status !== "BYE" && (match.mat || match.scheduledAt);
  return (
    <div className="w-60 overflow-hidden rounded-lg border border-line bg-surface text-sm shadow-sm">
      <CornerRow corner={match.red} match={match} stripe="bg-corner-red" />
      <div className="border-t border-line" />
      <CornerRow corner={match.blue} match={match} stripe="bg-corner-blue" />
      {live && (
        <div className="flex items-center justify-between border-t border-line bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
            A decorrer · {match.currentOnMat!.name}
          </span>
          <span className="font-mono text-foreground">
            {match.redScore}–{match.blueScore}
          </span>
        </div>
      )}
      {planned && (
        <div className="flex items-center gap-1.5 border-t border-line bg-surface-2 px-3 py-1.5 text-xs text-muted">
          <Icon name="clock" className="h-3.5 w-3.5" />
          {[match.mat?.name, match.scheduledAt && `prevista ${formatTime(match.scheduledAt)}`].filter(Boolean).join(" · ")}
        </div>
      )}
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

/** Colunas de rondas, da primeira à última, com os rótulos dados por `label`. */
function Rounds({
  matches,
  label,
  actions,
  after,
}: {
  matches: Match[];
  label: (round: number, totalRounds: number) => string;
  actions?: MatchActions;
  /** O que vai por baixo da última coluna (a disputa de bronze). */
  after?: ReactNode;
}) {
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  const totalRounds = Math.max(...rounds);
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-3">
      <div className="flex min-w-max gap-8">
        {rounds.map((round) => (
          <Reveal key={round} stagger className="flex shrink-0">
            <section className="flex shrink-0 flex-col gap-4">
              <RoundHeading>{label(round, totalRounds)}</RoundHeading>
              <div className="flex flex-1 flex-col justify-around gap-4">
                {matches
                  .filter((m) => m.round === round)
                  .map((match) => (
                    <MatchCard key={match.id} match={match} actions={actions} />
                  ))}
              </div>
              {round === totalRounds && after}
            </section>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

function PartTitle({ children, hint }: { children: ReactNode; hint: string }) {
  return (
    <div className="mb-3">
      <p className="text-sm font-semibold uppercase tracking-wider">{children}</p>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

function DoubleElimination({ bracket, actions }: { bracket: BracketDetails; actions?: MatchActions }) {
  const part = (section: ReturnType<typeof doubleEliminationSection>) =>
    bracket.matches.filter((m) => doubleEliminationSection(m.key) === section);
  const [final] = part("final");
  return (
    <div className="space-y-8">
      <div>
        <PartTitle hint="Quem perde aqui ainda tem uma segunda oportunidade.">Chave principal</PartTitle>
        <Rounds matches={part("winners")} label={(round, total) => eliminationLabel(round, total, "Final da principal")} actions={actions} />
      </div>
      <div>
        <PartTitle hint="Quem perde aqui pela segunda vez sai da prova.">Chave dos vencidos</PartTitle>
        <Rounds
          // As lutas que ficaram sem ninguém (byes seguidos na primeira ronda) só fariam ruído.
          matches={part("losers").filter((m) => m.red || m.blue || m.status !== "BYE")}
          label={(round, total) => (round === total ? "Final dos vencidos" : `Ronda ${round}`)}
          actions={actions}
        />
      </div>
      {final && (
        <div>
          <PartTitle hint="O vencedor da chave principal contra o da chave dos vencidos, numa luta única.">Final</PartTitle>
          <MatchCard match={final} actions={actions} />
        </div>
      )}
    </div>
  );
}

export function BracketView({ bracket, actions }: { bracket: BracketDetails; actions?: MatchActions }) {
  if (bracket.type === "DOUBLE_ELIMINATION") return <DoubleElimination bracket={bracket} actions={actions} />;
  if (bracket.type === "ROUND_ROBIN") {
    return <Rounds matches={bracket.matches} label={(round) => `Rodada ${round}`} actions={actions} />;
  }
  const bronze = bracket.matches.find((m) => m.key === BRONZE_KEY);
  return (
    <Rounds
      matches={bracket.matches.filter((m) => m.key !== BRONZE_KEY)}
      label={(round, total) => eliminationLabel(round, total)}
      actions={actions}
      after={
        bronze && (
          <>
            <RoundHeading>Disputa de 3º lugar</RoundHeading>
            <MatchCard match={bronze} actions={actions} />
          </>
        )
      }
    />
  );
}
