import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { AdminHeader, SearchBox, pageOf, textOf } from "@/components/admin/parts";
import { Field } from "@/components/field";
import { DataTable, FilterTabs } from "@/components/manage/parts";
import { Pager } from "@/components/pager";
import { EventStatusBadge } from "@/components/status-badges";
import { Empty } from "@/components/ui";
import { can } from "@/lib/admin-permissions";
import { formatDate } from "@/lib/format";
import { listEvents, PAGE_SIZE } from "@/server/admin/data";
import { pageStaff } from "@/server/admin/session";
import { moderateEventAction } from "../../actions";

const STATUS_TABS = [
  { value: "", label: "Todos" },
  { value: "PUBLISHED", label: "Publicados" },
  { value: "DRAFT", label: "Rascunhos" },
  { value: "CANCELLED", label: "Cancelados" },
];

/** Despublicar ou cancelar, sempre com motivo; ou voltar a publicar. */
function Moderate({ event }: { event: { id: string; status: string } }) {
  if (event.status !== "PUBLISHED") {
    return (
      <ActionForm action={moderateEventAction.bind(null, event.id, "PUBLISHED")} submitLabel="Publicar" submitVariant="secondary">
        <input type="hidden" name="reason" value="" />
      </ActionForm>
    );
  }
  return (
    <details>
      <summary className="inline-flex h-8 cursor-pointer list-none items-center rounded-full border border-line px-3 text-xs font-semibold hover:border-foreground/40">
        Moderar
      </summary>
      <div className="mt-2 grid w-72 gap-2 rounded-lg border border-line bg-surface-2 p-3 text-left">
        <ActionForm action={moderateEventAction.bind(null, event.id, "DRAFT")} submitLabel="Despublicar" submitVariant="secondary" className="flex flex-col gap-2">
          <Field label="Motivo" name="reason" maxLength={300} required />
        </ActionForm>
        <ActionForm action={moderateEventAction.bind(null, event.id, "CANCELLED")} submitLabel="Cancelar evento" className="flex flex-col gap-2 border-t border-line pt-2">
          <Field label="Motivo do cancelamento" name="reason" maxLength={300} required />
          <p className="text-xs text-muted">O organizador continua responsável por reembolsar as inscrições pagas.</p>
        </ActionForm>
      </div>
    </details>
  );
}

async function Events({ searchParams }: { searchParams: PageProps<"/admin/events">["searchParams"] }) {
  const staff = await pageStaff("events");
  const params = await searchParams;
  const q = textOf(params.q);
  const status = textOf(params.status);
  const page = pageOf(params.page);
  const { total, events } = await listEvents(staff, q, status, page);
  const moderate = can(staff.role, "events.moderate");
  const tabHref = (value: string) => {
    const query = new URLSearchParams(Object.entries({ q, status: value }).filter(([, v]) => v));
    return `/admin/events${query.size ? `?${query}` : ""}`;
  };
  return (
    <>
      <AdminHeader title="Eventos" description="Todos os eventos da plataforma, em qualquer estado. Despublicar ou cancelar fica no registo de atividade com o motivo." />
      <FilterTabs tabs={STATUS_TABS.map((tab) => ({ href: tabHref(tab.value), label: tab.label, active: status === tab.value }))} />
      <SearchBox action="/admin/events" q={q} placeholder="Evento, cidade ou organização" hidden={{ status }} />
      {events.length === 0 ? (
        <Empty>Nenhum evento encontrado.</Empty>
      ) : (
        <DataTable head={["Evento", "Organização", "Data", "Inscritos", "Estado", ""]}>
          {events.map((event) => (
            <tr key={event.id} className="align-top">
              <td className="px-4 py-3">
                <Link href={`/events/${event.slug}`} className="font-semibold hover:text-primary">
                  {event.name}
                </Link>
                <p className="text-xs text-muted">
                  {event.sport}
                  {event.city && ` · ${event.city}`}
                </p>
              </td>
              <td className="px-4 py-3">{event.organizer.name}</td>
              <td className="px-4 py-3 text-muted">{formatDate(event.startsAt)}</td>
              <td className="px-4 py-3 tabular-nums">{event._count.registrations}</td>
              <td className="px-4 py-3">
                <EventStatusBadge status={event.status} />
              </td>
              <td className="px-4 py-3 text-right">{moderate && <Moderate event={event} />}</td>
            </tr>
          ))}
        </DataTable>
      )}
      <Pager basePath="/admin/events" params={{ q, status }} page={page} totalPages={Math.ceil(total / PAGE_SIZE)} />
    </>
  );
}

export default function AdminEventsPage({ searchParams }: PageProps<"/admin/events">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Events searchParams={searchParams} />
    </Suspense>
  );
}
