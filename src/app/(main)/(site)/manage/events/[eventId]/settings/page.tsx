import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField, TextAreaField } from "@/components/field";
import { SectionHeader } from "@/components/manage/parts";
import { LocationPicker } from "@/components/map/location-picker";
import { Card } from "@/components/ui";
import { toDateInput } from "@/lib/format";
import { cityCenter } from "@/lib/geo";
import { SPORTS } from "@/lib/sports";
import { requireUser } from "@/server/auth";
import { getEventWorkspace } from "@/server/organizer";
import { cancelEventAction, updateEventSettingsAction } from "../../../event-actions";

function FormBlock({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-4 border-b border-line pb-8 last:border-0 md:grid-cols-[14rem_minmax(0,1fr)]">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

async function Settings({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await requireUser();
  const event = await getEventWorkspace(user.id, eventId);
  if (!event) return null;

  return (
    <>
      <SectionHeader
        title="Página do evento"
        description="O que aparece na página pública: nome, modalidade, datas, local e apresentação. As alterações ficam visíveis assim que gravar."
      />

      <Card className="p-6">
        <ActionForm
          action={updateEventSettingsAction.bind(null, event.id)}
          submitLabel="Guardar alterações"
          className="flex flex-col gap-8"
        >
          <FormBlock title="Apresentação" description="Nome, modalidade e o texto que convida os atletas.">
            <div className="sm:col-span-2">
              <Field label="Nome do evento" name="name" defaultValue={event.name} maxLength={120} required />
            </div>
            <div className="sm:col-span-2">
              <SelectField label="Modalidade" name="sport" defaultValue={event.sport} required>
                {SPORTS.map((sport) => (
                  <option key={sport.name} value={sport.name}>
                    {sport.name}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="sm:col-span-2">
              <TextAreaField
                label="Descrição"
                name="description"
                defaultValue={event.description ?? ""}
                maxLength={5000}
                placeholder="Regras, horários, prémios, contactos…"
              />
            </div>
          </FormBlock>

          <FormBlock title="Datas" description="Dias da prova e janela de inscrições online.">
            <Field label="Primeiro dia" name="date" type="date" defaultValue={toDateInput(event.startsAt)} required />
            <Field label="Último dia" name="endDate" type="date" defaultValue={toDateInput(event.endsAt)} />
            <Field
              label="Inscrições abrem"
              name="registrationOpensOn"
              type="date"
              defaultValue={toDateInput(event.registrationOpensAt)}
              required
            />
            <Field
              label="Inscrições fecham"
              name="registrationClosesOn"
              type="date"
              defaultValue={toDateInput(event.registrationClosesAt)}
              required
            />
          </FormBlock>

          <FormBlock title="Local" description="Onde decorre. Marque o ponto exato no mapa para aparecer no mapa de eventos.">
            <Field label="Pavilhão ou ginásio" name="venue" defaultValue={event.venue ?? ""} />
            <Field label="Cidade" name="city" defaultValue={event.city ?? ""} />
            <div className="sm:col-span-2">
              <LocationPicker
                initial={event.latitude !== null && event.longitude !== null ? { lat: event.latitude, lng: event.longitude } : null}
                center={cityCenter(event.city)}
              />
            </div>
          </FormBlock>
        </ActionForm>
      </Card>

      {event.status !== "CANCELLED" && (
        <Card className="mt-8 border-danger/40 p-6">
          <h3 className="font-display text-xl font-bold uppercase leading-none text-danger">Cancelar evento</h3>
          <p className="mt-2 mb-4 max-w-2xl text-sm text-muted">
            O evento sai da lista pública e deixa de aceitar inscrições. Os pagamentos já feitos não são devolvidos
            automaticamente: reembolse-os em Pagamentos e reembolsos.
          </p>
          <ActionForm
            action={cancelEventAction.bind(null, event.id)}
            submitLabel="Cancelar evento"
            submitVariant="secondary"
            className="flex max-w-sm flex-col gap-3"
          >
            <Field label="Escreva CANCELAR para confirmar" name="confirm" autoComplete="off" required />
          </ActionForm>
        </Card>
      )}
    </>
  );
}

export default function EventSettingsPage({ params }: PageProps<"/manage/events/[eventId]/settings">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Settings params={params} />
    </Suspense>
  );
}
