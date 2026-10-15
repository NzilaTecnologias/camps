import { Suspense } from "react";
import { CommunityCard, CommunityGrid } from "@/components/community-card";
import { SearchForm } from "@/components/search-form";
import { Empty, PageTitle } from "@/components/ui";
import { listAcademies, totalMedals } from "@/server/community";

type SearchParams = PageProps<"/academies">["searchParams"];

async function AcademyList({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.trim() : "";
  const academies = await listAcademies(search);

  return (
    <>
      <SearchForm
        value={search}
        label="Procurar academia"
        placeholder="Procurar academia ou afiliação"
        clearHref="/academies"
      />
      {academies.length === 0 ? (
        <Empty>
          {search
            ? `Nenhuma academia encontrada para "${search}".`
            : "Ainda não há academias com atletas em eventos publicados."}
        </Empty>
      ) : (
        <CommunityGrid>
          {academies.map((academy) => (
            <li key={academy.id}>
              <CommunityCard
                href={`/academies/${academy.id}`}
                name={academy.name}
                subtitle={academy.affiliation ?? (academy.country === "AO" ? "Angola" : academy.country)}
                // Posição no ranking geral, mesmo quando a pesquisa mostra só algumas.
                corner={`#${academy.rank}`}
                medals={academy.medals}
                stats={[
                  { label: "Atletas", value: academy.athletes },
                  { label: "Medalhas", value: totalMedals(academy.medals) },
                ]}
              />
            </li>
          ))}
        </CommunityGrid>
      )}
    </>
  );
}

export default function AcademiesPage({ searchParams }: PageProps<"/academies">) {
  return (
    <>
      <header className="mb-8 border-b border-line pb-6">
        <PageTitle>Academias</PageTitle>
        <p className="mt-2 text-sm text-muted">
          Academias com atletas em torneios publicados, ordenadas pelas medalhas conquistadas.
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted">A carregar academias…</p>}>
        <AcademyList searchParams={searchParams} />
      </Suspense>
    </>
  );
}
