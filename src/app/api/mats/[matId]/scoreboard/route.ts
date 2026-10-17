import { getMatStateCached } from "@/server/scoreboard";

// Os ecrãs de TV, a sobreposição da transmissão e a página do evento perguntam aqui, de segundo a segundo.
// O estado vem da cache partilhada (1 s) e a resposta pode ficar 1 s num CDN à frente da aplicação,
// por isso o número de espectadores quase não pesa na base de dados.
export async function GET(_request: Request, { params }: RouteContext<"/api/mats/[matId]/scoreboard">) {
  const { matId } = await params;
  const state = await getMatStateCached(matId);
  if (!state) {
    return Response.json({ error: "Área não encontrada" }, { status: 404, headers: { "Cache-Control": "public, s-maxage=5" } });
  }
  // A hora do servidor é a deste pedido, não a do momento em que o estado entrou na cache.
  const scoreboard = state.scoreboard ? { ...state.scoreboard, serverNow: Date.now() } : null;
  return Response.json(
    { ...state, scoreboard },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=1, stale-while-revalidate=1" } },
  );
}
