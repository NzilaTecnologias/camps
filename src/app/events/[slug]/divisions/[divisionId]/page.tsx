import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BracketView } from "@/components/bracket-view";
import { Podium, RegistrantList } from "@/components/division-parts";
import { BackLink, Badge, Empty, Icon, LinkButton, PageTitle, SectionTitle } from "@/components/ui";
import { BRACKET_TYPE_LABEL, formatMoney, formatWeight, count } from "@/lib/format";
import { getDivision } from "@/server/events";
import { registrationClosedReason } from "@/server/registrations";

async function DivisionDetails({ params }: { params: Promise<{ slug: string; divisionId: string }> }) {
  const { slug, divisionId } = await params;
  const division = await getDivision(slug, divisionId);
  if (!division) notFound();
  const { bracket } = division;
  const closedReason = registrationClosedReason(division.event);
  const price = division.priceCents === 0 ? "Gratuito" : formatMoney(division.priceCents, division.event.currency);

  return (
    <>
      <BackLink href={`/events/${division.event.slug}`}>{division.event.name}</BackLink>
      <header className="mt-3 mb-10 flex flex-wrap items-end justify-between gap-6 border-b border-line pb-8">
        <div>
          <PageTitle>{division.name}</PageTitle>
          <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <Icon name="scale" />
              {formatWeight(division.maxWeightKg)}
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="users" />
              {count(division.registrations.length, "inscrito", "inscritos")}
            </span>
            {bracket && <Badge tone="primary">{BRACKET_TYPE_LABEL[bracket.type]}</Badge>}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-display text-3xl font-bold leading-none">{price}</span>
          {closedReason ? (
            <Badge>{closedReason}</Badge>
          ) : (
            <LinkButton href={`/events/${division.event.slug}/divisions/${division.id}/register`}>
              Inscrever-se
            </LinkButton>
          )}
        </div>
      </header>

      {bracket && bracket.placements.length > 0 && (
        <section className="mb-10">
          <SectionTitle>Pódio</SectionTitle>
          <Podium placements={bracket.placements} />
        </section>
      )}

      <section className="mb-10">
        <SectionTitle>Chave</SectionTitle>
        {bracket ? <BracketView bracket={bracket} /> : <Empty>A chave ainda não foi gerada.</Empty>}
      </section>

      <section>
        <SectionTitle>Inscritos ({division.registrations.length})</SectionTitle>
        <RegistrantList registrations={division.registrations} />
      </section>
    </>
  );
}

export default function DivisionPage({ params }: PageProps<"/events/[slug]/divisions/[divisionId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar categoria…</p>}>
      <DivisionDetails params={params} />
    </Suspense>
  );
}
