import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { MatSchedule } from "@/components/schedule-list";
import { BackLink, Empty, PageTitle } from "@/components/ui";
import { formatDateRange } from "@/lib/format";
import { getPublicSchedule } from "@/server/schedule";

async function PublicSchedule({ params }: { params: Promise<{ slug: string }> }) {
  // As datas mostram o ano só quando não é o corrente: dependem da hora do pedido.
  await connection();
  const { slug } = await params;
  const event = await getPublicSchedule(slug);
  if (!event) notFound();
  const mats = event.mats.filter((mat) => mat.matches.length > 0);

  return (
    <>
      <BackLink href={`/events/${event.slug}`}>{event.name}</BackLink>
      <header className="mt-3 mb-8 border-b border-line pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{formatDateRange(event.startsAt, event.endsAt)}</p>
        <div className="mt-2">
          <PageTitle>Programação das lutas</PageTitle>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          A ordem das lutas em cada área, com a hora prevista. As horas podem mudar no dia, conforme o andamento da
          prova: esteja na área uns minutos antes.
        </p>
      </header>
      {mats.length === 0 ? (
        <Empty>A organização ainda não publicou a programação.</Empty>
      ) : (
        <div className="grid gap-8 xl:grid-cols-2">
          {mats.map((mat) => (
            <MatSchedule key={mat.id} name={mat.name} matches={mat.matches} live={mat.isLive} />
          ))}
        </div>
      )}
    </>
  );
}

export default function PublicSchedulePage({ params }: PageProps<"/events/[slug]/schedule">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar programação…</p>}>
      <PublicSchedule params={params} />
    </Suspense>
  );
}
