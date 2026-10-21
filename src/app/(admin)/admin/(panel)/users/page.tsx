import Link from "next/link";
import { Suspense } from "react";
import { AdminHeader, SearchBox, pageOf, textOf } from "@/components/admin/parts";
import { DataTable } from "@/components/manage/parts";
import { Pager } from "@/components/pager";
import { Badge, Empty } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/admin-permissions";
import { formatDate } from "@/lib/format";
import { listUsers, PAGE_SIZE } from "@/server/admin/data";
import { pageStaff } from "@/server/admin/session";

async function Users({ searchParams }: { searchParams: PageProps<"/admin/users">["searchParams"] }) {
  const staff = await pageStaff("users");
  const params = await searchParams;
  const q = textOf(params.q);
  const page = pageOf(params.page);
  const { total, users } = await listUsers(staff, q, page);
  return (
    <>
      <AdminHeader title="Utilizadores" description={`${total} contas${q ? ` com "${q}"` : ""}. Abra uma conta para a suspender, terminar sessões ou confirmar o e-mail.`} />
      <SearchBox action="/admin/users" q={q} placeholder="Nome ou e-mail" />
      {users.length === 0 ? (
        <Empty>Nenhuma conta encontrada.</Empty>
      ) : (
        <DataTable head={["Conta", "Criada", "Estado", "Inscrições", "Organizações"]}>
          {users.map((user) => (
            <tr key={user.id}>
              <td className="px-4 py-3">
                <Link href={`/admin/users/${user.id}`} className="font-semibold hover:text-primary">
                  {user.name}
                </Link>
                <p className="text-xs text-muted">{user.email}</p>
              </td>
              <td className="px-4 py-3 text-muted">{formatDate(user.createdAt)}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {user.suspendedAt ? <Badge tone="danger">Suspensa</Badge> : user.emailVerifiedAt ? <Badge tone="success">Ativa</Badge> : <Badge tone="warning">E-mail por confirmar</Badge>}
                  {user.role && <Badge tone="primary">{ROLE_LABEL[user.role]}</Badge>}
                </div>
              </td>
              <td className="px-4 py-3 tabular-nums">{user._count.registrations}</td>
              <td className="px-4 py-3 tabular-nums">{user._count.memberships}</td>
            </tr>
          ))}
        </DataTable>
      )}
      <Pager basePath="/admin/users" params={{ q }} page={page} totalPages={Math.ceil(total / PAGE_SIZE)} />
    </>
  );
}

export default function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Users searchParams={searchParams} />
    </Suspense>
  );
}
