import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { SelectField } from "@/components/field";
import { DataTable, SectionHeader } from "@/components/manage/parts";
import { Badge, Card, Empty, LinkButton, buttonClass } from "@/components/ui";
import { BRACKET_TYPE_LABEL } from "@/lib/format";
import { canOrganizer } from "@/lib/organizer-permissions";
import { requireUser } from "@/server/auth";
import { getEventWorkspace, listDivisionsSummary } from "@/server/organizer";
import { generateBracketAction } from "../../../actions";
import { generateMissingBracketsAction } from "../../../event-actions";

function TypeSelect({ defaultValue = "SINGLE_ELIMINATION" }: { defaultValue?: string }) {
  return (
    <select
      name="type"
      defaultValue={defaultValue}
      aria-label="Tipo de chave"
      className="h-8 rounded-lg border border-line bg-surface px-2 text-xs outline-none focus:border-primary"
    >
      {Object.entries(BRACKET_TYPE_LABEL).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}

async function Brackets({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await requireUser();
  const [event, divisions] = await Promise.all([getEventWorkspace(user.id, eventId), listDivisionsSummary(user.id, eventId)]);
  if (!event) return null;
  const manages = canOrganizer(event.role, "event");
  const missing = divisions.filter((division) => !division.bracket).length;

  return (
    <>
      <SectionHeader
        title="Chaves"
        description="O chaveamento usa os atletas confirmados que não chumbaram na pesagem, separa colegas da mesma academia na primeira ronda e dá passagem direta quando o número não fecha. Uma chave pode ser regerada até à primeira luta terminar."
      />

      {manages && divisions.length > 0 && missing > 0 && (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="font-semibold">
              {missing} {missing === 1 ? "categoria ainda não tem" : "categorias ainda não têm"} chave
            </p>
            <p className="text-sm text-muted">Gera todas de uma vez; as que têm menos de dois atletas aptos ficam de fora.</p>
          </div>
          <ActionForm action={generateMissingBracketsAction.bind(null, eventId)} className="flex flex-wrap items-center gap-2">
            <SelectField label="Tipo" name="type" defaultValue="SINGLE_ELIMINATION">
              {Object.entries(BRACKET_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            <button type="submit" className={`${buttonClass("primary")} self-end`}>
              Gerar chaves em falta
            </button>
          </ActionForm>
        </Card>
      )}

      {divisions.length === 0 ? (
        <Empty>Crie categorias primeiro.</Empty>
      ) : (
        <DataTable head={["Categoria", "Aptos", "Chave", "Progresso", ""]}>
          {divisions.map((division) => {
            const eligible = division.registrations.filter((registration) => registration.weighIn?.passed !== false).length;
            const out = division.registrations.length - eligible;
            const bracket = division.bracket;
            const finished = bracket?.matches.length ?? 0;
            const total = bracket?._count.matches ?? 0;
            const href = `/manage/events/${eventId}/divisions/${division.id}`;
            return (
              <tr key={division.id} className="transition-colors hover:bg-surface-2">
                <td className="px-4 py-3">
                  <Link href={href} className="font-semibold hover:text-primary">
                    {division.name}
                  </Link>
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {eligible}
                  {out > 0 && <span className="ml-2 text-xs text-danger">{out} fora do peso</span>}
                </td>
                <td className="px-4 py-3">
                  {bracket ? <Badge tone="primary">{BRACKET_TYPE_LABEL[bracket.type]}</Badge> : <Badge>sem chave</Badge>}
                </td>
                <td className="px-4 py-3">
                  {bracket ? (
                    bracket._count.placements > 0 ? (
                      <Badge tone="success">Pódio fechado</Badge>
                    ) : (
                      <span className="flex items-center gap-2 whitespace-nowrap text-xs text-muted">
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-foreground/8">
                          <span className="block h-full bg-primary" style={{ width: `${total ? (finished / total) * 100 : 0}%` }} />
                        </span>
                        {finished}/{total} lutas
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {manages && finished === 0 && eligible >= 2 && (
                      <ActionForm action={generateBracketAction.bind(null, division.id)} className="flex items-center gap-2">
                        <TypeSelect defaultValue={bracket?.type} />
                        <button type="submit" className={`${buttonClass(bracket ? "secondary" : "primary", "sm")} whitespace-nowrap`}>
                          {bracket ? "Regerar" : "Gerar"}
                        </button>
                      </ActionForm>
                    )}
                    {bracket && (
                      <LinkButton href={href} size="sm" variant="secondary" className="whitespace-nowrap">
                        Ver chave
                      </LinkButton>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </>
  );
}

export default function BracketsPage({ params }: PageProps<"/manage/events/[eventId]/brackets">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Brackets params={params} />
    </Suspense>
  );
}
