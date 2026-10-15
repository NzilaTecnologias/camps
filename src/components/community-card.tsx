import Link from "next/link";
import type { Medals } from "@/server/community";
import { MedalCounts } from "./medals";
import { Reveal } from "./reveal";

type Props = {
  href: string;
  name: string;
  /** Linha por baixo do nome (academia, afiliação…). */
  subtitle: string;
  /** Pequena etiqueta no canto, por exemplo a posição no ranking. */
  corner?: string;
  medals: Medals;
  /** Pares rótulo/valor no rodapé do cartão. */
  stats: { label: string; value: string | number }[];
};

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Cartão de academia ou de atleta, para as grelhas da comunidade. */
export function CommunityCard({ href, name, subtitle, corner, medals, stats }: Props) {
  return (
    <Reveal stagger className="h-full">
      <Link
        href={href}
        className="group relative flex h-full flex-col items-center overflow-hidden rounded-xl border border-line bg-surface text-center shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-lg"
      >
        {/* Faixa de cor por trás das iniciais */}
        <div aria-hidden="true" className="hero h-16 w-full" />
        {corner && (
          <span className="absolute top-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-xs font-bold text-white">{corner}</span>
        )}
        <span className="-mt-9 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-4 border-surface bg-primary font-display text-2xl font-bold text-white">
          {initials(name)}
        </span>

        <div className="flex w-full flex-1 flex-col items-center px-4 pt-3 pb-4">
          <h3 className="line-clamp-2 font-semibold leading-snug group-hover:text-primary">{name}</h3>
          <p className="mt-1 line-clamp-1 text-sm text-muted">{subtitle}</p>
          <div className="mt-3">
            <MedalCounts medals={medals} size="sm" />
          </div>
          <dl className="mt-auto grid w-full grid-cols-2 gap-2 border-t border-line pt-3">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dd className="font-display text-xl font-bold leading-none">{stat.value}</dd>
                <dt className="mt-0.5 text-[11px] uppercase tracking-wider text-muted">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </Link>
    </Reveal>
  );
}

export function CommunityGrid({ children }: { children: React.ReactNode }) {
  return <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</ul>;
}
