import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { EventCard } from "@/components/event-card";
import { ScoreboardCard } from "@/components/scoreboard-live";
import { StreamCard } from "@/components/stream-card";
import { Empty, PageTitle, SectionTitle } from "@/components/ui";
import { count } from "@/lib/format";
import { listLiveEvents, listLiveStreams } from "@/server/community";
import { listPublishedEvents } from "@/server/events";

async function LiveNow() {
  // Sem nada no ar, a página mostra os próximos eventos com "faltam N dias", que depende da hora
  // deste pedido: esta parte é sempre calculada no momento.
  await connection();
  const [streams, events] = await Promise.all([listLiveStreams(), listLiveEvents()]);
  const streamingMats = new Set(streams.map((stream) => stream.matId));
  // Áreas com uma luta no placar mas sem vídeo no ar: aparecem só com o placar.
  const scoreboardsOnly = events.flatMap((event) =>
    event.mats
      .filter((mat) => mat.currentMatchId !== null && !streamingMats.has(mat.id))
      .map((mat) => ({ ...mat, event })),
  );

  if (streams.length === 0 && scoreboardsOnly.length === 0) {
    const upcoming = await listPublishedEvents(4);
    return (
      <>
        <Empty>Nenhuma transmissão a decorrer neste momento.</Empty>
        {upcoming.length > 0 && (
          <section className="mt-10">
            <SectionTitle>Próximos torneios</SectionTitle>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {upcoming.map((event) => (
                <li key={event.id} className="min-w-0">
                  <EventCard event={event} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </>
    );
  }

  return (
    <>
      {/* Novas transmissões e pontos aparecem sem recarregar a página. */}
      <AutoRefresh seconds={30} />

      <section className="mb-12">
        <SectionTitle aside={<span className="text-sm text-muted">{count(streams.length, "transmissão", "transmissões")}</span>}>
          Em direto agora
        </SectionTitle>
        {streams.length === 0 ? (
          <Empty>Nenhum vídeo no ar neste momento; há lutas a decorrer no placar, abaixo.</Empty>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {streams.map((stream) => (
              <li key={stream.matId} className="min-w-0">
                <StreamCard stream={stream} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {scoreboardsOnly.length > 0 && (
        <section>
          <SectionTitle>Lutas a decorrer sem transmissão</SectionTitle>
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {scoreboardsOnly.map((mat) => (
              <li key={mat.id} className="min-w-0">
                <ScoreboardCard matId={mat.id} />
                <Link
                  href={`/events/${mat.event.slug}`}
                  className="mt-1.5 block truncate text-xs text-muted hover:text-primary"
                >
                  {mat.event.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export default function LivePage() {
  return (
    <>
      <header className="mb-8 border-b border-line pb-6">
        <PageTitle>Transmissão</PageTitle>
        <p className="mt-2 text-sm text-muted">
          Torneios a decorrer agora: escolha uma transmissão para ver o vídeo e o placar da área em direto.
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted">A procurar transmissões…</p>}>
        <LiveNow />
      </Suspense>
    </>
  );
}
