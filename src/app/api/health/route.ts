import { prisma, queryCounter } from "@/lib/db";

// Para o balanceador de carga: 200 quando este servidor consegue falar com a base de dados.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    // Em desenvolvimento mostra também quantas consultas este processo já fez (teste de carga).
    const extra = process.env.NODE_ENV === "production" ? {} : { queries: queryCounter.count };
    return Response.json({ ok: true, ...extra }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
