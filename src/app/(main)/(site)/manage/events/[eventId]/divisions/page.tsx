import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/field";
import { DataTable, NoAccess, SectionHeader } from "@/components/manage/parts";
import { Badge, Card, Empty, Icon } from "@/components/ui";
import { BRACKET_TYPE_LABEL, formatMoney, formatWeight } from "@/lib/format";
import { canOrganizer } from "@/lib/organizer-permissions";
import { requireUser } from "@/server/auth";
import { getEventWorkspace, listDivisionsSummary } from "@/server/organizer";
import { createDivisionAction } from "../../../actions";

async function Divisions({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await requireUser();
  const [event, divisions] = await Promise.all([getEventWorkspace(user.id, eventId), listDivisionsSummary(user.id, eventId)]);
  if (!event) return null;
  if (!canOrganizer(event.role, "event")) return <NoAccess />;

  return (
    <>
      <SectionHeader
        title="Categorias"
        description="Cada categoria junta sexo, faixa etária, faixa e peso, com o preço da inscrição. Abra uma categoria para ver a chave e inscrever atletas à mão."
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {divisions.length === 0 ? (
          <Empty>Nenhuma categoria ainda. Adicione a primeira no formulário.</Empty>
        ) : (
          <DataTable head={["Categoria", "Peso", "Inscritos", "Chave", "Preço", ""]}>
            {divisions.map((division) => (
              <tr key={division.id} className="transition-colors hover:bg-surface-2">
                <td className="px-4 py-3">
                  <Link href={`/manage/events/${event.id}/divisions/${division.id}`} className="font-semibold hover:text-primary">
                    {division.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{formatWeight(division.maxWeightKg)}</td>
                <td className="px-4 py-3 tabular-nums">{division._count.registrations}</td>
                <td className="px-4 py-3">
                  {division.bracket ? (
                    <Badge tone="primary">{BRACKET_TYPE_LABEL[division.bracket.type]}</Badge>
                  ) : (
                    <Badge>sem chave</Badge>
                  )}
                </td>
                <td className="px-4 py-3 font-semibold tabular-nums">
                  {division.priceCents === 0 ? "Grátis" : formatMoney(division.priceCents, event.currency)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/manage/events/${event.id}/divisions/${division.id}`}
                    aria-label={`Abrir ${division.name}`}
                    className="inline-flex text-muted hover:text-primary"
                  >
                    <Icon name="chevron-right" className="h-5 w-5" />
                  </Link>
                </td>
              </tr>
            ))}
          </DataTable>
        )}

        <Card className="p-5">
          <h3 className="mb-4 font-display text-xl font-bold uppercase leading-none">Nova categoria</h3>
          <ActionForm action={createDivisionAction.bind(null, event.id)} submitLabel="Adicionar categoria" className="flex flex-col gap-4">
            <SelectField label="Sexo" name="gender" required>
              <option value="MALE">Masculino</option>
              <option value="FEMALE">Feminino</option>
            </SelectField>
            <Field label="Faixa etária" name="ageGroup" defaultValue="Adulto" required />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Faixa" name="belt" placeholder="Azul" required />
              <Field label="Peso" name="weightClass" placeholder="Leve" required />
            </div>
            <Field label="Peso máximo em kg (vazio = sem limite)" name="maxWeightKg" inputMode="decimal" />
            <Field label={`Preço da inscrição (${event.currency})`} name="price" inputMode="decimal" defaultValue="0" />
          </ActionForm>
        </Card>
      </div>
    </>
  );
}

export default function DivisionsPage({ params }: PageProps<"/manage/events/[eventId]/divisions">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Divisions params={params} />
    </Suspense>
  );
}
