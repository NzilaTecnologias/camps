import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { DataTable, SectionHeader } from "@/components/manage/parts";
import { PlanGate } from "@/components/manage/premium-gate";
import { Card, Empty, buttonClass } from "@/components/ui";
import { planActive } from "@/lib/federation-rules";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { getFederationOverview } from "@/server/federations";
import { addFederationOrganizerAction, removeFederationOrganizerAction } from "../../../federation-actions";

async function Organizers({ params }: { params: Promise<{ federationId: string }> }) {
  const { federationId } = await params;
  const user = await requireUser();
  const { federation, organizers } = await getFederationOverview(user.id, federationId);
  return (
    <>
      <SectionHeader
        title="Organizações"
        description="Ligas, clubes e academias que organizam torneios sob a federação. Depois de autorizadas, escolhem a federação na Página do evento de cada torneio."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {organizers.length === 0 ? (
          <Empty>Ainda não autorizou nenhuma organização.</Empty>
        ) : (
          <DataTable head={["Organização", "Identificador", "Desde", ""]}>
            {organizers.map(({ organizer, createdAt }) => (
              <tr key={organizer.id}>
                <td className="px-4 py-3 font-semibold">{organizer.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{organizer.slug}</td>
                <td className="px-4 py-3 text-muted">{formatDate(createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <ActionForm action={removeFederationOrganizerAction.bind(null, federation.id, organizer.id)}>
                    <button type="submit" className={buttonClass("ghost", "sm")}>
                      Retirar
                    </button>
                  </ActionForm>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
        <Card className="p-5">
          <h3 className="mb-1 font-display text-xl font-bold uppercase leading-none">Autorizar organização</h3>
          <p className="mb-4 text-sm text-muted">Peça o identificador à organização: aparece no painel dela, por baixo do nome.</p>
          <PlanGate allowed={planActive(federation)} plan="ativo">
            <ActionForm action={addFederationOrganizerAction.bind(null, federation.id)} submitLabel="Autorizar" className="flex flex-col gap-4">
              <Field label="Identificador" name="organizerSlug" placeholder="liga-camps" autoComplete="off" required />
            </ActionForm>
          </PlanGate>
        </Card>
      </div>
    </>
  );
}

export default function FederationOrganizersPage({ params }: PageProps<"/manage/federations/[federationId]/organizers">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Organizers params={params} />
    </Suspense>
  );
}
