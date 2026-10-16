import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { DataTable, FilterTabs, SectionHeader } from "@/components/manage/parts";
import { RegistrationStatusBadge } from "@/components/status-badges";
import { Badge, Empty, Icon, buttonClass } from "@/components/ui";
import { formatKg, formatMoney } from "@/lib/format";
import { requireUser } from "@/server/auth";
import {
  countRegistrationsByStatus,
  getEventWorkspace,
  listDivisionsSummary,
  listEventRegistrations,
} from "@/server/organizer";
import { cancelRegistrationAction } from "../../../event-actions";

const TABS = [
  { key: "ALL", label: "Todas" },
  { key: "PAID", label: "Confirmadas" },
  { key: "INCOMPLETE", label: "Por pagar" },
  { key: "CANCELLED", label: "Canceladas" },
] as const;

const param = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

async function Registrations({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ eventId }, query] = await Promise.all([params, searchParams]);
  const status = param(query.status);
  const divisionId = param(query.division);
  const q = param(query.q);
  const user = await requireUser();
  const [event, counts, divisions, registrations] = await Promise.all([
    getEventWorkspace(user.id, eventId),
    countRegistrationsByStatus(user.id, eventId),
    listDivisionsSummary(user.id, eventId),
    listEventRegistrations(user.id, eventId, { status, divisionId, q }),
  ]);
  if (!event) return null;
  const base = `/manage/events/${event.id}/registrations`;

  const hrefFor = (nextStatus: string) => {
    const search = new URLSearchParams();
    if (nextStatus !== "ALL") search.set("status", nextStatus);
    if (divisionId) search.set("division", divisionId);
    if (q) search.set("q", q);
    const text = search.toString();
    return text ? `${base}?${text}` : base;
  };

  return (
    <>
      <SectionHeader
        title="Inscrições"
        description="Todas as inscrições do evento. Uma inscrição paga cancela-se reembolsando o pagamento; as restantes cancelam-se aqui."
      />

      <FilterTabs
        tabs={TABS.map((tab) => ({
          href: hrefFor(tab.key),
          label: tab.label,
          count: counts[tab.key],
          active: (status || "ALL") === tab.key,
        }))}
      />

      <AutoSubmitForm action={base} className="mb-5 flex flex-wrap items-end gap-3">
        {status && <input type="hidden" name="status" value={status} />}
        <label className="min-w-56 flex-1">
          <span className="sr-only">Procurar</span>
          <span className="relative block">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Atleta, academia ou e-mail"
              className="h-10 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </span>
        </label>
        <label>
          <span className="sr-only">Categoria</span>
          <select
            name="division"
            defaultValue={divisionId}
            className="h-10 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-primary"
          >
            <option value="">Todas as categorias</option>
            {divisions.map((division) => (
              <option key={division.id} value={division.id}>
                {division.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonClass("secondary")}>
          Filtrar
        </button>
        {(q || divisionId) && (
          <Link href={status ? `${base}?status=${status}` : base} className="text-sm text-muted hover:text-foreground">
            Limpar
          </Link>
        )}
      </AutoSubmitForm>

      {registrations.length === 0 ? (
        <Empty>Nenhuma inscrição com estes filtros.</Empty>
      ) : (
        <DataTable head={["Atleta", "Categoria", "Responsável", "Valor", "Pesagem", "Estado", ""]}>
          {registrations.map((registration) => {
            const payment = registration.payments[0];
            const paidOnline = payment?.status === "SUCCEEDED";
            return (
              <tr key={registration.id} className="align-top transition-colors hover:bg-surface-2">
                <td className="px-4 py-3">
                  <p className="font-semibold">
                    {registration.athlete.firstName} {registration.athlete.lastName}
                  </p>
                  <p className="text-xs text-muted">{registration.athlete.academy?.name ?? "Sem academia"}</p>
                </td>
                <td className="px-4 py-3 text-muted">{registration.division.name}</td>
                <td className="px-4 py-3">
                  <p>{registration.registeredBy.name}</p>
                  <p className="text-xs text-muted">{registration.registeredBy.email}</p>
                </td>
                <td className="px-4 py-3 tabular-nums">
                  <p className="font-semibold">
                    {registration.priceCents === 0 ? "Grátis" : formatMoney(registration.priceCents, event.currency)}
                  </p>
                  {registration.discountCents > 0 && (
                    <p className="text-xs text-success">
                      −{formatMoney(registration.discountCents, event.currency)}
                      {registration.coupon && ` · ${registration.coupon.code}`}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  {registration.weighIn ? (
                    <Badge tone={registration.weighIn.passed ? "success" : "danger"}>
                      {formatKg(registration.weighIn.weightKg)}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <RegistrationStatusBadge status={registration.status} />
                  {payment?.refund && (
                    <p className="mt-1 text-xs text-muted">
                      Reembolso {payment.refund.status === "PENDING" ? "em curso" : payment.refund.status === "FAILED" ? "falhou" : "feito"}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {registration.status !== "CANCELLED" &&
                    (paidOnline ? (
                      <Link
                        href={`/manage/events/${event.id}/payments#pagamento-${payment.id}`}
                        className={buttonClass("secondary", "sm")}
                      >
                        Reembolsar
                      </Link>
                    ) : (
                      <ActionForm action={cancelRegistrationAction.bind(null, registration.id)}>
                        <button type="submit" className={buttonClass("ghost", "sm")}>
                          Cancelar
                        </button>
                      </ActionForm>
                    ))}
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
      {registrations.length === 300 && (
        <p className="mt-3 text-sm text-muted">A mostrar as 300 mais recentes. Use os filtros para encontrar outras.</p>
      )}
    </>
  );
}

export default function RegistrationsPage({ params, searchParams }: PageProps<"/manage/events/[eventId]/registrations">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar inscrições…</p>}>
      <Registrations params={params} searchParams={searchParams} />
    </Suspense>
  );
}
