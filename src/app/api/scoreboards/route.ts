import { getMatStateCached, type MatState } from "@/server/scoreboard";

/** Áreas por pedido: chega para uma página com muitos eventos em direto. */
const MAX_MATS_PER_REQUEST = 60;
const MAT_ID = /^[a-z0-9]{10,40}$/;

// Placar de várias áreas num só pedido: uma página com 40 áreas em direto faz 1 pedido por
// segundo em vez de 40. Cada área vem da mesma cache partilhada de 1 s do placar individual.
// Os ids vêm ordenados do cliente, para o mesmo conjunto dar o mesmo URL no CDN.
export async function GET(request: Request) {
  const ids = [...new Set((new URL(request.url).searchParams.get("mats") ?? "").split(","))]
    .filter((id) => MAT_ID.test(id))
    .slice(0, MAX_MATS_PER_REQUEST);
  if (ids.length === 0) return Response.json({ error: "Indique as áreas" }, { status: 400 });

  const states = await Promise.all(ids.map((id) => getMatStateCached(id)));
  // A hora do servidor é a deste pedido, não a do momento em que cada estado entrou na cache.
  const now = Date.now();
  const mats: Record<string, MatState | null> = {};
  ids.forEach((id, index) => {
    const state = states[index];
    mats[id] = state ? { ...state, scoreboard: state.scoreboard ? { ...state.scoreboard, serverNow: now } : null } : null;
  });
  return Response.json(
    { mats },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=1, stale-while-revalidate=1" } },
  );
}
