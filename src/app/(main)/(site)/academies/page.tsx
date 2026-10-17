import { Suspense } from "react";
import { CommunityCard, CommunityGrid } from "@/components/community-card";
import { Pager, readPage } from "@/components/pager";
import { SearchForm } from "@/components/search-form";
import { Empty, PageTitle } from "@/components/ui";
import { ACADEMIES_PER_PAGE, listAcademies, totalMedals } from "@/server/community";

type SearchParams = PageProps<"/academies">["searchParams"];

async function AcademyList({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.trim() : "";
  const page = readPage(params.page);
  const { academies, total } = await listAcademies(search, page);

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
      <Pager
        basePath="/academies"
        params={{ q: search }}
        page={page}
        totalPages={Math.max(1, Math.ceil(total / ACADEMIES_PER_PAGE))}
      />
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
