import { getMatState } from "@/server/scoreboard";

// Os ecrãs de TV, a sobreposição da transmissão e a página do evento perguntam aqui, de segundo a segundo.
export async function GET(_request: Request, { params }: RouteContext<"/api/mats/[matId]/scoreboard">) {
  const { matId } = await params;
  const state = await getMatState(matId);
  if (!state) return Response.json({ error: "Área não encontrada" }, { status: 404 });
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
}
