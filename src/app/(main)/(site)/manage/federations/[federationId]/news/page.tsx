import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, TextAreaField } from "@/components/field";
import { SectionHeader } from "@/components/manage/parts";
import { PlanGate } from "@/components/manage/premium-gate";
import { Card, Empty, buttonClass } from "@/components/ui";
import { premiumActive } from "@/lib/federation-rules";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { getFederationOverview } from "@/server/federations";
import { createPostAction, deletePostAction } from "../../../federation-actions";

async function News({ params }: { params: Promise<{ federationId: string }> }) {
  const { federationId } = await params;
  const user = await requireUser();
  const { federation, posts } = await getFederationOverview(user.id, federationId);
  return (
    <>
      <SectionHeader title="Notícias" description="Comunicados, calendário e regulamentos, publicados na página da federação." />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="space-y-3">
          {posts.length === 0 ? (
            <Empty>Ainda não há notícias.</Empty>
          ) : (
            posts.map((post) => (
              <Card key={post.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted">{formatDate(post.publishedAt)}</p>
                    <h3 className="font-semibold">{post.title}</h3>
                  </div>
                  <ActionForm action={deletePostAction.bind(null, federation.id, post.id)}>
                    <button type="submit" className={buttonClass("ghost", "sm")}>
                      Apagar
                    </button>
                  </ActionForm>
                </div>
                <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-muted">{post.body}</p>
              </Card>
            ))
          )}
        </section>
        <Card className="p-5">
          <h3 className="mb-4 font-display text-xl font-bold uppercase leading-none">Nova notícia</h3>
          <PlanGate allowed={premiumActive(federation)} plan="Premium">
            <ActionForm action={createPostAction.bind(null, federation.id)} submitLabel="Publicar" className="flex flex-col gap-4">
              <Field label="Título" name="title" maxLength={140} required />
              <TextAreaField label="Texto" name="body" rows={8} maxLength={10000} required />
            </ActionForm>
          </PlanGate>
        </Card>
      </div>
    </>
  );
}

export default function FederationNewsPage({ params }: PageProps<"/manage/federations/[federationId]/news">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <News params={params} />
    </Suspense>
  );
}
