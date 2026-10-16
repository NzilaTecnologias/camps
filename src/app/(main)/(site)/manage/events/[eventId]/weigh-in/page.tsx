import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { Notice, SectionHeader } from "@/components/manage/parts";
import { Badge, Card, Empty, buttonClass } from "@/components/ui";
import { formatKg, formatWeight } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { listDivisionsSummary, listWeighIns } from "@/server/organizer";
import { clearWeighInAction, recordWeighInAction } from "../../../event-actions";

async function WeighIn({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ eventId }, query] = await Promise.all([params, searchParams]);
  const divisionId = typeof query.division === "string" ? query.division : "";
  const user = await requireUser();
  const [allDivisions, divisions] = await Promise.all([
    listDivisionsSummary(user.id, eventId),
    listWeighIns(user.id, eventId, divisionId || undefined),
  ]);
  const athletes = divisions.flatMap((division) => division.registrations);
  const weighed = athletes.filter((registration) => registration.weighIn).length;
  const failed = athletes.filter((registration) => registration.weighIn && !registration.weighIn.passed).length;

  return (
    <>
      <SectionHeader
        title="Pesagem"
        description="Escreva o peso de cada atleta confirmado. Fica aprovado se estiver dentro do limite da categoria; quem não passa fica fora da chave quando ela for gerada."
        actions={
          <AutoSubmitForm action={`/manage/events/${eventId}/weigh-in`}>
            <label>
              <span className="sr-only">Categoria</span>
              <select
                name="division"
                defaultValue={divisionId}
                className="h-10 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-primary"
              >
                <option value="">Todas as categorias</option>
                {allDivisions.map((division) => (
                  <option key={division.id} value={division.id}>
                    {division.name}
                  </option>
                ))}
              </select>
            </label>
          </AutoSubmitForm>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-surface px-5 py-4 text-sm">
        <span>
          <strong className="font-display text-2xl">{weighed}</strong>
          <span className="text-muted"> / {athletes.length} pesados</span>
        </span>
        <span className="h-2 min-w-32 flex-1 overflow-hidden rounded-full bg-foreground/8">
          <span
            className="block h-full rounded-full bg-success"
            style={{ width: `${athletes.length ? (weighed / athletes.length) * 100 : 0}%` }}
          />
        </span>
        {failed > 0 && <Badge tone="danger">{failed} fora do peso</Badge>}
      </div>

      {athletes.length === 0 ? (
        <Empty>Não há atletas confirmados {divisionId ? "nesta categoria" : "neste evento"}.</Empty>
      ) : (
        <div className="space-y-6">
          {divisions
            .filter((division) => division.registrations.length > 0)
            .map((division) => {
              const someFailed = division.registrations.some((registration) => registration.weighIn?.passed === false);
              return (
                <section key={division.id}>
                  <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                    <h3 className="font-semibold">{division.name}</h3>
                    <span className="text-sm text-muted">{formatWeight(division.maxWeightKg)}</span>
                  </div>
                  {division.bracket && someFailed && (
                    <div className="mb-3">
                      <Notice>
                        A chave desta categoria já foi gerada. Regere-a em Chaves para tirar quem não passou na pesagem.
                      </Notice>
                    </div>
                  )}
                  <Card className="divide-y divide-line">
                    {division.registrations.map((registration) => (
                      <div key={registration.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <div className="min-w-40 flex-1">
                          <p className="font-semibold">
                            {registration.athlete.firstName} {registration.athlete.lastName}
                          </p>
                          <p className="text-xs text-muted">{registration.athlete.academy?.name ?? "Sem academia"}</p>
                        </div>
                        {registration.weighIn && (
                          <Badge tone={registration.weighIn.passed ? "success" : "danger"}>
                            {formatKg(registration.weighIn.weightKg)} · {registration.weighIn.passed ? "aprovado" : "fora do peso"}
                          </Badge>
                        )}
                        <ActionForm action={recordWeighInAction.bind(null, registration.id)} className="flex items-center gap-2">
                          <label>
                            <span className="sr-only">Peso de {registration.athlete.firstName} em kg</span>
                            <input
                              name="weight"
                              inputMode="decimal"
                              placeholder="kg"
                              defaultValue={registration.weighIn ? registration.weighIn.weightKg.toString() : ""}
                              required
                              className="h-8 w-20 rounded-lg border border-line bg-surface px-2 text-sm tabular-nums outline-none focus:border-primary"
                            />
                          </label>
                          <button type="submit" className={buttonClass(registration.weighIn ? "secondary" : "primary", "sm")}>
                            {registration.weighIn ? "Corrigir" : "Pesar"}
                          </button>
                        </ActionForm>
                        {registration.weighIn && (
                          <ActionForm action={clearWeighInAction.bind(null, registration.id)}>
                            <button type="submit" className={buttonClass("ghost", "sm")} aria-label="Apagar pesagem">
                              Apagar
                            </button>
                          </ActionForm>
                        )}
                      </div>
                    ))}
                  </Card>
                </section>
              );
            })}
        </div>
      )}
    </>
  );
}

export default function WeighInPage({ params, searchParams }: PageProps<"/manage/events/[eventId]/weigh-in">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <WeighIn params={params} searchParams={searchParams} />
    </Suspense>
  );
}
