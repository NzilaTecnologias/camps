import Link from "next/link";
import { Suspense } from "react";
import { AdminHeader, pageOf, textOf } from "@/components/admin/parts";
import { DataTable } from "@/components/manage/parts";
import { Pager } from "@/components/pager";
import { Empty } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { listAudit, PAGE_SIZE } from "@/server/admin/data";
import { pageStaff } from "@/server/admin/session";

const inputClass = "h-10 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-primary";

function Target({ type, id }: { type: string | null; id: string | null }) {
  if (!type || !id) return <span className="text-muted">—</span>;
  if (type === "user") return <Link href={`/admin/users/${id}`} className="hover:text-primary">utilizador</Link>;
  if (type === "invoice") return <Link href={`/admin/invoices/${id}`} className="hover:text-primary">fatura</Link>;
  return <span className="text-muted">{type}</span>;
}

async function Audit({ searchParams }: { searchParams: PageProps<"/admin/audit">["searchParams"] }) {
  const staff = await pageStaff("audit");
  const params = await searchParams;
  const actor = textOf(params.actor);
  const action = textOf(params.action);
  const page = pageOf(params.page);
  const { total, entries } = await listAudit(staff, { actor, action }, page);
  return (
    <>
      <AdminHeader
        title="Registo de atividade"
        description="Tudo o que a equipa faz na administração, com data, autor e IP, incluindo entradas e tentativas falhadas. Não se pode apagar."
      />
      <form action="/admin/audit" className="mb-5 flex flex-wrap gap-2">
        <input name="actor" defaultValue={actor} placeholder="E-mail de quem fez" className={`${inputClass} w-64`} />
        <input name="action" defaultValue={action} placeholder="Ação (ex.: user., login)" className={`${inputClass} w-56`} />
        <button type="submit" className="h-10 rounded-full border border-line bg-surface px-4 text-sm font-semibold hover:border-foreground/40">
          Filtrar
        </button>
      </form>
      {entries.length === 0 ? (
        <Empty>Nada registado com estes filtros.</Empty>
      ) : (
        <DataTable head={["Quando", "Quem", "Ação", "Alvo", "Detalhes", "IP"]}>
          {entries.map((entry) => (
            <tr key={entry.id} className="align-top">
              <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDateTime(entry.createdAt)}</td>
              <td className="px-4 py-3">{entry.actorEmail}</td>
              <td className={`px-4 py-3 font-mono text-xs ${entry.action === "login.failed" ? "text-danger" : ""}`}>{entry.action}</td>
              <td className="px-4 py-3 text-xs">
                <Target type={entry.targetType} id={entry.targetId} />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-muted">{entry.details ? JSON.stringify(entry.details).slice(0, 160) : ""}</td>
              <td className="px-4 py-3 font-mono text-xs text-muted">{entry.ip}</td>
            </tr>
          ))}
        </DataTable>
      )}
      <Pager basePath="/admin/audit" params={{ actor, action }} page={page} totalPages={Math.ceil(total / PAGE_SIZE)} />
    </>
  );
}

export default function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Audit searchParams={searchParams} />
    </Suspense>
  );
}
