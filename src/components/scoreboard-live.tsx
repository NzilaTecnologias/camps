"use client";

import { useEffect, useRef, useState } from "react";
import { clockRemainingMs, formatClock, type Clock, type ScoreboardState } from "@/lib/scoreboard";
import type { MatState } from "@/server/scoreboard";

const POLL_MS = 1000;

/** Vai buscar o estado de uma área de segundo a segundo. `undefined` = ainda a carregar. */
function useMatState(matId: string): MatState | null | undefined {
  const [state, setState] = useState<MatState | null>();

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch(`/api/mats/${matId}/scoreboard`, { cache: "no-store" });
        const data = response.ok ? ((await response.json()) as MatState) : null;
        if (active) setState(data);
      } catch {
        // Falha de rede: mantém o último estado e tenta outra vez na volta seguinte.
      }
    }
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [matId]);

  return state;
}

/**
 * Relógio a correr entre duas respostas da API. `serverNow` acerta a diferença entre
 * a hora do servidor e a do aparelho, que num pavilhão raramente coincidem.
 */
export function LiveClock({ clock, serverNow, className }: { clock: Clock; serverNow: number; className?: string }) {
  // Estimativa local da hora do servidor; até ao primeiro tique vale a que veio na resposta.
  const [tick, setTick] = useState<number | null>(null);
  // As respostas podem vir de uma cache (até ~1 s), com `serverNow` atrasado. Um atraso só
  // pode fazer a diferença parecer menor, por isso fica-se com a maior já vista.
  const bestOffset = useRef<number | null>(null);

  useEffect(() => {
    const sample = serverNow - Date.now();
    if (bestOffset.current === null || sample > bestOffset.current) bestOffset.current = sample;
    if (clock.startedAt === null) return;
    const timer = setInterval(() => setTick(Date.now() + (bestOffset.current ?? 0)), 200);
    return () => clearInterval(timer);
  }, [clock.startedAt, serverNow]);

  const remaining = clockRemainingMs(clock, Math.max(tick ?? serverNow, serverNow));
  return (
    <span className={`font-mono tabular-nums ${remaining === 0 ? "text-primary" : ""} ${className ?? ""}`}>
      {formatClock(remaining)}
    </span>
  );
}

function Marks({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <span className="flex flex-col items-center">
      <span className={`font-display text-[4vw] font-bold leading-none ${tone}`}>{value}</span>
      <span className="text-[1.1vw] font-semibold uppercase tracking-widest text-white/60">{label}</span>
    </span>
  );
}

