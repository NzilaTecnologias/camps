import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { SectionHeader } from "@/components/manage/parts";
import { Badge, Card, Empty, Icon, LinkButton } from "@/components/ui";
import { formatTime } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { getScoreboardDesk } from "@/server/organizer";
import { createMatAction } from "../../../scoreboard-actions";

type Fighter = { athlete: { firstName: string; lastName: string; academy: { name: string } | null } } | null;

const name = (fighter: Fighter) => (fighter ? `${fighter.athlete.firstName} ${fighter.athlete.lastName}` : "A definir");

async function Desk({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await requireUser();
  const { mats, ready } = await getScoreboardDesk(user.id, eventId);

  return (
    <>
      <SectionHeader
        title="Placar e áreas"
        description="Cada área de luta tem o seu placar. Chame uma luta pronta para uma área e controle pontos, vantagens, punições e cronómetro a partir do telemóvel ou do portátil da mesa."
      />

      <section className="mb-10">
        {mats.length === 0 ? (
          <Empty>Ainda não há áreas de luta. Crie a primeira abaixo.</Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {mats.map((mat) => {
              const match = mat.currentMatch;
              return (
                <Card key={mat.id} className="overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
                    <h3 className="font-display text-2xl font-bold uppercase leading-none">{mat.name}</h3>
                    <div className="flex items-center gap-2">
                      {mat.isLive && <Badge tone="danger">● Em direto</Badge>}
                      {match ? (
                        <Badge tone={match.clockStartedAt ? "success" : "warning"}>
                          {match.clockStartedAt ? "Cronómetro a correr" : "Luta no placar"}
                        </Badge>
                      ) : (
                        <Badge>Livre</Badge>
                      )}
                    </div>
                  </div>
                  {match ? (
                    <div className="p-5">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                        {match.bracket.division.name}
                      </p>
                      {(
                        [
                          ["bg-corner-red", match.red, match.redScore],
                          ["bg-corner-blue", match.blue, match.blueScore],
                        ] as const
                      ).map(([bar, fighter, score]) => (
                        <div key={bar} className="flex items-center gap-3 py-1.5">
                          <span className={`h-8 w-1.5 rounded-full ${bar}`} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{name(fighter)}</p>
                            <p className="truncate text-xs text-muted">{fighter?.athlete.academy?.name ?? "Sem academia"}</p>
                          </div>
                          <span className="font-display text-4xl font-bold leading-none tabular-nums">{score}</span>
                        </div>
                      ))}
                      <LinkButton href={`/manage/matches/${match.id}/scoreboard`} className="mt-4 w-full">
                        Controlar placar
                      </LinkButton>
                    </div>
                  ) : (
                    <p className="px-5 py-8 text-center text-sm text-muted">Chame uma das lutas prontas para esta área.</p>
                  )}
                  <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line bg-surface-2 px-5 py-3 text-sm">
                    <Link href={`/scoreboard/${mat.id}`} target="_blank" className="inline-flex items-center gap-1 font-semibold hover:text-primary">
                      Ecrã de TV <Icon name="external" className="h-3.5 w-3.5" />
                    </Link>
                    <Link href={`/overlay/${mat.id}`} target="_blank" className="inline-flex items-center gap-1 font-semibold hover:text-primary">
                      Sobreposição <Icon name="external" className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Card className="mt-4 max-w-md p-5">
          <ActionForm
            action={createMatAction.bind(null, eventId)}
            submitLabel="Adicionar área"
            submitVariant="secondary"
            className="flex flex-col gap-3"
          >
            <Field label="Nova área de luta" name="name" placeholder={`Área ${mats.length + 1}`} required />
          </ActionForm>
        </Card>
      </section>

      <section>
        <h3 className="mb-3 font-display text-xl font-bold uppercase leading-none">Lutas prontas ({ready.length})</h3>
        {ready.length === 0 ? (
          <Empty>Nenhuma luta pronta. As lutas ficam prontas quando a chave é gerada e os dois atletas estão definidos.</Empty>
        ) : (
          <Card className="divide-y divide-line">
            {ready.map((match) => (
              <div key={match.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-48 flex-1">
                  <p className="font-semibold">
                    <span className="text-corner-red">{name(match.red)}</span>
                    <span className="mx-2 text-muted">×</span>
                    <span className="text-corner-blue">{name(match.blue)}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {[
                      match.bracket.division.name,
                      `ronda ${match.round}`,
                      match.mat && !match.currentOnMat && match.mat.name,
                      match.scheduledAt && `prevista ${formatTime(match.scheduledAt)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {match.currentOnMat && <Badge tone="success">No placar · {match.currentOnMat.name}</Badge>}
                <LinkButton href={`/manage/matches/${match.id}/scoreboard`} size="sm" variant={match.currentOnMat ? "primary" : "secondary"}>
                  {match.currentOnMat ? "Controlar" : "Chamar para o placar"}
                </LinkButton>
              </div>
            ))}
          </Card>
        )}
      </section>
    </>
  );
}

export default function ScoreboardDeskPage({ params }: PageProps<"/manage/events/[eventId]/scoreboard">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Desk params={params} />
    </Suspense>
  );
}
