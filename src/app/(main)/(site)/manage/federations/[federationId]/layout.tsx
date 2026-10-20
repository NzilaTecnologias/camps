import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { FederationNav } from "@/components/manage/federation-nav";
import { Badge, BackLink, Icon, LinkButton } from "@/components/ui";
import { PLAN_LABEL, planActive } from "@/lib/federation-rules";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { getFederationWorkspace } from "@/server/federations";

async function Workspace({ params, children }: { params: Promise<{ federationId: string }>; children: ReactNode }) {
  const { federationId } = await params;
  const user = await requireUser();
  const federation = await getFederationWorkspace(user.id, federationId);
  if (!federation) notFound();
  const active = planActive(federation);

  return (
    <>
      <BackLink href="/manage">Os meus eventos</BackLink>
      <header
        className="relative mt-3 mb-8 overflow-hidden rounded-2xl px-6 py-6 text-white sm:px-8"
        style={{ background: `linear-gradient(120deg, #0b0c10 30%, ${federation.color})` }}
      >
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              {active ? (
                <Badge tone="accent">Plano {PLAN_LABEL[federation.plan!]}</Badge>
              ) : (
                <Badge tone="inverse">Plano inativo</Badge>
              )}
              <span className="text-sm text-white/70">
                Federação · {federation.sport}
                {active && ` · válido até ${formatDate(federation.planExpiresAt!)}`}
              </span>
            </div>
            <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight sm:text-5xl">{federation.name}</h1>
            <p className="mt-2 font-mono text-sm text-white/60">/f/{federation.slug}</p>
          </div>
          {active && (
            <LinkButton href={`/f/${federation.slug}`} variant="inverse" target="_blank">
              Ver página pública
              <Icon name="external" />
            </LinkButton>
          )}
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="min-w-0">
          <FederationNav federationId={federation.id} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}

/** Todas as secções do painel de uma federação partilham este cabeçalho e o menu lateral. */
export default function FederationWorkspaceLayout({ params, children }: LayoutProps<"/manage/federations/[federationId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar federação…</p>}>
      <Workspace params={params}>{children}</Workspace>
    </Suspense>
  );
}
