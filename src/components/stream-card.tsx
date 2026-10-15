import Image from "next/image";
import Link from "next/link";
import { sportImage } from "@/lib/sports";
import type { LiveStream } from "@/server/community";
import { Reveal } from "./reveal";
import { Icon } from "./ui";

export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white shadow">
      <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
      Ao vivo
    </span>
  );
}

/** Cartão de uma transmissão em direto: miniatura, evento, área e a luta que está no placar. */
export function StreamCard({ stream }: { stream: LiveStream }) {
  return (
    <Reveal stagger className="h-full">
      <Link
        href={`/live/${stream.matId}`}
        className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-lg"
      >
        <div className="relative aspect-video overflow-hidden bg-ink">
          {/* O Facebook não dá miniatura: usa a fotografia da modalidade. */}
          <Image
            src={stream.thumbnailUrl ?? sportImage(stream.event.sport)}
            alt=""
            fill
            sizes="(min-width: 1280px) 300px, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />
          <span className="absolute top-3 left-3">
            <LiveBadge />
          </span>
          <span className="absolute top-3 right-3 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">
            {stream.provider}
          </span>
          <span
            aria-hidden="true"
            className="absolute top-1/2 left-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition group-hover:scale-110 group-hover:bg-primary"
          >
            <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="absolute bottom-3 left-3 font-display text-lg font-bold uppercase text-white">
            {stream.matName}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="line-clamp-2 font-display text-xl font-bold uppercase leading-tight tracking-tight group-hover:text-primary">
            {stream.event.name}
          </h3>
          <p className="flex items-center gap-1.5 truncate text-sm text-muted">
            <Icon name="pin" />
            <span className="truncate">{[stream.event.city, stream.event.sport].filter(Boolean).join(" · ")}</span>
          </p>

          <div className="mt-auto border-t border-line pt-3 text-sm">
            {stream.match ? (
              <>
                <p className="truncate text-xs text-muted">No placar · {stream.match.division}</p>
                <p className="mt-1 flex items-center justify-between gap-2">
                  <span className="truncate">
                    {stream.match.red} <span className="text-muted">×</span> {stream.match.blue}
                  </span>
                  <span className="shrink-0 font-mono font-semibold">
                    {stream.match.redScore}–{stream.match.blueScore}
                  </span>
                </p>
              </>
            ) : (
              <p className="text-xs text-muted">Sem luta no placar neste momento</p>
            )}
          </div>
        </div>
      </Link>
    </Reveal>
  );
}
