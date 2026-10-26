import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { BracketView, type BracketMatchDetails } from "@/components/bracket-view";
import { Podium, RegistrantList } from "@/components/division-parts";
import { Field, SelectField } from "@/components/field";
import { SectionHeader } from "@/components/manage/parts";
import { BackLink, Badge, Card, Empty, LinkButton, SectionTitle, buttonClass } from "@/components/ui";
import { BRACKET_TYPE_LABEL, count } from "@/lib/format";
import { canOrganizer } from "@/lib/organizer-permissions";
import { requireUser } from "@/server/auth";
import { getManagedDivision } from "@/server/manage";
import { getEventWorkspace } from "@/server/organizer";
import { addAthleteAction, generateBracketAction, reportResultAction } from "../../../../actions";

function ResultButtons({ match }: { match: BracketMatchDetails }) {
  if (match.status !== "READY" || !match.red || !match.blue) return null;
  return (
    <div className="border-t border-line bg-surface-2 p-2">
      <LinkButton href={`/manage/matches/${match.id}/scoreboard`} size="sm" className="mb-2 w-full">
        {match.currentOnMat ? `Placar · ${match.currentOnMat.name}` : "Abrir placar"}
      </LinkButton>
      {/* Atalho para lançar o resultado sem passar pelo placar. */}
      <ActionForm action={reportResultAction.bind(null, match.id)} className="grid grid-cols-2 gap-2">
        {[match.red, match.blue].map((corner) => (
          <button
            key={corner.id}
            type="submit"
            name="winnerId"
            value={corner.id}
            className={`${buttonClass("secondary", "sm")} truncate`}
          >
            Venceu {corner.athlete.firstName}
          </button>
        ))}
      </ActionForm>
    </div>
  );
}

async function DivisionPanel({ params }: { params: Promise<{ eventId: string; divisionId: string }> }) {
  const { eventId, divisionId } = await params;
  const user = await requireUser();
  const [event, division] = await Promise.all([getEventWorkspace(user.id, eventId), getManagedDivision(user.id, eventId, divisionId)]);
  if (!event || !division) notFound();
  const { bracket } = division;
  const hasResults = bracket?.matches.some((match) => match.status === "FINISHED") ?? false;
  // O mesário vê a chave e lança resultados; mexer na chave e nos inscritos é para donos e gestores.
  const manages = canOrganizer(event.role, "event");

  return (
    <>
      {manages ? (
        <BackLink href={`/manage/events/${division.event.id}/divisions`}>Categorias</BackLink>
      ) : (
        <BackLink href={`/manage/events/${division.event.id}/brackets`}>Chaves</BackLink>
      )}
      <div className="mt-3">
        <SectionHeader
          title={division.name}
          description={
            <span className="flex flex-wrap items-center gap-3">
              <span>{count(division.registrations.length, "inscrito", "inscritos")}</span>
              {bracket ? <Badge tone="primary">{BRACKET_TYPE_LABEL[bracket.type]}</Badge> : <Badge>sem chave</Badge>}
            </span>
          }
        />
      </div>

      <section className="mb-10">
        <SectionTitle>Chave{bracket && ` · ${BRACKET_TYPE_LABEL[bracket.type]}`}</SectionTitle>
        {bracket ? (
          <BracketView bracket={bracket} actions={(match) => <ResultButtons match={match} />} />
        ) : (
          <Empty>Ainda não há chave. Gere-a quando as inscrições estiverem fechadas.</Empty>
        )}

        {!manages ? null : hasResults ? (
          <p className="mt-4 text-sm text-muted">A chave já tem lutas disputadas e não pode mais ser regerada.</p>
        ) : (
          <Card className="mt-4 max-w-md p-5">
            <ActionForm
              action={generateBracketAction.bind(null, division.id)}
              submitLabel={bracket ? "Regerar chave" : "Gerar chave"}
              submitVariant={bracket ? "secondary" : "primary"}
              className="flex flex-col gap-4"
            >
              <SelectField label="Tipo de chave" name="type" defaultValue={bracket?.type ?? "SINGLE_ELIMINATION"}>
                {Object.entries(BRACKET_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
            </ActionForm>
          </Card>
        )}
      </section>

      {bracket && bracket.placements.length > 0 && (
        <section className="mb-10">
          <SectionTitle>Pódio</SectionTitle>
          <Podium placements={bracket.placements} />
        </section>
      )}

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section>
          <SectionTitle>Inscritos ({division.registrations.length})</SectionTitle>
          <RegistrantList registrations={division.registrations} />
        </section>

        {manages && (
          <aside>
            <Card className="p-5">
              <h2 className="font-display text-xl font-bold uppercase leading-none">Inscrever atleta manualmente</h2>
              <p className="mt-2 mb-4 text-sm text-muted">
                Entra como inscrição paga, sem cobrança. Quem entrar depois da chave gerada só aparece ao regerar.
              </p>
              <ActionForm
                action={addAthleteAction.bind(null, division.id)}
                submitLabel="Inscrever atleta"
                submitVariant="secondary"
                className="flex flex-col gap-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Nome" name="firstName" required />
                  <Field label="Apelido" name="lastName" required />
                </div>
                <Field label="Data de nascimento" name="birthDate" type="date" required />
                <Field label="Academia" name="academyName" />
              </ActionForm>
            </Card>
          </aside>
        )}
      </div>
    </>
  );
}

export default function ManageDivisionPage({
  params,
}: PageProps<"/manage/events/[eventId]/divisions/[divisionId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar categoria…</p>}>
      <DivisionPanel params={params} />
    </Suspense>
  );
}
