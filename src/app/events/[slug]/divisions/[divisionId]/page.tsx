import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BracketView } from "@/components/bracket-view";
import { formatMoney } from "@/lib/format";
import { getDivision } from "@/server/events";
import { registrationClosedReason } from "@/server/registrations";

async function DivisionDetails({ params }: { params: Promise<{ slug: string; divisionId: string }> }) {
  const { slug, divisionId } = await params;
  const division = await getDivision(slug, divisionId);
  if (!division) notFound();
  const { bracket } = division;
  const closedReason = registrationClosedReason(division.event);

  return (
    <>
      <header className="mb-8">
        <Link href={`/events/${division.event.slug}`} className="text-sm opacity-60 hover:opacity-100">
          ← {division.event.name}
        </Link>
        <h1 className="text-2xl font-bold">{division.name}</h1>
        {closedReason ? (
          <p className="mt-2 text-sm opacity-60">{closedReason}.</p>
        ) : (
          <Link
            href={`/events/${division.event.slug}/divisions/${division.id}/register`}
            className="mt-3 inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Inscrever-se ·{" "}
            {division.priceCents === 0 ? "gratuito" : formatMoney(division.priceCents, division.event.currency)}
          </Link>
        )}
      </header>

      {bracket && bracket.placements.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Pódio</h2>
          <ol className="space-y-1">
            {bracket.placements.map((placement) => (
              <li key={placement.id}>
                {placement.place}º — {placement.registration.athlete.firstName}{" "}
                {placement.registration.athlete.lastName}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Chave</h2>
        {bracket ? <BracketView bracket={bracket} /> : <p className="opacity-60">A chave ainda não foi gerada.</p>}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Inscritos ({division.registrations.length})</h2>
        <ul className="divide-y divide-foreground/10 rounded-lg border border-foreground/15">
          {division.registrations.map((registration) => (
            <li key={registration.id} className="flex justify-between gap-4 px-4 py-2">
              <span>
                {registration.athlete.firstName} {registration.athlete.lastName}
              </span>
              <span className="text-sm opacity-60">{registration.athlete.academy?.name}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export default function DivisionPage({ params }: PageProps<"/events/[slug]/divisions/[divisionId]">) {
  return (
    <Suspense fallback={<p className="opacity-60">A carregar categoria…</p>}>
      <DivisionDetails params={params} />
    </Suspense>
  );
}
