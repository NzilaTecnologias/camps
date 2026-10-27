import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { MedalCounts } from "@/components/medals";
import { Reveal } from "@/components/reveal";
import { BackLink, Badge, Card, Empty, Icon, SectionTitle } from "@/components/ui";
import type { MethodShare } from "@/lib/athlete-record";
import { count, formatDate } from "@/lib/format";
import { getAthlete } from "@/server/community";

type Athlete = NonNullable<Awaited<ReturnType<typeof getAthlete>>>;

const COUNTRY: Record<string, string> = { AO: "Angola", PT: "Portugal", BR: "Brasil", MZ: "Moçambique", CV: "Cabo Verde", ST: "São Tomé e Príncipe" };

/** Cor de cada faixa, só como amostra ao lado do nome (o nome é que identifica). */
const BELT_SWATCH: Record<string, string> = {
  branca: "#f4f4f5",
  cinzenta: "#9ca3af",
  cinza: "#9ca3af",
  amarela: "#facc15",
  laranja: "#f97316",
  verde: "#16a34a",
  azul: "#2563eb",
  roxa: "#7c3aed",
  castanha: "#78350f",
  marrom: "#78350f",
  preta: "#0a0a0a",
};

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts.at(-1)![0] : ""}`.toUpperCase();
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Reveal stagger className="h-full">
      <Card className="h-full px-5 py-4">
        <p className="font-display text-4xl font-bold leading-none tabular-nums">{value}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </Card>
    </Reveal>
  );
}

/** Vitória ou derrota: a letra diz o resultado, a cor só reforça. */
function Result({ won, size = "md" }: { won: boolean; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-6 w-6 text-xs" : "h-8 w-8 text-sm";
  return (
    <span
      title={won ? "Vitória" : "Derrota"}
      className={`inline-flex shrink-0 items-center justify-center rounded-md font-bold ${box} ${won ? "bg-success/15 text-success" : "bg-danger/12 text-danger"}`}
    >
      <span aria-hidden="true">{won ? "V" : "D"}</span>
      <span className="sr-only">{won ? "Vitória" : "Derrota"}</span>
    </span>
  );
}

/** Uma barra por método, do mais frequente para o menos; o número vai sempre escrito. */
function MethodBars({ title, rows, total, empty }: { title: string; rows: MethodShare[]; total: number; empty: string }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-xl font-bold uppercase leading-none">{title}</h3>
        <span className="text-sm text-muted tabular-nums">{total}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.method} title={`${row.method}: ${row.count} (${Math.round(row.share * 100)}%)`}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{row.method}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {row.count} <span className="font-normal text-muted">· {Math.round(row.share * 100)}%</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-foreground/8">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(row.share * 100, 4)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const PLACE_TONE = { 1: "accent", 2: "neutral", 3: "warning" } as const;

/** Colunas de uma luta no historial: 3 no telemóvel (resultado, adversário, pontos), 5 no ecrã largo. */
const BOUT_GRID =
  "grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 px-5 sm:grid-cols-[5.5rem_minmax(0,1.4fr)_minmax(0,1fr)_4rem_minmax(0,1.2fr)]";

function Place({ place }: { place: number | null }) {
  if (!place) return null;
  return <Badge tone={place <= 3 ? PLACE_TONE[place as 1 | 2 | 3] : "neutral"}>{place}.º lugar</Badge>;
}

function EventHistory({ entry }: { entry: Athlete["events"][number] }) {
  const href = `/events/${entry.event.slug}/divisions/${entry.division.id}`;
  return (
    <Reveal>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-surface-2 px-5 py-4">
          <div className="min-w-0">
            <Link href={`/events/${entry.event.slug}`} className="font-semibold hover:text-primary">
              {entry.event.name}
            </Link>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span className="flex items-center gap-1.5">
                <Icon name="calendar" />
                {formatDate(entry.event.startsAt)}
              </span>
              {entry.event.city && (
                <span className="flex items-center gap-1.5">
                  <Icon name="pin" />
                  {entry.event.city}
                </span>
              )}
              <Link href={href} className="hover:text-primary hover:underline">
                {entry.division.name}
              </Link>
            </p>
          </div>
          <Place place={entry.place} />
        </div>
        {entry.bouts.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">Sem lutas disputadas nesta categoria.</p>
        ) : (
          // Linhas em vez de tabela: no telemóvel o método e a ronda descem para baixo do adversário.
          <ol className="divide-y divide-line text-sm">
            <li aria-hidden="true" className={`${BOUT_GRID} hidden py-2 text-xs font-semibold uppercase tracking-wider text-muted sm:grid`}>
              <span>Resultado</span>
              <span>Adversário</span>
              <span>Método</span>
              <span className="text-right">Pontos</span>
              <span>Ronda</span>
            </li>
            {entry.bouts.map((bout) => (
              <li key={bout.id} className={`${BOUT_GRID} grid py-3`}>
                <Result won={bout.won} />
                <span className="min-w-0">
                  {bout.opponent ? (
                    <Link href={`/athletes/${bout.opponent.id}`} className="font-semibold hover:text-primary">
                      {bout.opponent.name}
                    </Link>
                  ) : (
                    <span className="text-muted">Adversário por definir</span>
                  )}
                  <span className="block truncate text-xs text-muted">{bout.opponent?.academy ?? "Sem academia"}</span>
                  <span className="mt-1 block text-xs text-muted sm:hidden">
                    {bout.method ?? "Sem método registado"} · {bout.round}
                  </span>
                </span>
                <span className="hidden sm:block">{bout.method ?? <span className="text-muted">—</span>}</span>
                <span className="text-right font-mono font-semibold tabular-nums">{bout.score}</span>
                <span className="hidden text-muted sm:block">{bout.round}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </Reveal>
  );
}

async function AthleteDetails({ params }: { params: Promise<{ athleteId: string }> }) {
  // "Próximas provas" depende da hora do pedido; os dados vêm de cache.
  await connection();
  const { athleteId } = await params;
  const athlete = await getAthlete(athleteId);
  if (!athlete) notFound();
  const now = new Date();
  const { record } = athlete;
  const upcoming = athlete.events.filter((entry) => entry.event.endsAt >= now && entry.bouts.length === 0);
  const history = athlete.events.filter((entry) => !upcoming.includes(entry));
  const swatch = athlete.belt ? BELT_SWATCH[athlete.belt.trim().toLowerCase()] : undefined;
  const podiums = athlete.medals.gold + athlete.medals.silver + athlete.medals.bronze;

  return (
    <>
      <BackLink href="/athletes">Atletas</BackLink>
      <Reveal>
        <header className="hero mt-3 mb-8 flex flex-wrap items-center justify-between gap-6 rounded-2xl px-6 py-8 sm:px-10">
          <div className="flex min-w-0 items-center gap-5">
            <span
              aria-hidden="true"
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white font-display text-3xl font-bold text-ink sm:h-24 sm:w-24 sm:text-4xl"
            >
              {initials(athlete.name)}
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight sm:text-5xl">{athlete.name}</h1>
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-white/75">
                {athlete.academy ? (
                  <Link href={`/academies/${athlete.academy.id}`} className="font-semibold text-white hover:underline">
                    {athlete.academy.name}
                    {athlete.academy.affiliation && <span className="font-normal text-white/60"> · {athlete.academy.affiliation}</span>}
                  </Link>
                ) : (
                  <span>Sem academia</span>
                )}
                {athlete.belt && (
                  <span className="flex items-center gap-1.5">
                    {swatch && <span aria-hidden="true" className="h-3 w-6 rounded-sm ring-1 ring-white/40" style={{ background: swatch }} />}
                    Faixa {athlete.belt.toLowerCase()}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Icon name="pin" />
                  {COUNTRY[athlete.country] ?? athlete.country}
                </span>
              </p>
              <p className="mt-1.5 text-sm text-white/60">
                {[athlete.since && `Compete desde ${athlete.since}`, count(athlete.events.length, "evento", "eventos")].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span className="text-xs font-semibold uppercase tracking-widest text-white/60">Medalhas</span>
            <MedalCounts medals={athlete.medals} />
          </div>
        </header>
      </Reveal>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Registo" value={`${record.wins}–${record.losses}`} hint="Vitórias – derrotas" />
        <Stat label="Aproveitamento" value={record.winRate === null ? "—" : `${record.winRate}%`} hint={count(record.fights, "luta", "lutas")} />
        <Stat
          label="Série atual"
          value={record.streak}
          hint={
            record.fights === 0
              ? "ainda sem lutas"
              : record.streak === 0
                ? "a última luta foi uma derrota"
                : record.streak === 1
                  ? "vitória seguida"
                  : "vitórias seguidas"
          }
        />
        <Stat label="Pódios" value={podiums} hint={count(history.length, "prova disputada", "provas disputadas")} />
      </div>

      {record.fights > 0 && (
        <div className="mb-10 grid gap-4 lg:grid-cols-3">
          <Card className="p-5">
            <h3 className="mb-4 font-display text-xl font-bold uppercase leading-none">Forma recente</h3>
            <div className="flex items-center gap-2">
              {record.form.map((won, index) => (
                <Result key={index} won={won} />
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              {count(record.form.length, "última luta", "últimas lutas")}, da mais recente para a mais antiga.
            </p>
          </Card>
          <MethodBars title="Vitórias por método" rows={record.winsBy} total={record.wins} empty="Ainda sem vitórias." />
          <MethodBars title="Derrotas por método" rows={record.lossesBy} total={record.losses} empty="Nenhuma derrota." />
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="mb-10">
          <SectionTitle>Próximas provas</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {upcoming.map((entry) => (
              <Link
                key={entry.id}
                href={`/events/${entry.event.slug}/divisions/${entry.division.id}`}
                className="group flex items-center gap-4 rounded-xl border border-line bg-surface px-5 py-4 transition hover:border-foreground/30"
              >
                <Icon name="calendar" className="h-5 w-5 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold group-hover:text-primary">{entry.event.name}</p>
                  <p className="truncate text-sm text-muted">
                    {formatDate(entry.event.startsAt)} · {entry.division.name}
                  </p>
                </div>
                <Icon name="chevron-right" className="h-5 w-5 text-muted" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <SectionTitle aside={<span className="text-sm text-muted">{count(record.fights, "luta", "lutas")}</span>}>Historial</SectionTitle>
      {history.length === 0 ? (
        <Empty>Ainda sem provas disputadas.</Empty>
      ) : (
        <div className="space-y-4">
          {history.map((entry) => (
            <EventHistory key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </>
  );
}

export default function AthletePage({ params }: PageProps<"/athletes/[athleteId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar atleta…</p>}>
      <AthleteDetails params={params} />
    </Suspense>
  );
}
