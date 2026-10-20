import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField, TextAreaField } from "@/components/field";
import { SectionHeader } from "@/components/manage/parts";
import { Card } from "@/components/ui";
import { SPORTS } from "@/lib/sports";
import { requireUser } from "@/server/auth";
import { getFederationWorkspace } from "@/server/federations";
import { updateFederationSettingsAction } from "../../../federation-actions";

async function Settings({ params }: { params: Promise<{ federationId: string }> }) {
  const { federationId } = await params;
  const user = await requireUser();
  const federation = await getFederationWorkspace(user.id, federationId);
  if (!federation) return null;
  return (
    <>
      <SectionHeader title="Página da federação" description="O que aparece em /f/ na página pública: nome, modalidade, apresentação e a cor da marca." />
      <Card className="max-w-2xl p-6">
        <ActionForm action={updateFederationSettingsAction.bind(null, federation.id)} submitLabel="Guardar" className="flex flex-col gap-4">
          <Field label="Nome" name="name" defaultValue={federation.name} maxLength={120} required />
          <SelectField label="Modalidade" name="sport" defaultValue={federation.sport}>
            {SPORTS.map((sport) => (
              <option key={sport.name} value={sport.name}>
                {sport.name}
              </option>
            ))}
          </SelectField>
          <TextAreaField label="Apresentação" name="description" defaultValue={federation.description ?? ""} maxLength={3000} />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Cor da marca</span>
            <input type="color" name="color" defaultValue={federation.color} className="h-10 w-20 cursor-pointer rounded-lg border border-line bg-surface" />
          </label>
        </ActionForm>
      </Card>
    </>
  );
}

export default function FederationSettingsPage({ params }: PageProps<"/manage/federations/[federationId]/settings">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Settings params={params} />
    </Suspense>
  );
}
