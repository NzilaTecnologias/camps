import { connection } from "next/server";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { Field } from "@/components/field";
import { DataTable, SectionHeader } from "@/components/manage/parts";
import { Badge, Empty, buttonClass } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { listFederationMembers } from "@/server/federations";
import { refundMembershipAction } from "../../../federation-actions";

const PROVIDER_LABEL = { MULTICAIXA_EXPRESS: "Multicaixa Express", PAYPAL: "PayPal", SIMULATOR: "Simulador" } as const;

type Member = Awaited<ReturnType<typeof listFederationMembers>>[number];

function RefundForm({ payment }: { payment: Member["payments"][number] }) {
  return (
    <details>
      <summary className="inline-flex h-8 cursor-pointer list-none items-center rounded-full border border-line px-3 text-xs font-semibold hover:border-foreground/40">
        Reembolsar
      </summary>
      <div className="mt-3 w-72 rounded-lg border border-line bg-surface-2 p-3 text-left">
        <ActionForm
          action={refundMembershipAction.bind(null, payment.id)}
          submitLabel={`Devolver ${formatMoney(payment.amountCents, "AOA")}`}
          className="flex flex-col gap-3"
        >
          <Field label="Motivo" name="reason" placeholder="Desistência, erro, duplicado…" maxLength={300} required />
          <fieldset className="space-y-2 text-sm">
            <legend className="mb-1 font-medium">Como devolver</legend>
            <label className="flex items-start gap-2">
              <input type="radio" name="manual" value="0" defaultChecked className="mt-1" />
              <span>Pelo {PROVIDER_LABEL[payment.provider]}, para a conta de onde veio</span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name="manual" value="1" className="mt-1" />
              <span>Já devolvi fora da plataforma (numerário, transferência)</span>
            </label>
          </fieldset>
          <p className="text-xs text-muted">A filiação é cancelada quando a devolução se confirma.</p>
        </ActionForm>
      </div>
    </details>
  );
}

async function Members({
  params,
  searchParams,
}: {
  params: Promise<{ federationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ federationId }, query] = await Promise.all([params, searchParams]);
  const q = typeof query.q === "string" ? query.q : "";
  const user = await requireUser();
  const members = await listFederationMembers(user.id, federationId, q);
  await connection();
  const now = new Date();
  return (
    <>
      <SectionHeader
        title="Atletas filiados"
        description="Filiações individuais pagas, por pagar e reembolsadas. Uma filiação conta como em dia até à data de validade. Um reembolso devolve a quota inteira e cancela a filiação."
      />
      <AutoSubmitForm action={`/manage/federations/${federationId}/members`} className="mb-5 flex gap-3">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Nome do atleta"
          className="h-10 w-full max-w-sm rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-primary"
        />
        <button type="submit" className={buttonClass("secondary")}>
          Procurar
        </button>
      </AutoSubmitForm>
      {members.length === 0 ? (
        <Empty>{q ? "Nenhum atleta com esse nome." : "Ainda não há atletas filiados."}</Empty>
      ) : (
        <DataTable head={["Atleta", "Plano", "Quota", "Validade", "Estado", ""]}>
          {members.map((member) => {
            const current = member.status === "ACTIVE" && member.validUntil !== null && member.validUntil >= now;
            const payment = member.payments[0];
            const refund = payment?.refund;
            const canRefund = payment?.status === "SUCCEEDED" && (!refund || refund.status === "FAILED");
            return (
              <tr key={member.id} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-semibold">
                    {member.athlete.firstName} {member.athlete.lastName}
                  </p>
                  <p className="text-xs text-muted">{member.athlete.academy?.name ?? "Sem academia"}</p>
                </td>
                <td className="px-4 py-3">{member.plan.name}</td>
                <td className="px-4 py-3 tabular-nums">
                  {formatMoney(member.priceCents, "AOA")}
                  {payment && <p className="text-xs text-muted">{PROVIDER_LABEL[payment.provider]}</p>}
                </td>
                <td className="px-4 py-3 text-muted">{member.validUntil ? formatDate(member.validUntil) : "—"}</td>
                <td className="px-4 py-3">
                  {payment?.status === "REFUNDED" ? (
                    <Badge>Reembolsada</Badge>
                  ) : refund?.status === "PENDING" ? (
                    <Badge tone="warning">Reembolso em curso</Badge>
                  ) : current ? (
                    <Badge tone="success">Em dia</Badge>
                  ) : member.status === "PENDING" ? (
                    <Badge tone="warning">Por pagar</Badge>
                  ) : (
                    <Badge>Expirada</Badge>
                  )}
                  {refund && (
                    <div className="mt-1 max-w-48 text-xs text-muted">
                      {refund.status === "FAILED" ? (
                        <p className="text-danger">Reembolso falhou: {refund.failureReason}</p>
                      ) : (
                        <p>
                          {refund.manual ? "Devolvido fora da plataforma" : "Devolvido pelo provedor"} · {refund.reason}
                        </p>
                      )}
                      <p>por {refund.requestedBy.name}</p>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">{canRefund && <RefundForm payment={payment} />}</td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </>
  );
}

export default function FederationMembersPage({ params, searchParams }: PageProps<"/manage/federations/[federationId]/members">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Members params={params} searchParams={searchParams} />
    </Suspense>
  );
}
