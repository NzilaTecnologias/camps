import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { SelectField } from "@/components/field";
import { LiveClock } from "@/components/scoreboard-live";
import { BackLink, Badge, Card, LinkButton, PageTitle, buttonClass } from "@/components/ui";
import { formatDuration, type ScoreboardState } from "@/lib/scoreboard";
import { penaltyWarning, type Mark, type SportRules } from "@/lib/sport-rules";
import { requireUser } from "@/server/auth";
import { getScoreboardControl } from "@/server/scoreboard";
import { clockAction, finishMatchAction, openScoreboardAction, scoreAction } from "../../../scoreboard-actions";

const CORNER = {
  red: { label: "Vermelho", bar: "bg-corner-red" },
  blue: { label: "Azul", bar: "bg-corner-blue" },
} as const;

function ChangeButton({ change, children }: { change: string; children: string }) {
  return (
    <button type="submit" name="change" value={change} className={`${buttonClass("secondary")} h-12 text-base`}>
      {children}
    </button>
  );
}

/** Botões de um marcador: os da modalidade e um −1 para corrigir. */
function MarkButtons({ field, mark }: { field: "points" | "advantages" | "penalties"; mark: Mark }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{mark.label}</p>
      <div className="flex flex-wrap gap-2">
        {mark.steps.map((step) => (
          <ChangeButton key={step.value} change={`${field}:${step.value}`}>
            {step.label}
          </ChangeButton>
        ))}
        <ChangeButton change={`${field}:-1`}>−1</ChangeButton>
      </div>
    </div>
  );
}

