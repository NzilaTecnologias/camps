import { timingSafeEqual } from "node:crypto";
import { runJobs } from "@/server/jobs";

// Para um agendador externo (Vercel Cron, cron do servidor, GitHub Actions…) correr o trabalho
// de fundo: GET com "Authorization: Bearer <CRON_SECRET>". Sem CRON_SECRET a rota não existe.
function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response(null, { status: 404 });
  const report = await runJobs({ forceStats: new URL(request.url).searchParams.has("stats") });
  return Response.json(report, { headers: { "Cache-Control": "no-store" } });
}
