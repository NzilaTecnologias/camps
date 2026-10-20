import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge, Card, Empty, Icon, LinkButton, SectionTitle } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { getPublicFederation, listFederationEvents, listFederationPosts } from "@/server/federations";

async function Home({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const federation = await getPublicFederation(slug);
  if (!federation) notFound();
  const [events, posts] = await Promise.all([
    listFederationEvents(federation.id, federation.slug),
    federation.premium ? listFederationPosts(federation.id, federation.slug) : Promise.resolve([]),
  ]);

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-10">
        {federation.description && (
          <section>
            <SectionTitle>Sobre</SectionTitle>
            <p className="max-w-3xl whitespace-pre-line text-muted">{federation.description}</p>
          </section>
        )}
        <section>
          <SectionTitle>Eventos</SectionTitle>
          {events.length === 0 ? (
            <Empty>Ainda não há eventos publicados desta federação.</Empty>
          ) : (
            <Card className="divide-y divide-line">
              {events.map((event) => (
                <Link key={event.id} href={`/events/${event.slug}`} className="group flex items-center gap-4 px-5 py-4 hover:bg-surface-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold group-hover:text-primary">{event.name}</p>
                    <p className="mt-1 text-sm text-muted">
                      {formatDate(event.startsAt)} · {event.city ?? "local a definir"} · {event.organizer.name}
                    </p>
                  </div>
                  {event.requiresMembership && <Badge tone="primary">Exige filiação</Badge>}
                  <Icon name="chevron-right" className="h-5 w-5 text-muted group-hover:text-primary" />
                </Link>
              ))}
            </Card>
          )}
        </section>
      </div>

      <aside className="space-y-6">
        {federation.premium && (
          <Card className="p-5">
            <h2 className="font-display text-xl font-bold uppercase leading-none">Filie-se</h2>
            <p className="mt-2 mb-4 text-sm text-muted">Filiação individual online, paga por Multicaixa Express ou PayPal.</p>
            <LinkButton href={`/f/${federation.slug}/filiacao`} className="w-full">
              Ver planos de filiação
            </LinkButton>
          </Card>
        )}
        {posts.length > 0 && (
          <section>
            <h2 className="mb-3 font-display text-xl font-bold uppercase leading-none">Notícias</h2>
            <div className="space-y-3">
              {posts.map((post) => (
                <Card key={post.id} className="p-5">
                  <p className="text-xs text-muted">{formatDate(post.publishedAt)}</p>
                  <h3 className="mt-1 font-semibold">{post.title}</h3>
                  <p className="mt-2 whitespace-pre-line text-sm text-muted">{post.body}</p>
                </Card>
              ))}
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}

export default function FederationPage({ params }: PageProps<"/f/[slug]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Home params={params} />
    </Suspense>
  );
}
