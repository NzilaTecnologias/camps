import Image from "next/image";
import type { ReactNode } from "react";
import { Card, Icon } from "./ui";
import { Reveal } from "./reveal";

/** Cabeçalho com fotografia das páginas institucionais (Sobre nós, Preços, Apoiar, Patrocínios). */
export function InfoHero({
  eyebrow,
  title,
  lead,
  image,
  imageAlt,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  image: string;
  imageAlt: string;
}) {
  return (
    <Reveal>
      <header className="relative isolate mb-12 overflow-hidden rounded-2xl px-6 py-16 text-white sm:px-10">
        <Image src={image} alt={imageAlt} fill sizes="(min-width: 1152px) 1152px, 100vw" className="-z-10 object-cover" priority />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/70 to-black/30" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
        <h1 className="mt-3 max-w-2xl font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl">
          {title}
        </h1>
        <p className="mt-4 max-w-xl text-lg text-white/85">{lead}</p>
      </header>
    </Reveal>
  );
}

export function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Reveal stagger className="h-full">
      <Card className="h-full p-6">
        <h2 className="font-display text-2xl font-bold uppercase leading-none">{title}</h2>
        <div className="mt-3 space-y-3 text-sm text-muted">{children}</div>
      </Card>
    </Reveal>
  );
}

export function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
          <Icon name="check" className="mt-0.5 h-4 w-4 text-success" />
          {item}
        </li>
      ))}
    </ul>
  );
}
