import type { ReactNode } from "react";
import { LEGAL } from "@/lib/legal";

/** Página de texto legal: título, data de revisão e secções numeradas. */
export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl py-4">
      <h1 className="font-display text-5xl font-bold uppercase leading-none tracking-tight">{title}</h1>
      <p className="mt-3 text-sm text-muted">Última atualização: {LEGAL.updatedOn}</p>
      <p className="mt-6 text-foreground">{intro}</p>
      <div className="mt-8 space-y-8">{children}</div>
    </article>
  );
}

export function LegalSection({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl font-bold uppercase leading-none">
        {n}. {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}
