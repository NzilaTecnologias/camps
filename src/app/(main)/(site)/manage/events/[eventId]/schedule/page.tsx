import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { DataTable, Notice, SectionHeader } from "@/components/manage/parts";
import { MatSchedule } from "@/components/schedule-list";
import { Badge, Card, Empty, buttonClass } from "@/components/ui";
import { BRACKET_TYPE_LABEL, formatTime, toDateTimeInput } from "@/lib/format";
import { canOrganizer } from "@/lib/organizer-permissions";
import { requireUser } from "@/server/auth";
import { getEventWorkspace } from "@/server/organizer";
import { getScheduleDesk } from "@/server/schedule";
import {
  assignDivisionMatsAction,
  balanceDivisionMatsAction,
  generateScheduleAction,
  updateScheduleSettingsAction,
} from "../../../event-actions";

const selectClass =
  "h-9 w-full min-w-36 rounded-lg border border-line bg-surface px-2 text-sm outline-none focus:border-primary";

async function Schedule({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await requireUser();
  const [event, desk] = await Promise.all([getEventWorkspace(user.id, eventId), getScheduleDesk(user.id, eventId)]);
  if (!event || !desk) return null;
  const manages = canOrganizer(event.role, "event");
  const base = `/manage/events/${event.id}`;
  const withBracket = desk.divisions.filter((division) => division.bracket);
  const scheduled = desk.mats.reduce((sum, mat) => sum + mat.matches.length, 0);
  // Hora prevista da última luta de cada área: é quando a área fica livre.
  const ends = desk.mats.map((mat) => mat.matches.at(-1)?.scheduledAt ?? null);

  return (
    <>
      <SectionHeader
        title="Programação"
        description="Em que área se disputa cada categoria e a ordem das lutas, com a hora prevista de cada uma. As primeiras rondas de todas as categorias de uma área vêm antes das segundas, para os atletas descansarem. Atletas e treinadores veem a programação na página do evento."
        actions={
          event.status === "PUBLISHED" && (
            <Link href={`/events/${event.slug}/schedule`} target="_blank" className={buttonClass("secondary", "sm")}>
              Ver programa público
            </Link>
          )
        }
      />

      {desk.mats.length === 0 ? (
        <Empty>
          Ainda não há áreas de luta. Crie-as em{" "}
          <Link href={`${base}/scoreboard`} className="font-semibold text-primary hover:underline">
            Placar e áreas
          </Link>
          .
        </Empty>
      ) : (
        manages && (
          <div className="mb-10 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <section className="min-w-0">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <h3 className="font-display text-xl font-bold uppercase leading-none">Área de cada categoria</h3>
                <ActionForm action={balanceDivisionMatsAction.bind(null, event.id)} submitLabel="Repartir automaticamente" submitVariant="secondary">
                  {null}
                </ActionForm>
              </div>
              {withBracket.length === 0 && (
                <div className="mb-4">
                  <Notice>
                    Só as categorias com chave entram na programação. Gere as chaves em{" "}
                    <Link href={`${base}/brackets`} className="font-semibold underline">
                      Chaves
                    </Link>
                    .
                  </Notice>
                </div>
              )}
              <ActionForm action={assignDivisionMatsAction.bind(null, event.id)} submitLabel="Guardar áreas" className="flex flex-col gap-4">
                <DataTable head={["Categoria", "Chave", "Lutas", "Área"]}>
                  {desk.divisions.map((division) => (
                    <tr key={division.id}>
                      <td className="px-4 py-2 font-semibold">{division.name}</td>
                      <td className="px-4 py-2">
                        {division.bracket ? <Badge tone="primary">{BRACKET_TYPE_LABEL[division.bracket.type]}</Badge> : <Badge>sem chave</Badge>}
                      </td>
                      <td className="px-4 py-2 tabular-nums">{division.bracket?._count.matches ?? "—"}</td>
                      <td className="px-4 py-2">
                        <select name={`mat-${division.id}`} defaultValue={division.matId ?? ""} aria-label={`Área de ${division.name}`} className={selectClass}>
                          <option value="">Sem área</option>
                          {desk.mats.map((mat) => (
                            <option key={mat.id} value={mat.id}>
                              {mat.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </DataTable>
              </ActionForm>
            </section>

            <div className="grid gap-6">
              <Card className="p-5">
                <h3 className="mb-1 font-display text-xl font-bold uppercase leading-none">Horários</h3>
                <p className="mb-4 text-sm text-muted">Hora da primeira luta de cada área e quanto tempo ocupa cada luta, já com a troca de atletas.</p>
                <ActionForm action={updateScheduleSettingsAction.bind(null, event.id)} submitLabel="Guardar horários" submitVariant="secondary" className="flex flex-col gap-4">
                  <Field label="Minutos por luta" name="matchMinutes" type="number" min={2} max={60} defaultValue={desk.matchMinutes} required />
                  {desk.mats.map((mat) => (
                    <Field
                      key={mat.id}
                      label={`Início · ${mat.name}`}
                      name={`startsAt-${mat.id}`}
                      type="datetime-local"
                      defaultValue={toDateTimeInput(mat.startsAt ?? desk.startsAt)}
                    />
                  ))}
                </ActionForm>
              </Card>
              <Card className="p-5">
                <h3 className="mb-1 font-display text-xl font-bold uppercase leading-none">Gerar programação</h3>
                <p className="mb-4 text-sm text-muted">
                  Ordena as lutas de cada área e calcula a hora prevista. Pode gerar de novo depois de mudar áreas, horários ou
                  chaves: as lutas já disputadas ou no placar não mudam.
                </p>
                <ActionForm action={generateScheduleAction.bind(null, event.id)} submitLabel={scheduled ? "Gerar de novo" : "Gerar programação"}>
                  {null}
                </ActionForm>
              </Card>
            </div>
          </div>
        )
      )}

      {scheduled === 0 ? (
        desk.mats.length > 0 && <Empty>Ainda não há lutas programadas.</Empty>
      ) : (
        <div className="grid gap-8 xl:grid-cols-2">
          {desk.mats.map((mat, index) => (
            <div key={mat.id}>
              <MatSchedule name={mat.name} matches={mat.matches} />
              {ends[index] && <p className="mt-2 text-xs text-muted">Última luta prevista às {formatTime(ends[index])}.</p>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function SchedulePage({ params }: PageProps<"/manage/events/[eventId]/schedule">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Schedule params={params} />
    </Suspense>
  );
}
