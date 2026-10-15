import { Suspense } from "react";
import { CommunityCard, CommunityGrid } from "@/components/community-card";
import { SearchForm } from "@/components/search-form";
import { Empty, PageTitle } from "@/components/ui";
import { listAthletes, totalMedals } from "@/server/community";

type SearchParams = PageProps<"/athletes">["searchParams"];

async function AthleteList({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams;
  const search = typeof q === "string" ? q : "";
  const athletes = await listAthletes(search);

  return (
    <>
      <SearchForm value={search} label="Procurar atleta" placeholder="Procurar pelo nome" clearHref="/athletes" />

      {athletes.length === 0 ? (
        <Empty>{search ? `Nenhum atleta encontrado para "${search}".` : "Ainda não há atletas em eventos publicados."}</Empty>
      ) : (
        <CommunityGrid>
          {athletes.map((athlete) => (
            <li key={athlete.id}>
              <CommunityCard
                href={`/athletes/${athlete.id}`}
                name={athlete.name}
                subtitle={athlete.academy?.name ?? "Sem academia"}
                medals={athlete.medals}
                stats={[
                  { label: athlete.events === 1 ? "Torneio" : "Torneios", value: athlete.events },
                  { label: "Medalhas", value: totalMedals(athlete.medals) },
                ]}
              />
            </li>
          ))}
        </CommunityGrid>
      )}
      {athletes.length === 60 && (
        <p className="mt-4 text-sm text-muted">A mostrar os primeiros 60. Use a pesquisa para encontrar outros.</p>
      )}
    </>
  );
}

export default function AthletesPage({ searchParams }: PageProps<"/athletes">) {
  return (
    <>
      <header className="mb-8 border-b border-line pb-6">
        <PageTitle>Atletas</PageTitle>
        <p className="mt-2 text-sm text-muted">Atletas que competiram em torneios publicados na Camps.</p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted">A carregar atletas…</p>}>
        <AthleteList searchParams={searchParams} />
      </Suspense>
    </>
  );
}