function CornerControl({ side, state, rules }: { side: "red" | "blue"; state: ScoreboardState; rules: SportRules }) {
  const corner = state[side];
  const warning = penaltyWarning(rules, corner.penalties);
  return (
    <Card className="overflow-hidden">
      <div className={`h-2 ${CORNER[side].bar}`} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{CORNER[side].label}</p>
            <p className="truncate font-display text-3xl font-bold uppercase leading-tight">{corner.name}</p>
            <p className="truncate text-sm text-muted">{corner.academy ?? "Sem academia"}</p>
          </div>
          <p className="font-display text-7xl font-bold leading-none tabular-nums">{corner.points}</p>
        </div>
        <p className="mt-3 text-sm text-muted">
          {rules.points.label}: <strong className="text-foreground">{corner.points}</strong>
          {rules.advantages && (
            <>
              {" "}· {rules.advantages.label}: <strong className="text-foreground">{corner.advantages}</strong>
            </>
          )}{" "}
          · {rules.penalties.label}: <strong className="text-foreground">{corner.penalties}</strong>
        </p>
        {warning && <p className="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{warning}</p>}

        <ActionForm action={scoreAction.bind(null, state.matchId, side)} className="mt-4 flex flex-col gap-4">
          <MarkButtons field="points" mark={rules.points} />
          {rules.advantages && <MarkButtons field="advantages" mark={rules.advantages} />}
          <MarkButtons field="penalties" mark={rules.penalties} />
        </ActionForm>
      </div>
    </Card>
  );
}

async function ScoreboardControl({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const user = await requireUser();
  const control = await getScoreboardControl(user.id, matchId);
  if (!control) notFound();
  const { state, mats, rules } = control;
  // Ao terminar a luta, a mesa volta à lista de áreas e lutas prontas.
  const deskPath = `/manage/events/${control.eventId}/scoreboard`;
  const isRunning = state.clock.startedAt !== null;

  return (
    <>
      <BackLink href={deskPath}>Placar e áreas · {state.eventName}</BackLink>
      <header className="mt-3 mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <PageTitle>Placar</PageTitle>
          <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
            {state.red.name} × {state.blue.name}
            {state.matName ? <Badge tone="primary">{state.matName}</Badge> : <Badge>Sem área</Badge>}
            <Badge>
              {state.sport} · regras {rules.rulebook}
            </Badge>
          </p>
        </div>
        {control.matId && control.status === "READY" && (
          <LinkButton href={`/scoreboard/${control.matId}`} variant="secondary" target="_blank">
            Abrir ecrã de TV
          </LinkButton>
        )}
      </header>

      {control.status === "FINISHED" && (
        <Card className="p-6">
          <p className="font-semibold">
            Luta terminada: venceu {state.winner === "red" ? state.red.name : state.blue.name}
            {state.method && ` (${state.method})`}, {state.red.points}–{state.blue.points}.
          </p>
        </Card>
      )}

      {control.status !== "READY" && control.status !== "FINISHED" && (
        <Card className="p-6 text-sm text-muted">Esta luta ainda não tem os dois atletas definidos.</Card>
      )}

      {control.status === "READY" && (
        <div className="grid gap-6">
          <Card className="p-5">
            <ActionForm
              action={openScoreboardAction.bind(null, state.matchId)}
              submitLabel={control.isOpen ? "Mudar de área" : "Abrir placar"}
              submitVariant={control.isOpen ? "secondary" : "primary"}
              className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]"
            >
              <SelectField label="Área de luta" name="matId" defaultValue={control.matId ?? mats[0]?.id ?? ""}>
                {mats.map((mat) => (
                  <option key={mat.id} value={mat.id}>
                    {mat.name}
                  </option>
                ))}
                <option value="">Sem área (não aparece em ecrãs)</option>
              </SelectField>
              <SelectField
                label={rules.rounds ? `Duração de cada round (${rules.rounds} rounds)` : "Duração da luta"}
                name="durationSeconds"
                defaultValue={control.isOpen ? state.clock.durationSeconds : rules.defaultDuration}
                disabled={control.isOpen}
              >
                {rules.durations.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {formatDuration(seconds)}
                  </option>
                ))}
              </SelectField>
              {/* Um campo desativado não é enviado; a duração já definida segue por aqui. */}
              {control.isOpen && <input type="hidden" name="durationSeconds" value={state.clock.durationSeconds} />}
            </ActionForm>
          </Card>

          {control.isOpen && (
            <>
              <Card className="flex flex-wrap items-center justify-between gap-6 p-5">
                <LiveClock
                  clock={state.clock}
                  serverNow={state.serverNow}
                  className="text-7xl font-bold leading-none"
                />
                <ActionForm action={clockAction.bind(null, state.matchId)} className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    name="clock"
                    value={isRunning ? "pause" : "start"}
                    className={`${buttonClass("primary")} h-12 px-8 text-base`}
                  >
                    {isRunning ? "Pausar" : "Iniciar"}
                  </button>
                  <button type="submit" name="clock" value="reset" className={`${buttonClass("secondary")} h-12 text-base`}>
                    Repor tempo
                  </button>
                </ActionForm>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <CornerControl side="red" state={state} rules={rules} />
                <CornerControl side="blue" state={state} rules={rules} />
              </div>

              <Card className="p-5">
                <h2 className="mb-4 font-display text-xl font-bold uppercase leading-none">Terminar a luta</h2>
                <ActionForm
                  action={finishMatchAction.bind(null, state.matchId, deskPath)}
                  submitLabel="Terminar e gravar resultado"
                  className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]"
                >
                  <SelectField label="Vencedor" name="winner" defaultValue="" required>
                    <option value="" disabled>
                      Escolher…
                    </option>
                    <option value="red">{state.red.name} (vermelho)</option>
                    <option value="blue">{state.blue.name} (azul)</option>
                  </SelectField>
                  <SelectField label="Como terminou" name="method" defaultValue={rules.methods[0]}>
                    {rules.methods.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </SelectField>
                </ActionForm>
              </Card>
            </>
          )}
        </div>
      )}
    </>
  );
}

export default function ScoreboardControlPage({ params }: PageProps<"/manage/matches/[matchId]/scoreboard">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar placar…</p>}>
      <ScoreboardControl params={params} />
    </Suspense>
  );
}
