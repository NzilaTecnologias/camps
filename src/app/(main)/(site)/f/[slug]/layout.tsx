import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FederationTabs } from "@/components/federation-tabs";
import { Badge } from "@/components/ui";
import { count } from "@/lib/format";
import { getPublicFederation } from "@/server/federations";

async function Header({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const federation = await getPublicFederation(slug);
  if (!federation) notFound();
  return (
    <>
      <header
        className="mb-6 overflow-hidden rounded-2xl px-6 py-10 text-white sm:px-10"
        style={{ background: `linear-gradient(120deg, #0b0c10 25%, ${federation.color})` }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="inverse">{federation.sport}</Badge>
          <span className="text-sm text-white/70">
            {count(federation._count.events, "evento", "eventos")} · {count(federation._count.academies, "academia filiada", "academias filiadas")}
          </span>
        </div>
        <h1 className="mt-4 max-w-3xl font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl">
          {federation.name}
        </h1>
      </header>
      <FederationTabs slug={federation.slug} premium={federation.premium} />
    </>
  );
}

/** Página pública de uma federação (plano ativo). Os separadores mudam de página sem recarregar o cabeçalho. */
export default function FederationLayout({ params, children }: LayoutProps<"/f/[slug]">) {
  return (
    <>
      <Suspense fallback={<div className="mb-8 h-48 rounded-2xl bg-surface-2" />}>
        <Header params={params} />
      </Suspense>
      {children}
    </>
  );
}
