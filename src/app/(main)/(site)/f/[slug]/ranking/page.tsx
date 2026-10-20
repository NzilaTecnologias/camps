import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DataTable } from "@/components/manage/parts";
import { Empty } from "@/components/ui";
import { RANKING_POINTS } from "@/lib/federation-rules";
import { getPublicFederation, federationRanking } from "@/server/federations";

async function Ranking({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const federation = await getPublicFederation(slug);
  if (!federation || !federation.premium) notFound();
  await connection();
  const thisYear = new Date().getUTCFullYear();
  const requested = Number(query.year);
  const year = Number.isInteger(requested) && requested >= 2000 && requested <= thisYear ? requested : thisYear;
  const kind = query.kind === "academies" ? "academies" : "athletes";
  const rows = await federationRanking(federation.id, federation.slug, year, kind);
  const href = (next: { year?: number; kind?: string }) =>
    `/f/${slug}/ranking?year=${next.year ?? year}&kind=${next.kind ?? kind}`;
  const pill = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-sm font-medium ${active ? "border-primary bg-primary text-primary-fg" : "border-line text-muted hover:text-foreground"}`;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Link href={href({ kind: "athletes" })} className={pill(kind === "athletes")}>
            Atletas
          </Link>
          <Link href={href({ kind: "academies" })} className={pill(kind === "academies")}>
            Academias
          </Link>
        </div>
        <div className="flex gap-2">
          {[thisYear, thisYear - 1, thisYear - 2].map((option) => (
            <Link key={option} href={href({ year: option })} className={pill(option === year)}>
              {option}
            </Link>
          ))}
        </div>
      </div>
      <p className="mb-4 text-sm text-muted">
        Pontos por pódio em eventos da federação: ouro {RANKING_POINTS[1]}, prata {RANKING_POINTS[2]}, bronze {RANKING_POINTS[3]}.
      </p>
      {rows.length === 0 ? (
        <Empty>Ainda não há pódios em {year}.</Empty>
      ) : (
        <DataTable head={kind === "athletes" ? ["#", "Atleta", "Academia", "Ouro", "Prata", "Bronze", "Pontos"] : ["#", "Academia", "Ouro", "Prata", "Bronze", "Pontos"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3 font-display text-lg font-bold">{row.position}</td>
              <td className="px-4 py-3 font-semibold">
                {kind === "athletes" ? (
                  <Link href={`/athletes/${row.id}`} className="hover:text-primary">
                    {row.name}
                  </Link>
                ) : (
                  <Link href={`/academies/${row.id}`} className="hover:text-primary">
                    {row.name}
                  </Link>
                )}
              </td>
              {kind === "athletes" && <td className="px-4 py-3 text-muted">{row.academy ?? "—"}</td>}
              <td className="px-4 py-3 tabular-nums">{row.gold}</td>
              <td className="px-4 py-3 tabular-nums">{row.silver}</td>
              <td className="px-4 py-3 tabular-nums">{row.bronze}</td>
              <td className="px-4 py-3 font-display text-lg font-bold tabular-nums">{row.points}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}

export default function FederationRankingPage({ params, searchParams }: PageProps<"/f/[slug]/ranking">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar ranking…</p>}>
      <Ranking params={params} searchParams={searchParams} />
    </Suspense>
  );
}
