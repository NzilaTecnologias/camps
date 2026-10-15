import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MedalCounts } from "@/components/medals";
import { CommunityCard, CommunityGrid } from "@/components/community-card";
import { BackLink, PageTitle, SectionTitle } from "@/components/ui";
import { count } from "@/lib/format";
import { getAcademy, totalMedals } from "@/server/community";

async function AcademyDetails({ params }: { params: Promise<{ academyId: string }> }) {
  const { academyId } = await params;
  const academy = await getAcademy(academyId);
  if (!academy) notFound();

  return (
    <>
      <BackLink href="/academies">Academias</BackLink>
      <header className="mt-3 mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <PageTitle>{academy.name}</PageTitle>
          <p className="mt-2 text-sm text-muted">
            {count(academy.athletes.length, "atleta", "atletas")} em torneios publicados
            {academy.affiliation && ` · ${academy.affiliation}`}
          </p>
        </div>
        <MedalCounts medals={academy.medals} />
      </header>

      <SectionTitle>Atletas</SectionTitle>
      <CommunityGrid>
        {academy.athletes.map((athlete) => (
          <li key={athlete.id}>
            <CommunityCard
              href={`/athletes/${athlete.id}`}
              name={athlete.name}
              subtitle={athlete.belt ? `Faixa ${athlete.belt.toLowerCase()}` : academy.name}
              medals={athlete.medals}
              stats={[
                { label: "Medalhas", value: totalMedals(athlete.medals) },
                { label: "Ouro", value: athlete.medals.gold },
              ]}
            />
          </li>
        ))}
      </CommunityGrid>
    </>
  );
}

export default function AcademyPage({ params }: PageProps<"/academies/[academyId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar academia…</p>}>
      <AcademyDetails params={params} />
    </Suspense>
  );
}