function DisplayCorner({ side, state }: { side: "red" | "blue"; state: ScoreboardState }) {
  const corner = state[side];
  const isWinner = state.winner === side;
  return (
    <div className={`flex min-h-0 flex-1 items-center gap-[3vw] px-[4vw] ${side === "red" ? "bg-[#b91c1c]" : "bg-[#1d4ed8]"}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[6.5vw] font-bold uppercase leading-none">{corner.name}</p>
        <p className="mt-[0.6vw] truncate text-[2vw] text-white/75">{corner.academy ?? " "}</p>
        {isWinner && (
          <p className="mt-[0.8vw] inline-block rounded-full bg-white px-[1.4vw] py-[0.3vw] text-[1.6vw] font-bold uppercase text-black">
            Vencedor{state.method ? ` · ${state.method}` : ""}
          </p>
        )}
      </div>
      <div className="flex items-end gap-[2.5vw]">
        <Marks label="Vantagens" value={corner.advantages} tone="text-yellow-300" />
        <Marks label="Punições" value={corner.penalties} tone="text-white/80" />
      </div>
      <span className="w-[18vw] text-right font-display text-[17vw] font-bold leading-none tabular-nums">
        {corner.points}
      </span>
    </div>
  );
}

/** Placar em ecrã inteiro, para a televisão ou o projetor ao lado da área. */
export function ScoreboardDisplay({ matId }: { matId: string }) {
  const state = useMatState(matId);
  const frame = "flex h-dvh w-full flex-col bg-black text-white";

  if (state === undefined) return <div className={frame} />;
  if (state === null) {
    return <div className={`${frame} items-center justify-center text-2xl text-white/60`}>Área não encontrada.</div>;
  }
  const { scoreboard } = state;
  if (!scoreboard) {
    return (
      <div className={`${frame} items-center justify-center gap-4 text-center`}>
        <p className="font-display text-[9vw] font-bold uppercase leading-none">{state.matName}</p>
        <p className="text-[2.2vw] text-white/60">{state.eventName} · a aguardar a próxima luta</p>
      </div>
    );
  }

  return (
    <div className={frame}>
      <DisplayCorner side="red" state={scoreboard} />
      <div className="flex items-center justify-between gap-[3vw] bg-black px-[4vw] py-[1vw]">
        <p className="min-w-0 flex-1 truncate text-[1.8vw] text-white/70">
          {state.matName} · {scoreboard.divisionName}
        </p>
        <LiveClock clock={scoreboard.clock} serverNow={scoreboard.serverNow} className="text-[9vw] font-bold leading-none" />
        <p className="min-w-0 flex-1 truncate text-right text-[1.8vw] text-white/70">{state.eventName}</p>
      </div>
      <DisplayCorner side="blue" state={scoreboard} />
    </div>
  );
}

function OverlayCorner({ side, state }: { side: "red" | "blue"; state: ScoreboardState }) {
  const corner = state[side];
  return (
    <div className="flex items-stretch">
      <span className={`w-2 ${side === "red" ? "bg-[#dc2626]" : "bg-[#2563eb]"}`} />
      <div className="flex min-w-0 flex-1 items-center gap-4 px-4 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold uppercase leading-tight">{corner.name}</p>
          <p className="truncate text-xs text-white/60">{corner.academy ?? " "}</p>
        </div>
        <span className="text-sm font-semibold text-yellow-300">V {corner.advantages}</span>
        <span className="text-sm font-semibold text-white/70">P {corner.penalties}</span>
        <span className="w-12 text-right font-display text-4xl font-bold leading-none tabular-nums">{corner.points}</span>
      </div>
    </div>
  );
}

/** Placar compacto com fundo transparente, para pôr por cima do vídeo no OBS ou programa semelhante. */
export function ScoreboardOverlay({ matId }: { matId: string }) {
  const state = useMatState(matId);
  const scoreboard = state?.scoreboard;
  if (!state || !scoreboard) return null;

  return (
    <div className="fixed bottom-8 left-8 w-[30rem] overflow-hidden rounded-xl bg-black/85 text-white shadow-2xl">
      <OverlayCorner side="red" state={scoreboard} />
      <div className="border-t border-white/15" />
      <OverlayCorner side="blue" state={scoreboard} />
      <div className="flex items-center justify-between gap-4 border-t border-white/15 bg-white/10 px-4 py-1.5">
        <p className="min-w-0 truncate text-xs text-white/70">
          {state.matName} · {scoreboard.divisionName}
        </p>
        <LiveClock clock={scoreboard.clock} serverNow={scoreboard.serverNow} className="text-xl font-bold" />
      </div>
    </div>
  );
}

/** Resultado ao vivo de uma área, para a página pública do evento. */
export function ScoreboardCard({ matId }: { matId: string }) {
  const state = useMatState(matId);
  const scoreboard = state?.scoreboard;
  if (!state || !scoreboard) return null;

  const row = (side: "red" | "blue") => (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className={`h-8 w-1.5 shrink-0 rounded-full ${side === "red" ? "bg-corner-red" : "bg-corner-blue"}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{scoreboard[side].name}</p>
        <p className="truncate text-xs text-muted">{scoreboard[side].academy ?? "Sem academia"}</p>
      </div>
      <span className="text-xs text-muted">
        V {scoreboard[side].advantages} · P {scoreboard[side].penalties}
      </span>
      <span className="w-8 text-right font-display text-3xl font-bold leading-none tabular-nums">
        {scoreboard[side].points}
      </span>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2 px-4 py-2 text-sm">
        <span className="min-w-0 truncate font-semibold">
          {state.matName} · <span className="font-normal text-muted">{scoreboard.divisionName}</span>
        </span>
        <LiveClock clock={scoreboard.clock} serverNow={scoreboard.serverNow} className="font-bold" />
      </div>
      {row("red")}
      <div className="border-t border-line" />
      {row("blue")}
    </div>
  );
}
