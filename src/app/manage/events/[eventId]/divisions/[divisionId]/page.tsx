import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { BracketView, type BracketMatchDetails } from "@/components/bracket-view";
import { Field, SelectField } from "@/components/field";
import { BRACKET_TYPE_LABEL } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { getManagedDivision } from "@/server/manage";
import { addAthleteAction, generateBracketAction, reportResultAction } from "../../../../actions";

function ResultButtons({ match }: { match: BracketMatchDetails }) {
  if (match.status !== "READY" || !match.red || !match.blue) return null;
  return (
    <ActionForm
      action={reportResultAction.bind(null, match.id)}
      className="flex flex-wrap gap-2 border-t border-foreground/10 px-3 py-2"
    >
      {[match.red, match.blue].map((corner) => (
        <button
          key={corner.id}
          type="submit"
          name="winnerId"
          value={corner.id}
          className="rounded border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5 disabled:opacity-50"
        >
          Venceu {corner.athlete.firstName}
        </button>
      ))}
    </ActionForm>
  );
}

async function DivisionPanel({ params }: { params: Promise<{ eventId: string; divisionId: string }> }) {
  const { eventId, divisionId } = await params;
  const user = await requireUser();
  const division = await getManagedDivision(user.id, eventId, divisionId);
  if (!division) notFound();
  const { bracket } = division;
  const hasResults = bracket?.matches.some((match) => match.status === "FINISHED") ?? false;

  return (
    <>
      <header className="mb-8">
        <Link href={`/manage/events/${division.event.id}`} className="text-sm opacity-60 hover:opacity-100">
          ← {division.event.name}
        </Link>
        <h1 className="text-2xl font-bold">{division.name}</h1>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">
          Chave{bracket && ` · ${BRACKET_TYPE_LABEL[bracket.type]}`}
        </h2>
        {bracket && <BracketView bracket={bracket} actions={(match) => <ResultButtons match={match} />} />}

        {bracket && bracket.placements.length > 0 && (
          <ol className="mt-4 space-y-1">
            {bracket.placements.map((placement) => (
              <li key={placement.id}>
                {placement.place}º — {placement.registration.athlete.firstName}{" "}
                {placement.registration.athlete.lastName}
              </li>
            ))}
          </ol>
        )}

        {hasResults ? (
          <p className="mt-4 text-sm opacity-60">A chave já tem lutas disputadas e não pode mais ser regerada.</p>
        ) : (
          <ActionForm
            action={generateBracketAction.bind(null, division.id)}
            submitLabel={bracket ? "Regerar chave" : "Gerar chave"}
            className="mt-4 flex max-w-md flex-wrap items-end gap-4"
          >
            <SelectField label="Tipo de chave" name="type" defaultValue={bracket?.type ?? "SINGLE_ELIMINATION"}>
              {Object.entries(BRACKET_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </ActionForm>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Inscritos ({division.registrations.length})</h2>
        {division.registrations.length > 0 && (
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
        )}
      </section>

      <section className="max-w-md">
        <h2 className="mb-1 text-lg font-semibold">Inscrever atleta manualmente</h2>
        <p className="mb-3 text-sm opacity-60">
          Entra como inscrição paga, sem cobrança. Quem entrar depois da chave gerada só aparece ao regerar.
        </p>
        <ActionForm
          action={addAthleteAction.bind(null, division.id)}
          submitLabel="Inscrever atleta"
          className="space-y-4"
        >
          <Field label="Nome" name="firstName" required />
          <Field label="Sobrenome" name="lastName" required />
          <Field label="Data de nascimento" name="birthDate" type="date" required />
          <Field label="Academia" name="academyName" />
        </ActionForm>
      </section>
    </>
  );
}

export default function ManageDivisionPage({
  params,
}: PageProps<"/manage/events/[eventId]/divisions/[divisionId]">) {
  return (
    <Suspense fallback={<p className="opacity-60">A carregar categoria…</p>}>
      <DivisionPanel params={params} />
    </Suspense>
  );
}
