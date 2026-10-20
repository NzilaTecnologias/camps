import type { MatState } from "@/server/scoreboard";

// Um só "sondador" por página para todos os placares que ela mostra: de segundo a segundo pede
// as áreas subscritas num único pedido a /api/scoreboards (em grupos de 60). Com o separador
// escondido não pergunta nada; ao voltar a ficar visível atualiza logo.

const POLL_MS = 1000;
const MAX_PER_REQUEST = 60;

type Listener = (state: MatState | null) => void;

const listeners = new Map<string, Set<Listener>>();
const lastKnown = new Map<string, MatState | null>();
let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

async function poll() {
  if (inFlight || listeners.size === 0 || document.hidden) return;
  inFlight = true;
  try {
    // Ordenados, para o mesmo conjunto de áreas dar sempre o mesmo URL (e acertar no CDN).
    const ids = [...listeners.keys()].sort();
    for (let i = 0; i < ids.length; i += MAX_PER_REQUEST) {
      const chunk = ids.slice(i, i + MAX_PER_REQUEST);
      const response = await fetch(`/api/scoreboards?mats=${chunk.join(",")}`, { cache: "no-store" });
      if (!response.ok) continue;
      const { mats } = (await response.json()) as { mats: Record<string, MatState | null> };
      for (const id of chunk) {
        const state = mats[id] ?? null;
        lastKnown.set(id, state);
        listeners.get(id)?.forEach((listener) => listener(state));
      }
    }
  } catch {
    // Falha de rede: cada placar mantém o último estado e tenta outra vez na volta seguinte.
  } finally {
    inFlight = false;
  }
}

function onVisibilityChange() {
  if (!document.hidden) void poll();
}

function start() {
  if (timer) return;
  timer = setInterval(poll, POLL_MS);
  document.addEventListener("visibilitychange", onVisibilityChange);
}

function stop() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  document.removeEventListener("visibilitychange", onVisibilityChange);
}

/** Passa a receber o estado da área; devolve a função para deixar de receber. */
export function subscribeMat(matId: string, listener: Listener): () => void {
  let set = listeners.get(matId);
  if (!set) listeners.set(matId, (set = new Set()));
  set.add(listener);
  if (lastKnown.has(matId)) listener(lastKnown.get(matId) ?? null);
  start();
  // Junta numa só volta os placares que se subscrevem ao mesmo tempo (a página inteira).
  queueMicrotask(() => void poll());
  return () => {
    set.delete(listener);
    if (set.size === 0) {
      listeners.delete(matId);
      lastKnown.delete(matId);
    }
    if (listeners.size === 0) stop();
  };
}
