import Link from "next/link";
import { Suspense } from "react";
import { ScoreboardCard } from "@/components/scoreboard-live";
import { LiveBadge, StreamCard } from "@/components/stream-card";
import { BackLink, Empty, Icon, LinkButton, SectionTitle } from "@/components/ui";
import { getLiveStream, listLiveStreams } from "@/server/community";

async function WatchStream({ params }: { params: Promise<{ matId: string }> }) {
  const { matId } = await params;
  const [stream, all] = await Promise.all([getLiveStream(matId), listLiveStreams()]);
  const others = all.filter((other) => other.matId !== matId);

  if (!stream) {
    return (
      <>
        <BackLink href="/live">Transmissão</BackLink>
        <div className="mt-6">
          <Empty>
            <p className="mb-4">Esta transmissão terminou ou ainda não começou.</p>
            <LinkButton href="/live">Ver o que está em direto</LinkButton>
          </Empty>
        </div>
      </>
    );
  }

  return (
    <>
      <BackLink href="/live">Transmissão</BackLink>
      <header className="mt-3 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <LiveBadge />
            <span className="text-sm text-muted">
              {stream.matName} · via {stream.provider}
            </span>
          </div>
          <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight">{stream.event.name}</h1>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
            <Icon name="pin" />
            {[stream.event.city, stream.event.sport].filter(Boolean).join(" · ")}
          </p>
        </div>
        <LinkButton href={`/events/${stream.event.slug}`} variant="secondary">
          Página do evento
        </LinkButton>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="overflow-hidden rounded-xl border border-line bg-black shadow-sm">
          <iframe
            src={stream.embedUrl}
            title={`Transmissão em direto: ${stream.event.name}, ${stream.matName}`}
            className="aspect-video w-full"
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <aside className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Placar da {stream.matName}</p>
          <ScoreboardCard matId={stream.matId} />
          {!stream.match && <p className="text-sm text-muted">Nenhuma luta no placar desta área agora.</p>}
          <Link
            href={`/scoreboard/${stream.matId}`}
            target="_blank"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            Placar em ecrã inteiro ↗
          </Link>
        </aside>
      </div>

      {others.length > 0 && (
        <section className="mt-12">
          <SectionTitle>Outras transmissões em direto</SectionTitle>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {others.map((other) => (
              <li key={other.matId} className="min-w-0">
                <StreamCard stream={other} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export default function WatchPage({ params }: PageProps<"/live/[matId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A abrir a transmissão…</p>}>
      <WatchStream params={params} />
    </Suspense>
  );
}
