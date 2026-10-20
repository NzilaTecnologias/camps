import { connection } from "next/server";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { DataTable, SectionHeader } from "@/components/manage/parts";
import { PlanGate } from "@/components/manage/premium-gate";
import { Badge, Card, Empty, buttonClass } from "@/components/ui";
import { planActive } from "@/lib/federation-rules";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { getFederationOverview } from "@/server/federations";
import { affiliateAcademyAction, removeAcademyAction } from "../../../federation-actions";

async function Academies({ params }: { params: Promise<{ federationId: string }> }) {
  const { federationId } = await params;
  const user = await requireUser();
  const { federation, academies } = await getFederationOverview(user.id, federationId);
  await connection();
  const now = new Date();
  return (
    <>
      <SectionHeader
        title="Academias filiadas"
        description="Academias com filiação na federação e a validade de cada uma. Para renovar, volte a filiar com a nova data. Aparecem na página pública da federação."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {academies.length === 0 ? (
          <Empty>Ainda não há academias filiadas.</Empty>
        ) : (
          <DataTable head={["Academia", "Válida até", "Estado", ""]}>
            {academies.map(({ academy, validUntil }) => (
              <tr key={academy.id}>
                <td className="px-4 py-3 font-semibold">{academy.name}</td>
                <td className="px-4 py-3 text-muted">{formatDate(validUntil)}</td>
                <td className="px-4 py-3">{validUntil >= now ? <Badge tone="success">Em dia</Badge> : <Badge tone="warning">Expirada</Badge>}</td>
                <td className="px-4 py-3 text-right">
                  <ActionForm action={removeAcademyAction.bind(null, federation.id, academy.id)}>
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
          <h3 className="mb-4 font-display text-xl font-bold uppercase leading-none">Filiar academia</h3>
          <PlanGate allowed={planActive(federation)} plan="ativo">
            <ActionForm action={affiliateAcademyAction.bind(null, federation.id)} submitLabel="Filiar" className="flex flex-col gap-4">
              <Field label="Academia" name="academyName" placeholder="Kimura Luanda" required />
              <Field label="Válida até" name="validUntil" type="date" required />
            </ActionForm>
          </PlanGate>
        </Card>
      </div>
    </>
  );
}

export default function FederationAcademiesPage({ params }: PageProps<"/manage/federations/[federationId]/academies">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Academies params={params} />
    </Suspense>
  );
}
